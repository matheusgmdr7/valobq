/**
 * React Hook para usar WebSocket Client
 * 
 * Gerencia ciclo de vida da conexão WebSocket e fornece
 * interface reativa para componentes React
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WebSocketClient,
  WebSocketStatus,
  MarketDataMessage,
  WebSocketConfig
} from '@/engine/websocket/WebSocketClient';

export interface UseWebSocketOptions extends Omit<WebSocketConfig, 'url'> {
  url?: string;
  autoConnect?: boolean;
  onMessage?: (message: MarketDataMessage) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
  client: WebSocketClient | null;
  status: WebSocketStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: string | object) => boolean;
  subscribe: (symbol: string) => boolean;
  unsubscribe: (symbol: string) => boolean;
  bufferSize: number;
  clearBuffer: () => void;
}

/**
 * Hook para usar WebSocket Client
 */
export function useWebSocket(
  urlOrConfig: string | WebSocketConfig,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
  const [bufferSize, setBufferSize] = useState(0);

  // Determinar configuração
  const config: WebSocketConfig = typeof urlOrConfig === 'string'
    ? { url: urlOrConfig, ...options }
    : { ...urlOrConfig, ...options };

  const {
    autoConnect = true,
    onMessage,
    onStatusChange,
    onError
  } = options;

  // Criar cliente WebSocket
  useEffect(() => {
    if (!config.url) {
      return;
    }

    const client = new WebSocketClient(config);
    clientRef.current = client;

    // Configurar handlers
    if (onMessage) {
      client.onMessage(onMessage);
    }

    client.onStatusChange((newStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    });

    if (onError) {
      client.onError(onError);
    }

    // Atualizar buffer size periodicamente
    const bufferInterval = setInterval(() => {
      if (client) {
        setBufferSize(client.getBufferSize());
      }
    }, 1000);

    // Conectar automaticamente se configurado
    if (autoConnect) {
      client.connect();
    }

    return () => {
      clearInterval(bufferInterval);
      client.disconnect();
      clientRef.current = null;
    };
  }, [config.url]); // Apenas recriar se URL mudar

  // Conectar
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  // Desconectar
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  // Enviar mensagem
  const send = useCallback((message: string | object): boolean => {
    return clientRef.current?.send(message) ?? false;
  }, []);

  // Inscrever-se em símbolo
  const subscribe = useCallback((symbol: string): boolean => {
    return clientRef.current?.subscribe(symbol) ?? false;
  }, []);

  // Cancelar inscrição
  const unsubscribe = useCallback((symbol: string): boolean => {
    return clientRef.current?.unsubscribe(symbol) ?? false;
  }, []);

  // Limpar buffer
  const clearBuffer = useCallback(() => {
    clientRef.current?.clearBuffer();
    setBufferSize(0);
  }, []);

  return {
    client: clientRef.current,
    status,
    isConnected: status === WebSocketStatus.CONNECTED,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    bufferSize,
    clearBuffer
  };
}

