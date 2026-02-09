'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  User, 
  CheckCircle2,
  Calendar,
  ChevronDown,
  X,
  History,
  ArrowRight,
  DollarSign,
  RotateCcw,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  status: string;
  method?: string;
  created_at: string;
}

export default function TransactionsPage() {
  const { user, logout, activeBalance, accountType } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('POLARIUM BROKER');
  const [userPhoto, setUserPhoto] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_photo') || null;
    }
    return null;
  });

  // Language selector
  type Language = 'pt' | 'en' | 'es';
  interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
  }
  const languages: LanguageOption[] = [
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];
  const [language, setLanguage] = useState<Language>('pt');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    transactionType: 'all', // 'all', 'deposit', 'withdrawal'
    currency: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Carregar logo e nome da broker
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null;
        let brokerNameValue: string | null = null;
        
        if (supabase) {
          try {
            const { data: logoLightData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_logo_light')
              .single();
            
            if (logoLightData?.value) {
              logoUrl = logoLightData.value as string;
              localStorage.setItem('broker_logo_light', logoUrl);
            } else {
              const { data: logoData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_logo')
                .single();
              
              if (logoData?.value) {
                logoUrl = logoData.value as string;
                localStorage.setItem('broker_logo', logoUrl);
              }
            }
            
            const { data: nameData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_name')
              .single();
            
            if (nameData?.value) {
              brokerNameValue = nameData.value as string;
              localStorage.setItem('broker_name', brokerNameValue);
            }
          } catch (error) {
            // Fallback para localStorage
          }
        }
        
        if (!logoUrl) {
          logoUrl = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_logo_light') || localStorage.getItem('broker_logo')
            : null;
        }
        if (!brokerNameValue) {
          brokerNameValue = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_name')
            : null;
        }
        
        if (logoUrl) {
          setBrokerLogo(logoUrl);
        }
        if (brokerNameValue) {
          setBrokerName(brokerNameValue);
        }
      } catch (error) {
        console.error('Erro ao carregar dados da broker:', error);
      }
    };
    
    loadBrokerData();
  }, []);

  // Carregar transações
  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, filters]);

  const loadTransactions = async () => {
    if (!supabase || !user) return;

    setLoading(true);
    try {
      const allTransactions: Transaction[] = [];

      // Buscar depósitos
      let depositsQuery = supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id);

      if (filters.status !== 'all') {
        depositsQuery = depositsQuery.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        depositsQuery = depositsQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        depositsQuery = depositsQuery.lte('created_at', filters.dateTo);
      }

      const { data: deposits, error: depositsError } = await depositsQuery.order('created_at', { ascending: false });

      if (!depositsError && deposits) {
        deposits.forEach((deposit: any) => {
          allTransactions.push({
            id: deposit.id,
            type: 'deposit',
            amount: parseFloat(deposit.amount),
            currency: deposit.currency || 'BRL',
            status: deposit.status,
            method: deposit.method,
            created_at: deposit.created_at
          });
        });
      }

      // Buscar saques
      let withdrawalsQuery = supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id);

      if (filters.status !== 'all') {
        withdrawalsQuery = withdrawalsQuery.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        withdrawalsQuery = withdrawalsQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        withdrawalsQuery = withdrawalsQuery.lte('created_at', filters.dateTo);
      }

      const { data: withdrawals, error: withdrawalsError } = await withdrawalsQuery.order('created_at', { ascending: false });

      if (!withdrawalsError && withdrawals) {
        withdrawals.forEach((withdrawal: any) => {
          allTransactions.push({
            id: withdrawal.id,
            type: 'withdrawal',
            amount: parseFloat(withdrawal.amount),
            currency: 'BRL',
            status: withdrawal.status,
            method: withdrawal.method,
            created_at: withdrawal.created_at
          });
        });
      }

      // Filtrar por tipo de transação
      let filtered = allTransactions;
      if (filters.transactionType !== 'all') {
        filtered = allTransactions.filter(t => t.type === filters.transactionType);
      }
      if (filters.currency !== 'all') {
        filtered = filtered.filter(t => t.currency === filters.currency);
      }

      // Ordenar por data (mais recente primeiro)
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(filtered);
    } catch (error: any) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      'pending': 'Pendente',
      'approved': 'Aprovado',
      'completed': 'Concluída',
      'rejected': 'Rejeitado',
      'processing': 'Processando'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-green-600';
      case 'pending':
      case 'processing':
        return 'text-yellow-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    return type === 'deposit' ? 'Depósito' : 'Retirada';
  };

  // Calcular datas padrão (último mês)
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    if (!filters.dateFrom && !filters.dateTo) {
      setFilters(prev => ({
        ...prev,
        dateFrom: lastMonth.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      }));
    }
  }, []);

  if (!user) return null;

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header - Mesma estrutura do /profile */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          {brokerLogo && (
            <div className="flex items-center space-x-2">
              <img 
                src={brokerLogo} 
                alt={brokerName}
                className="h-16 w-auto object-contain"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">{languages.find(l => l.code === language)?.flag || '🇧🇷'}</span>
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {language === lang.code && (
                          <span className="ml-auto text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Avatar clicável */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative flex-shrink-0"
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            </button>
            
            {/* Botão Negociar */}
            <button
              onClick={() => router.push('/dashboard/trading')}
              className="bg-blue-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
              style={{ borderRadius: '0' }}
            >
              Negociar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Histórico do saldo</h1>

          {/* Filtros */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Tipo de transação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2.5">
                  Tipo de transação
                </label>
                <div className="relative">
                  <select
                    value={filters.transactionType}
                    onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="deposit">Depósito</option>
                    <option value="withdrawal">Retirada</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Moeda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2.5">
                  Moeda
                </label>
                <div className="relative">
                  <select
                    value={filters.currency}
                    onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">Todas as moedas</option>
                    <option value="BRL">BRL</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2.5">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendente</option>
                    <option value="approved">Aprovado</option>
                    <option value="completed">Concluída</option>
                    <option value="rejected">Rejeitado</option>
                    <option value="processing">Processando</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2.5">
                  Data
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <span className="text-gray-500 text-sm font-medium whitespace-nowrap">-</span>
                  <div className="relative flex-1 min-w-0">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Transações */}
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-gray-500">Carregando...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-gray-500">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tipo de transação
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Moeda
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => (
                      <tr 
                        key={transaction.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                          <span className="text-gray-500 ml-2">
                            {new Date(transaction.created_at).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {getTransactionTypeLabel(transaction.type)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.currency}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-sm font-medium ${getStatusColor(transaction.status)}`}>
                              {getStatusLabel(transaction.status)}
                            </span>
                            {transaction.status === 'completed' && (
                              <ChevronDown className="w-4 h-4 text-blue-600 cursor-pointer" />
                            )}
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
      </div>

      {/* Menu Lateral do Usuário */}
      {showUserMenu && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={() => setShowUserMenu(false)}
          />
          
          {/* Menu Lateral */}
          <div className="fixed right-0 top-0 h-full w-80 bg-gray-50 z-[101] shadow-2xl overflow-y-auto">
            {/* Header do Menu */}
            <div className="bg-gray-50 p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {/* Avatar com verificação */}
                  <div className="relative">
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-400"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center">
                        <User className="w-7 h-7 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Seção de Conta */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700">{accountType === 'demo' ? 'Conta demo' : 'Conta real'}</span>
                <span className={`text-lg font-bold ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`}>
                  R$ {activeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    router.push('/dashboard/trading');
                    setShowUserMenu(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 text-sm font-medium transition-colors"
                  style={{ borderRadius: '0' }}
                >
                  Depositar
                </button>
                <button 
                  onClick={() => {
                    router.push('/dashboard/trading');
                    setShowUserMenu(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 text-sm font-medium transition-colors"
                  style={{ borderRadius: '0' }}
                >
                  Negociar
                </button>
              </div>
            </div>

            {/* Menu de Opções */}
            <div className="py-4">
              <button 
                onClick={() => {
                  router.push('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <User className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Dados pessoais</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/profile');
                  localStorage.setItem('profile_active_section', 'verification');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <CheckCircle2 className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Verificação</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/withdrawal');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <DollarSign className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Retirar fundos</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/transactions');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Histórico do saldo</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/trading-history');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <History className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Histórico de trading</span>
              </button>
              
              <button 
                onClick={() => {
                  localStorage.setItem('open_chat_on_profile', 'true');
                  router.push('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <HelpCircle className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Serviço de suporte</span>
              </button>
            </div>

            {/* Botão Sair */}
            <div className="mt-4 border-t border-gray-300 pt-4">
              <button 
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                  router.push('/login');
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors"
              >
                <ArrowRight className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

