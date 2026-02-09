'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalTrades: number;
  activeTrades: number;
  totalRevenue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  winRate: number;
  avgTradeAmount: number;
}

interface ChartData {
  date: string;
  users: number;
  trades: number;
  revenue: number;
  deposits: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalTrades: 0,
    activeTrades: 0,
    totalRevenue: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    winRate: 0,
    avgTradeAmount: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        // Dados mockados se Supabase não estiver configurado
        setMockData();
        return;
      }

      // Calcular período
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Buscar dados do banco
      await Promise.all([
        loadUsersData(startDate),
        loadTradesData(startDate),
        loadTransactionsData(startDate),
        loadChartData(startDate, days),
      ]);
    } catch (error: any) {
      console.error('Erro ao carregar analytics:', error);
      toast.error('Erro ao carregar dados de analytics');
      setMockData(); // Fallback para dados mockados
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUsersData = async (startDate: Date) => {
    if (!supabase) return;

    try {
      // Total de usuários
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Usuários ativos (fizeram trade ou transação no período)
      const { count: activeUsers } = await supabase
        .from('trades')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString());

      setData(prev => ({
        ...prev,
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
      }));
    } catch (error) {
      console.error('Erro ao carregar dados de usuários:', error);
    }
  };

  const loadTradesData = async (startDate: Date) => {
    if (!supabase) return;

    try {
      // Total de trades
      const { count: totalTrades } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString());

      // Trades ativos
      const { count: activeTrades } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .is('exit_price', null)
        .is('result', null);

      // Trades vencedores para calcular win rate
      const { count: winningTrades } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'win')
        .gte('created_at', startDate.toISOString());

      // Receita total (soma dos profits)
      const { data: tradesData } = await supabase
        .from('trades')
        .select('amount, profit, result')
        .gte('created_at', startDate.toISOString())
        .not('result', 'is', null);

      let totalRevenue = 0;
      let totalAmount = 0;
      if (tradesData) {
        tradesData.forEach(trade => {
          totalAmount += parseFloat(trade.amount.toString());
          if (trade.result === 'loss' && trade.profit) {
            totalRevenue += Math.abs(parseFloat(trade.profit.toString()));
          }
        });
      }

      const winRate = totalTrades && totalTrades > 0 
        ? ((winningTrades || 0) / totalTrades * 100) 
        : 0;
      
      const avgTradeAmount = totalTrades && totalTrades > 0
        ? totalAmount / totalTrades
        : 0;

      setData(prev => ({
        ...prev,
        totalTrades: totalTrades || 0,
        activeTrades: activeTrades || 0,
        totalRevenue,
        winRate,
        avgTradeAmount,
      }));
    } catch (error) {
      console.error('Erro ao carregar dados de trades:', error);
    }
  };

  const loadTransactionsData = async (startDate: Date) => {
    if (!supabase) return;

    try {
      // Depósitos
      const { data: deposits } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString());

      // Saques
      const { data: withdrawals } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'withdrawal')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString());

      const totalDeposits = deposits?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      const totalWithdrawals = withdrawals?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

      setData(prev => ({
        ...prev,
        totalDeposits,
        totalWithdrawals,
      }));
    } catch (error) {
      console.error('Erro ao carregar dados de transações:', error);
    }
  };

  const loadChartData = async (startDate: Date, days: number) => {
    if (!supabase) return;

    try {
      const chartDataArray: ChartData[] = [];
      
      // Gerar dados para cada dia do período
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        // Usuários criados no dia
        const { count: users } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateStr)
          .lt('created_at', nextDateStr);

        // Trades no dia
        const { count: trades } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dateStr)
          .lt('created_at', nextDateStr);

        // Receita do dia
        const { data: tradesData } = await supabase
          .from('trades')
          .select('profit, result')
          .gte('created_at', dateStr)
          .lt('created_at', nextDateStr)
          .eq('result', 'loss');

        const revenue = tradesData?.reduce((sum, t) => {
          if (t.profit) {
            return sum + Math.abs(parseFloat(t.profit.toString()));
          }
          return sum;
        }, 0) || 0;

        // Depósitos do dia
        const { data: deposits } = await supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'deposit')
          .eq('status', 'completed')
          .gte('created_at', dateStr)
          .lt('created_at', nextDateStr);

        const depositsAmount = deposits?.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

        chartDataArray.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          users: users || 0,
          trades: trades || 0,
          revenue,
          deposits: depositsAmount,
        });
      }

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Erro ao carregar dados do gráfico:', error);
    }
  };

  const setMockData = () => {
    // Dados mockados para desenvolvimento
    setData({
      totalUsers: 1247,
      activeUsers: 342,
      totalTrades: 5892,
      activeTrades: 89,
      totalRevenue: 125000,
      totalDeposits: 250000,
      totalWithdrawals: 45000,
      winRate: 58.3,
      avgTradeAmount: 125.50,
    });

    // Dados mockados do gráfico
    const mockChartData: ChartData[] = [];
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      mockChartData.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        users: Math.floor(Math.random() * 20) + 5,
        trades: Math.floor(Math.random() * 200) + 50,
        revenue: Math.floor(Math.random() * 5000) + 1000,
        deposits: Math.floor(Math.random() * 10000) + 2000,
      });
    }
    setChartData(mockChartData);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="bg-black text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Analytics</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Estatísticas e análises da plataforma</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPeriod('7d')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  period === '7d'
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-900 text-gray-400 hover:text-gray-300 border border-gray-800'
                }`}
              >
                7 dias
              </button>
              <button
                onClick={() => setPeriod('30d')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  period === '30d'
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-900 text-gray-400 hover:text-gray-300 border border-gray-800'
                }`}
              >
                30 dias
              </button>
              <button
                onClick={() => setPeriod('90d')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  period === '90d'
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'bg-gray-900 text-gray-400 hover:text-gray-300 border border-gray-800'
                }`}
              >
                90 dias
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-4">Carregando analytics...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">Total</span>
                </div>
                <h3 className="text-xl font-semibold mb-1 text-white">{data.totalUsers.toLocaleString('pt-BR')}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Usuários</p>
                <p className="text-xs text-gray-400 mt-1">{data.activeUsers} ativos</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-3">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">Total</span>
                </div>
                <h3 className="text-xl font-semibold mb-1 text-white">{data.totalTrades.toLocaleString('pt-BR')}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Trades</p>
                <p className="text-xs text-gray-400 mt-1">{data.activeTrades} ativos</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">Receita</span>
                </div>
                <h3 className="text-xl font-semibold mb-1 text-white">{formatCurrency(data.totalRevenue)}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className={`text-xs font-medium ${data.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.winRate.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-1 text-white">{formatCurrency(data.avgTradeAmount)}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Ticket Médio</p>
                <p className="text-xs text-gray-400 mt-1">Win Rate: {data.winRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Depósitos</span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">{formatCurrency(data.totalDeposits)}</h3>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Saques</span>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">{formatCurrency(data.totalWithdrawals)}</h3>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Saldo Líquido</span>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {formatCurrency(data.totalDeposits - data.totalWithdrawals)}
                </h3>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Trades Chart */}
              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">Trades ao Longo do Tempo</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid #374151',
                        borderRadius: '4px',
                        color: '#F3F4F6'
                      }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="trades" stroke="#3B82F6" strokeWidth={2} name="Trades" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Chart */}
              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">Receita ao Longo do Tempo</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid #374151',
                        borderRadius: '4px',
                        color: '#F3F4F6'
                      }} 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10B981" name="Receita" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Users and Deposits Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">Novos Usuários</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid #374151',
                        borderRadius: '4px',
                        color: '#F3F4F6'
                      }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#8B5CF6" strokeWidth={2} name="Usuários" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 uppercase tracking-wide">Depósitos ao Longo do Tempo</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: '1px solid #374151',
                        borderRadius: '4px',
                        color: '#F3F4F6'
                      }} 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="deposits" fill="#F59E0B" name="Depósitos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
