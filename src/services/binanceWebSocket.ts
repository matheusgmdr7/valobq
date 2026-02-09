/**
 * Binance WebSocket Client
 * 
 * WebSocket público da Binance para dados de mercado em tempo real
 * Não requer autenticação para dados de ticker
 */

export interface BinanceConfig {
  symbol?: string;
  streamType?: 'ticker' | 'trade' | 'kline';
  interval?: string; // 1m, 5m, 15m, 1h, etc.
}

export interface BinanceTick {
  symbol: string;
  price: number;
  volume?: number;
  timestamp: number;
  bid?: number;
  ask?: number;
}

export type BinanceTickHandler = (tick: BinanceTick) => void;

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private symbol: string;
  private streamType: string;
  private interval: string;
  private tickHandlers: Set<BinanceTickHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(config: BinanceConfig = {}) {
    this.symbol = this.normalizeSymbol(config.symbol || 'BTCUSDT');
    this.streamType = config.streamType || 'ticker';
    this.interval = config.interval || '1m';
  }

  /**
   * Normaliza símbolo para formato Binance
   * Ex: BTC/USD -> BTCUSDT, EUR/USD -> EURUSDT
   */
  private normalizeSymbol(symbol: string): string {
    // Remover espaços e barras
    let normalized = symbol.replace(/[\s\/]/g, '').toUpperCase();
    
    // Se não termina com USDT, adicionar
    if (!normalized.endsWith('USDT') && !normalized.endsWith('BUSD')) {
      // Para pares de forex, converter para cripto equivalente
      if (normalized.includes('EUR') || normalized.includes('GBP') || normalized.includes('USD')) {
        // Para forex, usar EUR/USD como exemplo - Binance não tem todos os pares forex
        // Vamos usar BTCUSDT como padrão e deixar o usuário escolher
        return 'BTCUSDT';
      }
      normalized += 'USDT';
    }
    
    return normalized;
  }

  /**
   * Constrói URL do WebSocket Binance
   */
  private buildWebSocketUrl(): string {
    const baseUrl = 'wss://stream.binance.com:9443/ws/';
    
    if (this.streamType === 'ticker') {
      // Stream de ticker (preço atual)
      const streamName = `${this.symbol.toLowerCase()}@ticker`;
      return `${baseUrl}${streamName}`;
    } else if (this.streamType === 'trade') {
      // Stream de trades (últimas transações)
      const streamName = `${this.symbol.toLowerCase()}@trade`;
      return `${baseUrl}${streamName}`;
    } else {
      // Stream de kline (candles)
      const streamName = `${this.symbol.toLowerCase()}@kline_${this.interval}`;
      return `${baseUrl}${streamName}`;
    }
  }

  /**
   * Conecta ao WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = this.buildWebSocketUrl();
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
          }
        };

        this.ws.onerror = () => {
          console.error('[BinanceWebSocket] Error: WebSocket error');
          // Não rejeitar imediatamente, aguardar onclose
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.stopHeartbeat();
          
          if (event.code !== 1000 && this.reconnectAttempts === 0) {
            // Primeira desconexão inesperada
            this.scheduleReconnect();
          } else if (event.code === 1000) {
            // Fechamento normal
            resolve();
          } else {
            reject(new Error(`WebSocket closed with code ${event.code}`));
          }
        };

        // Timeout para conexão
        setTimeout(() => {
          if (!this.isConnected && this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Binance WebSocket connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(data: any) {
    try {
      if (this.streamType === 'ticker') {
        // Formato: { e: "24hrTicker", E: timestamp, s: "BTCUSDT", c: "50000.00", ... }
        if (data.e === '24hrTicker') {
          const tick: BinanceTick = {
            symbol: data.s,
            price: parseFloat(data.c), // Preço de fechamento (último preço)
            volume: parseFloat(data.v || '0'),
            timestamp: data.E || Date.now(),
            bid: parseFloat(data.b || data.c), // Best bid price
            ask: parseFloat(data.a || data.c)  // Best ask price
          };

          this.tickHandlers.forEach(handler => {
            try {
              handler(tick);
            } catch (error) {
              console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
            }
          });
        }
      } else if (this.streamType === 'trade') {
        // Formato: { e: "trade", E: timestamp, s: "BTCUSDT", p: "50000.00", q: "0.1", ... }
        if (data.e === 'trade') {
          const tick: BinanceTick = {
            symbol: data.s,
            price: parseFloat(data.p),
            volume: parseFloat(data.q || '0'),
            timestamp: data.E || Date.now()
          };

          this.tickHandlers.forEach(handler => {
            try {
              handler(tick);
            } catch (error) {
              console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
            }
          });
        }
      } else if (this.streamType === 'kline') {
        // Formato: { e: "kline", E: timestamp, s: "BTCUSDT", k: { ... } }
        if (data.e === 'kline' && data.k) {
          const kline = data.k;
          const tick: BinanceTick = {
            symbol: data.s,
            price: parseFloat(kline.c), // Preço de fechamento
            volume: parseFloat(kline.v || '0'),
            timestamp: kline.t || Date.now()
          };

          this.tickHandlers.forEach(handler => {
            try {
              handler(tick);
            } catch (error) {
              console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
            }
          });
        }
      }
    } catch (error) {
      console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Adiciona handler para ticks
   */
  onTick(handler: BinanceTickHandler): () => void {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  /**
   * Inscreve-se em um símbolo
   */
  subscribe(symbol: string) {
    this.symbol = this.normalizeSymbol(symbol);
    
    // Se já conectado, precisamos reconectar com novo símbolo
    if (this.isConnected) {
      this.disconnect();
      this.connect().catch(error => {
        console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
      });
    }
  }

  /**
   * Inicia heartbeat
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    // Binance não requer heartbeat, mas vamos manter conexão viva
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        // Binance mantém conexão viva automaticamente
        // Não precisamos enviar ping manualmente
      }
    }, 30000);
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
      console.error('[BinanceWebSocket] Error: Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[BinanceWebSocket] Error:', error instanceof Error ? error.message : 'Unknown error');
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
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Verifica se está conectado
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
}

