'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, Power, TrendingUp, TrendingDown, DollarSign, Users,
  Activity, ArrowUpRight, ArrowDownRight, Settings, BarChart3, Megaphone,
  Trophy, Newspaper, Calendar, MessageSquare, RefreshCw, Clock,
  UserPlus, Wallet, ArrowRight, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

type PeriodFilter = '7d' | '15d' | '30d' | '90d' | 'all';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  '7d': '7 dias',
  '15d': '15 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  'all': 'Todo período',
};

function getDateFrom(period: PeriodFilter): string | null {
  if (period === 'all') return null;
  const days = parseInt(period);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export default function AdminPage() {
  const router = useRouter();
  const [tradingEnabled, setTradingEnabled] = useState(true);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsers: 0,
    activeTrades: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositCount: 0,
    withdrawalCount: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });
  const [newUsersChart, setNewUsersChart] = useState<{ date: string; count: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadTradingStatus();
  }, []);

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadTradingStatus = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'trading_enabled')
        .single();
      if (!error && data) setTradingEnabled(data.value as boolean);
    } catch (error) {
      console.error('Erro ao carregar status de trading:', error);
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm(`Tem certeza que deseja ${tradingEnabled ? 'DESATIVAR' : 'ATIVAR'} todas as operações de trading?`)) return;
    setKillSwitchLoading(true);
    try {
      if (!supabase) {
        setTradingEnabled(!tradingEnabled);
        toast.success(`Trading ${!tradingEnabled ? 'ativado' : 'desativado'}!`);
        return;
      }
      const newStatus = !tradingEnabled;
      const { error: upsertError } = await supabase
        .from('platform_settings')
        .upsert({ key: 'trading_enabled', value: newStatus, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (upsertError) throw upsertError;
      await supabase.from('admin_logs').insert([{ admin_id: null, action: newStatus ? 'trading_enabled' : 'trading_disabled', entity_type: 'platform', details: { trading_enabled: newStatus } }]);
      setTradingEnabled(newStatus);
      toast.success(`Trading ${newStatus ? 'ativado' : 'DESATIVADO'} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao alterar status de trading:', error);
      toast.error(error.message || 'Erro ao alterar status');
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      if (!supabase) { setLoading(false); return; }

      const dateFrom = getDateFrom(period);

      // Total de usuários (sem filtro de período)
      const { count: totalUsers } = await supabase
        .from('users').select('*', { count: 'exact', head: true });

      // Novos usuários no período
      let newUsersQuery = supabase.from('users').select('*', { count: 'exact', head: true });
      if (dateFrom) newUsersQuery = newUsersQuery.gte('created_at', dateFrom);
      const { count: newUsers } = await newUsersQuery;

      // Trades ativos
      const { count: activeTrades } = await supabase
        .from('trades').select('*', { count: 'exact', head: true })
        .is('exit_price', null).is('result', null);

      // Depósitos concluídos (da tabela deposits)
      let depsQuery = supabase.from('deposits').select('amount').eq('status', 'approved');
      if (dateFrom) depsQuery = depsQuery.gte('created_at', dateFrom);
      const { data: depositsData } = await depsQuery;
      const totalDeposits = depositsData?.reduce((s, d) => s + parseFloat(d.amount?.toString() || '0'), 0) || 0;
      const depositCount = depositsData?.length || 0;

      // Saques processados (da tabela withdrawal_requests)
      let wdQuery = supabase.from('withdrawal_requests').select('amount').in('status', ['approved', 'completed']);
      if (dateFrom) wdQuery = wdQuery.gte('created_at', dateFrom);
      const { data: withdrawalsData } = await wdQuery;
      const totalWithdrawals = withdrawalsData?.reduce((s, w) => s + parseFloat(w.amount?.toString() || '0'), 0) || 0;
      const withdrawalCount = withdrawalsData?.length || 0;

      // Depósitos pendentes
      const { count: pendingDeposits } = await supabase
        .from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      // Saques pendentes
      const { count: pendingWithdrawals } = await supabase
        .from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setStats({
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        activeTrades: activeTrades || 0,
        totalDeposits,
        totalWithdrawals,
        depositCount,
        withdrawalCount,
        pendingDeposits: pendingDeposits || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
      });

      // Gráfico de novos usuários (últimos N dias)
      await loadNewUsersChart(dateFrom);
      await loadRecentActivity();
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadNewUsersChart = async (dateFrom: string | null) => {
    try {
      if (!supabase) return;
      const days = period === 'all' ? 30 : parseInt(period);
      const from = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString();

      const { data } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', from)
        .order('created_at', { ascending: true });

      if (!data) { setNewUsersChart([]); return; }

      const grouped: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        grouped[key] = 0;
      }
      data.forEach((u: any) => {
        const key = new Date(u.created_at).toISOString().slice(0, 10);
        if (grouped[key] !== undefined) grouped[key]++;
      });

      setNewUsersChart(Object.entries(grouped).map(([date, count]) => ({ date, count })));
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      if (!supabase) return;

      const { data: deposits } = await supabase
        .from('deposits')
        .select('id, amount, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, status, created_at, user_id, first_name, last_name')
        .order('created_at', { ascending: false })
        .limit(5);

      const combined = [
        ...(deposits || []).map((d: any) => ({ ...d, type: 'deposit' })),
        ...(withdrawals || []).map((w: any) => ({ ...w, type: 'withdrawal', userName: w.first_name ? `${w.first_name} ${w.last_name || ''}`.trim() : null })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

      const activity = combined.map((tx: any) => {
        const diffMs = Date.now() - new Date(tx.created_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        let timeStr = diffMins < 60 ? `${diffMins}min` : diffHours < 24 ? `${diffHours}h` : `${Math.floor(diffHours / 24)}d`;
        return {
          type: tx.type,
          user: tx.userName || tx.user_id?.slice(0, 8) || '—',
          amount: parseFloat(tx.amount?.toString() || '0'),
          status: tx.status,
          time: timeStr,
        };
      });
      setRecentActivity(activity);
    } catch (error) {
      console.error('Erro ao carregar atividades recentes:', error);
    }
  };

  const maxChartValue = Math.max(...newUsersChart.map(d => d.count), 1);

  const menuItems = [
    { id: 'finance', title: 'Gestão Financeira', icon: DollarSign, description: 'Depósitos, saques e transações', accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20', iconColor: 'text-emerald-400' },
    { id: 'payment-gateways', title: 'Gateways de Pagamento', icon: Wallet, description: 'Configurar APIs de pagamento', accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/20', iconColor: 'text-blue-400' },
    { id: 'users', title: 'Usuários e CRM', icon: Users, description: 'Gerenciar usuários, saldos e KYC', accent: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20', iconColor: 'text-indigo-400' },
    { id: 'trading-monitor', title: 'Monitor de Operações', icon: BarChart3, description: 'Trades ativos em tempo real', accent: 'from-purple-500/20 to-purple-500/5 border-purple-500/20', iconColor: 'text-purple-400' },
    { id: 'trading-config', title: 'Config. Trading', icon: Settings, description: 'Payout, ativos e horários', accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/20', iconColor: 'text-amber-400' },
    { id: 'chats', title: 'Chats e Suporte', icon: MessageSquare, description: 'Atender chamados', accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/20', iconColor: 'text-rose-400' },
  ];

  return (
    <div className="bg-[#0a0a0b] text-white min-h-screen">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4 sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard</h1>
            <p className="text-xs text-white/40 mt-0.5">Visão geral da plataforma</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Kill Switch */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              tradingEnabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${tradingEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              Trading {tradingEnabled ? 'Ativo' : 'Desativado'}
            </div>
            <button
              onClick={handleKillSwitch}
              disabled={killSwitchLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                tradingEnabled
                  ? 'border-white/10 bg-white/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/20'
                  : 'border-white/10 bg-white/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'
              } disabled:opacity-50`}
            >
              <Power className="w-3 h-3" />
              {killSwitchLoading ? '...' : tradingEnabled ? 'Desativar' : 'Ativar'}
            </button>
            <button onClick={() => router.push('/dashboard')} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/60 transition-all">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto">
        {/* Period Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/30" />
            <span className="text-xs text-white/40">Período:</span>
            <div className="relative">
              <button
                onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/80 hover:bg-white/10 transition-all"
              >
                {PERIOD_LABELS[period]}
                <ChevronDown className="w-3 h-3 text-white/40" />
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full mt-1 left-0 bg-[#141416] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20 min-w-[140px]">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
                    <button
                      key={p}
                      onClick={() => { setPeriod(p); setShowPeriodMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        period === p ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => loadStats()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/50 hover:bg-white/10 hover:text-white/70 transition-all">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Usuários */}
          <div className="group bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] rounded-xl p-5 hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              {stats.newUsers > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                  <ArrowUpRight className="w-3 h-3" />+{stats.newUsers}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{loading ? '—' : stats.totalUsers.toLocaleString('pt-BR')}</h3>
            <p className="text-[11px] text-white/40 mt-1">Total de Usuários</p>
          </div>

          {/* Trades Ativos */}
          <div className="group bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] rounded-xl p-5 hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{loading ? '—' : stats.activeTrades}</h3>
            <p className="text-[11px] text-white/40 mt-1">Trades em Andamento</p>
          </div>

          {/* Total Depositado */}
          <div className="group bg-gradient-to-b from-emerald-500/[0.04] to-transparent border border-emerald-500/[0.08] rounded-xl p-5 hover:border-emerald-500/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              {stats.depositCount > 0 && (
                <span className="text-[10px] font-medium text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md">
                  {stats.depositCount} ordem{stats.depositCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">
              {loading ? '—' : `R$ ${stats.totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </h3>
            <p className="text-[11px] text-white/40 mt-1">Total Depositado</p>
          </div>

          {/* Total Sacado */}
          <div className="group bg-gradient-to-b from-red-500/[0.04] to-transparent border border-red-500/[0.08] rounded-xl p-5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-400" />
              </div>
              {stats.withdrawalCount > 0 && (
                <span className="text-[10px] font-medium text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md">
                  {stats.withdrawalCount} ordem{stats.withdrawalCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-red-400 tracking-tight">
              {loading ? '—' : `R$ ${stats.totalWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </h3>
            <p className="text-[11px] text-white/40 mt-1">Total Sacado</p>
          </div>
        </div>

        {/* Chart + Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* New Users Chart */}
          <div className="lg:col-span-2 bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Novos Usuários</h3>
                <p className="text-[11px] text-white/40 mt-0.5">Cadastros por dia nos últimos {PERIOD_LABELS[period].toLowerCase()}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <UserPlus className="w-3.5 h-3.5" />
                <span className="font-semibold text-white">{stats.newUsers}</span> no período
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60"></div>
              </div>
            ) : newUsersChart.length > 0 ? (
              <div className="flex items-end gap-[2px] h-[200px] px-1">
                {newUsersChart.map((d, i) => {
                  const height = maxChartValue > 0 ? Math.max(2, (d.count / maxChartValue) * 180) : 2;
                  const isToday = i === newUsersChart.length - 1;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end group/bar relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1a1a1e] border border-white/10 rounded px-2 py-1 text-[9px] text-white/70 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {d.count} usuário{d.count !== 1 ? 's' : ''}
                      </div>
                      <div
                        className={`w-full rounded-sm transition-all duration-200 ${
                          isToday ? 'bg-indigo-500' : d.count > 0 ? 'bg-indigo-500/40 group-hover/bar:bg-indigo-500/70' : 'bg-white/[0.04]'
                        }`}
                        style={{ height: `${height}px`, minHeight: '2px' }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-xs text-white/30">Sem dados no período</div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Atividade Recente</h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60"></div>
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        a.type === 'deposit' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      }`}>
                        {a.type === 'deposit' ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-white/80">{a.user}</p>
                        <p className="text-[10px] text-white/30">{a.time} · <span className={`${
                          a.status === 'approved' || a.status === 'completed' ? 'text-emerald-400/60' : a.status === 'pending' ? 'text-amber-400/60' : 'text-red-400/60'
                        }`}>{a.status}</span></p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${a.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {a.type === 'deposit' ? '+' : '-'}R$ {a.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12"><p className="text-xs text-white/30">Nenhuma atividade recente</p></div>
            )}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/admin/finance?tab=deposits&status=pending')}
            className="group flex items-center justify-between bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-xl p-5 hover:border-amber-500/20 hover:from-amber-500/[0.03] transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Depósitos Pendentes</h4>
                <p className="text-[11px] text-white/40 mt-0.5">Aguardando aprovação</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-400">{loading ? '—' : stats.pendingDeposits}</span>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-amber-400/60 transition-colors" />
            </div>
          </button>

          <button
            onClick={() => router.push('/admin/finance?tab=withdrawals&status=pending')}
            className="group flex items-center justify-between bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-xl p-5 hover:border-orange-500/20 hover:from-orange-500/[0.03] transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Saques Pendentes</h4>
                <p className="text-[11px] text-white/40 mt-0.5">Aguardando processamento</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-orange-400">{loading ? '—' : stats.pendingWithdrawals}</span>
              <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-orange-400/60 transition-colors" />
            </div>
          </button>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Acesso Rápido</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => router.push(`/admin/${item.id}`)}
                className={`group flex flex-col items-start bg-gradient-to-b ${item.accent} border rounded-xl p-4 hover:scale-[1.02] transition-all text-left`}
              >
                <item.icon className={`w-5 h-5 ${item.iconColor} mb-3`} />
                <h4 className="text-xs font-semibold text-white leading-tight">{item.title}</h4>
                <p className="text-[10px] text-white/30 mt-1 leading-snug">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
