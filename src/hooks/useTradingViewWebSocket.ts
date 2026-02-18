/**
 * @deprecated Este hook está deprecated. Use `useRealtimeMarketData` em vez disso.
 * 
 * Hook para usar TradingView WebSocket
 * 
 * ⚠️ AVISO: TradingView não oferece WebSocket público. Este hook tenta conectar
 * mas sempre falha. Use `useRealtimeMarketData` que detecta automaticamente
 * o tipo de ativo e usa a estratégia correta (Forex: Polling, Crypto: Binance WS).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { TradingViewWebSocket, TradingViewConfig, TradingViewTick } from '@/services/tradingViewWebSocket';
import { BinanceWebSocket, BinanceTick } from '@/services/binanceWebSocket';
import { PriceAnimator } from '@/utils/priceAnimator';
import { UpdateBatcher } from '@/utils/updateBatcher';
import { CandlestickData } from '@/types/chart';
import { logger } from '@/utils/logger';

export interface UseTradingViewWebSocketOptions extends TradingViewConfig {
  onTick?: (tick: TradingViewTick | BinanceTick) => void;
  onCandleUpdate?: (candles: CandlestickData[]) => void;
  enableAnimation?: boolean;
  animationSpeed?: number;
  useBinanceFallback?: boolean; // Usar Binance como fallback se TradingView falhar
}

export interface UseTradingViewWebSocketReturn {
  isConnected: boolean;
  currentPrice: number;
  animatedPrice: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
}

/**
 * Hook para TradingView WebSocket com animação fluida
 */
export function useTradingViewWebSocket(
  options: UseTradingViewWebSocketOptions = {}
): UseTradingViewWebSocketReturn {
  const {
    symbol,
    onTick,
    onCandleUpdate,
    enableAnimation = true,
    animationSpeed = 0.15,
    useBinanceFallback = true,
    ...config
  } = options;

  const wsRef = useRef<TradingViewWebSocket | null>(null);
  const binanceWsRef = useRef<BinanceWebSocket | null>(null);
  const useBinanceRef = useRef(false);
  const priceAnimatorRef = useRef<PriceAnimator | null>(null);
  const updateBatcherRef = useRef<UpdateBatcher | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const candlesRef = useRef<CandlestickData[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [animatedPrice, setAnimatedPrice] = useState(0);

  // Inicializar candles com dados iniciais se fornecidos
  useEffect(() => {
    if (candlesRef.current.length === 0 && onCandleUpdate) {
      // Se não há candles e há callback, inicializar vazio
      // Os candles serão preenchidos quando os dados chegarem
      candlesRef.current = [];
    }
  }, [onCandleUpdate]);

  // Inicializar animador de preço
  useEffect(() => {
    if (enableAnimation) {
      priceAnimatorRef.current = new PriceAnimator({
        speed: animationSpeed,
        easing: 'easeOut'
      });
    }
  }, [enableAnimation, animationSpeed]);

  // Handler de tick
  const handleTickUpdate = useCallback((tick: TradingViewTick | BinanceTick) => {
    setCurrentPrice(tick.price);

    // Atualizar animador
    if (priceAnimatorRef.current) {
      priceAnimatorRef.current.setTarget(tick.price);
    } else {
      setAnimatedPrice(tick.price);
    }

    // Atualizar último candle
    if (candlesRef.current.length > 0) {
      const lastCandle = candlesRef.current[candlesRef.current.length - 1];
      const now = Date.now();
      const candleInterval = 60000; // 1 minuto

      if (now - lastCandle.timestamp < candleInterval) {
        // Atualizar candle atual com preço animado
        const currentAnimatedPrice = enableAnimation && priceAnimatorRef.current
          ? priceAnimatorRef.current.getCurrent()
          : tick.price;
        
        lastCandle.close = currentAnimatedPrice;
        lastCandle.high = Math.max(lastCandle.high, tick.price);
        lastCandle.low = Math.min(lastCandle.low, tick.price);
        lastCandle.volume = (lastCandle.volume || 0) + (tick.volume || 0);

        // Notificar atualização (será agrupada pelo UpdateBatcher)
        if (onCandleUpdate) {
          onCandleUpdate([...candlesRef.current]);
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

        candlesRef.current = [...candlesRef.current, newCandle].slice(-1000); // Manter últimos 1000

        if (onCandleUpdate) {
          onCandleUpdate([...candlesRef.current]);
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
        // Processar todas as atualizações de uma vez
        updates.forEach(update => {
          if (update.type === 'tick') {
            handleTickUpdate(update as TradingViewTick | BinanceTick);
          }
        });
      },
      { batchInterval: 16 } // ~60 FPS
    );
  }, [handleTickUpdate]);

  // Loop de animação com RAF - atualiza preço e candles suavemente
  useEffect(() => {
    if (!enableAnimation || !priceAnimatorRef.current) {
      return;
    }

    const animate = () => {
      const animator = priceAnimatorRef.current;
      if (animator && animator.isActive()) {
        const animated = animator.update();
        setAnimatedPrice(animated);
        
        // Atualizar último candle com preço animado
        if (candlesRef.current.length > 0) {
          const lastCandle = candlesRef.current[candlesRef.current.length - 1];
          lastCandle.close = animated;
          
          // Notificar atualização suave (será agrupada pelo UpdateBatcher)
          if (onCandleUpdate) {
            onCandleUpdate([...candlesRef.current]);
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enableAnimation, onCandleUpdate]);

  // Conectar
  const connect = useCallback(async () => {
    if (wsRef.current || binanceWsRef.current) {
      return;
    }

    // Tentar TradingView primeiro, se não usar Binance como fallback
    if (!useBinanceRef.current) {
      try {
        const ws = new TradingViewWebSocket({
          symbol,
          ...config
        });

        // Handler de ticks
        ws.onTick((tick) => {
          if (updateBatcherRef.current) {
            updateBatcherRef.current.add({ type: 'tick', ...tick });
          } else {
            handleTickUpdate(tick);
          }
        });

        wsRef.current = ws;
        await ws.connect();
        setIsConnected(true);
        return;
      } catch (error) {
        useBinanceRef.current = true;
      }
    }

    // Fallback para Binance
    if (useBinanceFallback || useBinanceRef.current) {
      try {
        const binanceWs = new BinanceWebSocket({
          symbol,
          streamType: 'ticker'
        });

        // Handler de ticks
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
      } catch (error) {
        logger.error('Failed to connect to Binance WebSocket:', error);
        setIsConnected(false);
      }
    } else {
      setIsConnected(false);
    }
  }, [symbol, config, handleTickUpdate, useBinanceFallback]);

  // Desconectar
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
    if (binanceWsRef.current) {
      binanceWsRef.current.disconnect();
      binanceWsRef.current = null;
    }
    useBinanceRef.current = false;
    setIsConnected(false);
  }, []);

  // Inscrever em símbolo
  const subscribe = useCallback((newSymbol: string) => {
    if (wsRef.current && isConnected) {
      wsRef.current.subscribeToSymbol(newSymbol);
    } else if (binanceWsRef.current && isConnected) {
      binanceWsRef.current.subscribe(newSymbol);
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
    subscribe
  };
}

