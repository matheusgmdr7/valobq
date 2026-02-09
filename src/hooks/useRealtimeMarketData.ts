/**
 * Hook para dados de mercado em tempo real
 * 
 * Estratégia inteligente baseada no tipo de ativo:
 * - Forex: Polling (Yahoo Finance) - melhor opção gratuita
 * - Crypto: Binance WebSocket - tempo real verdadeiro
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { BinanceWebSocket, BinanceTick } from '@/services/binanceWebSocket';
import { ForexPollingService, ForexTick } from '@/services/forexPollingService';
import { PriceAnimator } from '@/utils/priceAnimator';
import { UpdateBatcher } from '@/utils/updateBatcher';
import { CandlestickData } from '@/types/chart';

export interface UseRealtimeMarketDataOptions {
  symbol: string;
  onTick?: (tick: BinanceTick | ForexTick) => void;
  onCandleUpdate?: (candles: CandlestickData[]) => void;
  enableAnimation?: boolean;
  animationSpeed?: number;
  pollingInterval?: number; // Intervalo de polling para Forex (padrão: 2000ms)
  initialCandles?: CandlestickData[]; // Dados iniciais para inicializar o hook
}

export interface UseRealtimeMarketDataReturn {
  isConnected: boolean;
  currentPrice: number;
  animatedPrice: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
  dataSource: 'binance' | 'forex_polling' | 'none';
}

/**
 * Detecta se o símbolo é Forex ou Crypto
 */
