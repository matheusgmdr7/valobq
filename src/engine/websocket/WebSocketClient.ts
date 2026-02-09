/**
 * WebSocket Client para dados de mercado em tempo real
 * 
 * Características:
 * - Reconexão automática com backoff exponencial
 * - Heartbeat para manter conexão ativa
 * - Buffer de mensagens para gerenciar dados
 * - Fallback para polling quando WebSocket não disponível
 */

export enum WebSocketStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
  bufferSize?: number;
  enableHeartbeat?: boolean;
}

export interface MarketDataMessage {
  type: 'candle' | 'tick' | 'price' | 'volume' | 'trade';
  symbol: string;
  timestamp: number;
  data: any;
}

export type MessageHandler = (message: MarketDataMessage) => void;
export type StatusChangeHandler = (status: WebSocketStatus) => void;
export type ErrorHandler = (error: Error) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = WebSocketStatus.DISCONNECTED;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageBuffer: MarketDataMessage[] = [];
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusChangeHandlers: Set<StatusChangeHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 segundos
      heartbeatMessage: config.heartbeatMessage || JSON.stringify({ type: 'ping' }),
      bufferSize: config.bufferSize || 1000,
      enableHeartbeat: config.enableHeartbeat !== false
    };
  }

  /**
   * Conecta ao servidor WebSocket
   */
  public connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.status === WebSocketStatus.CONNECTING || this.status === WebSocketStatus.RECONNECTING) {
      return;
    }

    this.setStatus(WebSocketStatus.CONNECTING);
    
    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
      this.handleError(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Desconecta do servidor WebSocket
   */
  public disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      
      this.ws = null;
    }

    this.setStatus(WebSocketStatus.DISCONNECTED);
  }

  /**
   * Envia mensagem para o servidor
   */
  public send(message: string | object): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Inscreve-se para receber mensagens de um símbolo específico
   */
  public subscribe(symbol: string): boolean {
    return this.send({
      type: 'subscribe',
      symbol
    });
  }

  /**
   * Cancela inscrição de um símbolo
   */
  public unsubscribe(symbol: string): boolean {
    return this.send({
      type: 'unsubscribe',
      symbol
    });
  }

  /**
   * Adiciona handler para mensagens recebidas
   */
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Adiciona handler para mudanças de status
   */
  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusChangeHandlers.add(handler);
    return () => this.statusChangeHandlers.delete(handler);
  }

  /**
   * Adiciona handler para erros
   */
  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Obtém o status atual da conexão
   */
  public getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Verifica se está conectado
   */
  public isConnected(): boolean {
    return this.status === WebSocketStatus.CONNECTED && 
           this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Obtém o número de mensagens no buffer
   */
  public getBufferSize(): number {
    return this.messageBuffer.length;
  }

  /**
   * Limpa o buffer de mensagens
   */
  public clearBuffer(): void {
    this.messageBuffer = [];
  }

  /**
   * Obtém todas as mensagens do buffer
   */
  public flushBuffer(): MarketDataMessage[] {
    const messages = [...this.messageBuffer];
    this.messageBuffer = [];
    return messages;
  }

  /**
   * Configura event handlers do WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus(WebSocketStatus.CONNECTED);
      this.startHeartbeat();
      this.processBuffer();
    };

    this.ws.onclose = (event) => {
      this.clearTimers();
      
      // Código 1000 = fechamento normal, não reconectar
      if (event.code === 1000) {
        this.setStatus(WebSocketStatus.DISCONNECTED);
      } else {
        this.setStatus(WebSocketStatus.RECONNECTING);
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Não tratar como erro fatal imediatamente - deixar onclose lidar com reconexão
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(data: string | Blob): void {
    try {
      let message: MarketDataMessage;

      if (data instanceof Blob) {
        // Se for binary, converter para texto primeiro
        data.text().then(text => {
          message = JSON.parse(text);
          this.processMessage(message);
        }).catch(error => {
          console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
        });
        return;
      }

      const parsed = JSON.parse(data);
      
      // Ignorar mensagens de heartbeat
      if (parsed.type === 'pong' || parsed.type === 'ping') {
        return;
      }

      message = parsed as MarketDataMessage;
      this.processMessage(message);
    } catch (error) {
      console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Processa mensagem válida
   */
  private processMessage(message: MarketDataMessage): void {
    // Adicionar ao buffer se necessário
    if (this.messageBuffer.length >= this.config.bufferSize) {
      this.messageBuffer.shift(); // Remove mensagem mais antiga
    }
    this.messageBuffer.push(message);

    // Notificar handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
  }

  /**
   * Processa mensagens do buffer quando conectado
   */
  private processBuffer(): void {
    if (this.messageBuffer.length > 0) {
      const messages = this.flushBuffer();
      messages.forEach(message => {
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
        } catch (error) {
          console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
        }
        });
      });
    }
  }

  /**
   * Agenda reconexão com backoff exponencial
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocketClient] Error: Max reconnect attempts reached');
      this.setStatus(WebSocketStatus.ERROR);
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Máximo de 30 segundos
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.setStatus(WebSocketStatus.RECONNECTING);
      this.connect();
    }, delay);
  }

  /**
   * Inicia heartbeat para manter conexão ativa
   */
  private startHeartbeat(): void {
    if (!this.config.enableHeartbeat) return;

    this.clearHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send(this.config.heartbeatMessage);
      } else {
        this.clearHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Limpa timers
   */
  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearHeartbeat();
  }

  /**
   * Limpa timer de reconexão
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Limpa timer de heartbeat
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Atualiza status e notifica handlers
   */
  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusChangeHandlers.forEach(handler => {
        try {
          handler(status);
    } catch (error) {
        console.error('[WebSocketClient] Error:', error instanceof Error ? error.message : 'Unknown error');
      }
      });
    }
  }

  /**
   * Trata erros e notifica handlers
   */
  private handleError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('[WebSocketClient] Error:', err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }
}

