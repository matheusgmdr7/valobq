import { supabase } from '@/lib/supabase';
import { BinaryOption } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Serviço para gerenciar operações de trading
 */

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  expiration: number;
  entryPrice: number;
  exitPrice: number | null;
  result: 'win' | 'loss' | null;
  profit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  entryPrice: number;
  expiration: number;
  expiryTime: Date;
  createdAt: string;
}

/**
 * Busca ordens abertas (posições pendentes) do usuário
 */
export async function getOpenPositions(userId: string): Promise<OpenPosition[]> {
  if (!supabase) {
    // Modo local - retornar dados fictícios
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .is('result', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar posições abertas:', error);
      return [];
    }

    return (data || []).map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      type: trade.type,
      amount: trade.amount,
      entryPrice: trade.entry_price,
      expiration: trade.expiration,
      expiryTime: new Date(trade.expiration * 1000), // expiration é timestamp Unix em segundos
      createdAt: trade.created_at,
    }));
  } catch (error) {
    logger.error('Erro ao buscar posições abertas:', error);
    return [];
  }
}

/**
 * Busca histórico de operações do usuário
 */
export async function getTradeHistory(
  userId: string,
  limit: number = 50
): Promise<Trade[]> {
  if (!supabase) {
    // Modo local - retornar dados fictícios
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Erro ao buscar histórico:', error);
      return [];
    }

    return (data || []).map(trade => ({
      id: trade.id,
      userId: trade.user_id,
      symbol: trade.symbol,
      type: trade.type,
      amount: trade.amount,
      expiration: trade.expiration,
      entryPrice: trade.entry_price,
      exitPrice: trade.exit_price,
      result: trade.result,
      profit: trade.profit,
      createdAt: trade.created_at,
      updatedAt: trade.updated_at,
    }));
  } catch (error) {
    logger.error('Erro ao buscar histórico:', error);
    return [];
  }
}

