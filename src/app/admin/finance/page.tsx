'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, 
  AlertCircle, X, User, Eye, Send, Check, RefreshCw, ChevronDown,
  ArrowDownRight, ArrowUpRight, Filter, Search
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
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  transaction_id?: string;
  admin_notes?: string;
  user_name?: string;
}

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  transaction_id?: string;
  admin_notes?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  pix_key?: string;
  cpf?: string;
}

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals'>(() => {
    return (searchParams.get('tab') as 'deposits' | 'withdrawals') || 'deposits';
  });
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [summaryStats, setSummaryStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositCount: 0,
    withdrawalCount: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userStats, setUserStats] = useState({ depositsCount: 0, withdrawalsCount: 0, totalDeposits: 0, totalWithdrawals: 0 });
  const [transferMethod, setTransferMethod] = useState<'api' | 'manual'>('api');
  const [transactionId, setTransactionId] = useState('');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadUserNames = async () => {
      if (!supabase) return;
      try {
        const { data: users } = await supabase.from('users').select('id, name, email');
        if (users) {
          const map = new Map<string, string>();
          users.forEach((u: any) => map.set(u.id, u.name || u.email || u.id.slice(0, 8)));
          setUserNames(map);
        }
      } catch { /* ignore */ }
    };
    loadUserNames();
  }, []);

  useEffect(() => { loadSummary(); }, [period]);
  useEffect(() => { loadData(); }, [activeTab, statusFilter, methodFilter, period, userNames]);

  const loadSummary = useCallback(async () => {
    if (!supabase) return;
    try {
      const dateFrom = getDateFrom(period);

      let dq = supabase.from('deposits').select('amount').eq('status', 'approved');
      if (dateFrom) dq = dq.gte('created_at', dateFrom);
      const { data: dd } = await dq;

      let wq = supabase.from('withdrawal_requests').select('amount').in('status', ['approved', 'completed']);
      if (dateFrom) wq = wq.gte('created_at', dateFrom);
      const { data: wd } = await wq;

      const { count: pd } = await supabase.from('deposits').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: pw } = await supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setSummaryStats({
        totalDeposits: dd?.reduce((s, d) => s + parseFloat(d.amount?.toString() || '0'), 0) || 0,
        totalWithdrawals: wd?.reduce((s, w) => s + parseFloat(w.amount?.toString() || '0'), 0) || 0,
        depositCount: dd?.length || 0,
        withdrawalCount: wd?.length || 0,
        pendingDeposits: pd || 0,
        pendingWithdrawals: pw || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    }
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!supabase) { setDeposits([]); setWithdrawals([]); return; }
      const dateFrom = getDateFrom(period);

      if (activeTab === 'deposits') {
        let query = supabase.from('deposits').select('*').order('created_at', { ascending: false }).limit(200);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (methodFilter !== 'all') query = query.eq('method', methodFilter);
        if (dateFrom) query = query.gte('created_at', dateFrom);

        const { data, error } = await query;
        if (error) throw error;
        setDeposits((data || []).map((d: any) => ({ ...d, user_name: userNames.get(d.user_id) || d.user_id?.slice(0, 8) })));
      } else {
        let query = supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(200);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (methodFilter !== 'all') query = query.eq('method', methodFilter);
        if (dateFrom) query = query.gte('created_at', dateFrom);

        const { data, error } = await query;
        if (error) throw error;
        setWithdrawals((data || []).map((w: any) => ({ ...w, user_name: userNames.get(w.user_id) || w.first_name ? `${w.first_name} ${w.last_name || ''}`.trim() : w.user_id?.slice(0, 8) })));
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'deposit' | 'withdrawal') => {
    try {
      if (!supabase) { toast.error('Banco de dados não configurado'); return; }
      if (type === 'withdrawal') {
        const { data: request, error: fetchError } = await supabase.from('withdrawal_requests').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;
        if (!request) { toast.error('Solicitação não encontrada'); return; }
        const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
        const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;
        const { error: updateError } = await supabase.from('withdrawal_requests').update({ status: 'approved', processed_at: new Date().toISOString(), admin_id: adminId }).eq('id', id);
        if (updateError) throw updateError;
        const { data: userData, error: userError } = await supabase.from('users').select('balance').eq('id', request.user_id).single();
        if (userError) throw userError;
        const newBalance = parseFloat(userData.balance) - parseFloat(request.amount);
        const { error: balanceError } = await supabase.from('users').update({ balance: newBalance }).eq('id', request.user_id);
        if (balanceError) throw balanceError;
        toast.success('Saque aprovado e saldo atualizado!');
      } else {
        const { error } = await supabase.from('deposits').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        toast.success('Depósito aprovado!');
      }
      loadData();
      loadSummary();
    } catch (error: any) {
      console.error('Erro ao aprovar:', error);
      toast.error(error.message || 'Erro ao aprovar');
    }
  };

  const handleReject = async (id: string, type: 'deposit' | 'withdrawal', reason?: string) => {
    try {
      if (!supabase) { toast.error('Banco de dados não configurado'); return; }
      if (type === 'withdrawal') {
        const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
        const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;
        const { error } = await supabase.from('withdrawal_requests').update({ status: 'rejected', admin_response: reason || 'Rejeitado pelo administrador', processed_at: new Date().toISOString(), admin_id: adminId }).eq('id', id);
        if (error) throw error;
        toast.success('Saque rejeitado');
      } else {
        const { error } = await supabase.from('deposits').update({ status: 'rejected', admin_notes: reason || 'Rejeitado pelo administrador' }).eq('id', id);
        if (error) throw error;
        toast.success('Depósito rejeitado');
      }
      loadData();
      loadSummary();
    } catch (error: any) {
      console.error('Erro ao rejeitar:', error);
      toast.error(error.message || 'Erro ao rejeitar');
    }
  };

  const handleAnalyze = async (withdrawal: Withdrawal) => {
    if (!supabase) { toast.error('Banco de dados não configurado'); return; }
    try {
      const { data: requestData } = await supabase.from('withdrawal_requests').select('*').eq('id', withdrawal.id).single();
      setSelectedWithdrawal(requestData as any);
      const { data: userData } = await supabase.from('users').select('*').eq('id', withdrawal.user_id).single();
      setUserInfo(userData);
      const [depositsResult, withdrawalsResult] = await Promise.all([
        supabase.from('deposits').select('id, amount, status').eq('user_id', withdrawal.user_id),
        supabase.from('withdrawal_requests').select('id, amount, status').eq('user_id', withdrawal.user_id),
      ]);
      const deps = depositsResult.data || [];
      const wds = withdrawalsResult.data || [];
      setUserStats({
        depositsCount: deps.length,
        withdrawalsCount: wds.length,
        totalDeposits: deps.filter((d: any) => d.status === 'approved' || d.status === 'completed').reduce((s: number, d: any) => s + parseFloat(d.amount), 0),
        totalWithdrawals: wds.filter((w: any) => w.status === 'approved' || w.status === 'completed').reduce((s: number, w: any) => s + parseFloat(w.amount), 0),
      });
      setShowAnalysisModal(true);
    } catch (error: any) {
      console.error('Erro ao carregar informações:', error);
      toast.error('Erro ao carregar informações do cliente');
    }
  };

  const handleCompleteTransfer = async () => {
    if (!supabase || !selectedWithdrawal) { toast.error('Dados não disponíveis'); return; }
    try {
      const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
      const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;
      const { error: updateError } = await supabase.from('withdrawal_requests').update({ status: 'completed', processed_at: new Date().toISOString(), admin_id: adminId, admin_response: transactionId || (transferMethod === 'api' ? 'Transferido via API' : 'Transferido manualmente') }).eq('id', selectedWithdrawal.id);
      if (updateError) throw updateError;
      if (selectedWithdrawal.status !== 'approved') {
        const { data: userData } = await supabase.from('users').select('balance').eq('id', selectedWithdrawal.user_id).single();
        if (userData) {
          const newBalance = parseFloat(userData.balance) - parseFloat(selectedWithdrawal.amount.toString());
          await supabase.from('users').update({ balance: newBalance }).eq('id', selectedWithdrawal.user_id);
        }
      }
      toast.success('Transferência concluída!');
      setShowAnalysisModal(false);
      setSelectedWithdrawal(null);
      setTransactionId('');
      loadData();
      loadSummary();
    } catch (error: any) {
      console.error('Erro ao completar transferência:', error);
      toast.error(error.message || 'Erro ao completar transferência');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      processing: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
    };
    const icons: Record<string, React.ReactNode> = {
      approved: <CheckCircle className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      processing: <RefreshCw className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${styles[status] || 'text-white/40 bg-white/5 border-white/10'}`}>
        {icons[status] || <AlertCircle className="w-3 h-3" />}
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  const currentItems = activeTab === 'deposits' ? deposits : withdrawals;
  const filteredItems = searchQuery
    ? currentItems.filter(i => i.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.id.includes(searchQuery))
    : currentItems;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4 sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Gestão Financeira</h1>
            <p className="text-xs text-white/40 mt-0.5">Gerencie depósitos e saques da plataforma</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowPeriodMenu(!showPeriodMenu)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-white/80 hover:bg-white/10 transition-all">
                <Clock className="w-3 h-3 text-white/40" />
                {PERIOD_LABELS[period]}
                <ChevronDown className="w-3 h-3 text-white/40" />
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full mt-1 right-0 bg-[#141416] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20 min-w-[140px]">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
                    <button key={p} onClick={() => { setPeriod(p); setShowPeriodMenu(false); }} className={`w-full text-left px-3 py-2 text-xs transition-colors ${period === p ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5'}`}>
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { loadData(); loadSummary(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/50 hover:bg-white/10 transition-all">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-b from-amber-500/[0.04] to-transparent border border-amber-500/[0.08] rounded-xl p-5 hover:border-amber-500/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-400" /></div>
              <span className="text-lg font-bold text-amber-400">{summaryStats.pendingDeposits}</span>
            </div>
            <p className="text-[11px] text-white/40">Depósitos Pendentes</p>
          </div>
          <div className="bg-gradient-to-b from-orange-500/[0.04] to-transparent border border-orange-500/[0.08] rounded-xl p-5 hover:border-orange-500/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-orange-400" /></div>
              <span className="text-lg font-bold text-orange-400">{summaryStats.pendingWithdrawals}</span>
            </div>
            <p className="text-[11px] text-white/40">Saques Pendentes</p>
          </div>
          <div className="bg-gradient-to-b from-emerald-500/[0.04] to-transparent border border-emerald-500/[0.08] rounded-xl p-5 hover:border-emerald-500/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-400" /></div>
              {summaryStats.depositCount > 0 && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{summaryStats.depositCount} ordens</span>}
            </div>
            <h3 className="text-xl font-bold text-emerald-400 tracking-tight">R$ {summaryStats.totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-white/40 mt-1">Total Depositado</p>
          </div>
          <div className="bg-gradient-to-b from-red-500/[0.04] to-transparent border border-red-500/[0.08] rounded-xl p-5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-400" /></div>
              {summaryStats.withdrawalCount > 0 && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{summaryStats.withdrawalCount} ordens</span>}
            </div>
            <h3 className="text-xl font-bold text-red-400 tracking-tight">R$ {summaryStats.totalWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-white/40 mt-1">Total Sacado</p>
          </div>
        </div>

        {/* Tabs + Filters */}
        <div className="bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5">
            <div className="flex">
              <button onClick={() => { setActiveTab('deposits'); setStatusFilter('all'); }} className={`relative px-4 py-3.5 text-xs font-medium transition-colors ${activeTab === 'deposits' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}>
                <span className="flex items-center gap-2">
                  <ArrowDownRight className="w-3.5 h-3.5" />Depósitos
                  {summaryStats.pendingDeposits > 0 && <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] flex items-center justify-center font-bold">{summaryStats.pendingDeposits}</span>}
                </span>
                {activeTab === 'deposits' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />}
              </button>
              <button onClick={() => { setActiveTab('withdrawals'); setStatusFilter('all'); }} className={`relative px-4 py-3.5 text-xs font-medium transition-colors ${activeTab === 'withdrawals' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}>
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-3.5 h-3.5" />Saques
                  {summaryStats.pendingWithdrawals > 0 && <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[9px] flex items-center justify-center font-bold">{summaryStats.pendingWithdrawals}</span>}
                </span>
                {activeTab === 'withdrawals' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />}
              </button>
            </div>
            <div className="flex items-center gap-2 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/80 placeholder-white/30 w-[160px] focus:outline-none focus:border-white/20" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/70 focus:outline-none appearance-none cursor-pointer">
                <option value="all">Todos status</option>
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="completed">Concluído</option>
                <option value="rejected">Rejeitado</option>
              </select>
              <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/70 focus:outline-none appearance-none cursor-pointer">
                <option value="all">Todos métodos</option>
                <option value="pix">PIX</option>
                <option value="pix-email">PIX E-mail</option>
                <option value="pix-phone">PIX Telefone</option>
                <option value="pix-random">PIX Aleatória</option>
                <option value="stripe">Stripe</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <DollarSign className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-xs text-white/30">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Usuário</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Valor</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Método</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Data</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold text-white/30 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === 'deposits' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {activeTab === 'deposits' ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-white/80">{item.user_name || '—'}</p>
                            <p className="text-[9px] text-white/25 font-mono">{item.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-semibold tabular-nums ${activeTab === 'deposits' ? 'text-emerald-400' : 'text-red-400'}`}>
                          R$ {parseFloat(item.amount?.toString() || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 rounded text-[10px] font-medium capitalize">
                          {item.method ? item.method.replace(/-/g, ' ') : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">{getStatusBadge(item.status)}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-[11px] text-white/50">
                          {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          <span className="text-white/25 ml-1.5">{new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {item.status === 'pending' && activeTab === 'withdrawals' ? (
                          <button onClick={() => handleAnalyze(item as any)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-medium text-white/60 transition-all flex items-center gap-1.5 ml-auto">
                            <Eye className="w-3 h-3" />Analisar
                          </button>
                        ) : item.status === 'pending' ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => handleApprove(item.id, activeTab === 'deposits' ? 'deposit' : 'withdrawal')} className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[10px] font-medium text-emerald-400 transition-all">
                              Aprovar
                            </button>
                            <button onClick={() => handleReject(item.id, activeTab === 'deposits' ? 'deposit' : 'withdrawal')} className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] font-medium text-red-400 transition-all">
                              Rejeitar
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      {showAnalysisModal && selectedWithdrawal && userInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f11] border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Análise de Saque</h2>
                  <p className="text-xs text-white/40 mt-0.5">Revise os dados antes de aprovar</p>
                </div>
                <button onClick={() => { setShowAnalysisModal(false); setSelectedWithdrawal(null); setUserInfo(null); setTransactionId(''); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Valor</p>
                  <p className="text-2xl font-bold text-red-400">R$ {parseFloat(selectedWithdrawal.amount.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Método</p>
                  <p className="text-sm font-medium text-white/80 capitalize">{selectedWithdrawal.method?.replace(/-/g, ' ')}</p>
                  <p className="text-[10px] text-white/30 mt-1">{new Date(selectedWithdrawal.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* PIX Data */}
              {(selectedWithdrawal as any).pix_key && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Dados PIX</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-white/30">Chave PIX</p>
                      <p className="text-xs text-white/80 font-mono break-all">{(selectedWithdrawal as any).pix_key}</p>
                    </div>
                    {(selectedWithdrawal as any).first_name && (
                      <div className="flex gap-4 pt-2 border-t border-white/[0.06]">
                        <div><p className="text-[10px] text-white/30">Nome</p><p className="text-xs text-white/80">{(selectedWithdrawal as any).first_name} {(selectedWithdrawal as any).last_name}</p></div>
                        {(selectedWithdrawal as any).cpf && <div><p className="text-[10px] text-white/30">CPF</p><p className="text-xs text-white/80 font-mono">{(selectedWithdrawal as any).cpf}</p></div>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* User Info */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5"><User className="w-3 h-3" />Cliente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] text-white/30">Nome</p><p className="text-xs text-white/80 font-medium">{userInfo.name}</p></div>
                  <div><p className="text-[10px] text-white/30">E-mail</p><p className="text-xs text-white/60 break-all">{userInfo.email}</p></div>
                  <div><p className="text-[10px] text-white/30">Saldo Atual</p><p className="text-sm font-bold text-emerald-400">R$ {parseFloat(userInfo.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div><p className="text-[10px] text-white/30">Histórico</p><p className="text-xs text-white/60">{userStats.depositsCount} depósitos · {userStats.withdrawalsCount} saques</p></div>
                </div>
              </div>

              {/* Transfer Method */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-6">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Método de Transferência</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => setTransferMethod('api')} className={`p-3 rounded-lg border text-left transition-all ${transferMethod === 'api' ? 'bg-white/5 border-white/20' : 'border-white/[0.06] hover:border-white/10'}`}>
                    <Send className={`w-4 h-4 mb-1.5 ${transferMethod === 'api' ? 'text-blue-400' : 'text-white/30'}`} />
                    <p className="text-xs font-medium text-white/80">Via API</p>
                    <p className="text-[10px] text-white/30">Automática</p>
                  </button>
                  <button onClick={() => setTransferMethod('manual')} className={`p-3 rounded-lg border text-left transition-all ${transferMethod === 'manual' ? 'bg-white/5 border-white/20' : 'border-white/[0.06] hover:border-white/10'}`}>
                    <User className={`w-4 h-4 mb-1.5 ${transferMethod === 'manual' ? 'text-blue-400' : 'text-white/30'}`} />
                    <p className="text-xs font-medium text-white/80">Manual</p>
                    <p className="text-[10px] text-white/30">Via PIX direto</p>
                  </button>
                </div>
                {transferMethod === 'manual' && (
                  <div>
                    <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1.5">ID da Transação (opcional)</label>
                    <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="Ex: E12345678920240101120000" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/20" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/[0.06]">
                <button onClick={() => { setShowAnalysisModal(false); setSelectedWithdrawal(null); setUserInfo(null); setTransactionId(''); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/50 transition-all">
                  Cancelar
                </button>
                <button onClick={handleCompleteTransfer} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-medium text-emerald-400 transition-all flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />Concluir Transferência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
