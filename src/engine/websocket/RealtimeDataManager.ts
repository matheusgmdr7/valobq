/**
 * Gerenciador de Dados em Tempo Real
 * 
 * Integra WebSocket/Polling com ChartManager para atualizações em tempo real
 */

import { CandlestickData } from '@/types/chart';
import { WebSocketClient, MarketDataMessage, WebSocketStatus } from './WebSocketClient';
import { MarketDataParser } from './MarketDataParser';
import { PollingFallback, PollingConfig } from './PollingFallback';
import { trackTradingEvent } from '@/utils/analytics';
import { captureMessage } from '@/utils/monitoring';

export interface RealtimeDataConfig {
  symbol: string;
  websocketUrl?: string;
  pollingUrl?: string;
  pollingInterval?: number;
  enableWebSocket?: boolean;
  enablePolling?: boolean;
  maxCandles?: number; // Limite de candles mantidos em memória
}

export type DataUpdateHandler = (candles: CandlestickData[]) => void;
export type StatusChangeHandler = (status: 'connected' | 'disconnected' | 'polling') => void;

export class RealtimeDataManager {
  private config: Required<RealtimeDataConfig>;
  private candles: CandlestickData[] = [];
  private wsClient: WebSocketClient | null = null;
  private pollingFallback: PollingFallback | null = null;
  private dataHandlers: Set<DataUpdateHandler> = new Set();
  private statusHandlers: Set<StatusChangeHandler> = new Set();
  private currentStatus: 'connected' | 'disconnected' | 'polling' = 'disconnected';
  private lastCandleTimestamp: number = 0;
  private pollingFailed = false; // Flag para evitar reiniciar polling que já falhou

  constructor(config: RealtimeDataConfig) {
    this.config = {
      symbol: config.symbol,
      websocketUrl: config.websocketUrl || '',
      pollingUrl: config.pollingUrl || '',
      pollingInterval: config.pollingInterval || 5000,
      enableWebSocket: config.enableWebSocket !== false,
      enablePolling: config.enablePolling !== false,
      maxCandles: config.maxCandles || 10000
    };
  }

