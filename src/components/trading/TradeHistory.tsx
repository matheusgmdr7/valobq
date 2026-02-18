'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTradeHistory, Trade } from '@/services/tradesService';
import { TrendingUp, TrendingDown, BarChart3, ChevronDown } from 'lucide-react';
import { logger } from '@/utils/logger';

// Categorias de ativos (mesmas do dropdown de seleção de ativos)
const assetCategories = [
  { value: 'all', label: 'Todos os ativos' },
  { value: 'crypto', label: 'Criptomoedas' },
  { value: 'forex', label: 'Forex' },
  { value: 'stocks', label: 'Ações' },
  { value: 'indices', label: 'Índices' },
  { value: 'commodities', label: 'Commodities' },
];

// Mapear símbolo para categoria
function getAssetCategory(symbol: string): string {
  const s = symbol.toUpperCase();
  const cryptoBases = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'LTC', 'ATOM', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX', 'SHIB', 'NEAR', 'APT', 'OP', 'ARB', 'SUI', 'SEI', 'INJ', 'AAVE', 'SAND', 'MANA', 'AXS'];
  if (cryptoBases.some(b => s.startsWith(b + '/') || s.startsWith(b + 'USD'))) return 'crypto';
  const forexBases = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY', 'BRL'];
  const parts = s.split('/');
  if (parts.length === 2 && forexBases.includes(parts[0]) && forexBases.includes(parts[1])) return 'forex';
  if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY') || s.includes('CHF') || s.includes('AUD') || s.includes('NZD') || s.includes('CAD')) {
    if (!cryptoBases.some(b => s.startsWith(b))) return 'forex';
  }
  const stockSymbols = ['AAPL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'];
  if (stockSymbols.some(st => s.includes(st))) return 'stocks';
  const indexSymbols = ['SPX', 'NDX', 'DJI', 'IBOV', 'DAX', 'FTSE', 'US500', 'US100', 'US30'];
  if (indexSymbols.some(idx => s.includes(idx))) return 'indices';
  const commoditySymbols = ['XAU', 'XAG', 'OIL', 'GOLD', 'SILVER', 'BRENT', 'WTI', 'NATGAS'];
  if (commoditySymbols.some(c => s.includes(c))) return 'commodities';
  return 'crypto';
}

// Tipo flexível para aceitar diferentes formatos de Trade
type FlexibleTrade = Trade | {
  id: string;
  type: 'call' | 'put';
  amount: number;
  entryPrice: number;
  exitPrice?: number;
  profit: number;
  status?: 'active' | 'won' | 'lost';
  timestamp?: Date;
  createdAt?: string;
  symbol?: string;
  result?: 'win' | 'loss' | null;
};

interface TradeHistoryProps {
  onClose?: () => void;
  trades?: FlexibleTrade[];
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ onClose, trades: externalTrades }) => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const convertTrades = (externalTrades: FlexibleTrade[]): Trade[] => {
    return externalTrades.map(trade => {
      if ('userId' in trade && 'symbol' in trade && 'createdAt' in trade) {
        return trade as Trade;
      }
      
      const isWon = trade.status === 'won' || (trade.result === 'win');
      const createdAt = trade.createdAt || (trade.timestamp ? trade.timestamp.toISOString() : new Date().toISOString());
      
      return {
        id: trade.id,
        userId: '',
        symbol: trade.symbol || 'N/A',
        type: trade.type,
        amount: trade.amount,
        expiration: 0,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice || null,
        result: isWon ? 'win' : (trade.status === 'lost' || trade.result === 'loss' ? 'loss' : null),
        profit: trade.profit || null,
        createdAt,
        updatedAt: createdAt,
      };
    });
  };

  const loadHistory = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await getTradeHistory(user.id, 50);
      setTrades(data);
    } catch (error) {
      logger.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (externalTrades && externalTrades.length > 0) {
      const converted = convertTrades(externalTrades);
      setTrades(converted);
      setLoading(false);
      return;
    }

    if (user && !externalTrades) {
      loadHistory();
    }
  }, [user, externalTrades, loadHistory]);

  // Filtrar por categoria de ativo
  const filteredTrades = useMemo(() => {
    if (filter === 'all') return trades;
    return trades.filter(t => getAssetCategory(t.symbol) === filter);
  }, [trades, filter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="px-4 py-3 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-800/60">
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Histórico de Trading</div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <span className="text-gray-400 text-xs">✕</span>
          </button>
        )}
      </div>

      {/* Filtro por tipo de ativo (select/dropdown) */}
      {!externalTrades && (
        <div className="px-3 py-2 border-b border-gray-800/60 flex-shrink-0">
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-900/60 border border-gray-700/50 rounded text-[11px] text-white appearance-none cursor-pointer focus:outline-none focus:border-gray-600 transition-colors"
            >
              {assetCategories.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
          </div>
        </div>
      )}
      
      {/* Lista de trades */}
      <div className="overflow-y-auto flex-1 bg-black" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin mb-2" />
            <span className="text-xs text-gray-500">Carregando histórico...</span>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <BarChart3 className="w-8 h-8 text-gray-700 mb-2" />
            <span className="text-xs text-gray-500">Nenhuma operação encontrada</span>
          </div>
        ) : (
          <div>
            {filteredTrades.map((trade, index) => {
              const isWin = trade.result === 'win';
              const isLoss = trade.result === 'loss';
              const profitValue = trade.profit || 0;
              const profitPercent = trade.amount > 0 
                ? Math.abs((profitValue / trade.amount) * 100).toFixed(0)
                : '0';
              
              return (
                <div 
                  key={trade.id} 
                  className={`px-3 py-2.5 transition-colors hover:bg-gray-900/40 ${
                    index < filteredTrades.length - 1 ? 'border-b border-gray-800/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    {/* Lado esquerdo: ícone + ativo + direção */}
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        isWin ? 'bg-green-500/15' : isLoss ? 'bg-red-500/15' : 'bg-gray-700/30'
                      }`}>
                        {trade.type === 'call' ? (
                          <TrendingUp className={`w-3.5 h-3.5 ${isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'}`} />
                        ) : (
                          <TrendingDown className={`w-3.5 h-3.5 ${isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'}`} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-white leading-tight">{trade.symbol}</span>
                        <span className="text-[9px] text-gray-500 leading-tight">
                          {trade.type === 'call' ? 'Compra' : 'Venda'} · {formatCurrency(trade.amount)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Lado direito: resultado */}
                    <div className="flex flex-col items-end">
                      <span className={`text-[11px] font-bold leading-tight ${
                        isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {isWin ? '+' : ''}{formatCurrency(profitValue)}
                      </span>
                      <span className={`text-[9px] leading-tight ${
                        isWin ? 'text-green-500/70' : isLoss ? 'text-red-500/70' : 'text-gray-500'
                      }`}>
                        {isWin ? '+' : '-'}{profitPercent}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Linha inferior: data/hora e preços */}
                  <div className="flex items-center justify-between pl-8">
                    <span className="text-[9px] text-gray-500">
                      {formatDate(trade.createdAt)} · {formatTime(trade.createdAt)}
                    </span>
                    {trade.entryPrice && trade.exitPrice && (
                      <span className="text-[9px] text-gray-600">
                        {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
