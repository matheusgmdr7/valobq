import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { approveDepositAndCreditBalance } from '@/lib/depositApproval';
import {
  decodeGatewayCredentials,
  parseWebhookForGateway,
  verifyWebhookForGateway,
  type PaymentGatewayRow,
} from '@/lib/paymentGateways';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmhna3FwcXNua2hld25tYXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzI3MzEsImV4cCI6MjA4MzkwODczMX0.Am-rYaY9wiIBbXAirbkZj0gau5kxR_Dx2QiMrQC2xns';
    return createClient(url, anonKey);
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findDepositByTransactionId(supabase: ReturnType<typeof getAdminSupabase>, externalId: string) {
  const { data, error } = await supabase
    .from('deposits')
    .select('id, user_id, amount, status')
    .eq('transaction_id', externalId)
    .single();

  if (!error && data) return data;

  const { data: byNotes } = await supabase
    .from('deposits')
    .select('id, user_id, amount, status')
    .ilike('admin_notes', `%${externalId}%`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return byNotes;
}

/**
 * Webhook endpoint genérico para callbacks de pagamento PIX
 * POST /api/deposits/callback?webhookSecret=...
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: gateways } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('type', 'pix')
      .eq('is_active', true);

    const activeGateways = (gateways || []) as PaymentGatewayRow[];
    if (activeGateways.length === 0) {
      return NextResponse.json({ error: 'No active gateway' }, { status: 503 });
    }

    const gateway =
      activeGateways.find((g) => verifyWebhookForGateway(g, rawBody, request.nextUrl.searchParams, request.headers)) ||
      activeGateways[0];

    if (!verifyWebhookForGateway(gateway, rawBody, request.nextUrl.searchParams, request.headers)) {
      console.warn('[Webhook] Falha na validação de segurança');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = parseWebhookForGateway(gateway, body);
    const creds = decodeGatewayCredentials(gateway);

    const externalId = parsed.externalId;
    if (!externalId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const deposit = await findDepositByTransactionId(supabase, externalId.toString());
    if (!deposit) {
      return NextResponse.json({ error: 'Deposit not found', external_id: externalId }, { status: 404 });
    }

    if (deposit.status === 'approved') {
      return NextResponse.json({ message: 'Already processed', deposit_id: deposit.id });
    }

    if (parsed.status === 'completed' && deposit.status === 'pending') {
      const result = await approveDepositAndCreditBalance(supabase, deposit.id, {
        source: 'webhook',
        notes: `Aprovado via webhook (${creds.provider}/${parsed.event}). Status: "${parsed.rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
      });

      if (!result.ok && !result.alreadyProcessed) {
        return NextResponse.json({ error: result.error ?? 'Failed to approve deposit' }, { status: 500 });
      }

      return NextResponse.json({
        message: result.alreadyProcessed ? 'Already processed' : 'Deposit approved',
        deposit_id: deposit.id,
      });
    }

    if (parsed.status === 'rejected' && deposit.status === 'pending') {
      await supabase
        .from('deposits')
        .update({
          status: 'rejected',
          admin_notes: `Rejeitado via webhook (${creds.provider}/${parsed.event}). Status: "${parsed.rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id)
        .eq('status', 'pending');

      return NextResponse.json({ message: 'Deposit rejected', deposit_id: deposit.id });
    }

    return NextResponse.json({
      message: 'Status noted',
      status_received: parsed.rawStatus,
      event: parsed.event,
      deposit_id: deposit.id,
    });
  } catch (error) {
    console.error('[Webhook] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'deposits/callback' });
}