function isForexSymbol(symbol: string): boolean {
  // Forex geralmente tem "/" no símbolo (ex: GBP/USD, EUR/USD)
  // E não são criptomoedas conhecidas
  const cryptoKeywords = ['BTC', 'ETH', 'USDT', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT'];
  const hasSlash = symbol.includes('/');
  const isCrypto = cryptoKeywords.some(keyword => symbol.toUpperCase().includes(keyword));
  
  return hasSlash && !isCrypto;
}

/**
 * Hook para dados de mercado em tempo real com animação fluida
 */
export function useRealtimeMarketData(
  options: UseRealtimeMarketDataOptions
): UseRealtimeMarketDataReturn {
  const {
    symbol,
    onTick,
    onCandleUpdate,
    enableAnimation = true,
    animationSpeed = 0.15,
    pollingInterval = 2000,
    initialCandles = []
  } = options;

  const binanceWsRef = useRef<BinanceWebSocket | null>(null);
  const forexPollingRef = useRef<ForexPollingService | null>(null);
  const priceAnimatorRef = useRef<PriceAnimator | null>(null);
  const updateBatcherRef = useRef<UpdateBatcher | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const candlesRef = useRef<CandlestickData[]>([]);
  const dataSourceRef = useRef<'binance' | 'forex_polling' | 'none'>('none');

  const [isConnected, setIsConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [animatedPrice, setAnimatedPrice] = useState(0);
  const [dataSource, setDataSource] = useState<'binance' | 'forex_polling' | 'none'>('none');

  // Inicializar candles com dados iniciais se fornecidos
  // IMPORTANTE: Usar apenas os últimos N candles para evitar dados com padrão senoidal
  useEffect(() => {
    if (initialCandles.length > 0 && candlesRef.current.length === 0) {
      // Usar apenas os últimos 10 candles iniciais para evitar dados antigos com seno
      // Os dados em tempo real vão substituir e construir novos candles
      const recentCandles = initialCandles.slice(-10);
      candlesRef.current = [...recentCandles];
      if (onCandleUpdate) {
        onCandleUpdate([...candlesRef.current]);
      }
    }
  }, [initialCandles, onCandleUpdate]);

  // Inicializar animador de preço
  useEffect(() => {
    if (enableAnimation) {
      priceAnimatorRef.current = new PriceAnimator({
        speed: animationSpeed,
        easing: 'easeOut'
      });
    }
  }, [enableAnimation, animationSpeed]);

  // Handler de tick unificado
  const handleTickUpdate = useCallback((tick: BinanceTick | ForexTick) => {
    setCurrentPrice(tick.price);

    // Atualizar animador
    if (priceAnimatorRef.current) {
      priceAnimatorRef.current.setTarget(tick.price);
    } else {
      setAnimatedPrice(tick.price);
    }

    // Se não há candles ainda, criar o primeiro
    if (candlesRef.current.length === 0) {
      const now = Date.now();
      const candleInterval = 60000; // 1 minuto
      const firstCandle: CandlestickData = {
        timestamp: Math.floor(now / candleInterval) * candleInterval,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume || 0
      };
      candlesRef.current = [firstCandle];
      if (onCandleUpdate) {
        onCandleUpdate([...candlesRef.current]);
      }
      return;
    }

    // Atualizar último candle
    if (candlesRef.current.length > 0) {
      const lastCandle = candlesRef.current[candlesRef.current.length - 1];
      const now = Date.now();
      const candleInterval = 60000; // 1 minuto

      if (now - lastCandle.timestamp < candleInterval) {
        // IMPORTANTE: Criar NOVO objeto para o último candle (não modificar o existente)
        // Isso garante que a comparação no WebGLChart detecte a mudança
        const updatedLastCandle: CandlestickData = {
          ...lastCandle, // Copiar todas as propriedades
          close: tick.price, // Usar preço real do tick
          high: Math.max(lastCandle.high, tick.price),
          low: Math.min(lastCandle.low, tick.price),
          volume: (lastCandle.volume || 0) + (tick.volume || 0)
        };

        // Criar nova cópia do array com último candle atualizado (novo objeto)
        const updatedCandles = candlesRef.current.map((c, i) => 
          i === candlesRef.current.length - 1 ? updatedLastCandle : { ...c }
        );
        candlesRef.current = updatedCandles;

        if (onCandleUpdate) {
          onCandleUpdate(updatedCandles);
        }
      } else {
        // Criar novo candle
        const newCandle: CandlestickData = {
          timestamp: Math.floor(now / candleInterval) * candleInterval,
          open: lastCandle.close,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume || 0
        };

        const updatedCandles = [...candlesRef.current, newCandle].slice(-1000);
        candlesRef.current = updatedCandles;
        
        if (onCandleUpdate) {
          onCandleUpdate(updatedCandles);
        }
      }
    }

    // Notificar tick
    if (onTick) {
      onTick(tick);
    }
  }, [enableAnimation, onTick, onCandleUpdate]);

  // Inicializar batcher de atualizações
  useEffect(() => {
    updateBatcherRef.current = new UpdateBatcher(
      (updates) => {
        updates.forEach(update => {
          if (update.type === 'tick') {
            handleTickUpdate(update as BinanceTick | ForexTick);
          }
        });
      },
      { batchInterval: 16 } // ~60 FPS
    );
  }, [handleTickUpdate]);

  // Loop de animação com RAF (apenas para animatedPrice, não para candles)
  useEffect(() => {
    if (!enableAnimation || !priceAnimatorRef.current) {
      return;
    }

    const animate = () => {
      const animator = priceAnimatorRef.current;
      if (animator && animator.isActive()) {
        const animated = animator.update();
        setAnimatedPrice(animated);
        // NÃO atualizar candles aqui - apenas o preço animado para display
        // Os candles devem usar o preço REAL do tick, não o animado
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enableAnimation]);

  // Conectar
  const connect = useCallback(async () => {
    // Verificar se já está conectado para evitar múltiplas inicializações
    if (binanceWsRef.current || forexPollingRef.current) {
      return;
    }

    const isForex = isForexSymbol(symbol);

    // Estratégia 1: Binance WebSocket (para Crypto)
    if (!isForex) {
      try {
        const binanceWs = new BinanceWebSocket({
          symbol,
          streamType: 'ticker'
        });

        binanceWs.onTick((tick) => {
          if (updateBatcherRef.current) {
            updateBatcherRef.current.add({ type: 'tick', ...tick });
          } else {
            handleTickUpdate(tick);
          }
        });

        binanceWsRef.current = binanceWs;
        await binanceWs.connect();
        setIsConnected(true);
        setDataSource('binance');
        dataSourceRef.current = 'binance';
        return;
      } catch (error) {
        console.error('[Realtime] Error:', error instanceof Error ? error.message : 'Unknown error');
        setIsConnected(false);
        setDataSource('none');
        dataSourceRef.current = 'none';
      }
    }

    // Estratégia 2: Forex Polling (para Forex)
    if (isForex) {
      try {
        const forexPolling = new ForexPollingService({
          symbol,
          interval: pollingInterval,
          onTick: (tick) => {
            if (updateBatcherRef.current) {
              updateBatcherRef.current.add({ type: 'tick', ...tick });
            } else {
              handleTickUpdate(tick);
            }
          }
        });

        forexPollingRef.current = forexPolling;
        forexPolling.start();
        setIsConnected(true);
        setDataSource('forex_polling');
        dataSourceRef.current = 'forex_polling';
      } catch (error) {
        console.error('[Realtime] Error:', error instanceof Error ? error.message : 'Unknown error');
        setIsConnected(false);
        setDataSource('none');
        dataSourceRef.current = 'none';
      }
    }
  }, [symbol, handleTickUpdate, pollingInterval]);

  // Desconectar
  const disconnect = useCallback(() => {
    if (binanceWsRef.current) {
      binanceWsRef.current.disconnect();
      binanceWsRef.current = null;
    }
    if (forexPollingRef.current) {
      forexPollingRef.current.stop();
      forexPollingRef.current = null;
    }
    setIsConnected(false);
    setDataSource('none');
    dataSourceRef.current = 'none';
  }, []);

  // Inscrever em símbolo
  const subscribe = useCallback((newSymbol: string) => {
    if (binanceWsRef.current && isConnected) {
      binanceWsRef.current.subscribe(newSymbol);
    } else if (forexPollingRef.current && isConnected) {
      forexPollingRef.current.updateSymbol(newSymbol);
    }
  }, [isConnected]);

  // Cleanup
  useEffect(() => {
    return () => {
      disconnect();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [disconnect]);

  return {
    isConnected,
    currentPrice,
    animatedPrice: enableAnimation ? animatedPrice : currentPrice,
    connect,
    disconnect,
    subscribe,
    dataSource
  };
}

