/**
 * Indicadores Técnicos - Cálculos em Tempo Real
 * 
 * Implementação otimizada para 60 FPS com suporte a visualPrice (preço pulsante)
 * Baseado nas recomendações do motor profissional
 */

export interface IndicatorConfig {
  type: 'sma' | 'ema' | 'bollinger' | 'rsi' | 'macd' | 'volume';
  period?: number;
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Média Móvel Simples (SMA)
 * Calcula a média dos últimos N preços incluindo o preço visual atual
 */
export function calculateSMA(
  candles: CandleData[],
  period: number,
  visualPrice: number
): number {
  if (candles.length === 0) return visualPrice;
  
  // Pegar os últimos (period - 1) fechamentos + o preço visual atual
  const lastCloses = candles.slice(-(period - 1)).map(c => c.close);
  const sum = lastCloses.reduce((a, b) => a + b, 0) + visualPrice;
  
  return sum / period;
}

/**
 * Média Móvel Exponencial (EMA)
 * Dá mais peso ao preço atual, sendo mais "viva" e responsiva
 */
export function calculateEMA(
  previousEMA: number | null,
  currentPrice: number,
  period: number
): number {
  if (previousEMA === null) return currentPrice;
  
  const k = 2 / (period + 1);
  return currentPrice * k + previousEMA * (1 - k);
}

/**
 * Bandas de Bollinger
 * Mostra a volatilidade do mercado com base no desvio padrão
 */
export interface BollingerBands {
  middle: number; // SMA
  upper: number;  // SMA + (stdDev * multiplier)
  lower: number;  // SMA - (stdDev * multiplier)
}

export function calculateBollingerBands(
  candles: CandleData[],
  period: number,
  stdDevMultiplier: number,
  visualPrice: number
): BollingerBands {
  const sma = calculateSMA(candles, period, visualPrice);
  
  // Pegar os últimos (period - 1) fechamentos + o preço visual atual
  const lastPrices = [...candles.slice(-(period - 1)).map(c => c.close), visualPrice];
  
  // Calcular Desvio Padrão
  const squareDiffs = lastPrices.map(p => Math.pow(p - sma, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  return {
    middle: sma,
    upper: sma + (stdDev * stdDevMultiplier),
    lower: sma - (stdDev * stdDevMultiplier)
  };
}

/**
 * RSI (Relative Strength Index)
 * Oscilador que mede a velocidade e mudança dos movimentos de preço (0-100)
 */
export function calculateRSI(
  candles: CandleData[],
  period: number,
  visualPrice: number
): number {
  if (candles.length < period) return 50; // Valor neutro se não há dados suficientes
  
  // Calcular mudanças (gains e losses)
  const changes: number[] = [];
  
  // Mudanças históricas
  for (let i = candles.length - period + 1; i < candles.length; i++) {
    if (i > 0) {
      changes.push(candles[i].close - candles[i - 1].close);
    }
  }
  
  // Mudança atual (visualPrice - último close)
  if (candles.length > 0) {
    changes.push(visualPrice - candles[candles.length - 1].close);
  }
  
  let gains = 0;
  let losses = 0;
  
  changes.forEach(ch => {
    if (ch > 0) {
      gains += ch;
    } else {
      losses += Math.abs(ch);
    }
  });
  
  if (losses === 0) return 100; // Sem perdas = RSI máximo
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Mostra a força da tendência através da diferença entre duas EMAs
 */
export interface MACDData {
  macdLine: number;      // EMA(12) - EMA(26)
  signalLine: number;    // EMA(9) da linha MACD
  histogram: number;     // MACD Line - Signal Line
}

export function calculateMACD(
  candles: CandleData[],
  visualPrice: number,
  previousEMA12: number | null,
  previousEMA26: number | null,
  previousSignalEMA: number | null,
  signalPeriod: number = 9
): MACDData {
  // Calcular EMAs
  const ema12 = calculateEMA(previousEMA12, visualPrice, 12);
  const ema26 = calculateEMA(previousEMA26, visualPrice, 26);
  
  // Linha MACD
  const macdLine = ema12 - ema26;
  
  // Linha de sinal (EMA da linha MACD)
  const signalLine = calculateEMA(previousSignalEMA, macdLine, signalPeriod);
  
  // Histograma
  const histogram = macdLine - signalLine;
  
  return {
    macdLine,
    signalLine,
    histogram
  };
}

/**
 * Volume
 * Retorna o volume do último candle ou acumulado do candle atual
 */
export function getVolume(
  candles: CandleData[],
  currentVolume: number = 0
): number {
  if (candles.length === 0) return currentVolume;
  
  // Retornar volume do último candle fechado + volume atual (se disponível)
  const lastCandle = candles[candles.length - 1];
  return (lastCandle.volume || 0) + currentVolume;
}

/**
 * Classe para gerenciar múltiplos indicadores
 */
export class IndicatorEngine {
  private indicators: Map<string, IndicatorConfig & { values: any[] }> = new Map();
  private emaCache: Map<string, number> = new Map();
  
  /**
   * Adiciona um indicador ao engine
   */
  addIndicator(id: string, config: IndicatorConfig, preserveValues: boolean = false): void {
    const existing = this.indicators.get(id);
    const existingValues = preserveValues && existing ? existing.values : [];
    
    this.indicators.set(id, {
      ...config,
      values: existingValues
    });
  }
  
  /**
   * Atualiza apenas as configurações visuais de um indicador (cor, lineWidth, style)
   */
  updateIndicatorConfig(id: string, config: Partial<IndicatorConfig>): void {
    const existing = this.indicators.get(id);
    if (existing) {
      if (config.color !== undefined) existing.color = config.color;
      if (config.lineWidth !== undefined) existing.lineWidth = config.lineWidth;
      if (config.style !== undefined) existing.style = config.style;
    }
  }
  
  /**
   * Remove um indicador
   */
  removeIndicator(id: string): void {
    this.indicators.delete(id);
    // Limpar cache de EMA
    this.emaCache.delete(`${id}-12`);
    this.emaCache.delete(`${id}-26`);
    this.emaCache.delete(`${id}-signal`);
  }
  
  /**
   * Calcula todos os indicadores para um tick de preço
   */
  onTick(candles: CandleData[], visualPrice: number, currentVolume?: number): Map<string, any> {
    const results = new Map<string, any>();
    
    this.indicators.forEach((indicator, id) => {
      let value: any;
      
      switch (indicator.type) {
        case 'sma':
          value = calculateSMA(candles, indicator.period || 20, visualPrice);
          break;
          
        case 'ema':
          const cacheKey = `${id}-${indicator.period}`;
          const previousEMA = this.emaCache.get(cacheKey) || null;
          value = calculateEMA(previousEMA, visualPrice, indicator.period || 20);
          this.emaCache.set(cacheKey, value);
          break;
          
        case 'bollinger':
          value = calculateBollingerBands(
            candles,
            indicator.period || 20,
            2, // Multiplicador padrão
            visualPrice
          );
          break;
          
        case 'rsi':
          value = calculateRSI(candles, indicator.period || 14, visualPrice);
          break;
          
        case 'macd':
          const ema12Key = `${id}-12`;
          const ema26Key = `${id}-26`;
          const signalKey = `${id}-signal`;
          const prevEMA12 = this.emaCache.get(ema12Key) || null;
          const prevEMA26 = this.emaCache.get(ema26Key) || null;
          const prevSignal = this.emaCache.get(signalKey) || null;
          
          value = calculateMACD(candles, visualPrice, prevEMA12, prevEMA26, prevSignal);
          
          // Atualizar cache
          this.emaCache.set(ema12Key, calculateEMA(prevEMA12, visualPrice, 12));
          this.emaCache.set(ema26Key, calculateEMA(prevEMA26, visualPrice, 26));
          this.emaCache.set(signalKey, value.signalLine);
          break;
          
        case 'volume':
          value = getVolume(candles, currentVolume);
          break;
      }
      
      // Armazenar valor histórico
      // IMPORTANTE: Não atualizar valores históricos a cada frame
      // Apenas adicionar novos valores quando houver novos candles
      const values = indicator.values;
      
      // Se o número de candles é maior que o número de valores, adicionar novo valor
      // Caso contrário, apenas atualizar o último valor (tempo real)
      if (candles.length > values.length) {
        // Novo candle histórico - adicionar ao array
        values.push(value);
        if (values.length > 500) {
          values.shift();
        }
      } else if (values.length > 0 && candles.length === values.length) {
        // Atualizar apenas o último valor (tempo real com visualPrice)
        // Isso permite que apenas o último ponto da linha se mova
        values[values.length - 1] = value;
      } else if (values.length === 0) {
        // Primeiro valor
        values.push(value);
      }
      
      results.set(id, value);
    });
    
    return results;
  }
  
  /**
   * Obtém o valor atual de um indicador
   */
  getValue(id: string): any {
    const indicator = this.indicators.get(id);
    if (!indicator || indicator.values.length === 0) return null;
    return indicator.values[indicator.values.length - 1];
  }
  
  /**
   * Obtém todos os valores históricos de um indicador
   */
  getValues(id: string): any[] {
    const indicator = this.indicators.get(id);
    return indicator ? indicator.values : [];
  }
  
  /**
   * Obtém a configuração de um indicador
   */
  getConfig(id: string): IndicatorConfig | undefined {
    const indicator = this.indicators.get(id);
    if (!indicator) return undefined;
    return {
      type: indicator.type,
      period: indicator.period,
      color: indicator.color,
      lineWidth: indicator.lineWidth,
      style: indicator.style
    };
  }
  
  /**
   * Lista todos os indicadores ativos
   */
  getActiveIndicators(): string[] {
    return Array.from(this.indicators.keys());
  }
  
  /**
   * Limpa todos os indicadores e cache
   */
  clear(): void {
    this.indicators.clear();
    this.emaCache.clear();
  }
}
