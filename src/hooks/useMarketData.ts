/**
 * Hook para buscar dados de mercado
 */

import { useState, useEffect, useCallback } from 'react';
import { CandlestickData } from '@/types/chart';
import { CurrencyPair, marketService, MarketDataResponse } from '@/services/marketService';
import { realPriceService } from '@/services/realPriceService';
import { useRealtimeData } from './useRealtimeData';

export interface UseMarketDataOptions {
  symbol: string;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  limit?: number;
  autoUpdate?: boolean;
  updateInterval?: number;
}

export interface UseMarketDataReturn {
  candles: CandlestickData[];
  currentPrice: number | null;
  pair: CurrencyPair | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook para buscar e gerenciar dados de mercado
 */
export function useMarketData(options: UseMarketDataOptions): UseMarketDataReturn {
  const {
    symbol,
    timeframe = '1m',
    limit = 100,
    autoUpdate = true,
    updateInterval = 1000
  } = options;

  const [candles, setCandles] = useState<CandlestickData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pair = marketService.getPair(symbol);

  /**
   * Busca candles históricos usando serviço de preços reais
   */
  const fetchCandles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Tentar buscar dados reais primeiro
      let data: CandlestickData[];
      try {
        data = await realPriceService.getHistoricalCandles(symbol, timeframe, limit);
        // Converter timestamp para time se necessário (compatibilidade)
        data = data.map(candle => ({
          ...candle,
          timestamp: candle.timestamp || (candle as any).time || Date.now()
        }));
      } catch (realPriceError) {
        // Fallback para marketService
        data = await marketService.getHistoricalCandles(symbol, timeframe, limit);
      }
      
      setCandles(data);
      
      // Atualizar preço atual com o último candle
      if (data.length > 0) {
        setCurrentPrice(data[data.length - 1].close);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch candles'));
      console.error('Error fetching candles:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, limit]);

  /**
   * Atualiza dados
   */
  const refresh = useCallback(async () => {
    await fetchCandles();
  }, [fetchCandles]);

  // Buscar dados iniciais
  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // Atualização de preço em tempo real
  useEffect(() => {
    if (!autoUpdate || !symbol) return;

    const unsubscribe = marketService.startPriceUpdates(symbol, (data: MarketDataResponse) => {
      setCurrentPrice(data.price);
      
      // Atualizar último candle se necessário
      setCandles(prev => {
        if (prev.length === 0) return prev;
        
        const lastCandle = prev[prev.length - 1];
        const now = Date.now();
        const candleTime = lastCandle.timestamp;
        
        // Se ainda estamos no mesmo período do candle, atualizar
        // Caso contrário, criar novo candle
        const intervals: Record<string, number> = {
          '1m': 60 * 1000,
          '5m': 5 * 60 * 1000,
          '15m': 15 * 60 * 1000,
          '1h': 60 * 60 * 1000,
          '4h': 4 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000
        };
        
        const interval = intervals[timeframe];
        const timeDiff = now - candleTime;
        
        if (timeDiff < interval) {
          // Atualizar candle atual
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastCandle,
            close: data.price,
            high: Math.max(lastCandle.high, data.price),
            low: Math.min(lastCandle.low, data.price)
          };
          return updated;
        } else {
          // Criar novo candle
          const newCandle: CandlestickData = {
            timestamp: now,
            open: lastCandle.close,
            high: data.price,
            low: data.price,
            close: data.price,
            volume: Math.random() * 10000 + 5000
          };
          
          const updated = [...prev, newCandle];
          // Manter apenas os últimos 'limit' candles
          if (updated.length > limit) {
            return updated.slice(-limit);
          }
          return updated;
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, autoUpdate, timeframe, limit]);

  return {
    candles,
    currentPrice,
    pair,
    loading,
    error,
    refresh
  };
}

