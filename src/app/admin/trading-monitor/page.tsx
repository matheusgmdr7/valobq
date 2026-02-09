'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, TrendingUp, TrendingDown, Clock, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ActiveTrade {
  id: string;
  user_id: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  entry_price: number;
  expiration: number;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
}

export default function TradingMonitorPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<ActiveTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTrades();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadTrades();
      }, 3000); // Atualiza dados a cada 3 segundos
    }
    
    // Atualizar contadores de tempo a cada segundo
    timeUpdateRef.current = setInterval(() => {
      // Força re-render para atualizar contadores
      setTrades(prev => [...prev]);
    }, 1000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current);
    };
  }, [autoRefresh]);

  const loadTrades = async () => {
    try {
      if (!supabase) {
        setTrades([]);
        setLoading(false);
        return;
      }

      // Buscar trades ativos (sem exit_price ou result)
      // expiration é um timestamp em milissegundos
      const now = Date.now();
      
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          user:users!trades_user_id_fkey(id, name, email)
        `)
        .is('exit_price', null)
        .is('result', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        // Se a tabela não existir, apenas retornar array vazio
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTrades([]);
          setLoading(false);
          return;
        }
        throw error;
      }

      // Filtrar apenas trades que ainda não expiraram
      const activeTrades = (data || []).filter((trade: any) => {
        // expiration pode ser timestamp ou número de segundos/minutos
        // Vamos assumir que é em milissegundos (timestamp)
        const expirationTime = new Date(trade.created_at).getTime() + (trade.expiration * 1000);
        return expirationTime > now;
      });

      setTrades(activeTrades as ActiveTrade[]);
      setLoading(false);
    } catch (error: any) {
      console.error('Erro ao carregar trades:', error);
      // Não mostrar toast se for erro de tabela não existir
      if (error?.code !== '42P01' && !error?.message?.includes('does not exist')) {
        toast.error('Erro ao carregar trades ativos');
      }
      setTrades([]);
      setLoading(false);
    }
  };

  const getTotalVolume = () => {
    return trades.reduce((sum, trade) => sum + trade.amount, 0);
  };

  const getTotalByType = (type: 'call' | 'put') => {
    return trades
      .filter(t => t.type === type)
      .reduce((sum, trade) => sum + trade.amount, 0);
  };

  const stats = {
    total: trades.length,
    totalVolume: getTotalVolume(),
    callVolume: getTotalByType('call'),
    putVolume: getTotalByType('put'),
  };

  return (
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Monitor de Operações</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Trades ativos em tempo real</p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
              autoRefresh 
                ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-green-400 hover:text-green-300' 
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            {autoRefresh ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
            <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Ativos</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-white">{stats.total}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Trades Ativos</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Total</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-green-500">R$ {stats.totalVolume.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Volume Total</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">CALL</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-green-500">R$ {stats.callVolume.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Volume CALL</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingDown className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">PUT</span>
            </div>
            <h3 className="text-xl font-semibold mb-1 text-red-500">R$ {stats.putVolume.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Volume PUT</p>
          </div>
        </div>

        {/* Tabela de Trades */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ativo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Preço Entrada</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Expiração</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tempo Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Nenhum trade ativo no momento
                      </td>
                    </tr>
                  ) : (
                    trades.map((trade) => {
                      const expirationTime = new Date(new Date(trade.created_at).getTime() + trade.expiration * 1000);
                      const timeRemaining = Math.max(0, Math.floor((expirationTime.getTime() - Date.now()) / 1000));
                      const minutes = Math.floor(timeRemaining / 60);
                      const seconds = timeRemaining % 60;
                      const isExpired = timeRemaining <= 0;

                      return (
                        <tr key={trade.id} className={`hover:bg-gray-800/50 ${isExpired ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-300">{trade.id.slice(0, 8)}...</td>
                          <td className="px-4 py-3 text-sm text-gray-200">
                            {trade.user?.name || trade.user_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-200">{trade.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.type === 'call' 
                                ? 'bg-gray-800 text-green-500' 
                                : 'bg-gray-800 text-red-500'
                            }`}>
                              {trade.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-500">R$ {trade.amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{trade.entry_price.toFixed(8)}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {expirationTime.toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {!isExpired ? (
                              <span className="flex items-center space-x-1 text-gray-300">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-mono">{minutes}:{seconds.toString().padStart(2, '0')}</span>
                              </span>
                            ) : (
                              <span className="text-red-500 font-medium">Expirado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

