'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle,
  Power,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  BarChart3,
  Megaphone,
  Trophy,
  Newspaper,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const router = useRouter();
  // TEMPORÁRIO: Removida dependência de autenticação para testes
  const [tradingEnabled, setTradingEnabled] = useState(true);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTrades: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadTradingStatus();
    loadStats();
  }, []);

  const loadTradingStatus = async () => {
    try {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'trading_enabled')
        .single();

      if (!error && data) {
        setTradingEnabled(data.value as boolean);
      }
    } catch (error) {
      console.error('Erro ao carregar status de trading:', error);
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm(`Tem certeza que deseja ${tradingEnabled ? 'DESATIVAR' : 'ATIVAR'} todas as operações de trading?`)) {
      return;
    }

    setKillSwitchLoading(true);
    try {
      if (!supabase) {
        setTradingEnabled(!tradingEnabled);
        toast.success(`Trading ${!tradingEnabled ? 'ativado' : 'desativado'}!`);
        return;
      }

      const newStatus = !tradingEnabled;
      
      // Atualizar ou criar configuração
      const { error: upsertError } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'trading_enabled',
          value: newStatus,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (upsertError) throw upsertError;

      // Registrar no log
      await supabase
        .from('admin_logs')
        .insert([{
          admin_id: null, // Temporário: sem verificação de usuário
          action: newStatus ? 'trading_enabled' : 'trading_disabled',
          entity_type: 'platform',
          details: { trading_enabled: newStatus }
        }]);

      setTradingEnabled(newStatus);
      toast.success(`Trading ${newStatus ? 'ativado' : 'DESATIVADO'} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao alterar status de trading:', error);
      toast.error(error.message || 'Erro ao alterar status');
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const menuItems = [
    {
      id: 'finance',
      title: 'Gestão Financeira',
      icon: DollarSign,
      description: 'Depósitos, saques e transações',
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      id: 'payment-gateways',
      title: 'Gateways de Pagamento',
      icon: Settings,
      description: 'Configurar APIs de pagamento',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'users',
      title: 'Usuários e CRM',
      icon: Users,
      description: 'Gerenciar usuários, saldos e KYC',
      color: 'bg-indigo-600 hover:bg-indigo-700',
    },
    {
      id: 'trading-monitor',
      title: 'Monitor de Operações',
      icon: BarChart3,
      description: 'Trades ativos em tempo real',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      id: 'trading-config',
      title: 'Configuração de Trading',
      icon: Settings,
      description: 'Payout, ativos e horários',
      color: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
      id: 'promotions',
      title: 'Promoções',
      icon: Megaphone,
      description: 'Gerenciar promoções e campanhas',
      color: 'bg-pink-600 hover:bg-pink-700',
    },
    {
      id: 'leaderboard',
      title: 'Tabela de Líderes',
      icon: Trophy,
      description: 'Gerenciar ranking de traders',
      color: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      id: 'news',
      title: 'Notícias de Mercado',
      icon: Newspaper,
      description: 'Gerenciar notícias e análises',
      color: 'bg-teal-600 hover:bg-teal-700',
    },
    {
      id: 'calendar',
      title: 'Calendário Econômico',
      icon: Calendar,
      description: 'Gerenciar eventos econômicos',
      color: 'bg-cyan-600 hover:bg-cyan-700',
    },
    {
      id: 'chats',
      title: 'Chats e Suporte',
      icon: MessageSquare,
      description: 'Atender chamados de suporte',
      color: 'bg-red-600 hover:bg-red-700',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      description: 'Estatísticas e relatórios',
      color: 'bg-violet-600 hover:bg-violet-700',
    },
    {
      id: 'settings',
      title: 'Configurações',
      icon: Settings,
      description: 'Configurações do sistema',
      color: 'bg-gray-600 hover:bg-gray-700',
    },
  ];

  const loadStats = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setLoading(false);
        return;
      }

      // Buscar total de usuários
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Buscar trades ativos
      const { count: activeTrades } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .is('exit_price', null)
        .is('result', null);

      // Buscar depósitos completados
      const { data: depositsData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit')
        .eq('status', 'completed');

      const totalDeposits = depositsData?.reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0) || 0;

      // Buscar saques completados
      const { data: withdrawalsData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'withdrawal')
        .eq('status', 'completed');

      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0) || 0;

      // Buscar depósitos pendentes
      const { count: pendingDeposits } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'deposit')
        .eq('status', 'pending');

      // Buscar saques pendentes
      const { count: pendingWithdrawals } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'withdrawal')
        .eq('status', 'pending');

      setStats({
        totalUsers: totalUsers || 0,
        activeTrades: activeTrades || 0,
        totalDeposits,
        totalWithdrawals,
        pendingDeposits: pendingDeposits || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
      });

      // Buscar atividades recentes
      await loadRecentActivity();
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      if (!supabase) return;

      // Buscar últimas transações
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          *,
          user:users!transactions_user_id_fkey(id, email, name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactions) {
        const activity = transactions.map((tx: any) => {
          const date = new Date(tx.created_at);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          
          let timeStr = '';
          if (diffMins < 60) {
            timeStr = `${diffMins} min atrás`;
          } else if (diffHours < 24) {
            timeStr = `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
          } else {
            const diffDays = Math.floor(diffHours / 24);
            timeStr = `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
          }

          return {
            type: tx.type,
            user: tx.user?.email || tx.user?.name || 'Usuário',
            amount: parseFloat(tx.amount.toString()),
            time: timeStr,
          };
        });
        setRecentActivity(activity);
      }
    } catch (error) {
      console.error('Erro ao carregar atividades recentes:', error);
    }
  };

  return (
    <div className="bg-black text-white">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10 bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-200">Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Visão geral da plataforma</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs">
                <span className="text-gray-500">Usuário:</span>
                <span className="ml-2 font-medium text-gray-300">Admin</span>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Kill Switch */}
        <div className={`px-6 py-2.5 border-b ${
          tradingEnabled ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-900/50 border-gray-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className={`w-4 h-4 ${
                tradingEnabled ? 'text-green-500' : 'text-red-500'
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Status de Trading: <span className={tradingEnabled ? 'text-green-500' : 'text-red-500'}>
                    {tradingEnabled ? 'ATIVO' : 'DESATIVADO'}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {tradingEnabled 
                    ? 'Todas as operações estão permitidas'
                    : 'Todas as novas operações estão bloqueadas'}
                </p>
              </div>
            </div>
            <button
              onClick={handleKillSwitch}
              disabled={killSwitchLoading}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                tradingEnabled
                  ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-red-400 hover:text-red-300'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-green-400 hover:text-green-300'
              } disabled:opacity-50`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{killSwitchLoading ? 'Processando...' : tradingEnabled ? 'DESATIVAR' : 'ATIVAR'}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <main className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Total</span>
              </div>
              <h3 className="text-xl font-semibold mb-1 text-white">{loading ? '...' : stats.totalUsers.toLocaleString('pt-BR')}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total de Usuários</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Ativos</span>
              </div>
              <h3 className="text-xl font-semibold mb-1 text-white">{loading ? '...' : stats.activeTrades}</h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Trades em Andamento</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Total</span>
              </div>
              <h3 className="text-xl font-semibold mb-1 text-green-500">
                {loading ? '...' : `R$ ${stats.totalDeposits.toLocaleString('pt-BR')}`}
              </h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Depositado</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingDown className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Total</span>
              </div>
              <h3 className="text-xl font-semibold mb-1 text-red-500">
                {loading ? '...' : `R$ ${stats.totalWithdrawals.toLocaleString('pt-BR')}`}
              </h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sacado</p>
            </div>
          </div>

          {/* Charts and Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Revenue Chart - Removido gráfico fictício */}
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded p-5 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Visualize gráficos detalhados em</p>
                <button
                  onClick={() => router.push('/admin/analytics')}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1 underline"
                >
                  Analytics
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <h3 className="text-sm font-semibold mb-4 text-gray-300 uppercase tracking-wide">Atividade Recente</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          activity.type === 'deposit' ? 'bg-green-500' :
                          activity.type === 'withdrawal' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`} />
                        <div>
                          <p className="text-xs font-medium text-gray-300">{activity.user}</p>
                          <p className="text-[10px] text-gray-500">{activity.time}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${
                        activity.type === 'deposit' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {activity.type === 'deposit' ? '+' : '-'}R$ {activity.amount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-500">Nenhuma atividade recente</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Depósitos Pendentes</h3>
                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] font-medium">
                  {loading ? '...' : stats.pendingDeposits}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Aprovação necessária</p>
              <button
                onClick={() => router.push('/admin/finance?tab=deposits&status=pending')}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-xs font-medium text-gray-300"
              >
                Ver Depósitos
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Saques Pendentes</h3>
                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] font-medium">
                  {loading ? '...' : stats.pendingWithdrawals}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">Aprovação necessária</p>
              <button
                onClick={() => router.push('/admin/finance?tab=withdrawals&status=pending')}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-xs font-medium text-gray-300"
              >
                Ver Saques
              </button>
            </div>
          </div>
        </main>
    </div>
  );
}

