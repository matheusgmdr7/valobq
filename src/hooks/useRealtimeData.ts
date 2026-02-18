/**
 * React Hook para dados em tempo real
 * 
 * Integra RealtimeDataManager com componentes React
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { CandlestickData } from '@/types/chart';
import { RealtimeDataManager, RealtimeDataConfig } from '@/engine/websocket/RealtimeDataManager';
import { logger } from '@/utils/logger';

export interface UseRealtimeDataOptions extends Omit<RealtimeDataConfig, 'symbol'> {
  symbol: string;
  initialData?: CandlestickData[];
  autoStart?: boolean;
  onDataUpdate?: (candles: CandlestickData[]) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'polling') => void;
}

export interface UseRealtimeDataReturn {
  candles: CandlestickData[];
  status: 'connected' | 'disconnected' | 'polling';
  isConnected: boolean;
  start: () => Promise<void>;
  stop: () => void;
  setInitialData: (data: CandlestickData[]) => void;
}

/**
 * Hook para dados em tempo real
 */
export function useRealtimeData(
  options: UseRealtimeDataOptions
): UseRealtimeDataReturn {
  const {
    symbol,
    initialData = [],
    autoStart = true,
    onDataUpdate,
    onStatusChange,
    ...config
  } = options;

  const managerRef = useRef<RealtimeDataManager | null>(null);
  const [candles, setCandles] = useState<CandlestickData[]>(initialData);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'polling'>('disconnected');

  // Criar manager
  useEffect(() => {
    if (!symbol) {
      return;
    }

    const manager = new RealtimeDataManager({
      symbol,
      ...config
    });

    // Handler de atualização de dados
    const unsubscribeData = manager.onDataUpdate((newCandles) => {
      setCandles(newCandles);
      onDataUpdate?.(newCandles);
    });

    // Handler de mudança de status
    const unsubscribeStatus = manager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    });

    // Definir dados iniciais
    if (initialData.length > 0) {
      manager.setInitialData(initialData);
    }

    managerRef.current = manager;

    // Iniciar automaticamente se configurado
    if (autoStart) {
      manager.start().catch((error) => {
        logger.error('Failed to start realtime data manager:', error);
      });
    }

    return () => {
      unsubscribeData();
      unsubscribeStatus();
      manager.stop();
      managerRef.current = null;
    };
  }, [symbol, config.websocketUrl, config.pollingUrl]); // Recriar apenas se URL ou símbolo mudar

  // Atualizar dados iniciais quando mudarem
  useEffect(() => {
    if (managerRef.current && initialData.length > 0) {
      managerRef.current.setInitialData(initialData);
    }
  }, [initialData]);

  // Iniciar
  const start = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.start();
    }
  }, []);

  // Parar
  const stop = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stop();
    }
  }, []);

  // Definir dados iniciais
  const setInitialData = useCallback((data: CandlestickData[]) => {
    if (managerRef.current) {
      managerRef.current.setInitialData(data);
    }
    setCandles(data);
  }, []);

  return {
    candles,
    status,
    isConnected: status === 'connected' || status === 'polling',
    start,
    stop,
    setInitialData
  };
}