  /**
   * Inicializa e conecta
   */
  public async start(): Promise<void> {
    // Tentar WebSocket primeiro
    if (this.config.enableWebSocket && this.config.websocketUrl) {
      try {
        await this.startWebSocket();
        return;
      } catch (error) {
        console.error('[RealtimeDataManager] Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Fallback para polling apenas se realmente habilitado
    if (this.config.enablePolling && this.config.pollingUrl && this.config.pollingUrl.startsWith('/')) {
      this.startPolling();
    }
  }

  /**
   * Para todas as conexões
   */
  public stop(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }

    if (this.pollingFallback) {
      this.pollingFallback.stop();
      this.pollingFallback = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Define dados iniciais (históricos)
   */
  public setInitialData(candles: CandlestickData[]): void {
    this.candles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    
    if (this.candles.length > 0) {
      this.lastCandleTimestamp = this.candles[this.candles.length - 1].timestamp;
    }

    this.notifyDataUpdate();
  }

  /**
   * Obtém candles atuais
   */
  public getCandles(): CandlestickData[] {
    return [...this.candles];
  }

  /**
   * Adiciona handler para atualizações de dados
   */
  public onDataUpdate(handler: DataUpdateHandler): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  /**
   * Adiciona handler para mudanças de status
   */
  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Obtém status atual
   */
  public getStatus(): 'connected' | 'disconnected' | 'polling' {
    return this.currentStatus;
  }

  /**
   * Inicia conexão WebSocket
   */
  private async startWebSocket(): Promise<void> {
    if (!this.config.websocketUrl) {
      throw new Error('WebSocket URL not configured');
    }

    this.wsClient = new WebSocketClient({
      url: this.config.websocketUrl,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      bufferSize: 1000
    });

    // Handler de mensagens
    this.wsClient.onMessage((message) => {
      this.handleMessage(message);
    });

    // Handler de status
    this.wsClient.onStatusChange((status) => {
      if (status === WebSocketStatus.CONNECTED) {
        this.setStatus('connected');
        // Inscrever-se no símbolo
        this.wsClient?.subscribe(this.config.symbol);
        
        // Track WebSocket connection
        trackTradingEvent('websocket_connected', {
          symbol: this.config.symbol
        });
      } else if (status === WebSocketStatus.DISCONNECTED || 
                 status === WebSocketStatus.ERROR) {
        this.setStatus('disconnected');
        
        // Track WebSocket disconnection
        trackTradingEvent('websocket_disconnected', {
          symbol: this.config.symbol,
          reason: status === WebSocketStatus.ERROR ? 'error' : 'normal'
        });
        
        captureMessage(`WebSocket disconnected for ${this.config.symbol}`, 'warning', {
          symbol: this.config.symbol,
          status
        });
        
        // Tentar fallback para polling apenas se polling estiver habilitado e URL válida
        // E apenas se não estiver já fazendo polling
        if (this.config.enablePolling && 
            this.config.pollingUrl && 
            this.config.pollingUrl.startsWith('/') &&
            !this.pollingFallback?.isActive()) {
          try {
          this.startPolling();
          } catch {
            // Silenciar erros de polling - não é crítico
          }
        }
      }
    });

    // Handler de erros
    this.wsClient.onError(() => {
      // Não tentar polling automaticamente em caso de erro
      // O onclose já lida com fallback se necessário
    });

    this.wsClient.connect();
  }

  /**
   * Inicia polling
   */
  private startPolling(): void {
    // Verificar se polling está realmente habilitado
    if (!this.config.enablePolling) {
      return; // Polling desabilitado
    }

    if (!this.config.pollingUrl) {
      return; // URL não configurada
    }

    // Não iniciar se polling já falhou anteriormente
    if (this.pollingFailed) {
      return; // Polling já falhou, não tentar novamente
    }

    // Verificar se já está fazendo polling
    if (this.pollingFallback?.isActive()) {
      return; // Já está fazendo polling
    }

    // Parar qualquer instância anterior antes de criar nova
    if (this.pollingFallback) {
      this.pollingFallback.stop();
      this.pollingFallback = null;
    }

    this.pollingFallback = new PollingFallback(
      {
        url: this.config.pollingUrl,
        interval: this.config.pollingInterval,
        params: {
          symbol: this.config.symbol,
          ...(this.lastCandleTimestamp > 0 && {
            since: this.lastCandleTimestamp.toString()
          })
        }
      },
      {
        onData: (data) => {
          this.handlePollingData(data);
        },
        onError: () => {
          // Silenciar erros de polling - não é crítico
        },
        maxAttempts: 3, // Reduzir tentativas para evitar loops
        retryDelay: 5000, // Aumentar delay entre tentativas
        onMaxAttemptsReached: () => {
          // Marcar que polling falhou para não tentar novamente
          this.pollingFailed = true;
          this.setStatus('disconnected');
        }
      }
    );

    this.setStatus('polling');
    this.pollingFallback.start();
  }

  /**
   * Processa mensagem do WebSocket
   */
  private handleMessage(message: MarketDataMessage): void {
    if (message.symbol !== this.config.symbol) {
      return; // Ignorar mensagens de outros símbolos
    }

    const candle = MarketDataParser.parseCandle(message);
    if (candle) {
      this.updateCandles(candle);
    } else {
      // Tentar parse como tick e atualizar último candle
      const tick = MarketDataParser.parseTick(message);
      if (tick) {
        this.updateLastCandleWithTick(tick);
      }
    }
  }

  /**
   * Processa dados do polling
   */
  private handlePollingData(data: any): void {
    if (Array.isArray(data)) {
      // Array de candles
      const newCandles = data
        .map((item: any) => {
          const message: MarketDataMessage = {
            type: 'candle',
            symbol: this.config.symbol,
            timestamp: item.timestamp || Date.now(),
            data: item
          };
          return MarketDataParser.parseCandle(message);
        })
        .filter((candle): candle is CandlestickData => candle !== null);

      if (newCandles.length > 0) {
        this.mergeCandles(newCandles);
      }
    } else if (data.candle) {
      // Candle único
      const message: MarketDataMessage = {
        type: 'candle',
        symbol: this.config.symbol,
        timestamp: data.timestamp || Date.now(),
        data: data.candle
      };
      const candle = MarketDataParser.parseCandle(message);
      if (candle) {
        this.updateCandles(candle);
      }
    }
  }

  /**
   * Atualiza candles com novo candle
   */
  private updateCandles(newCandle: CandlestickData): void {
    const index = this.candles.findIndex(
      c => c.timestamp === newCandle.timestamp
    );

    if (index >= 0) {
      // Atualizar candle existente
      this.candles[index] = newCandle;
    } else {
      // Adicionar novo candle
      this.candles.push(newCandle);
      this.candles.sort((a, b) => a.timestamp - b.timestamp);
      
      // Limitar tamanho do array
      if (this.candles.length > this.config.maxCandles) {
        this.candles = this.candles.slice(-this.config.maxCandles);
      }
    }

    this.lastCandleTimestamp = Math.max(
      this.lastCandleTimestamp,
      newCandle.timestamp
    );

    this.notifyDataUpdate();
  }

  /**
   * Atualiza último candle com tick
   */
  private updateLastCandleWithTick(tick: { timestamp: number; price: number; volume?: number }): void {
    if (this.candles.length === 0) {
      // Criar novo candle a partir do tick
      const newCandle: CandlestickData = {
        timestamp: Math.floor(tick.timestamp / 60000) * 60000, // Arredondar para minuto
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume ?? 0
      };
      this.updateCandles(newCandle);
      return;
    }

    const lastCandle = this.candles[this.candles.length - 1];
    const candleTimestamp = Math.floor(tick.timestamp / 60000) * 60000;

    if (candleTimestamp === lastCandle.timestamp) {
      // Atualizar último candle
      lastCandle.high = Math.max(lastCandle.high, tick.price);
      lastCandle.low = Math.min(lastCandle.low, tick.price);
      lastCandle.close = tick.price;
      if (tick.volume) {
        lastCandle.volume = (lastCandle.volume ?? 0) + tick.volume;
      }
      this.notifyDataUpdate();
    } else {
      // Criar novo candle
      const newCandle: CandlestickData = {
        timestamp: candleTimestamp,
        open: lastCandle.close,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume ?? 0
      };
      this.updateCandles(newCandle);
    }
  }

  /**
   * Mescla candles (para polling que retorna múltiplos)
   */
  private mergeCandles(newCandles: CandlestickData[]): void {
    let updated = false;

    for (const newCandle of newCandles) {
      const index = this.candles.findIndex(
        c => c.timestamp === newCandle.timestamp
      );

      if (index >= 0) {
        this.candles[index] = newCandle;
        updated = true;
      } else {
        this.candles.push(newCandle);
        updated = true;
      }
    }

    if (updated) {
      this.candles.sort((a, b) => a.timestamp - b.timestamp);
      
      // Limitar tamanho
      if (this.candles.length > this.config.maxCandles) {
        this.candles = this.candles.slice(-this.config.maxCandles);
      }

      if (this.candles.length > 0) {
        this.lastCandleTimestamp = this.candles[this.candles.length - 1].timestamp;
      }

      this.notifyDataUpdate();
    }
  }

  /**
   * Notifica handlers de atualização de dados
   */
  private notifyDataUpdate(): void {
    const candles = this.getCandles();
    this.dataHandlers.forEach(handler => {
      try {
        handler(candles);
      } catch (error) {
        console.error('[RealtimeDataManager] Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
  }

  /**
   * Atualiza status e notifica handlers
   */
  private setStatus(status: 'connected' | 'disconnected' | 'polling'): void {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusHandlers.forEach(handler => {
        try {
          handler(status);
        } catch (error) {
          console.error('[RealtimeDataManager] Error:', error instanceof Error ? error.message : 'Unknown error');
        }
      });
    }
  }
}

