'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Filter,
  Download,
  Search,
  Calendar,
  DollarSign,
  Target,
  BarChart3
} from 'lucide-react';
import { BinaryOption, TradingStats } from '@/types';

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<BinaryOption[]>([]);
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'pending'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<TradingStats | null>(null);

  // Dados simulados de negociações
  useEffect(() => {
    const mockTrades: BinaryOption[] = [
      {
        id: '1',
        userId: user?.id || '1',
        assetId: '1',
        assetSymbol: 'EUR/USD',
        direction: 'call',
        amount: 50,
        payout: 40,
        expiryTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'won',
        resultPrice: 1.0850,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: '2',
        userId: user?.id || '1',
        assetId: '3',
        assetSymbol: 'Bitcoin',
        direction: 'put',
        amount: 100,
        payout: 80,
        expiryTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'lost',
        resultPrice: 43500,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        id: '3',
        userId: user?.id || '1',
        assetId: '5',
        assetSymbol: 'Apple',
        direction: 'call',
        amount: 75,
        payout: 60,
        expiryTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
        status: 'won',
        resultPrice: 186.20,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
      },
      {
        id: '4',
        userId: user?.id || '1',
        assetId: '6',
        assetSymbol: 'Gold',
        direction: 'put',
        amount: 25,
        payout: 20,
        expiryTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
        status: 'won',
        resultPrice: 2040.50,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000)
      },
      {
        id: '5',
        userId: user?.id || '1',
        assetId: '2',
        assetSymbol: 'GBP/USD',
        direction: 'call',
        amount: 30,
        payout: 24,
        expiryTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
        status: 'lost',
        resultPrice: 1.2620,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        id: '6',
        userId: user?.id || '1',
        assetId: '4',
        assetSymbol: 'Ethereum',
        direction: 'put',
        amount: 60,
        payout: 48,
        expiryTime: new Date(Date.now() - 16 * 60 * 60 * 1000),
        status: 'won',
        resultPrice: 2620.30,
        createdAt: new Date(Date.now() - 16 * 60 * 60 * 1000)
      }
    ];

    setTrades(mockTrades);
  }, [user]);

  // Calcular estatísticas
  useEffect(() => {
    if (trades.length > 0) {
      const totalTrades = trades.length;
      const winningTrades = trades.filter(trade => trade.status === 'won').length;
      const losingTrades = trades.filter(trade => trade.status === 'lost').length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      
      const totalProfit = trades
        .filter(trade => trade.status === 'won')
        .reduce((sum, trade) => sum + trade.payout, 0);
      
      const totalLoss = trades
        .filter(trade => trade.status === 'lost')
        .reduce((sum, trade) => sum + trade.amount, 0);
      
      const netProfit = totalProfit - totalLoss;

      setStats({
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalProfit,
        totalLoss,
        netProfit
      });
    }
  }, [trades]);

  const filteredTrades = trades.filter(trade => {
    const matchesFilter = filter === 'all' || trade.status === filter;
    const matchesSearch = trade.assetSymbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const now = new Date();
      const tradeDate = new Date(trade.createdAt);
      
      switch (dateFilter) {
        case 'today':
          matchesDate = tradeDate.toDateString() === now.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = tradeDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = tradeDate >= monthAgo;
          break;
      }
    }
    
    return matchesFilter && matchesSearch && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'text-green-600 bg-green-50';
      case 'lost':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won':
        return 'Ganhou';
      case 'lost':
        return 'Perdeu';
      case 'pending':
        return 'Pendente';
      default:
        return status;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'call' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getDirectionText = (direction: string) => {
    return direction === 'call' ? 'Alta' : 'Baixa';
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Histórico de Negociações</h1>
        <p className="text-gray-600 mt-2">Acompanhe todas as suas negociações e performance</p>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Negociações</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTrades}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-gray-900">{stats.winRate.toFixed(1)}%</p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lucro Total</p>
                <p className="text-2xl font-bold text-green-600">
                  +${stats.totalProfit.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resultado Líquido</p>
                <p className={`text-2xl font-bold ${
                  stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por ativo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os resultados</option>
              <option value="won">Ganhou</option>
              <option value="lost">Perdeu</option>
              <option value="pending">Pendente</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os períodos</option>
              <option value="today">Hoje</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
            </select>
          </div>

          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Lista de Negociações */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Negociações ({filteredTrades.length})
          </h3>
        </div>
        
        {filteredTrades.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredTrades.map((trade) => (
              <div key={trade.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getDirectionIcon(trade.direction)}
                      <div>
                        <h4 className="font-medium text-gray-900">{trade.assetSymbol}</h4>
                        <p className="text-sm text-gray-500">
                          {getDirectionText(trade.direction)} • ${trade.amount}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {trade.createdAt.toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-sm text-gray-500">
                        {trade.createdAt.toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Payout: ${trade.payout.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Total: ${(trade.amount + trade.payout).toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(trade.status)}`}>
                        {getStatusText(trade.status)}
                      </span>
                      {trade.resultPrice && (
                        <p className="text-sm text-gray-500 mt-1">
                          Resultado: ${trade.resultPrice.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma negociação encontrada
            </h3>
            <p className="text-gray-500">
              {searchTerm || filter !== 'all' || dateFilter !== 'all'
                ? 'Tente ajustar os filtros para encontrar negociações'
                : 'Comece a negociar para ver seu histórico aqui'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
