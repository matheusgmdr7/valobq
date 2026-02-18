'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getOpenPositions, OpenPosition } from '@/services/tradesService';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { logger } from '@/utils/logger';

interface PortfolioTotalProps {
  onClose: () => void;
}

export const PortfolioTotal: React.FC<PortfolioTotalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPositions();
      const interval = setInterval(loadPositions, 3000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadPositions = async () => {
    if (!user) return;
    
    try {
      const data = await getOpenPositions(user.id);
      setPositions(data);
    } catch (error) {
      logger.error('Erro ao carregar posições:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getTimeRemaining = (expiryTime: Date) => {
    const now = new Date();
    const diff = expiryTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expirado';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Portfólio Total</div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
      </div>
      
      {/* Lista de posições */}
      <div className="overflow-y-auto flex-1 bg-black" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin mb-2" />
            <span className="text-xs text-gray-500">Carregando posições...</span>
          </div>
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <span className="text-xs text-gray-500">Nenhuma posição aberta</span>
          </div>
        ) : (
          <div>
            {positions.map((position, index) => {
              const expiryTime = new Date(position.expiryTime);
              const timeRemaining = getTimeRemaining(expiryTime);
              const isExpired = new Date() > expiryTime;
              const isCall = position.type === 'call';
              
              return (
                <div 
                  key={position.id} 
                  className={`px-3 py-2.5 transition-colors hover:bg-gray-900/40 ${
                    index < positions.length - 1 ? 'border-b border-gray-800/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        isCall ? 'bg-green-500/15' : 'bg-red-500/15'
                      }`}>
                        {isCall ? (
                          <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-white leading-tight">{position.symbol}</span>
                        <span className="text-[9px] text-gray-500 leading-tight">
                          {isCall ? 'Compra' : 'Venda'} · {formatCurrency(position.amount)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className={`text-[11px] font-bold leading-tight ${
                        isExpired ? 'text-gray-500' : 'text-red-400'
                      }`}>
                        {timeRemaining}
                      </span>
                      <span className="text-[9px] text-gray-500 leading-tight">
                        {isExpired ? 'Processando...' : 'restante'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pl-8">
                    <span className="text-[9px] text-gray-500">
                      {formatTime(position.createdAt)}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      Entrada: {position.entryPrice.toFixed(2)}
                    </span>
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
