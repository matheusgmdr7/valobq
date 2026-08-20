import type { SupabaseClient } from '@supabase/supabase-js';

export type DepositApprovalSource = 'webhook' | 'check-status' | 'admin';

export interface ApproveDepositResult {
  ok: boolean;
  alreadyProcessed: boolean;
  depositId?: string;
  userId?: string;
  amount?: number;
  error?: string;
}

/**
 * Aprova depósito pendente e credita saldo real uma única vez.
 * Usa UPDATE ... WHERE status = 'pending' para evitar crédito duplicado
 * (webhook + polling + admin manual em paralelo).
 */
export async function approveDepositAndCreditBalance(
  supabase: SupabaseClient,
  depositId: string,
  options: { source: DepositApprovalSource; notes?: string; adminId?: string },
): Promise<ApproveDepositResult> {
  const notes =
    options.notes ??
    `Aprovado via ${options.source}. Data: ${new Date().toISOString()}`;

  const { data: updated, error: updateError } = await supabase
    .from('deposits')
    .update({
      status: 'approved',
      admin_notes: notes,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(options.adminId ? { approved_by: options.adminId } : {}),
    })
    .eq('id', depositId)
    .eq('status', 'pending')
    .select('id, user_id, amount')
    .maybeSingle();

  if (updateError) {
    return { ok: false, alreadyProcessed: false, error: updateError.message };
  }

  if (!updated) {
    const { data: existing } = await supabase
      .from('deposits')
      .select('id, status')
      .eq('id', depositId)
      .maybeSingle();

    return {
      ok: existing?.status === 'approved',
      alreadyProcessed: existing?.status === 'approved',
      depositId,
    };
  }

  const depositAmount = parseFloat(updated.amount.toString());
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('balance')
    .eq('id', updated.user_id)
    .single();

  if (userError || !userData) {
    return {
      ok: false,
      alreadyProcessed: false,
      depositId: updated.id,
      error: userError?.message ?? 'Usuário não encontrado',
    };
  }

  const newBalance =
    parseFloat(userData.balance?.toString() || '0') + depositAmount;

  const { error: balanceError } = await supabase
    .from('users')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', updated.user_id);

  if (balanceError) {
    return {
      ok: false,
      alreadyProcessed: false,
      depositId: updated.id,
      error: balanceError.message,
    };
  }

  return {
    ok: true,
    alreadyProcessed: false,
    depositId: updated.id,
    userId: updated.user_id,
    amount: depositAmount,
  };
}
