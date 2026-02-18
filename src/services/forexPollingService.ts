/**
 * Forex Polling Service
 * 
 * Serviço de polling para dados de Forex em tempo real
 * Usa Yahoo Finance REST API (gratuito, sem API key)
 * 
 * ⚠️ Nota: Polling não é verdadeiramente tempo real, mas é a melhor
 * opção gratuita disponível para Forex sem WebSocket privado.
 */

import { CandlestickData } from '@/types/chart';
import { logger } from '@/utils/logger';

export interface ForexTick {
  symbol: string;
  price: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
}

export type ForexTickHandler = (tick: ForexTick) => void;

export interface ForexPollingConfig {
  symbol: string;
  interval?: number; // Intervalo de polling em ms (padrão: 2000 = 2 segundos)
  onTick?: ForexTickHandler;
  enabled?: boolean;
}

export class ForexPollingService {
  private symbol: string;
  private interval: number;
  private tickHandler?: ForexTickHandler;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastPrice: number | null = null;
  // Histórico de preços para Random Walk
  private priceHistory: number[] = [];
  private readonly maxHistoryLength = 100;
  // Volatilidade para Random Walk (ajustável por símbolo)
  private readonly volatility: number = 0.0002; // 0.02% por tick
  // Drift (tendência) para Random Walk
  private drift: number = 0;

  constructor(config: ForexPollingConfig) {
    this.symbol = config.symbol;
    this.interval = config.interval || 2000; // 2 segundos por padrão
    this.tickHandler = config.onTick;
  }

