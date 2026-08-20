import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { approveDepositAndCreditBalance } from '@/lib/depositApproval';

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

/**
 * Webhook endpoint para receber callbacks do HorsePay
 * POST /api/deposits/callback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const externalId = body.external_id || body.id || body.transaction_id || body.order_id || null;
    const rawStatus = (
      body.status?.toString() ||
      body.payment_status?.toString() ||
      body.status_pagamento?.toString() ||
      ''
    ).toLowerCase().trim();

    if (!externalId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    const isCompleted = [
      'concluida', 'completed', 'paid', 'pago', 'approved', 'settled', 'confirmed', 'success',
    ].includes(rawStatus) || body.status === 1;

    const isRejected = [
      'rejected', 'failed', 'cancelled', 'canceled', 'expired', 'recusada', 'expirada',
    ].includes(rawStatus);

    const supabase = getAdminSupabase();

    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('id, user_id, amount, status')
      .eq('transaction_id', externalId.toString())
      .single();

    if (fetchError || !deposit) {
      return NextResponse.json({ error: 'Deposit not found', external_id: externalId }, { status: 404 });
    }

    if (deposit.status === 'approved') {
      return NextResponse.json({ message: 'Already processed', deposit_id: deposit.id });
    }

    if (isCompleted && deposit.status === 'pending') {
      const result = await approveDepositAndCreditBalance(supabase, deposit.id, {
        source: 'webhook',
        notes: `Aprovado via webhook. Status: "${rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
      });

      if (!result.ok && !result.alreadyProcessed) {
        return NextResponse.json({ error: result.error ?? 'Failed to approve deposit' }, { status: 500 });
      }

      return NextResponse.json({
        message: result.alreadyProcessed ? 'Already processed' : 'Deposit approved',
        deposit_id: deposit.id,
      });
    }

    if (isRejected && deposit.status === 'pending') {
      await supabase
        .from('deposits')
        .update({
          status: 'rejected',
          admin_notes: `Rejeitado via webhook. Status: "${rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id)
        .eq('status', 'pending');

      return NextResponse.json({ message: 'Deposit rejected', deposit_id: deposit.id });
    }

    return NextResponse.json({
      message: 'Status noted',
      status_received: rawStatus,
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
