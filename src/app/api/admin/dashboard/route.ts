import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const service = await requireAdmin(request);
    if (!service) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const from = request.nextUrl.searchParams.get('from');
    const chartFrom = request.nextUrl.searchParams.get('chartFrom') || new Date(Date.now() - 30 * 86400000).toISOString();

    let approvedDeposits = service.from('deposits').select('amount').eq('status', 'approved');
    let approvedWithdrawals = service.from('withdrawal_requests').select('amount').in('status', ['approved', 'completed']);
    let newUsers = service.from('users').select('*', { count: 'exact', head: true });
    let recentDeposits = service
      .from('deposits')
      .select('id, user_id, amount, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    let recentWithdrawals = service
      .from('withdrawal_requests')
      .select('id, user_id, amount, status, created_at, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(5);

    if (from) {
      approvedDeposits = approvedDeposits.gte('created_at', from);
      approvedWithdrawals = approvedWithdrawals.gte('created_at', from);
      newUsers = newUsers.gte('created_at', from);
      recentDeposits = recentDeposits.gte('created_at', from);
      recentWithdrawals = recentWithdrawals.gte('created_at', from);
    }

    const [
      totalUsersResult,
      newUsersResult,
      approvedDepositsResult,
      approvedWithdrawalsResult,
      pendingDepositsResult,
      pendingWithdrawalsResult,
      depositsResult,
      withdrawalsResult,
      chartResult,
    ] = await Promise.all([
      service.from('users').select('*', { count: 'exact', head: true }),
      newUsers,
      approvedDeposits,
      approvedWithdrawals,
      service.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      service.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      recentDeposits,
      recentWithdrawals,
      service.from('users').select('created_at').gte('created_at', chartFrom).order('created_at', { ascending: true }),
    ]);

    const failed = [
      totalUsersResult,
      newUsersResult,
      approvedDepositsResult,
      approvedWithdrawalsResult,
      pendingDepositsResult,
      pendingWithdrawalsResult,
      depositsResult,
      withdrawalsResult,
      chartResult,
    ].find((result) => result.error);
    if (failed?.error) {
      return NextResponse.json({ error: failed.error.message }, { status: 500 });
    }

    const deposits = depositsResult.data || [];
    const withdrawals = withdrawalsResult.data || [];
    const userIds = [...new Set([...deposits, ...withdrawals].map((row) => row.user_id).filter(Boolean))];
    const { data: users } = userIds.length
      ? await service.from('users').select('id, name, email').in('id', userIds)
      : { data: [] };
    const names = new Map((users || []).map((user) => [user.id, user.name || user.email || String(user.id).slice(0, 8)]));

    const sum = (rows: { amount?: number | string | null }[]) =>
      rows.reduce((total, row) => total + parseFloat(String(row.amount || 0)), 0);

    return NextResponse.json({
      stats: {
        totalUsers: totalUsersResult.count || 0,
        newUsers: newUsersResult.count || 0,
        totalDeposits: sum(approvedDepositsResult.data || []),
        totalWithdrawals: sum(approvedWithdrawalsResult.data || []),
        depositCount: (approvedDepositsResult.data || []).length,
        withdrawalCount: (approvedWithdrawalsResult.data || []).length,
        pendingDeposits: pendingDepositsResult.count || 0,
        pendingWithdrawals: pendingWithdrawalsResult.count || 0,
      },
      userCreatedAt: (chartResult.data || []).map((row) => row.created_at),
      deposits: deposits.map((row) => ({ ...row, user_name: names.get(row.user_id) || row.user_id?.slice(0, 8) })),
      withdrawals: withdrawals.map((row) => ({ ...row, user_name: names.get(row.user_id) || row.user_id?.slice(0, 8) })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar o dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
