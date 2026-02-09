/**
 * useRealtimeStream - Hook para conectar ao MarketDataServer WebSocket
 * 
 * Substitui o polling e conecta diretamente ao servidor centralizado
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';

export interface RealtimeTick {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  isOTC?: boolean;
}

export interface UseRealtimeStreamOptions {
  symbol: string;
  wsUrl?: string;
  autoConnect?: boolean;
  onTick?: (tick: RealtimeTick) => void;
}

export interface MarketStatusInfo {
  isOpen: boolean;
  isOTC: boolean;
  category: string;
  message: string;
}

export interface UseRealtimeStreamReturn {
  isConnected: boolean;
  lastTick: RealtimeTick | null;
  error: string | null;
  marketStatus: MarketStatusInfo | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
}

/**
 * Hook para streaming de dados em tempo real via WebSocket
 */
export function useRealtimeStream(options: UseRealtimeStreamOptions): UseRealtimeStreamReturn {
  const {
    symbol,
    wsUrl = process.env.NEXT_PUBLIC_MARKET_DATA_WS_URL || 'ws://localhost:8080',
    autoConnect = true,
    onTick
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastTick, setLastTick] = useState<RealtimeTick | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // CRÍTICO: Prevenir dupla conexão causada pelo React Strict Mode
  const isInitializedRef = useRef(false);
  const isConnectingRef = useRef(false);
  // CRÍTICO: Rastrear símbolo atual subscrito para cancelar subscrição anterior ao mudar
  const currentSubscribedSymbolRef = useRef<string | null>(null);
  // CRÍTICO: Ref para o símbolo atual para evitar problemas de closure no connect
  const symbolRef = useRef(symbol);
  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  /**
   * Conecta ao WebSocket do MarketDataServer
   */
  const connect = useCallback(() => {
    // CRÍTICO: Prevenir dupla conexão - verificar se já está conectado ou conectando
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      logger.log('✅ [useRealtimeStream] Já conectado');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING || isConnectingRef.current) {
      logger.log('⏳ [useRealtimeStream] Conexão em andamento...');
      return;
    }

    // CRÍTICO: Prevenir dupla inicialização do Strict Mode
    if (isInitializedRef.current && wsRef.current) {
      logger.log('⚠️ [useRealtimeStream] Tentativa de dupla conexão ignorada (Strict Mode)');
      return;
    }

    try {
      logger.log(`🔌 [useRealtimeStream] Conectando ao MarketDataServer: ${wsUrl}`);
      
      // Marcar como conectando para prevenir dupla conexão
      isConnectingRef.current = true;
      isInitializedRef.current = true;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.log('✅ [useRealtimeStream] Conectado ao MarketDataServer');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false; // Marcar como não conectando mais

        // Subscrever ao símbolo após um pequeno delay para garantir que a conexão está estável
        // Usar symbolRef para sempre ter o valor mais recente
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN && symbolRef.current) {
            subscribe(symbolRef.current);
            currentSubscribedSymbolRef.current = symbolRef.current;
          }
        }, 200);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'connected') {
            logger.log('✅ [useRealtimeStream] Servidor confirmou conexão');
            return;
          }

          // Processar status do mercado (real vs OTC)
          if (message.type === 'market-status') {
            const status: MarketStatusInfo = {
              isOpen: message.isOpen,
              isOTC: message.isOTC,
              category: message.category,
              message: message.message,
            };
            setMarketStatus(status);
            logger.log(`📊 [useRealtimeStream] Status do mercado para ${message.symbol}: ${status.isOTC ? '🎰 OTC' : '🟢 Real'} (${status.message})`);
            return;
          }

          if (message.type === 'tick' && message.data) {
            const tick: RealtimeTick = {
              symbol: message.data.symbol,
              price: message.data.price,
              timestamp: message.data.timestamp || Date.now(),
              volume: message.data.volume,
              bid: message.data.bid,
              ask: message.data.ask,
              change: message.data.change,
              changePercent: message.data.changePercent,
              isOTC: message.data.isOTC || false,
            };

            // Log detalhado para rastrear discrepâncias
            logger.log(`📥 [useRealtimeStream] Tick recebido do servidor:`);
            logger.log(`   💰 Preço: ${tick.price.toFixed(5)}`);
            logger.log(`   📅 Timestamp: ${tick.timestamp} (${new Date(tick.timestamp).toISOString()})`);
            logger.log(`   📊 Símbolo: ${tick.symbol}`);

            setLastTick(tick);

            if (onTick) {
              onTick(tick);
            }
          } else {
            // Log de mensagens não processadas para debug
            if (message.type !== 'connected') {
              logger.log(`📨 [useRealtimeStream] Mensagem recebida (não processada):`, message.type, message);
            }
          }
        } catch (err) {
          logger.error('❌ [useRealtimeStream] Erro ao processar mensagem:', err);
        }
      };

      ws.onerror = (event) => {
        // O evento de erro do WebSocket não fornece muitos detalhes
        // Não definir erro imediatamente, aguardar onclose para determinar o problema real
        logger.warn('⚠️ [useRealtimeStream] Evento de erro WebSocket (aguardando onclose para mais detalhes)');
        // Não setar erro aqui - deixar onclose tratar
      };

      ws.onclose = (event) => {
        logger.log('⚠️ [useRealtimeStream] Conexão fechada:', event.code, event.reason || 'Sem motivo');
        setIsConnected(false);
        isConnectingRef.current = false; // Resetar flag de conexão
        wsRef.current = null;

        // Determinar o tipo de erro baseado no código
        let errorMsg: string | null = null;
        if (event.code === 1006) {
          // Conexão anormalmente fechada (servidor não disponível ou erro de rede)
          errorMsg = 'Conexão perdida. Verificando servidor...';
        } else if (event.code === 1000) {
          // Fechamento normal (intencional)
          errorMsg = null; // Não é um erro
        } else if (event.code === 1001) {
          // Servidor desligando
          errorMsg = 'Servidor está desligando. Tentando reconectar...';
        } else {
          errorMsg = `Conexão fechada (código: ${event.code}). Tentando reconectar...`;
        }

        if (errorMsg) {
          setError(errorMsg);
        } else {
          setError(null); // Limpar erro se foi fechamento normal
        }

        // Tentar reconectar indefinidamente se não foi um fechamento intencional
        if (event.code !== 1000) {
          // Backoff: 1s, 2s, 4s, 8s, 15s, 30s, depois fica em 30s para sempre
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          if (reconnectAttemptsRef.current <= 5) {
            logger.log(`🔄 [useRealtimeStream] Reconectando em ${delay}ms... (tentativa ${reconnectAttemptsRef.current})`);
          } else if (reconnectAttemptsRef.current % 10 === 0) {
            // Logar a cada 10 tentativas para não poluir o console
            logger.log(`🔄 [useRealtimeStream] Ainda tentando reconectar... (tentativa ${reconnectAttemptsRef.current})`);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      logger.error('❌ [useRealtimeStream] Erro ao criar WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      isConnectingRef.current = false; // Resetar flag em caso de erro
    }
  }, [wsUrl, onTick]); // Removido 'symbol' das dependências - mudanças de símbolo são gerenciadas pelo useEffect separado

  /**
   * Desconecta do WebSocket
   * TAREFA 2: CRÍTICO - Limpar todos os timers e resetar flags para prevenir reconexões indesejadas
   */
  const disconnect = useCallback(() => {
    // TAREFA 2: CRÍTICO - Limpar timer de reconexão pendente
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
      logger.log('🧹 [useRealtimeStream] Timer de reconexão cancelado');
    }

    // TAREFA 2: CRÍTICO - Fechar WebSocket se existir
    if (wsRef.current) {
      // Remover event listeners para prevenir callbacks após desconexão
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      
      // Fechar conexão
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Desconexão solicitada pelo cliente');
      }
      wsRef.current = null;
    }

    // CRÍTICO: Resetar todas as flags
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    currentSubscribedSymbolRef.current = null; // Resetar símbolo subscrito
    // NÃO resetar isInitializedRef aqui - ele será resetado apenas quando o componente for completamente desmontado
    
    logger.log('🔌 [useRealtimeStream] Desconectado e limpo');
  }, []);

  /**
   * Subscreve a um símbolo
   */
  const subscribe = useCallback((newSymbol: string) => {
    if (!wsRef.current) {
      logger.warn('⚠️ [useRealtimeStream] WebSocket não inicializado');
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      // Se não estiver aberto, aguardar um pouco e tentar novamente
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          subscribe(newSymbol);
        }
      }, 100);
      return;
    }

    try {
      // Se já estiver subscrito a este símbolo, não fazer nada
      if (currentSubscribedSymbolRef.current === newSymbol) {
        logger.log(`⏭️ [useRealtimeStream] Já subscrito a ${newSymbol}, ignorando`);
        return;
      }

      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        symbol: newSymbol
      }));
      currentSubscribedSymbolRef.current = newSymbol;
      logger.log(`📡 [useRealtimeStream] Subscrito a ${newSymbol}`);
    } catch (err) {
      logger.error('❌ [useRealtimeStream] Erro ao subscrever:', err);
    }
  }, []);

  /**
   * Cancela subscrição de um símbolo
   */
  const unsubscribe = useCallback((newSymbol: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        symbol: newSymbol
      }));
      logger.log(`📡 [useRealtimeStream] Cancelada subscrição de ${newSymbol}`);
    } catch (err) {
      logger.error('❌ [useRealtimeStream] Erro ao cancelar subscrição:', err);
    }
  }, []);

  // Conectar automaticamente se solicitado
  // TAREFA 1: CRÍTICO - Prevenir dupla execução do Strict Mode
  useEffect(() => {
    // CRÍTICO: Verificar isInitializedRef ANTES de qualquer lógica de conexão
    // Isso garante que new WebSocket() seja executado apenas uma vez
    if (isInitializedRef.current) {
      logger.log('⚠️ [useRealtimeStream] Ignorando dupla inicialização (Strict Mode) - isInitializedRef já está true');
      return;
    }

    // Verificar se já está conectado ou conectando
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      logger.log('⚠️ [useRealtimeStream] Ignorando - conexão já existe ou está em andamento');
      return;
    }

    // Marcar como inicializado ANTES de criar o WebSocket
    isInitializedRef.current = true;

    if (autoConnect && symbolRef.current) {
      connect();
    }

    return () => {
      // TAREFA 2: CRÍTICO - Cleanup completo - limpar tudo
      logger.log('🧹 [useRealtimeStream] Cleanup do useEffect de conexão');
      
      // Cancelar timer de reconexão pendente
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Fechar WebSocket e limpar
      disconnect();
      
      // Resetar flag de inicialização apenas no cleanup final
      isInitializedRef.current = false;
    };
  }, [autoConnect, connect, disconnect]);

  // CRÍTICO: Gerenciar mudanças de símbolo - fazer unsubscribe/subscribe
  // Este useEffect é executado quando o símbolo muda e a conexão está estabelecida
  useEffect(() => {
    logger.log(`🔄 [useRealtimeStream] useEffect de mudança de símbolo executado - símbolo: ${symbol}, conectado: ${isConnected}`);
    
    // Se não estiver conectado, não fazer nada (o useEffect de conexão vai cuidar disso)
    if (!isConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      logger.log(`⏭️ [useRealtimeStream] Não conectado ou WebSocket não aberto, aguardando conexão...`);
      return;
    }

    if (!symbol) {
      logger.log(`⏭️ [useRealtimeStream] Símbolo vazio, ignorando...`);
      return;
    }

    // Se já estiver subscrito a este símbolo, não fazer nada
    if (currentSubscribedSymbolRef.current === symbol) {
      logger.log(`⏭️ [useRealtimeStream] Já subscrito a ${symbol}, ignorando...`);
      return;
    }

    // Fazer unsubscribe do símbolo anterior se existir
    const previousSymbol = currentSubscribedSymbolRef.current;
    if (previousSymbol && previousSymbol !== symbol) {
      logger.log(`🔄 [useRealtimeStream] Mudando de ${previousSymbol} para ${symbol} - cancelando subscrição anterior`);
      unsubscribe(previousSymbol);
      currentSubscribedSymbolRef.current = null;
    }

    // Aguardar um pouco para garantir que o unsubscribe foi processado antes de subscrever ao novo
    const timeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && symbol) {
        logger.log(`📡 [useRealtimeStream] Subscrito a ${symbol} após mudança de símbolo`);
        subscribe(symbol);
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
    };
  }, [symbol, isConnected, subscribe, unsubscribe]);


  return {
    isConnected,
    lastTick,
    error,
    marketStatus,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