  /**
   * Inicia polling
   */
  start() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.poll(); // Poll imediatamente
    this.scheduleNextPoll();
  }

  /**
   * Para polling
   */
  stop() {
    this.isPolling = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Agenda próximo poll
   */
  private scheduleNextPoll() {
    if (!this.isPolling) {
      return;
    }

    this.pollingTimer = setTimeout(() => {
      this.poll();
      this.scheduleNextPoll();
    }, this.interval);
  }

  /**
   * Faz poll do preço atual
   */
  private async poll() {
    try {
      const tick = await this.fetchCurrentPrice(this.symbol);
      
      // Sempre notificar o primeiro tick, depois só se o preço mudou significativamente
      const shouldNotify = this.lastPrice === null || Math.abs(tick.price - this.lastPrice) > 0.0001;
      
      if (shouldNotify) {
        this.lastPrice = tick.price;
        
        if (this.tickHandler) {
          this.tickHandler(tick);
        }
      }
    } catch (error: unknown) {
      logger.error('[ForexPolling]', error instanceof Error ? error.message : 'Unknown error');
      
      // Mesmo com erro, tentar usar preço simulado como último recurso
      try {
        const fallbackTick = this.getSimulatedPrice(this.symbol);
        const shouldNotify = this.lastPrice === null || Math.abs(fallbackTick.price - (this.lastPrice || 0)) > 0.0001;
        
        if (shouldNotify && this.tickHandler) {
          this.lastPrice = fallbackTick.price;
          this.tickHandler(fallbackTick);
        }
      } catch (fallbackError) {
        logger.error('[ForexPolling]', fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
      }
    }
  }

  /**
   * Busca preço atual via API route (evita problemas de CORS)
   */
  private async fetchCurrentPrice(symbol: string): Promise<ForexTick> {
    try {
      // Usar API route do Next.js como proxy para evitar CORS
      const url = `/api/forex/price?symbol=${encodeURIComponent(symbol)}`;
      
      // Adicionar timeout para evitar requisições travadas
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos
      
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Tentar ler o JSON mesmo se não estiver OK (pode ter preço simulado)
          try {
            const errorData = await response.json();
            if (errorData.price) {
              // API retornou erro mas com preço simulado
              return {
                symbol,
                price: errorData.price,
                timestamp: errorData.timestamp || Date.now(),
                change: 0,
                changePercent: 0
              };
            }
          } catch {
            // Se não conseguir ler JSON, usar fallback
          }
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Se a API retornou erro mas com preço simulado, usar ele
        // (a API agora sempre retorna status 200 mesmo com erro, mas com preço simulado)
        if (data.error && data.price) {
          return {
            symbol,
            price: data.price,
            timestamp: data.timestamp || Date.now(),
            change: 0,
            changePercent: 0
          };
        }

        // Validar que temos um preço válido
        if (typeof data.price !== 'number' || !isFinite(data.price)) {
          throw new Error('Invalid price data from API');
        }

        // Dados válidos da API
        return {
          symbol: data.symbol || symbol,
          price: data.price,
          timestamp: data.timestamp || Date.now(),
          bid: data.bid,
          ask: data.ask,
          change: data.change,
          changePercent: data.changePercent
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Se foi abortado por timeout
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - API route não respondeu em 10 segundos');
        }
        
        // Re-throw outros erros
        throw fetchError;
      }
    } catch (error: any) {
      // LOG DETALHADO DO ERRO (sempre logar para debug)
      const errorDetails = {
        symbol,
        errorMessage: error?.message || 'Unknown error',
        errorName: error?.name || 'Error',
        errorType: error?.constructor?.name || typeof error,
        stack: error?.stack,
        // Informações específicas de fetch
        isNetworkError: error?.name === 'TypeError' && error?.message?.includes('fetch'),
        isTimeout: error?.name === 'AbortError',
        isCORS: error?.message?.includes('CORS') || error?.message?.includes('cross-origin'),
        url: `/api/forex/price?symbol=${encodeURIComponent(symbol)}`
      };

      logger.error(`[ForexPolling] Erro ao buscar preço para ${symbol}:`, errorDetails);
      
      // Fallback para preço simulado (Random Walk)
      return this.getSimulatedPrice(symbol);
    }
  }

  /**
   * Gera preço simulado usando Random Walk (Geometric Brownian Motion)
   * 
   * Em vez de usar seno ou variação aleatória simples, usa um Random Walk
   * baseado no último preço, simulando movimento realista de mercado.
   */
  private getSimulatedPrice(symbol: string): ForexTick {
    // Preços base por símbolo
    const basePrices: Record<string, number> = {
      'GBP/USD': 1.2650,
      'EUR/USD': 1.0850,
      'USD/JPY': 149.50,
      'AUD/CAD': 0.8950,
      'USD/CHF': 0.8750,
      'NZD/USD': 0.6250
    };

    // Determinar preço base (último preço ou preço base do símbolo)
    let basePrice: number;
    if (this.lastPrice !== null) {
      // Usar último preço como base para continuidade
      basePrice = this.lastPrice;
    } else {
      // Primeira vez: usar preço base do símbolo
      basePrice = basePrices[symbol] || 1.0;
    }

    // Geometric Brownian Motion (Random Walk)
    // Fórmula: S(t) = S(0) * exp((μ - σ²/2) * t + σ * W(t))
    // Simplificada para: price = lastPrice * (1 + drift + random_shock)
    
    // Calcular drift baseado na tendência recente (média móvel simples)
    if (this.priceHistory.length >= 2) {
      const recentChange = this.priceHistory[this.priceHistory.length - 1] - this.priceHistory[this.priceHistory.length - 2];
      const avgChange = recentChange / this.priceHistory.length;
      // Drift suavizado (tendência de longo prazo)
      this.drift = this.drift * 0.9 + avgChange * 0.1;
    } else {
      // Inicializar drift com pequena variação aleatória
      this.drift = (Math.random() - 0.5) * 0.00001;
    }

    // Random shock (ruído branco gaussiano)
    // Usar distribuição normal aproximada (Box-Muller transform)
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // N(0,1)
    
    // Aplicar volatilidade
    const randomShock = z * this.volatility;
    
    // Calcular novo preço usando Geometric Brownian Motion
    // price = basePrice * exp(drift + randomShock)
    // Simplificado para pequenas variações: price ≈ basePrice * (1 + drift + randomShock)
    const priceChange = this.drift + randomShock;
    const price = basePrice * (1 + priceChange);
    
    // Limitar variação extrema (circuit breaker)
    const maxChange = 0.01; // Máximo 1% de variação por tick
    const clampedPrice = Math.max(
      basePrice * (1 - maxChange),
      Math.min(basePrice * (1 + maxChange), price)
    );

    // Atualizar histórico
    this.priceHistory.push(clampedPrice);
    if (this.priceHistory.length > this.maxHistoryLength) {
      this.priceHistory.shift(); // Manter apenas últimos N preços
    }

    // Calcular change e changePercent
    const change = clampedPrice - basePrice;
    const changePercent = (change / basePrice) * 100;

    return {
      symbol,
      price: clampedPrice,
      timestamp: Date.now(),
      change,
      changePercent
    };
  }

  /**
   * Atualiza símbolo
   */
  updateSymbol(symbol: string) {
    this.symbol = symbol;
    this.lastPrice = null; // Reset para forçar notificação
    this.priceHistory = []; // Reset histórico para novo símbolo
    this.drift = 0; // Reset drift
  }

  /**
   * Atualiza handler
   */
  setTickHandler(handler: ForexTickHandler) {
    this.tickHandler = handler;
  }

  /**
   * Verifica se está fazendo polling
   */
  getIsPolling(): boolean {
    return this.isPolling;
  }
}

