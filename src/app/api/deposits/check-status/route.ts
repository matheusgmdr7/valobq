import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { approveDepositAndCreditBalance } from '@/lib/depositApproval';
import {
  checkPixStatusForGateway,
  isPaidStatusForGateway,
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

/**
 * Fallback de confirmação: consulta o gateway quando o webhook demora.
 * POST /api/deposits/check-status
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingDeposits, error: fetchError } = await supabase
      .from('deposits')
      .select('id, amount, status, transaction_id, method, created_at')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .not('transaction_id', 'is', null)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch deposits', details: fetchError.message }, { status: 500 });
    }

    const updated: Array<{ id: string; status: string; amount: number }> = [];

    if (pendingDeposits && pendingDeposits.length > 0) {
      const { data: gateways } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('type', 'pix')
        .eq('is_active', true)
        .limit(1);

      if (gateways && gateways.length > 0) {
        const gateway = gateways[0] as PaymentGatewayRow;

        for (const deposit of pendingDeposits) {
          if (!deposit.transaction_id) continue;

          try {
            const result = await checkPixStatusForGateway(gateway, deposit.transaction_id);
            if (!isPaidStatusForGateway(gateway, result.status)) continue;

            const approval = await approveDepositAndCreditBalance(supabase, deposit.id, {
              source: 'check-status',
              notes: `Aprovado via check-status. Status: "${result.status}". Data: ${new Date().toISOString()}`,
            });

            if (approval.ok && !approval.alreadyProcessed) {
              updated.push({
                id: deposit.id,
                status: 'approved',
                amount: parseFloat(deposit.amount.toString()),
              });
            }
          } catch {
            continue;
          }
        }
      }
    }

    const { data: approvedDeposits } = await supabase
      .from('deposits')
      .select('id, amount, status, transaction_id, created_at, approved_at')
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .gte('created_at', twentyFourHoursAgo)
      .order('approved_at', { ascending: false });

    return NextResponse.json({
      updated,
      approved: approvedDeposits || [],
      pending: (pendingDeposits || []).filter((d) => !updated.some((u) => u.id === d.id)),
      checked: pendingDeposits?.length || 0,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
