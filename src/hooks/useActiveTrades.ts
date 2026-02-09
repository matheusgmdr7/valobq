/**
 * Hook para gerenciar trades ativos
 * 
 * Apenas carrega trades ativos do banco. O processamento de resultados
 * é feito exclusivamente pelo processTradeResult no componente de trading
 * (com preço real do gráfico, toast moderno e atualização de saldo).
 */

import { useEffect, useState, useRef } from 'react';
import { tradeService } from '@/services/tradeService';
import { Trade } from '@/lib/db';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';

export function useActiveTrades() {
  const { user } = useAuth();
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    // Carregar trades ativos
    const loadActiveTrades = async () => {
      try {
        const allTrades = await tradeService.getUserTrades(user.id);
        const active = allTrades.filter(
          trade => !trade.result && trade.expiration > Date.now()
        );
        setActiveTrades(active);
      } catch (error: any) {
        if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
          setActiveTrades([]);
          return;
        }
        const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
        logger.error('Erro ao carregar trades ativos:', errorMessage);
        setActiveTrades([]);
      }
    };

    loadActiveTrades();

    // Recarregar trades ativos periodicamente (apenas leitura, sem processar resultados)
    intervalRef.current = setInterval(() => {
      loadActiveTrades();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { activeTrades };
}

