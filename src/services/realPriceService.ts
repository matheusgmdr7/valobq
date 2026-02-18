/**
 * Serviço de Preços Reais
 * 
 * Integra com APIs de preços reais (Alpha Vantage, Yahoo Finance, etc.)
 * e fornece dados de mercado em tempo real
 */

import { CandlestickData } from '@/types/chart';
import { logger } from '@/utils/logger';

export interface RealPriceConfig {
  provider: 'alpha_vantage' | 'yahoo_finance' | 'simulated';
  apiKey?: string;
  baseUrl?: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class RealPriceService {
  private config: RealPriceConfig;
  private cache: Map<string, { data: PriceData; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minuto

  constructor(config: RealPriceConfig = { provider: 'simulated' }) {
    this.config = {
      provider: config.provider || 'simulated',
      apiKey: config.apiKey || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY,
      baseUrl: config.baseUrl
    };
  }

  /**
   * Obtém preço atual de um símbolo
   */
  async getCurrentPrice(symbol: string): Promise<PriceData> {
    // Verificar cache
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      let priceData: PriceData;

      switch (this.config.provider) {
        case 'alpha_vantage':
          priceData = await this.fetchFromAlphaVantage(symbol);
          break;
        case 'yahoo_finance':
          priceData = await this.fetchFromYahooFinance(symbol);
          break;
        default:
          priceData = await this.fetchSimulated(symbol);
      }

      // Atualizar cache
      this.cache.set(symbol, { data: priceData, timestamp: Date.now() });
      return priceData;
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      // Fallback para dados simulados
      return await this.fetchSimulated(symbol);
    }
  }

  /**
   * Obtém dados históricos de candles
   */
  async getHistoricalCandles(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1m',
    limit: number = 100
  ): Promise<CandlestickData[]> {
    try {
      let candles: CandlestickData[];

      switch (this.config.provider) {
        case 'alpha_vantage':
          candles = await this.fetchCandlesFromAlphaVantage(symbol, timeframe, limit);
          break;
        case 'yahoo_finance':
          candles = await this.fetchCandlesFromYahooFinance(symbol, timeframe, limit);
          break;
        default:
          candles = await this.fetchSimulatedCandles(symbol, timeframe, limit);
      }

      return candles;
    } catch (error) {
      logger.error(`Error fetching candles for ${symbol}:`, error);
      // Fallback para dados simulados
      return await this.fetchSimulatedCandles(symbol, timeframe, limit);
    }
  }

  /**
   * Busca preço do Alpha Vantage
   */
  private async fetchFromAlphaVantage(symbol: string): Promise<PriceData> {
    if (!this.config.apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }

    // Converter símbolo para formato Alpha Vantage (ex: GBP/USD -> FX:GBPUSD)
    const avSymbol = this.convertSymbolToAlphaVantage(symbol);
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${this.config.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      throw new Error(data['Error Message'] || data['Note']);
    }

    const quote = data['Global Quote'];
    if (!quote) {
      throw new Error('Invalid response from Alpha Vantage');
    }

    const price = parseFloat(quote['05. price']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
    const high = parseFloat(quote['03. high']);
    const low = parseFloat(quote['04. low']);
    const volume = parseFloat(quote['06. volume']);

    return {
      symbol,
      price,
      change,
      changePercent,
      high,
      low,
      volume,
      timestamp: Date.now()
    };
  }

  /**
   * Busca candles do Alpha Vantage
   */
  private async fetchCandlesFromAlphaVantage(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<CandlestickData[]> {
    if (!this.config.apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }

    const avSymbol = this.convertSymbolToAlphaVantage(symbol);
    const interval = this.convertTimeframeToAlphaVantage(timeframe);
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${avSymbol}&interval=${interval}&apikey=${this.config.apiKey}&outputsize=compact`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data['Error Message'] || data['Note']) {
      throw new Error(data['Error Message'] || data['Note']);
    }

    const timeSeriesKey = `Time Series (${interval})`;
    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) {
      throw new Error('Invalid response from Alpha Vantage');
    }

    const candles: CandlestickData[] = [];
    const entries = Object.entries(timeSeries).slice(0, limit);

    for (const [timeStr, values] of entries) {
      const v = values as any;
      candles.push({
        timestamp: new Date(timeStr).getTime(),
        open: parseFloat(v['1. open']),
        high: parseFloat(v['2. high']),
        low: parseFloat(v['3. low']),
        close: parseFloat(v['4. close']),
        volume: parseFloat(v['5. volume'])
      });
    }

    return candles.reverse(); // Mais antigo primeiro
  }

  /**
   * Busca preço do Yahoo Finance (via API pública)
   */
  private async fetchFromYahooFinance(symbol: string): Promise<PriceData> {
    // Converter símbolo para formato Yahoo Finance (ex: GBP/USD -> GBPUSD=X)
    const yfSymbol = this.convertSymbolToYahooFinance(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1m&range=1d`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      throw new Error('Invalid response from Yahoo Finance');
    }

    const quote = result.meta;
    const price = quote.regularMarketPrice;
    const previousClose = quote.previousClose;
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      price,
      change,
      changePercent,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
      timestamp: Date.now()
    };
  }

  /**
   * Busca candles do Yahoo Finance
   */
  private async fetchCandlesFromYahooFinance(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<CandlestickData[]> {
    const yfSymbol = this.convertSymbolToYahooFinance(symbol);
    const interval = this.convertTimeframeToYahooFinance(timeframe);
    const range = this.getRangeForLimit(limit, timeframe);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=${interval}&range=${range}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      throw new Error('Invalid response from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const candles: CandlestickData[] = [];
    const dataLength = Math.min(timestamps.length, limit);

    for (let i = 0; i < dataLength; i++) {
      candles.push({
        timestamp: timestamps[i] * 1000, // Converter para milissegundos
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i]
      });
    }

    return candles;
  }

  /**
   * Gera dados simulados (fallback)
   */
  private async fetchSimulated(symbol: string): Promise<PriceData> {
    // Preços base por símbolo
    const basePrices: Record<string, number> = {
      'GBP/USD': 1.2650,
      'EUR/USD': 1.0850,
      'USD/JPY': 149.50,
      'AUD/CAD': 0.8950,
      'BTC/USD': 43250.00,
      'ETH/USD': 2650.00
    };

    const basePrice = basePrices[symbol] || 1.0;
    const variation = (Math.random() - 0.5) * 0.001;
    const price = basePrice * (1 + variation);
    const change = price - basePrice;
    const changePercent = (change / basePrice) * 100;

    return {
      symbol,
      price,
      change,
      changePercent,
      high: price * 1.001,
      low: price * 0.999,
      volume: Math.random() * 1000000 + 500000,
      timestamp: Date.now()
    };
  }

  /**
   * Gera candles simulados (fallback)
   */
  private async fetchSimulatedCandles(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    limit: number
  ): Promise<CandlestickData[]> {
    const basePrices: Record<string, number> = {
      'GBP/USD': 1.2650,
      'EUR/USD': 1.0850,
      'USD/JPY': 149.50,
      'AUD/CAD': 0.8950,
      'BTC/USD': 43250.00,
      'ETH/USD': 2650.00
    };

    const basePrice = basePrices[symbol] || 1.0;
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    const interval = intervals[timeframe];
    const now = Date.now();
    const candles: CandlestickData[] = [];
    let price = basePrice;

    // Random Walk para dados históricos (sem seno)
    const volatility = 0.0002; // 0.02% de volatilidade
    let drift = 0; // Tendência inicial
    
    for (let i = limit - 1; i >= 0; i--) {
      const time = now - (i * interval);
      
      // Random Walk (Geometric Brownian Motion)
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // N(0,1)
      
      // Atualizar drift
      drift = drift * 0.95 + (Math.random() - 0.5) * 0.00001;
      
      // Calcular variação usando Random Walk
      const randomShock = z * volatility;
      const priceChange = drift + randomShock;
      
      const open = price;
      const close = price * (1 + priceChange);
      
      // High e Low com variação adicional
      const wickVariation = Math.abs(randomShock) * 0.5;
      const high = Math.max(open, close) * (1 + wickVariation);
      const low = Math.min(open, close) * (1 - wickVariation);

      candles.push({
        timestamp: time,
        open,
        high,
        low,
        close,
        volume: Math.random() * 10000 + 5000
      });

      price = close;
    }

    return candles;
  }

  /**
   * Converte símbolo para formato Alpha Vantage
   */
  private convertSymbolToAlphaVantage(symbol: string): string {
    // Para Forex: GBP/USD -> FX:GBPUSD
    if (symbol.includes('/')) {
      return `FX:${symbol.replace('/', '')}`;
    }
    return symbol;
  }

  /**
   * Converte símbolo para formato Yahoo Finance
   */
  private convertSymbolToYahooFinance(symbol: string): string {
    // Para Forex: GBP/USD -> GBPUSD=X
    if (symbol.includes('/')) {
      return `${symbol.replace('/', '')}=X`;
    }
    return symbol;
  }

  /**
   * Converte timeframe para formato Alpha Vantage
   */
  private convertTimeframeToAlphaVantage(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '1h': '60min',
      '4h': '60min', // Alpha Vantage não suporta 4h diretamente
      '1d': 'daily'
    };
    return map[timeframe] || '1min';
  }

  /**
   * Converte timeframe para formato Yahoo Finance
   */
  private convertTimeframeToYahooFinance(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return map[timeframe] || '1m';
  }

  /**
   * Obtém range apropriado para o limite de candles
   */
  private getRangeForLimit(limit: number, timeframe: string): string {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    const interval = intervals[timeframe] || 60000;
    const totalTime = limit * interval;
    const days = Math.ceil(totalTime / (24 * 60 * 60 * 1000));

    if (days <= 1) return '1d';
    if (days <= 5) return '5d';
    if (days <= 30) return '1mo';
    if (days <= 90) return '3mo';
    return '1y';
  }
}

// Singleton com configuração padrão
export const realPriceService = new RealPriceService({
  provider: (process.env.NEXT_PUBLIC_PRICE_PROVIDER as any) || 'simulated',
  apiKey: process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY
});

