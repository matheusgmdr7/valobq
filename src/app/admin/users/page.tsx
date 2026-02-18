'use client';

import React, { useEffect, useState } from 'react';
import { Search, DollarSign, FileText, X, ArrowUpRight, ArrowDownRight, Clock, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  is_demo: boolean;
  created_at: string;
}

interface KYCDocument {
  id: string;
  user_id: string;
  document_type: string;
  status: string;
  rejection_reason?: string;
  file_url: string;
  created_at: string;
}

interface AccountClosureRequest {
  id: string;
  user_id: string;
  request_type: 'close' | 'delete';
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  response_deadline: string;
  admin_response?: string;
  created_at: string;
}

interface DepositRecord {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  result: string | null;
  profit: number | null;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [kycDocuments, setKycDocuments] = useState<KYCDocument[]>([]);
  const [closureRequests, setClosureRequests] = useState<AccountClosureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [selectedClosureRequest, setSelectedClosureRequest] = useState<AccountClosureRequest | null>(null);
  const [balanceAdjustment, setBalanceAdjustment] = useState({ amount: 0, amountDisplay: '', type: 'credit' as 'credit' | 'debit', reason: '' });

  const [userDeposits, setUserDeposits] = useState<DepositRecord[]>([]);
  const [userTrades, setUserTrades] = useState<TradeRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [balanceModalTab, setBalanceModalTab] = useState<'adjust' | 'deposits' | 'trades'>('adjust');

