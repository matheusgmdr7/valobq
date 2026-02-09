'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, X, User, Eye, Send, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  transaction_id?: string;
  admin_notes?: string;
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
}

export default function FinancePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    method: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userStats, setUserStats] = useState({
    depositsCount: 0,
    withdrawalsCount: 0,
    totalDeposits: 0,
    totalWithdrawals: 0
  });
  const [transferMethod, setTransferMethod] = useState<'api' | 'manual'>('api');
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setDeposits([]);
        setWithdrawals([]);
        return;
      }

      if (activeTab === 'deposits') {
        let query = supabase
          .from('deposits')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.method !== 'all') {
          query = query.eq('method', filters.method);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;
        setDeposits(data || []);
      } else {
        let query = supabase
          .from('withdrawal_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.method !== 'all') {
          query = query.eq('method', filters.method);
        }
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;
        setWithdrawals(data || []);
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
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      if (type === 'withdrawal') {
        // Buscar a solicitação de retirada
        const { data: request, error: fetchError } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!request) {
          toast.error('Solicitação não encontrada');
          return;
        }

        // Buscar usuário atual para obter admin_id (se necessário)
        const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
        const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;

        // Atualizar status da solicitação
        const { error: updateError } = await supabase
          .from('withdrawal_requests')
          .update({ 
            status: 'approved',
            processed_at: new Date().toISOString(),
            admin_id: adminId
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Buscar saldo atual do usuário
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', request.user_id)
          .single();

        if (userError) throw userError;

        // Deduzir o valor do saldo do usuário
        const newBalance = parseFloat(userData.balance) - parseFloat(request.amount);

        const { error: balanceError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', request.user_id);

        if (balanceError) throw balanceError;

        toast.success('Saque aprovado e saldo atualizado com sucesso!');
      } else {
        // Para depósitos, manter a lógica original
        const { error } = await supabase
          .from('deposits')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('Depósito aprovado com sucesso!');
      }

      loadData();
    } catch (error: any) {
      console.error('Erro ao aprovar:', error);
      toast.error(error.message || 'Erro ao aprovar');
    }
  };

  const handleAnalyze = async (withdrawal: Withdrawal) => {
    if (!supabase) {
      toast.error('Banco de dados não configurado');
      return;
    }

    try {
      setLoading(true);
      
      // Buscar informações completas da solicitação
      const { data: requestData, error: requestError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', withdrawal.id)
        .single();

      if (requestError) throw requestError;
      setSelectedWithdrawal(requestData as any);

      // Buscar informações do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', withdrawal.user_id)
        .single();

      if (userError) throw userError;
      setUserInfo(userData);

      // Buscar estatísticas do usuário
      const [depositsResult, withdrawalsResult] = await Promise.all([
        supabase
          .from('deposits')
          .select('id, amount, status')
          .eq('user_id', withdrawal.user_id),
        supabase
          .from('withdrawal_requests')
          .select('id, amount, status')
          .eq('user_id', withdrawal.user_id)
      ]);

      const deposits = depositsResult.data || [];
      const withdrawals = withdrawalsResult.data || [];

      setUserStats({
        depositsCount: deposits.length,
        withdrawalsCount: withdrawals.length,
        totalDeposits: deposits
          .filter((d: any) => d.status === 'approved' || d.status === 'completed')
          .reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0),
        totalWithdrawals: withdrawals
          .filter((w: any) => w.status === 'approved' || w.status === 'completed')
          .reduce((sum: number, w: any) => sum + parseFloat(w.amount), 0)
      });

      setShowAnalysisModal(true);
    } catch (error: any) {
      console.error('Erro ao carregar informações:', error);
      toast.error('Erro ao carregar informações do cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!supabase || !selectedWithdrawal) {
      toast.error('Dados não disponíveis');
      return;
    }

    try {
      const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
      const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;

      // Atualizar status para completed
      const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          admin_id: adminId,
          admin_response: transactionId || (transferMethod === 'api' ? 'Transferido via API' : 'Transferido manualmente')
        })
        .eq('id', selectedWithdrawal.id);

      if (updateError) throw updateError;

      // Se ainda não foi deduzido o saldo (status não era approved), deduzir agora
      if (selectedWithdrawal.status !== 'approved') {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', selectedWithdrawal.user_id)
          .single();

        if (!userError && userData) {
          const newBalance = parseFloat(userData.balance) - parseFloat(selectedWithdrawal.amount.toString());

          await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', selectedWithdrawal.user_id);
        }
      }

      toast.success('Transferência concluída e status atualizado!');
      setShowAnalysisModal(false);
      setSelectedWithdrawal(null);
      setTransactionId('');
      loadData();
    } catch (error: any) {
      console.error('Erro ao completar transferência:', error);
      toast.error(error.message || 'Erro ao completar transferência');
    }
  };

  const handleReject = async (id: string, type: 'deposit' | 'withdrawal', reason?: string) => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      if (type === 'withdrawal') {
        // Buscar usuário atual para obter admin_id
        const savedUserStr = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
        const adminId = savedUserStr ? JSON.parse(savedUserStr).id : null;

        const { error } = await supabase
          .from('withdrawal_requests')
          .update({ 
            status: 'rejected',
            admin_response: reason || 'Rejeitado pelo administrador',
            processed_at: new Date().toISOString(),
            admin_id: adminId
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('Saque rejeitado');
      } else {
        const { error } = await supabase
          .from('deposits')
          .update({ 
            status: 'rejected',
            admin_notes: reason || 'Rejeitado pelo administrador'
          })
          .eq('id', id);

        if (error) throw error;
        toast.success('Depósito rejeitado');
      }

      loadData();
    } catch (error: any) {
      console.error('Erro ao rejeitar:', error);
      toast.error(error.message || 'Erro ao rejeitar');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'pending':
      case 'processing':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'rejected':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const stats = {
    deposits: {
      pending: deposits.filter(d => d.status === 'pending').length,
      approved: deposits.filter(d => d.status === 'approved').length,
      rejected: deposits.filter(d => d.status === 'rejected').length,
      total: deposits.reduce((sum, d) => sum + (d.status === 'approved' ? d.amount : 0), 0)
    },
    withdrawals: {
      pending: withdrawals.filter(w => w.status === 'pending').length,
      approved: withdrawals.filter(w => w.status === 'approved').length,
      rejected: withdrawals.filter(w => w.status === 'rejected').length,
      total: withdrawals.reduce((sum, w) => sum + (w.status === 'approved' ? w.amount : 0), 0)
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Gestão Financeira</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Gerencie depósitos e saques</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Pendentes</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-white">{stats.deposits.pending}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Depósitos Pendentes</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Pendentes</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-white">{stats.withdrawals.pending}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Saques Pendentes</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Total</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-green-500">R$ {stats.deposits.total.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Depositado</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingDown className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Total</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-red-500">R$ {stats.withdrawals.total.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sacado</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'deposits'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Depósitos
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'withdrawals'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Saques
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="rejected">Rejeitado</option>
                <option value="processing">Processando</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Método</label>
              <select
                value={filters.method}
                onChange={(e) => setFilters({ ...filters, method: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="all">Todos</option>
                <option value="pix-email">PIX (E-mail)</option>
                <option value="pix-phone">PIX (Telefone)</option>
                <option value="pix-random">PIX (Chave Aleatória)</option>
                <option value="picpay">PicPay</option>
                <option value="stripe">Stripe</option>
                <option value="crypto">Crypto</option>
                <option value="bank_transfer">Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Início</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Fim</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(activeTab === 'deposits' ? deposits : withdrawals).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{item.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{item.user_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        R$ {parseFloat(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs font-medium capitalize">
                          {item.method ? item.method.replace(/-/g, ' ') : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          <span className="capitalize">{item.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(item.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                        <span className="text-gray-500 ml-2">
                          {new Date(item.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {item.status === 'pending' && activeTab === 'withdrawals' ? (
                            <button
                              onClick={() => handleAnalyze(item)}
                              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors flex items-center space-x-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Analisar</span>
                            </button>
                          ) : item.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApprove(item.id, activeTab)}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-green-600/50 rounded text-xs font-medium text-green-400 transition-colors"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => handleReject(item.id, activeTab)}
                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-red-600/50 rounded text-xs font-medium text-red-400 transition-colors"
                              >
                                Rejeitar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Análise */}
      {showAnalysisModal && selectedWithdrawal && userInfo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 rounded max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold text-gray-200 uppercase tracking-wide">Análise de Solicitação de Saque</h2>
                <button
                  onClick={() => {
                    setShowAnalysisModal(false);
                    setSelectedWithdrawal(null);
                    setUserInfo(null);
                    setTransactionId('');
                  }}
                  className="p-2 hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Informações da Solicitação */}
              <div className="bg-gray-900 border border-gray-800 rounded p-5 mb-5">
                <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide">Detalhes da Solicitação</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Valor</p>
                    <p className="text-xl font-bold text-green-400">
                      R$ {parseFloat(selectedWithdrawal.amount.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Método</p>
                    <p className="text-sm font-medium text-gray-200 capitalize">
                      {selectedWithdrawal.method?.replace(/-/g, ' ')}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Data da Solicitação</p>
                    <p className="text-sm text-gray-300">
                      {new Date(selectedWithdrawal.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Status</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedWithdrawal.status)}`}>
                      {getStatusIcon(selectedWithdrawal.status)}
                      <span className="ml-1 capitalize">{selectedWithdrawal.status}</span>
                    </span>
                  </div>
                </div>
                
                {/* Dados PIX (se disponível) */}
                {(selectedWithdrawal as any).pix_key && (
                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Dados PIX</h4>
                    <div className="bg-gray-800/50 border border-gray-800 rounded p-3 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chave PIX</p>
                        <p className="text-sm text-gray-200 font-mono break-all">{(selectedWithdrawal as any).pix_key}</p>
                      </div>
                      {(selectedWithdrawal as any).first_name && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nome</p>
                            <p className="text-sm text-gray-200">{(selectedWithdrawal as any).first_name} {(selectedWithdrawal as any).last_name}</p>
                          </div>
                          {(selectedWithdrawal as any).cpf && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">CPF</p>
                              <p className="text-sm text-gray-200 font-mono">{(selectedWithdrawal as any).cpf}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Informações do Cliente */}
              <div className="bg-gray-900 border border-gray-800 rounded p-5 mb-5">
                <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Informações do Cliente
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Nome</p>
                    <p className="text-sm font-medium text-gray-200">{userInfo.name}</p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">E-mail</p>
                    <p className="text-sm text-gray-300 break-all">{userInfo.email}</p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Saldo Atual</p>
                    <p className="text-xl font-bold text-green-400">
                      R$ {parseFloat(userInfo.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">ID do Usuário</p>
                    <p className="text-sm text-gray-400 font-mono">{userInfo.id}</p>
                  </div>
                </div>

                {/* Estatísticas do Cliente */}
                <div className="pt-4 border-t border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Histórico</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Depósitos</p>
                      <p className="text-xl font-bold text-white mb-1">{userStats.depositsCount}</p>
                      <p className="text-xs text-gray-500">Total: R$ {userStats.totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-800 rounded p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Saques</p>
                      <p className="text-xl font-bold text-white mb-1">{userStats.withdrawalsCount}</p>
                      <p className="text-xs text-gray-500">Total: R$ {userStats.totalWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opções de Transferência */}
              <div className="bg-gray-900 border border-gray-800 rounded p-5 mb-5">
                <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide">Método de Transferência</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button
                    onClick={() => setTransferMethod('api')}
                    className={`px-4 py-4 rounded border transition-colors text-left ${
                      transferMethod === 'api'
                        ? 'bg-gray-800 border-blue-500/50 text-white'
                        : 'bg-gray-800/50 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Send className={`w-5 h-5 mt-0.5 ${transferMethod === 'api' ? 'text-blue-400' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium mb-1">Via API</p>
                        <p className="text-xs text-gray-500">Transferência automática</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setTransferMethod('manual')}
                    className={`px-4 py-4 rounded border transition-colors text-left ${
                      transferMethod === 'manual'
                        ? 'bg-gray-800 border-blue-500/50 text-white'
                        : 'bg-gray-800/50 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <User className={`w-5 h-5 mt-0.5 ${transferMethod === 'manual' ? 'text-blue-400' : 'text-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium mb-1">Manual</p>
                        <p className="text-xs text-gray-500">Transferência manual via PIX</p>
                      </div>
                    </div>
                  </button>
                </div>

                {transferMethod === 'manual' && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <label className="block text-xs font-medium mb-2 text-gray-400 uppercase tracking-wide">ID da Transação (opcional)</label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Ex: E12345678920240101120000"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                    />
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-800">
                <button
                  onClick={() => {
                    setShowAnalysisModal(false);
                    setSelectedWithdrawal(null);
                    setUserInfo(null);
                    setTransactionId('');
                  }}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs font-medium text-gray-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCompleteTransfer}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-green-600/50 rounded text-xs font-medium text-green-400 transition-colors flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Marcar como Concluído</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

