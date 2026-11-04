import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin(request: NextRequest): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !anonKey || !token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const service = getServiceSupabase();
  const { data: byAuth } = await service
    .from('users')
    .select('id, role')
    .eq('auth_id', data.user.id)
    .maybeSingle();
  const { data: byId } = byAuth
    ? { data: null }
    : await service.from('users').select('id, role').eq('id', data.user.id).maybeSingle();

  const row = byAuth || byId;
  if (!row || row.role !== 'admin') return null;
  return service;
}

function applyListFilters<T extends { eq: (c: string, v: string) => T; gte: (c: string, v: string) => T }>(
  query: T,
  status: string,
  method: string,
  from: string | null
) {
  let next = query;
  if (status !== 'all') next = next.eq('status', status);
  if (method !== 'all') next = next.eq('method', method);
  if (from) next = next.gte('created_at', from);
  return next;
}

export async function GET(request: NextRequest) {
  try {
    const service = await requireAdmin(request);
    if (!service) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get('status') || 'all';
    const method = request.nextUrl.searchParams.get('method') || 'all';
    const from = request.nextUrl.searchParams.get('from');
    const userId = request.nextUrl.searchParams.get('user_id');

    if (userId) {
      const [depositsResult, withdrawalsResult, userResult] = await Promise.all([
        service.from('deposits').select('id, amount, status').eq('user_id', userId),
        service.from('withdrawal_requests').select('id, amount, status').eq('user_id', userId),
        service.from('users').select('*').eq('id', userId).maybeSingle(),
      ]);
      const deps = depositsResult.data || [];
      const wds = withdrawalsResult.data || [];
      const paid = (row: { status?: string; amount?: number | string }) =>
        row.status === 'approved' || row.status === 'completed';
      return NextResponse.json({
        user: userResult.data,
        stats: {
          depositsCount: deps.length,
          withdrawalsCount: wds.length,
          totalDeposits: deps.filter(paid).reduce((sum, row) => sum + parseFloat(String(row.amount || 0)), 0),
          totalWithdrawals: wds.filter(paid).reduce((sum, row) => sum + parseFloat(String(row.amount || 0)), 0),
        },
      });
    }

    let depositsQuery = service.from('deposits').select('*').order('created_at', { ascending: false }).limit(200);
    let withdrawalsQuery = service
      .from('withdrawal_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    depositsQuery = applyListFilters(depositsQuery, status, method, from);
    withdrawalsQuery = applyListFilters(withdrawalsQuery, status, method, from);

    let approvedDeposits = service.from('deposits').select('amount').eq('status', 'approved');
    let approvedWithdrawals = service
      .from('withdrawal_requests')
      .select('amount')
      .in('status', ['approved', 'completed']);
    if (from) {
      approvedDeposits = approvedDeposits.gte('created_at', from);
      approvedWithdrawals = approvedWithdrawals.gte('created_at', from);
    }

    const [depositsResult, withdrawalsResult, approvedDepositsResult, approvedWithdrawalsResult, pendingDepositsResult, pendingWithdrawalsResult] =
      await Promise.all([
        depositsQuery,
        withdrawalsQuery,
        approvedDeposits,
        approvedWithdrawals,
        service.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        service.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

    if (depositsResult.error) {
      return NextResponse.json({ error: depositsResult.error.message }, { status: 500 });
    }
    if (withdrawalsResult.error) {
      return NextResponse.json({ error: withdrawalsResult.error.message }, { status: 500 });
    }

    const deposits = depositsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];
    const userIds = [...new Set([...deposits, ...withdrawals].map((row) => row.user_id).filter(Boolean))];
    const { data: users } = userIds.length
      ? await service.from('users').select('id, name, email').in('id', userIds)
      : { data: [] };
    const names = new Map((users || []).map((user) => [user.id, user.name || user.email || String(user.id).slice(0, 8)]));

    const withName = (row: { user_id?: string; first_name?: string; last_name?: string }) => ({
      ...row,
      user_name:
        names.get(row.user_id || '') ||
        (row.first_name ? `${row.first_name} ${row.last_name || ''}`.trim() : row.user_id?.slice(0, 8)),
    });

    const approvedDepositRows = approvedDepositsResult.data || [];
    const approvedWithdrawalRows = approvedWithdrawalsResult.data || [];

    return NextResponse.json({
      deposits: deposits.map(withName),
      withdrawals: withdrawals.map(withName),
      summary: {
        totalDeposits: approvedDepositRows.reduce((sum, row) => sum + parseFloat(String(row.amount || 0)), 0),
        totalWithdrawals: approvedWithdrawalRows.reduce((sum, row) => sum + parseFloat(String(row.amount || 0)), 0),
        depositCount: approvedDepositRows.length,
        withdrawalCount: approvedWithdrawalRows.length,
        pendingDeposits: pendingDepositsResult.count || 0,
        pendingWithdrawals: pendingWithdrawalsResult.count || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const service = await requireAdmin(request);
    if (!service) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    if (body.action !== 'reject-deposit' || !body.id) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const { error } = await service
      .from('deposits')
      .update({
        status: 'rejected',
        admin_notes: body.reason || 'Rejeitado pelo administrador',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