  const formatCurrency = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const amount = parseFloat(numbers) / 100;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return 0;
    return parseFloat(numbers) / 100;
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatCurrency(value);
    const numericValue = parseCurrency(value);
    setBalanceAdjustment({ ...balanceAdjustment, amount: numericValue, amountDisplay: formatted });
  };

  useEffect(() => {
    loadUsers();
    loadClosureRequests();
  }, [searchQuery]);

  const loadClosureRequests = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('account_closure_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      setClosureRequests(data || []);
    } catch (error) { console.error('Erro ao carregar solicitações:', error); }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (!supabase) { setUsers([]); return; }
      let query = supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100);
      if (searchQuery) query = query.or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,id.eq.${searchQuery}`);
      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally { setLoading(false); }
  };

  const loadUserHistory = async (userId: string) => {
    setLoadingHistory(true);
    try {
      if (!supabase) return;
      const [depsRes, tradesRes] = await Promise.all([
        supabase.from('deposits').select('id, amount, status, method, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('trades').select('id, symbol, type, amount, result, profit, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      ]);
      setUserDeposits((depsRes.data || []) as DepositRecord[]);
      setUserTrades((tradesRes.data || []) as TradeRecord[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally { setLoadingHistory(false); }
  };

  const loadKYCDocuments = async (userId: string) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('kyc_documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      setKycDocuments(data || []);
    } catch (error) {
      console.error('Erro ao carregar KYC:', error);
      toast.error('Erro ao carregar documentos KYC');
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    try {
      if (!supabase) { toast.error('Banco de dados não configurado'); return; }
      const adjustment = balanceAdjustment.type === 'credit' ? balanceAdjustment.amount : -balanceAdjustment.amount;
      const { error } = await supabase.from('users').update({ balance: selectedUser.balance + adjustment }).eq('id', selectedUser.id);
      if (error) throw error;
      await supabase.from('transactions').insert([{ user_id: selectedUser.id, type: balanceAdjustment.type === 'credit' ? 'deposit' : 'withdrawal', amount: Math.abs(adjustment), method: 'manual_adjustment', status: 'completed' }]);
      toast.success('Saldo ajustado com sucesso!');
      setShowBalanceModal(false);
      setBalanceAdjustment({ amount: 0, amountDisplay: '', type: 'credit', reason: '' });
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao ajustar saldo:', error);
      toast.error(error.message || 'Erro ao ajustar saldo');
    }
  };

  const handleKYCStatus = async (docId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      if (!supabase) { toast.error('Banco de dados não configurado'); return; }
      const { error } = await supabase.from('kyc_documents').update({ status, rejection_reason: reason || null, verified_at: new Date().toISOString() }).eq('id', docId);
      if (error) throw error;
      toast.success(`Documento ${status === 'approved' ? 'aprovado' : 'rejeitado'}!`);
      if (selectedUser) loadKYCDocuments(selectedUser.id);
    } catch (error: any) {
      console.error('Erro ao atualizar KYC:', error);
      toast.error(error.message || 'Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Aprovado' },
      completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Concluído' },
      pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pendente' },
      rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejeitado' },
      failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Falhou' },
    };
    const s = map[status] || { bg: 'bg-white/5', text: 'text-white/40', label: status };
    return <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const getTradeResultBadge = (result: string | null) => {
    if (!result) return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/30">Ativo</span>;
    if (result === 'win') return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">Win</span>;
    if (result === 'loss') return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400">Loss</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">Draw</span>;
  };

  const totalDeposited = userDeposits.filter(d => d.status === 'approved').reduce((s, d) => s + parseFloat(d.amount?.toString() || '0'), 0);
  const tradeStats = {
    total: userTrades.length,
    wins: userTrades.filter(t => t.result === 'win').length,
    losses: userTrades.filter(t => t.result === 'loss').length,
    totalProfit: userTrades.reduce((s, t) => s + (t.profit || 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white/90">Gestão de Usuários</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Gerencie contas, saldos e KYC</p>
          </div>
          <button onClick={() => loadUsers()} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all">
            <RefreshCw className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Closure requests alert */}
        {closureRequests.length > 0 && (
          <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <div>
                <p className="text-xs font-medium text-amber-300">{closureRequests.length} solicitação(ões) de encerramento pendente(s)</p>
                <p className="text-[10px] text-amber-400/60 mt-0.5">Clique para visualizar e responder</p>
              </div>
            </div>
            <button onClick={() => { setSelectedClosureRequest(closureRequests[0]); setShowClosureModal(true); }} className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium rounded-lg transition-colors">
              Ver Solicitações
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por ID, E-mail ou Nome..." className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/[0.12] transition-colors" />
        </div>

        {/* Users table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-white/30">Carregando...</p>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Nome</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">E-mail</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Saldo</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Cadastro</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-[11px] font-mono text-white/30">{user.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-white/80">{user.name || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/40">{user.email}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-emerald-400">R$ {user.balance?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${user.is_demo ? 'bg-white/5 text-white/30' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {user.is_demo ? 'Demo' : 'Real'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/30">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setBalanceAdjustment({ amount: 0, amountDisplay: '', type: 'credit', reason: '' });
                              setBalanceModalTab('adjust');
                              setUserDeposits([]);
                              setUserTrades([]);
                              loadUserHistory(user.id);
                              setShowBalanceModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all" title="Ajustar Saldo"
                          >
                            <DollarSign className="w-3 h-3 text-white/40" />
                          </button>
                          <button
                            onClick={() => { setSelectedUser(user); loadKYCDocuments(user.id); setShowKYCModal(true); }}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all" title="Ver KYC"
                          >
                            <FileText className="w-3 h-3 text-white/40" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Balance Modal */}
        {showBalanceModal && selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-white/90">{selectedUser.name || selectedUser.email}</h2>
                  <p className="text-[10px] text-white/30 mt-0.5">{selectedUser.email}</p>
                </div>
                <button onClick={() => { setShowBalanceModal(false); setBalanceAdjustment({ amount: 0, amountDisplay: '', type: 'credit', reason: '' }); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all">
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>

              {/* Balance summary */}
              <div className="px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold">Saldo Atual</p>
                    <p className="text-lg font-bold text-emerald-400 mt-1">R$ {selectedUser.balance?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold">Total Depositado</p>
                    <p className="text-lg font-bold text-white/80 mt-1">R$ {totalDeposited.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold">Operações</p>
                    <p className="text-lg font-bold text-white/80 mt-1">{tradeStats.total}</p>
                    <p className="text-[9px] text-white/25 mt-0.5">
                      <span className="text-emerald-400">{tradeStats.wins}W</span> / <span className="text-red-400">{tradeStats.losses}L</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-5 border-b border-white/[0.06] flex gap-0 flex-shrink-0">
                {[
                  { key: 'adjust' as const, label: 'Ajustar Saldo' },
                  { key: 'deposits' as const, label: `Depósitos (${userDeposits.length})` },
                  { key: 'trades' as const, label: `Operações (${userTrades.length})` },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setBalanceModalTab(tab.key)}
                    className={`px-4 py-2.5 text-[11px] font-medium border-b-2 transition-all ${
                      balanceModalTab === tab.key ? 'border-white/60 text-white/90' : 'border-transparent text-white/30 hover:text-white/50'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                {balanceModalTab === 'adjust' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Tipo</label>
                      <div className="flex gap-2">
                        {(['credit', 'debit'] as const).map(t => (
                          <button key={t} onClick={() => setBalanceAdjustment({ ...balanceAdjustment, type: t })}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                              balanceAdjustment.type === t
                                ? t === 'credit' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.05]'
                            }`}>
                            {t === 'credit' ? 'Crédito (+)' : 'Débito (-)'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Valor</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/25">R$</span>
                        <input type="text" value={balanceAdjustment.amountDisplay} onChange={(e) => handleAmountChange(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]" placeholder="0,00" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Motivo</label>
                      <textarea value={balanceAdjustment.reason} onChange={(e) => setBalanceAdjustment({ ...balanceAdjustment, reason: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12] resize-none" rows={3} placeholder="Motivo do ajuste..." />
                    </div>
                    <button onClick={handleAdjustBalance} disabled={balanceAdjustment.amount <= 0}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white/80">
                      Aplicar Ajuste
                    </button>
                  </div>
                )}

                {balanceModalTab === 'deposits' && (
                  <div>
                    {loadingHistory ? (
                      <div className="text-center py-8"><div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin mx-auto" /></div>
                    ) : userDeposits.length === 0 ? (
                      <p className="text-center py-8 text-xs text-white/20">Nenhum depósito encontrado</p>
                    ) : (
                      <div className="space-y-2">
                        {userDeposits.map(dep => (
                          <div key={dep.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-white/70">R$ {parseFloat(dep.amount?.toString() || '0').toFixed(2)}</p>
                                <p className="text-[10px] text-white/25">{dep.method || 'PIX'} &middot; {new Date(dep.created_at).toLocaleDateString('pt-BR')}</p>
                              </div>
                            </div>
                            {getStatusBadge(dep.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {balanceModalTab === 'trades' && (
                  <div>
                    {loadingHistory ? (
                      <div className="text-center py-8"><div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin mx-auto" /></div>
                    ) : userTrades.length === 0 ? (
                      <p className="text-center py-8 text-xs text-white/20">Nenhuma operação encontrada</p>
                    ) : (
                      <div className="space-y-2">
                        {userTrades.map(trade => (
                          <div key={trade.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${trade.type === 'call' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                {trade.type === 'call' ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium text-white/70">{trade.symbol}</p>
                                  <span className={`text-[9px] font-semibold uppercase ${trade.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>{trade.type}</span>
                                </div>
                                <p className="text-[10px] text-white/25">R$ {trade.amount?.toFixed(2) || '0.00'} &middot; {new Date(trade.created_at).toLocaleDateString('pt-BR')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {trade.profit !== null && trade.profit !== 0 && (
                                <span className={`text-[10px] font-semibold ${(trade.profit || 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {(trade.profit || 0) > 0 ? '+' : ''}{trade.profit?.toFixed(2)}
                                </span>
                              )}
                              {getTradeResultBadge(trade.result)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KYC Modal */}
        {showKYCModal && selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-white/90">Documentos KYC</h2>
                  <p className="text-[10px] text-white/30 mt-0.5">{selectedUser.name} &middot; {selectedUser.email}</p>
                </div>
                <button onClick={() => { setShowKYCModal(false); setSelectedUser(null); setKycDocuments([]); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all">
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                {kycDocuments.length === 0 ? (
                  <p className="text-center py-12 text-xs text-white/20">Nenhum documento encontrado</p>
                ) : (
                  kycDocuments.map((doc) => {
                    let fileData: any = null;
                    try { fileData = typeof doc.file_url === 'string' && doc.file_url.startsWith('{') ? JSON.parse(doc.file_url) : { document: doc.file_url, selfie: null }; }
                    catch { fileData = { document: doc.file_url, selfie: null }; }
                    return (
                      <div key={doc.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xs font-medium text-white/70">
                                {doc.document_type === 'proof_of_identity' ? 'Prova de Identidade' : doc.document_type === 'personal_details' ? 'Dados Pessoais' : doc.document_type}
                              </h3>
                              {getStatusBadge(doc.status)}
                            </div>
                            {doc.rejection_reason && <p className="text-[10px] text-red-400/70 mb-2">Motivo: {doc.rejection_reason}</p>}
                            {doc.document_type === 'proof_of_identity' && fileData ? (
                              <div className="mt-3 space-y-2">
                                {fileData.document && (<div><p className="text-[10px] text-white/25 mb-1">Documento:</p><img src={fileData.document} alt="Doc" className="max-w-xs border border-white/[0.06] rounded-lg" /></div>)}
                                {fileData.selfie && (<div><p className="text-[10px] text-white/25 mb-1">Selfie:</p><img src={fileData.selfie} alt="Selfie" className="max-w-xs border border-white/[0.06] rounded-lg" /></div>)}
                              </div>
                            ) : (
                              <div className="mt-2">
                                {fileData && typeof fileData === 'object' && fileData.fullName ? (
                                  <div className="text-[11px] text-white/30 space-y-1">
                                    <p>Nome: {fileData.fullName}</p>
                                    {fileData.birthDate && <p>Nascimento: {fileData.birthDate}</p>}
                                    {fileData.documentType && <p>Tipo: {fileData.documentType.toUpperCase()}</p>}
                                    {fileData.documentNumber && <p>Número: {fileData.documentNumber}</p>}
                                  </div>
                                ) : (
                                  <a href={typeof fileData === 'string' ? fileData : doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-white/30 hover:text-white/50 underline">Ver documento</a>
                                )}
                              </div>
                            )}
                          </div>
                          {doc.status === 'pending' && (
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={() => handleKYCStatus(doc.id, 'approved')} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[10px] font-medium text-emerald-400 transition-colors">Aprovar</button>
                              <button onClick={() => { const r = prompt('Motivo da rejeição:'); if (r) handleKYCStatus(doc.id, 'rejected', r); }} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] font-medium text-red-400 transition-colors">Rejeitar</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Closure Modal */}
        {showClosureModal && selectedClosureRequest && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
                  <h2 className="text-sm font-semibold text-white/90">
                    Solicitação de {selectedClosureRequest.request_type === 'close' ? 'Encerramento' : 'Exclusão'}
                  </h2>
                  <button onClick={() => { setShowClosureModal(false); setSelectedClosureRequest(null); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all">
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Usuário</p>
                    <p className="text-xs text-white/70">{users.find(u => u.id === selectedClosureRequest.user_id)?.name || 'N/A'} ({users.find(u => u.id === selectedClosureRequest.user_id)?.email || 'N/A'})</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Tipo</p>
                    <p className="text-xs text-white/70">{selectedClosureRequest.request_type === 'close' ? 'Encerramento Temporário' : 'Exclusão Permanente'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Motivo</p>
                    <p className="text-xs text-white/50 bg-white/[0.03] rounded-lg p-3">{selectedClosureRequest.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Prazo</p>
                      <p className="text-xs text-white/50">{new Date(selectedClosureRequest.response_deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Solicitado em</p>
                      <p className="text-xs text-white/50">{new Date(selectedClosureRequest.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  {selectedClosureRequest.status === 'pending' && (
                    <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
                      <button onClick={async () => {
                        try {
                          if (!supabase) return;
                          const response = prompt('Resposta para o usuário:');
                          if (!response) return;
                          const { error } = await supabase.from('account_closure_requests').update({ status: selectedClosureRequest.request_type === 'close' ? 'completed' : 'approved', admin_response: response, updated_at: new Date().toISOString() }).eq('id', selectedClosureRequest.id);
                          if (error) throw error;
                          toast.success('Solicitação aprovada!');
                          loadClosureRequests();
                          setShowClosureModal(false);
                        } catch (e: any) { toast.error(e.message || 'Erro'); }
                      }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-colors">Aprovar</button>
                      <button onClick={async () => {
                        try {
                          if (!supabase) return;
                          const response = prompt('Motivo da rejeição:');
                          if (!response) return;
                          const { error } = await supabase.from('account_closure_requests').update({ status: 'rejected', admin_response: response, updated_at: new Date().toISOString() }).eq('id', selectedClosureRequest.id);
                          if (error) throw error;
                          toast.success('Solicitação rejeitada!');
                          loadClosureRequests();
                          setShowClosureModal(false);
                        } catch (e: any) { toast.error(e.message || 'Erro'); }
                      }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors">Rejeitar</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
