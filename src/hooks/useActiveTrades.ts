/**
 * Hook para gerenciar trades ativos da conta ativa (demo ou real).
 */

import { useEffect, useState, useRef } from 'react';
import { tradeService } from '@/services/tradeService';
import { Trade } from '@/lib/db';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';
import { isTradeForAccount } from '@/lib/tradeAccountStorage';

export function useActiveTrades() {
  const { user, accountType } = useAuth();
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveTrades([]);
      return;
    }

    const loadActiveTrades = async () => {
      try {
        const allTrades = await tradeService.getUserTrades(user.id);
        const active = allTrades.filter(
          (trade) =>
            !trade.result &&
            trade.expiration > Date.now() &&
            isTradeForAccount(trade, accountType),
        );
        setActiveTrades(active);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err?.code === '42P01' || err?.message?.includes('does not exist')) {
          setActiveTrades([]);
          return;
        }
        const errorMessage = err?.message || String(error) || 'Erro desconhecido';
        logger.error('Erro ao carregar trades ativos:', errorMessage);
        setActiveTrades([]);
      }
    };

    loadActiveTrades();

    intervalRef.current = setInterval(() => {
      loadActiveTrades();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user?.id, accountType]);

  return { activeTrades };
}
