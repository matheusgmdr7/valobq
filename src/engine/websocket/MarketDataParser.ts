/**
 * Parser para dados de mercado recebidos via WebSocket
 * 
 * Converte mensagens WebSocket em formato padronizado
 * para uso no sistema de gráficos
 */

import { CandlestickData } from '@/types/chart';
import { MarketDataMessage } from './WebSocketClient';

export interface ParsedCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ParsedTick {
  timestamp: number;
  price: number;
  volume?: number;
}

export class MarketDataParser {
  /**
   * Valida se um número é válido (não NaN, não Infinity)
   */
  private static isValidNumber(value: any): value is number {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value) && 
           value > 0;
  }

  /**
   * Valida estrutura básica de candle
   */
  private static validateCandleData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Validar que open e close são números válidos
    if (!this.isValidNumber(data.open) || !this.isValidNumber(data.close)) {
      return false;
    }

    // Validar high e low se presentes
    if (data.high !== undefined && !this.isValidNumber(data.high)) {
      return false;
    }

    if (data.low !== undefined && !this.isValidNumber(data.low)) {
      return false;
    }

    // Validar que high >= max(open, close) e low <= min(open, close)
    if (data.high !== undefined && data.high < Math.max(data.open, data.close)) {
      return false;
    }

    if (data.low !== undefined && data.low > Math.min(data.open, data.close)) {
      return false;
    }

    return true;
  }

  /**
   * Normaliza valores de candle (garante consistência)
   */
  private static normalizeCandleValues(data: any): {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } {
    const open = data.open;
    const close = data.close;
    
    // Calcular high e low se não fornecidos
    let high = data.high;
    let low = data.low;

    if (!high || !this.isValidNumber(high)) {
      high = Math.max(open, close);
    }

    if (!low || !this.isValidNumber(low)) {
      low = Math.min(open, close);
    }

    // Garantir que high >= max(open, close) e low <= min(open, close)
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    // Volume
    const volume = this.isValidNumber(data.volume) ? data.volume : 0;

    return { open, high, low, close, volume };
  }

  /**
   * Parse mensagem de candlestick com validação avançada
   */
  public static parseCandle(message: MarketDataMessage): CandlestickData | null {
    if (message.type !== 'candle') {
      return null;
    }

    const data = message.data;
    
    // Validar estrutura
    if (!this.validateCandleData(data)) {
      return null;
    }

    // Normalizar valores
    const normalized = this.normalizeCandleValues(data);

    // Normalizar timestamp
    const timestamp = this.normalizeTimestamp(message.timestamp);

    return {
      timestamp,
      open: normalized.open,
      high: normalized.high,
      low: normalized.low,
      close: normalized.close,
      volume: normalized.volume
    };
  }

  /**
   * Valida estrutura de tick
   */
  private static validateTickData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!this.isValidNumber(data.price)) {
      return false;
    }

    // Volume é opcional, mas se presente deve ser válido
    if (data.volume !== undefined && !this.isValidNumber(data.volume)) {
      return false;
    }

    return true;
  }

  /**
   * Parse mensagem de tick (preço em tempo real) com validação
   */
  public static parseTick(message: MarketDataMessage): ParsedTick | null {
    if (message.type !== 'tick' && message.type !== 'price') {
      return null;
    }

    const data = message.data;
    
    if (!this.validateTickData(data)) {
      return null;
    }

    return {
      timestamp: this.normalizeTimestamp(message.timestamp),
      price: data.price,
      volume: data.volume
    };
  }

  /**
   * Parse mensagem genérica
   */
  public static parse(message: MarketDataMessage): CandlestickData | ParsedTick | null {
    switch (message.type) {
      case 'candle':
        return this.parseCandle(message);
      case 'tick':
      case 'price':
        return this.parseTick(message);
      default:
        return null;
    }
  }

  /**
   * Valida estrutura de mensagem
   */
  public static validate(message: any): message is MarketDataMessage {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.symbol === 'string' &&
      (typeof message.timestamp === 'number' || message.timestamp === undefined) &&
      message.data !== undefined
    );
  }

  /**
   * Normaliza timestamp para garantir consistência
   */
  public static normalizeTimestamp(timestamp: number | string | undefined): number {
    if (!timestamp) {
      return Date.now();
    }

    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      return isNaN(parsed) ? Date.now() : parsed;
    }

    // Se timestamp está em segundos, converter para milissegundos
    if (timestamp < 10000000000) {
      return timestamp * 1000;
    }

    return timestamp;
  }

  /**
   * Agrupa ticks em candles (para quando recebemos apenas ticks)
   */
  public static groupTicksIntoCandles(
    ticks: ParsedTick[],
    intervalMs: number = 60000 // 1 minuto por padrão
  ): CandlestickData[] {
    if (ticks.length === 0) {
      return [];
    }

    // Ordenar ticks por timestamp
    const sortedTicks = [...ticks].sort((a, b) => a.timestamp - b.timestamp);

    const candles: CandlestickData[] = [];
    let currentCandle: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    } | null = null;

    for (const tick of sortedTicks) {
      const candleStart = Math.floor(tick.timestamp / intervalMs) * intervalMs;

      if (!currentCandle || currentCandle.timestamp !== candleStart) {
        // Finalizar candle anterior
        if (currentCandle) {
          candles.push({
            timestamp: currentCandle.timestamp,
            open: currentCandle.open,
            high: currentCandle.high,
            low: currentCandle.low,
            close: currentCandle.close,
            volume: currentCandle.volume
          });
        }

        // Criar novo candle
        currentCandle = {
          timestamp: candleStart,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume ?? 0
        };
      } else {
        // Atualizar candle atual
        currentCandle.high = Math.max(currentCandle.high, tick.price);
        currentCandle.low = Math.min(currentCandle.low, tick.price);
        currentCandle.close = tick.price;
        currentCandle.volume += tick.volume ?? 0;
      }
    }

    // Adicionar último candle
    if (currentCandle) {
      candles.push({
        timestamp: currentCandle.timestamp,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close,
        volume: currentCandle.volume
      });
    }

    return candles;
  }
}

