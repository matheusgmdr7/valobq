/**
 * TradingView WebSocket Client
 * 
 * Integração com TradingView WebSocket para dados de mercado em tempo real
 * Formato: Socket.IO sobre WebSocket
 */

import { logger } from '@/utils/logger';

export interface TradingViewConfig {
  url?: string;
  symbol?: string;
  sessionId?: string;
}

export interface TradingViewMessage {
  m: string; // Método
  p: any[];  // Parâmetros
  id?: string;
}

export interface TradingViewTick {
  symbol: string;
  price: number;
  volume?: number;
  timestamp: number;
  bid?: number;
  ask?: number;
}

export type TickHandler = (tick: TradingViewTick) => void;
export type CandleHandler = (candle: any) => void;

export class TradingViewWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private symbol: string;
  private sessionId: string;
  private messageId = 0;
  private tickHandlers: Set<TickHandler> = new Set();
  private candleHandlers: Set<CandleHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(config: TradingViewConfig = {}) {
    this.url = config.url || 'wss://data.tradingview.com/socket.io/websocket';
    this.symbol = config.symbol || 'FX:GBPUSD';
    this.sessionId = config.sessionId || this.generateSessionId();
  }

  /**
   * Gera ID de sessão único
   */
  private generateSessionId(): string {
    return `qs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Conecta ao WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.initializeSession();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          logger.error('[TradingViewWS]', error instanceof Error ? error.message : 'Unknown error');
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Inicializa sessão TradingView
   */
  private initializeSession() {
    // Enviar mensagem de handshake
    this.send({
      m: 'set_auth_token',
      p: ['unauthorized_user']
    });

    // Aguardar um pouco e então subscrever símbolo
    setTimeout(() => {
      this.subscribeToSymbol(this.symbol);
    }, 1000);
  }

  /**
   * Inscreve-se em um símbolo
   */
  subscribeToSymbol(symbol: string) {
    this.symbol = symbol;
    
    // Converter símbolo para formato TradingView se necessário
    const tvSymbol = this.convertSymbolToTradingView(symbol);
    
    this.send({
      m: 'quote_add_symbols',
      p: [this.sessionId, tvSymbol]
    });

    // Subscrever para dados de tick
    this.send({
      m: 'quote_fast_symbols',
      p: [this.sessionId, tvSymbol]
    });
  }

  /**
   * Converte símbolo para formato TradingView
   */
  private convertSymbolToTradingView(symbol: string): string {
    // Exemplos de conversão:
    // GBP/USD -> FX:GBPUSD
    // EUR/USD -> FX:EURUSD
    // BTC/USD -> BINANCE:BTCUSDT
    // ETH/USD -> BINANCE:ETHUSDT

    if (symbol.includes('/')) {
      const [base, quote] = symbol.split('/');
      if (quote === 'USD') {
        return `FX:${base}${quote}`;
      }
      return `FX:${base}${quote}`;
    }

    // Para criptomoedas, usar Binance
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      return `BINANCE:${symbol.replace('/', '')}`;
    }

    return symbol;
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(data: string) {
    try {
      // TradingView usa formato Socket.IO
      // Mensagens podem vir em diferentes formatos
      
      if (data.startsWith('~m~')) {
        // Formato binário TradingView
        const message = this.parseTradingViewMessage(data);
        this.processTradingViewMessage(message);
      } else {
        // Formato JSON padrão
        const message = JSON.parse(data);
        this.processTradingViewMessage(message);
      }
    } catch (error) {
      logger.error('[TradingViewWS]', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Parse mensagem TradingView (formato ~m~)
   */
  private parseTradingViewMessage(data: string): any {
    // TradingView usa formato: ~m~{length}~m~{message}
    const regex = /~m~(\d+)~m~(.*)/;
    const match = data.match(regex);
    
    if (match) {
      const length = parseInt(match[1]);
      const message = match[2].substring(0, length);
      return JSON.parse(message);
    }
    
    return JSON.parse(data);
  }

  /**
   * Processa mensagem TradingView
   */
  private processTradingViewMessage(message: any) {
    // TradingView envia diferentes tipos de mensagens
    if (message.m === 'qsd') {
      // Quote data (dados de preço)
      this.handleQuoteData(message.p);
    } else if (message.m === 'timescale_update') {
      // Atualização de candle
      this.handleCandleUpdate(message.p);
    }
  }

  /**
   * Processa dados de quote (preço)
   */
  private handleQuoteData(params: any[]) {
    if (params.length < 2) return;

    const sessionId = params[0];
    const data = params[1];

    if (data && data.n && data.v) {
      const tick: TradingViewTick = {
        symbol: this.symbol,
        price: data.v.lp || data.v.p || 0, // last price
        volume: data.v.volume,
        timestamp: Date.now(),
        bid: data.v.bid,
        ask: data.v.ask
      };

      // Notificar handlers
      this.tickHandlers.forEach(handler => {
        try {
          handler(tick);
        } catch (error) {
          logger.error('[TradingViewWS]', error instanceof Error ? error.message : 'Unknown error');
        }
      });
    }
  }

  /**
   * Processa atualização de candle
   */
  private handleCandleUpdate(params: any[]) {
    // TradingView envia candles em formato específico
    this.candleHandlers.forEach(handler => {
      try {
        handler(params);
      } catch (error) {
        logger.error('[TradingViewWS]', error instanceof Error ? error.message : 'Unknown error');
      }
    });
  }

  /**
   * Envia mensagem
   */
  private send(message: TradingViewMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    message.id = (this.messageId++).toString();
    
    // TradingView usa formato ~m~{length}~m~{message}
    const jsonMessage = JSON.stringify(message);
    const formatted = `~m~${jsonMessage.length}~m~${jsonMessage}`;
    
    this.ws.send(formatted);
  }

  /**
   * Adiciona handler para ticks
   */
  onTick(handler: TickHandler): () => void {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  /**
   * Adiciona handler para candles
   */
  onCandle(handler: CandleHandler): () => void {
    this.candleHandlers.add(handler);
    return () => this.candleHandlers.delete(handler);
  }

  /**
   * Inicia heartbeat
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          m: 'ping',
          p: []
        });
      }
    }, 30000); // 30 segundos
  }

  /**
   * Para heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Agenda reconexão
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[TradingViewWS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        logger.error('[TradingViewWS]', error instanceof Error ? error.message : 'Unknown error');
      });
    }, delay);
  }

  /**
   * Desconecta
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

