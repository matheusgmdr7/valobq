'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Edit, DollarSign, FileText, Eye, EyeOff, X } from 'lucide-react';
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

export default function UsersPage() {
  const router = useRouter();
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
  const [balanceAdjustment, setBalanceAdjustment] = useState({
    amount: 0,
    amountDisplay: '',
    type: 'credit' as 'credit' | 'debit',
    reason: ''
  });

  // Função para formatar valor monetário
  const formatCurrency = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    if (!numbers) return '';
    
    // Converte para número e divide por 100 para ter centavos
    const amount = parseFloat(numbers) / 100;
    
    // Formata como moeda brasileira
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Função para converter valor formatado para número
  const parseCurrency = (value: string): number => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return 0;
    return parseFloat(numbers) / 100;
  };

  // Handler para mudança no campo de valor
  const handleAmountChange = (value: string) => {
    const formatted = formatCurrency(value);
    const numericValue = parseCurrency(value);
    
    setBalanceAdjustment({
      ...balanceAdjustment,
      amount: numericValue,
      amountDisplay: formatted
    });
  };

  useEffect(() => {
    loadUsers();
    loadClosureRequests();
  }, [searchQuery]);

  const loadClosureRequests = async () => {
    try {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('account_closure_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClosureRequests(data || []);
    } catch (error) {
      console.error('Erro ao carregar solicitações de encerramento:', error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setUsers([]);
        return;
      }

      let query = supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,id.eq.${searchQuery}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadKYCDocuments = async (userId: string) => {
    try {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKycDocuments(data || []);
    } catch (error) {
      console.error('Erro ao carregar documentos KYC:', error);
      toast.error('Erro ao carregar documentos KYC');
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;

    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const adjustment = balanceAdjustment.type === 'credit' 
        ? balanceAdjustment.amount 
        : -balanceAdjustment.amount;

      const { error } = await supabase
        .from('users')
        .update({ 
          balance: selectedUser.balance + adjustment 
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Registrar transação
      await supabase
        .from('transactions')
        .insert([{
          user_id: selectedUser.id,
          type: balanceAdjustment.type === 'credit' ? 'deposit' : 'withdrawal',
          amount: Math.abs(adjustment),
          method: 'manual_adjustment',
          status: 'completed',
        }]);

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
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('kyc_documents')
        .update({ 
          status,
          rejection_reason: reason || null,
          verified_at: new Date().toISOString()
        })
        .eq('id', docId);

      if (error) throw error;
      toast.success(`Documento ${status === 'approved' ? 'aprovado' : 'rejeitado'}!`);
      if (selectedUser) {
        loadKYCDocuments(selectedUser.id);
      }
    } catch (error: any) {
      console.error('Erro ao atualizar status KYC:', error);
      toast.error(error.message || 'Erro ao atualizar status');
    }
  };

  return (
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Gestão de Usuários</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Gerencie contas, saldos e KYC</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">

        {/* Notificação de Solicitações Pendentes */}
        {closureRequests.length > 0 && (
          <div className="mb-4 bg-yellow-900/30 border border-yellow-800 rounded p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-sm font-medium text-yellow-200">
                    {closureRequests.length} solicitação(ões) de encerramento/exclusão pendente(s)
                  </p>
                  <p className="text-xs text-yellow-400 mt-1">
                    Clique para visualizar e responder
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedClosureRequest(closureRequests[0]);
                  setShowClosureModal(true);
                }}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded transition-colors"
              >
                Ver Solicitações
              </button>
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, E-mail ou Nome..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
            />
          </div>
        </div>

        {/* Tabela de Usuários */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">E-mail</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">{user.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{user.email}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-500">R$ {user.balance.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.is_demo ? 'bg-gray-800 text-gray-400' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {user.is_demo ? 'Demo' : 'Real'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setBalanceAdjustment({ amount: 0, amountDisplay: '', type: 'credit', reason: '' });
                              setShowBalanceModal(true);
                            }}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
                            title="Ajustar Saldo"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              loadKYCDocuments(user.id);
                              setShowKYCModal(true);
                            }}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
                            title="Ver KYC"
                          >
                            <FileText className="w-3.5 h-3.5" />
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

        {/* Modal de Ajuste de Saldo */}
        {showBalanceModal && selectedUser && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-gray-800 rounded max-w-md w-full">
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-semibold text-gray-200 uppercase tracking-wide">Ajustar Saldo</h2>
                  <button
                    onClick={() => {
                      setShowBalanceModal(false);
                      setBalanceAdjustment({ amount: 0, amountDisplay: '', type: 'credit', reason: '' });
                    }}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="mb-4 bg-gray-900 border border-gray-800 rounded p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Usuário</p>
                  <p className="text-sm font-medium text-gray-200">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mt-2 mb-1">Saldo Atual</p>
                  <p className="text-sm font-semibold text-green-500">R$ {selectedUser.balance.toFixed(2)}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Tipo</label>
                    <select
                      value={balanceAdjustment.type}
                      onChange={(e) => setBalanceAdjustment({ ...balanceAdjustment, type: e.target.value as 'credit' | 'debit' })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    >
                      <option value="credit">Crédito</option>
                      <option value="debit">Débito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Valor</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                      <input
                        type="text"
                        value={balanceAdjustment.amountDisplay}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        onBlur={(e) => {
                          // Garantir que sempre tenha formato completo ao sair do campo
                          if (e.target.value && !e.target.value.includes(',')) {
                            const formatted = formatCurrency(e.target.value.replace(/\D/g, ''));
                            setBalanceAdjustment({
                              ...balanceAdjustment,
                              amountDisplay: formatted
                            });
                          }
                        }}
                        className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                        placeholder="0,00"
                      />
                    </div>
                    {balanceAdjustment.amount > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {balanceAdjustment.type === 'credit' ? 'Crédito de' : 'Débito de'} R$ {balanceAdjustment.amount.toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Motivo</label>
                    <textarea
                      value={balanceAdjustment.reason}
                      onChange={(e) => setBalanceAdjustment({ ...balanceAdjustment, reason: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                      rows={3}
                      placeholder="Motivo do ajuste..."
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-800">
                    <button
                      onClick={handleAdjustBalance}
                      className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
                    >
                      Aplicar
                    </button>
                    <button
                      onClick={() => {
                        setShowBalanceModal(false);
                        setBalanceAdjustment({ amount: 0, type: 'credit', reason: '' });
                      }}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs font-medium text-gray-400 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de KYC */}
        {showKYCModal && selectedUser && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-gray-800 rounded max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-semibold text-gray-200 uppercase tracking-wide">Documentos KYC - {selectedUser.name}</h2>
                  <button
                    onClick={() => {
                      setShowKYCModal(false);
                      setSelectedUser(null);
                      setKycDocuments([]);
                    }}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  {kycDocuments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">Nenhum documento encontrado</div>
                  ) : (
                    kycDocuments.map((doc) => {
                      let fileData: any = null;
                      try {
                        fileData = typeof doc.file_url === 'string' && doc.file_url.startsWith('{') 
                          ? JSON.parse(doc.file_url) 
                          : { document: doc.file_url, selfie: null };
                      } catch {
                        fileData = { document: doc.file_url, selfie: null };
                      }
                      
                      return (
                        <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-gray-200 mb-2 uppercase tracking-wide">
                                {doc.document_type === 'proof_of_identity' ? 'Prova de Identidade' : 
                                 doc.document_type === 'personal_details' ? 'Dados Pessoais' : 
                                 doc.document_type}
                              </h3>
                              <p className="text-xs text-gray-500 mb-2">
                                Status: <span className={`font-medium capitalize ${
                                  doc.status === 'approved' ? 'text-green-500' :
                                  doc.status === 'rejected' ? 'text-red-500' : 'text-gray-400'
                                }`}>{doc.status === 'approved' ? 'Aprovado' : doc.status === 'rejected' ? 'Rejeitado' : 'Pendente'}</span>
                              </p>
                              {doc.rejection_reason && (
                                <p className="text-xs text-red-500 mb-2">Motivo: {doc.rejection_reason}</p>
                              )}
                              
                              {/* Mostrar documento e selfie se for proof_of_identity */}
                              {doc.document_type === 'proof_of_identity' && fileData ? (
                                <div className="mt-3 space-y-2">
                                  {fileData.document && (
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">Documento de Identificação:</p>
                                      <img 
                                        src={fileData.document} 
                                        alt="Documento" 
                                        className="max-w-xs border border-gray-700 rounded mb-2"
                                      />
                                    </div>
                                  )}
                                  {fileData.selfie && (
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">Selfie com Documento:</p>
                                      <img 
                                        src={fileData.selfie} 
                                        alt="Selfie" 
                                        className="max-w-xs border border-gray-700 rounded"
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2">
                                  {fileData && typeof fileData === 'object' && fileData.fullName ? (
                                    <div className="text-xs text-gray-400 space-y-1">
                                      <p>Nome: {fileData.fullName}</p>
                                      {fileData.birthDate && <p>Data de Nascimento: {fileData.birthDate}</p>}
                                      {fileData.documentType && <p>Tipo: {fileData.documentType.toUpperCase()}</p>}
                                      {fileData.documentNumber && <p>Número: {fileData.documentNumber}</p>}
                                    </div>
                                  ) : (
                                    <a
                                      href={typeof fileData === 'string' ? fileData : doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-gray-400 hover:text-gray-300 underline"
                                    >
                                      Ver documento
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            {doc.status === 'pending' && (
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => handleKYCStatus(doc.id, 'approved')}
                                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-green-400 transition-colors"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt('Motivo da rejeição:');
                                    if (reason) {
                                      handleKYCStatus(doc.id, 'rejected', reason);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-red-400 transition-colors"
                                >
                                  Rejeitar
                                </button>
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
          </div>
        )}

        {/* Modal de Solicitação de Encerramento/Exclusão */}
        {showClosureModal && selectedClosureRequest && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-200">
                    Solicitação de {selectedClosureRequest.request_type === 'close' ? 'Encerramento' : 'Exclusão'} de Conta
                  </h2>
                  <button
                    onClick={() => {
                      setShowClosureModal(false);
                      setSelectedClosureRequest(null);
                    }}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Informações do Usuário */}
                  <div className="bg-gray-800 rounded p-4">
                    <p className="text-xs text-gray-400 mb-1">Usuário</p>
                    <p className="text-sm text-gray-200">
                      {users.find(u => u.id === selectedClosureRequest.user_id)?.name || 'N/A'} 
                      ({users.find(u => u.id === selectedClosureRequest.user_id)?.email || 'N/A'})
                    </p>
                  </div>

                  {/* Tipo de Solicitação */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Tipo de Solicitação</p>
                    <p className="text-sm text-gray-200">
                      {selectedClosureRequest.request_type === 'close' ? 'Encerramento Temporário' : 'Exclusão Permanente'}
                    </p>
                  </div>

                  {/* Motivo */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Motivo</p>
                    <p className="text-sm text-gray-200 bg-gray-800 rounded p-3">
                      {selectedClosureRequest.reason}
                    </p>
                  </div>

                  {/* Prazo de Resposta */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Prazo de Resposta</p>
                    <p className="text-sm text-gray-200">
                      {new Date(selectedClosureRequest.response_deadline).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Data de Solicitação */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Data de Solicitação</p>
                    <p className="text-sm text-gray-200">
                      {new Date(selectedClosureRequest.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Resposta do Admin */}
                  {selectedClosureRequest.status !== 'pending' && selectedClosureRequest.admin_response && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Resposta do Admin</p>
                      <p className="text-sm text-gray-200 bg-gray-800 rounded p-3">
                        {selectedClosureRequest.admin_response}
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  {selectedClosureRequest.status === 'pending' && (
                    <div className="flex items-center space-x-3 pt-4 border-t border-gray-800">
                      <button
                        onClick={async () => {
                          try {
                            if (!supabase) {
                              toast.error('Banco de dados não configurado');
                              return;
                            }

                            const response = prompt('Digite a resposta para o usuário:');
                            if (!response) return;

                            const { error } = await supabase
                              .from('account_closure_requests')
                              .update({
                                status: selectedClosureRequest.request_type === 'close' ? 'completed' : 'approved',
                                admin_response: response,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', selectedClosureRequest.id);

                            if (error) throw error;
                            toast.success('Solicitação aprovada!');
                            loadClosureRequests();
                            setShowClosureModal(false);
                            setSelectedClosureRequest(null);
                          } catch (error: any) {
                            console.error('Erro ao aprovar solicitação:', error);
                            toast.error(error.message || 'Erro ao aprovar solicitação');
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            if (!supabase) {
                              toast.error('Banco de dados não configurado');
                              return;
                            }

                            const response = prompt('Digite o motivo da rejeição:');
                            if (!response) return;

                            const { error } = await supabase
                              .from('account_closure_requests')
                              .update({
                                status: 'rejected',
                                admin_response: response,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', selectedClosureRequest.id);

                            if (error) throw error;
                            toast.success('Solicitação rejeitada!');
                            loadClosureRequests();
                            setShowClosureModal(false);
                            setSelectedClosureRequest(null);
                          } catch (error: any) {
                            console.error('Erro ao rejeitar solicitação:', error);
                            toast.error(error.message || 'Erro ao rejeitar solicitação');
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
                      >
                        Rejeitar
                      </button>
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

