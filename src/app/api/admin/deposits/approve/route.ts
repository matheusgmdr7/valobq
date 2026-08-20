import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { approveDepositAndCreditBalance } from '@/lib/depositApproval';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, anonKey);
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Aprovação manual de depósito (fallback — fluxo principal é webhook). */
export async function POST(request: NextRequest) {
  try {
    const { deposit_id, admin_id } = await request.json();

    if (!deposit_id) {
      return NextResponse.json({ error: 'deposit_id required' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const result = await approveDepositAndCreditBalance(supabase, deposit_id, {
      source: 'admin',
      adminId: admin_id ?? undefined,
      notes: `Aprovado manualmente pelo admin. Data: ${new Date().toISOString()}`,
    });

    if (!result.ok && !result.alreadyProcessed) {
      return NextResponse.json({ error: result.error ?? 'Falha ao aprovar' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      deposit_id: result.depositId,
      amount: result.amount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
