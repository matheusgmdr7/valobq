/**
 * Validador avançado de dados de mercado
 * 
 * Fornece validação robusta e transformação de dados
 * para garantir integridade e consistência
 */

import { CandlestickData } from '@/types/chart';
import { MarketDataMessage } from './WebSocketClient';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DataQualityMetrics {
  completeness: number; // 0-1
  consistency: number; // 0-1
  timeliness: number; // 0-1 (baseado em atraso)
  overall: number; // 0-1 (média ponderada)
}

export class DataValidator {
  /**
   * Valida mensagem de mercado completa
   */
  public static validateMessage(message: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar estrutura básica
    if (!message || typeof message !== 'object') {
      errors.push('Message must be an object');
      return { valid: false, errors, warnings };
    }

    // Validar tipo
    if (!message.type || typeof message.type !== 'string') {
      errors.push('Message must have a valid type');
    }

    // Validar símbolo
    if (!message.symbol || typeof message.symbol !== 'string') {
      errors.push('Message must have a valid symbol');
    }

    // Validar timestamp
    if (message.timestamp !== undefined) {
      const ts = typeof message.timestamp === 'number' 
        ? message.timestamp 
        : Date.parse(message.timestamp);
      
      if (isNaN(ts) || ts <= 0) {
        warnings.push('Invalid timestamp, using current time');
      } else {
        const age = Date.now() - ts;
        if (age > 60000) { // Mais de 1 minuto
          warnings.push(`Data is ${Math.round(age / 1000)}s old`);
        }
      }
    } else {
      warnings.push('No timestamp provided, using current time');
    }

    // Validar data
    if (!message.data || typeof message.data !== 'object') {
      errors.push('Message must have a data object');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Valida array de candles
   */
  public static validateCandles(candles: CandlestickData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(candles)) {
      errors.push('Candles must be an array');
      return { valid: false, errors, warnings };
    }

    if (candles.length === 0) {
      warnings.push('Empty candles array');
      return { valid: true, errors, warnings };
    }

    // Validar cada candle
    candles.forEach((candle, index) => {
      const candleErrors: string[] = [];

      // Validar timestamp
      if (!candle.timestamp || typeof candle.timestamp !== 'number' || candle.timestamp <= 0) {
        candleErrors.push(`Candle ${index}: invalid timestamp`);
      }

      // Validar preços
      const prices = ['open', 'high', 'low', 'close'] as const;
      prices.forEach(price => {
        const value = candle[price];
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value) || value <= 0) {
          candleErrors.push(`Candle ${index}: invalid ${price} price`);
        }
      });

      // Validar consistência (high >= max(open, close), low <= min(open, close))
      if (candle.high < Math.max(candle.open, candle.close)) {
        candleErrors.push(`Candle ${index}: high must be >= max(open, close)`);
      }

      if (candle.low > Math.min(candle.open, candle.close)) {
        candleErrors.push(`Candle ${index}: low must be <= min(open, close)`);
      }

      if (candle.high < candle.low) {
        candleErrors.push(`Candle ${index}: high must be >= low`);
      }

      if (candleErrors.length > 0) {
        errors.push(...candleErrors);
      }
    });

    // Verificar ordenação temporal
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].timestamp < candles[i - 1].timestamp) {
        warnings.push(`Candles are not sorted by timestamp (index ${i})`);
        break;
      }
    }

    // Verificar gaps temporais
    for (let i = 1; i < candles.length; i++) {
      const gap = candles[i].timestamp - candles[i - 1].timestamp;
      if (gap > 3600000) { // Mais de 1 hora
        warnings.push(`Large time gap detected: ${Math.round(gap / 60000)} minutes`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calcula métricas de qualidade dos dados
   */
  public static calculateQualityMetrics(candles: CandlestickData[]): DataQualityMetrics {
    if (candles.length === 0) {
      return {
        completeness: 0,
        consistency: 0,
        timeliness: 0,
        overall: 0
      };
    }

    // Completeness: verificar campos obrigatórios
    let completeFields = 0;
    let totalFields = 0;
    candles.forEach(candle => {
      const fields = ['timestamp', 'open', 'high', 'low', 'close'] as const;
      fields.forEach(field => {
        totalFields++;
        if (candle[field] !== undefined && candle[field] !== null) {
          completeFields++;
        }
      });
    });
    const completeness = completeFields / totalFields;

    // Consistency: verificar se valores são consistentes
    let consistentCandles = 0;
    candles.forEach(candle => {
      const isConsistent = 
        candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close) &&
        candle.high >= candle.low &&
        candle.open > 0 &&
        candle.close > 0 &&
        candle.high > 0 &&
        candle.low > 0;
      
      if (isConsistent) {
        consistentCandles++;
      }
    });
    const consistency = consistentCandles / candles.length;

    // Timeliness: verificar atraso dos dados
    const now = Date.now();
    let timelyCandles = 0;
    candles.forEach(candle => {
      const age = now - candle.timestamp;
      // Considerar timely se menos de 5 minutos
      if (age < 300000) {
        timelyCandles++;
      }
    });
    const timeliness = timelyCandles / candles.length;

    // Overall: média ponderada
    const overall = (completeness * 0.3 + consistency * 0.5 + timeliness * 0.2);

    return {
      completeness,
      consistency,
      timeliness,
      overall
    };
  }

  /**
   * Filtra candles inválidos
   */
  public static filterValidCandles(candles: CandlestickData[]): CandlestickData[] {
    return candles.filter(candle => {
      // Validar estrutura básica
      if (!candle || typeof candle !== 'object') {
        return false;
      }

      // Validar timestamp
      if (!candle.timestamp || typeof candle.timestamp !== 'number' || candle.timestamp <= 0) {
        return false;
      }

      // Validar preços
      const prices = ['open', 'high', 'low', 'close'] as const;
      for (const price of prices) {
        const value = candle[price];
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value) || value <= 0) {
          return false;
        }
      }

      // Validar consistência
      if (candle.high < Math.max(candle.open, candle.close)) {
        return false;
      }

      if (candle.low > Math.min(candle.open, candle.close)) {
        return false;
      }

      if (candle.high < candle.low) {
        return false;
      }

      return true;
    });
  }

  /**
   * Ordena candles por timestamp
   */
  public static sortCandlesByTimestamp(candles: CandlestickData[]): CandlestickData[] {
    return [...candles].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Remove candles duplicados (mesmo timestamp)
   */
  public static removeDuplicateCandles(candles: CandlestickData[]): CandlestickData[] {
    const seen = new Set<number>();
    return candles.filter(candle => {
      if (seen.has(candle.timestamp)) {
        return false;
      }
      seen.add(candle.timestamp);
      return true;
    });
  }

  /**
   * Limpa e normaliza array de candles
   */
  public static cleanCandles(candles: CandlestickData[]): CandlestickData[] {
    let cleaned = this.filterValidCandles(candles);
    cleaned = this.removeDuplicateCandles(cleaned);
    cleaned = this.sortCandlesByTimestamp(cleaned);
    return cleaned;
  }
}

