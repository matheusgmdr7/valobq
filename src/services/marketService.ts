/**
 * Serviço de Dados de Mercado
 * 
 * Gerencia pares de moedas, preços e dados históricos
 */

import { CandlestickData } from '@/types/chart';
import { logger } from '@/utils/logger';

export interface CurrencyPair {
  symbol: string;
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  category: 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices';
  enabled: boolean;
  minTradeAmount: number;
  maxTradeAmount: number;
  payout: number; // Percentual de payout (80-90%)
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdate: number;
}

export interface MarketDataResponse {
  symbol: string;
  price: number;
  timestamp: number;
  candles?: CandlestickData[];
}

class MarketService {
  private pairs: Map<string, CurrencyPair> = new Map();
  private priceSubscribers: Map<string, Set<(data: MarketDataResponse) => void>> = new Map();
  private candleSubscribers: Map<string, Set<(candles: CandlestickData[]) => void>> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializePairs();
  }

  /**
   * Inicializa pares de moedas padrão
   */
  private initializePairs(): void {
    const defaultPairs: CurrencyPair[] = [
      {
        symbol: 'EUR/USD',
        name: 'Euro / US Dollar',
        baseCurrency: 'EUR',
        quoteCurrency: 'USD',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 1.0850,
        change24h: -0.0015,
        changePercent24h: -0.14,
        high24h: 1.0870,
        low24h: 1.0830,
        volume24h: 150000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'GBP/USD',
        name: 'British Pound / US Dollar',
        baseCurrency: 'GBP',
        quoteCurrency: 'USD',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 1.2650,
        change24h: 0.0020,
        changePercent24h: 0.16,
        high24h: 1.2680,
        low24h: 1.2620,
        volume24h: 120000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'USD/JPY',
        name: 'US Dollar / Japanese Yen',
        baseCurrency: 'USD',
        quoteCurrency: 'JPY',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 149.50,
        change24h: 0.25,
        changePercent24h: 0.17,
        high24h: 149.80,
        low24h: 149.20,
        volume24h: 98000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'AUD/CAD',
        name: 'Australian Dollar / Canadian Dollar',
        baseCurrency: 'AUD',
        quoteCurrency: 'CAD',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 0.8950,
        change24h: 0.0010,
        changePercent24h: 0.11,
        high24h: 0.8970,
        low24h: 0.8930,
        volume24h: 45000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'AUD/USD',
        name: 'Australian Dollar / US Dollar',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 0.6750,
        change24h: 0.0015,
        changePercent24h: 0.22,
        high24h: 0.6770,
        low24h: 0.6730,
        volume24h: 85000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'USD/CAD',
        name: 'US Dollar / Canadian Dollar',
        baseCurrency: 'USD',
        quoteCurrency: 'CAD',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 1.3450,
        change24h: -0.0020,
        changePercent24h: -0.15,
        high24h: 1.3480,
        low24h: 1.3420,
        volume24h: 95000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'EUR/GBP',
        name: 'Euro / British Pound',
        baseCurrency: 'EUR',
        quoteCurrency: 'GBP',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 0.8570,
        change24h: 0.0005,
        changePercent24h: 0.06,
        high24h: 0.8590,
        low24h: 0.8550,
        volume24h: 75000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'EUR/JPY',
        name: 'Euro / Japanese Yen',
        baseCurrency: 'EUR',
        quoteCurrency: 'JPY',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 162.25,
        change24h: 0.35,
        changePercent24h: 0.22,
        high24h: 162.60,
        low24h: 161.90,
        volume24h: 88000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'GBP/JPY',
        name: 'British Pound / Japanese Yen',
        baseCurrency: 'GBP',
        quoteCurrency: 'JPY',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 189.15,
        change24h: 0.45,
        changePercent24h: 0.24,
        high24h: 189.50,
        low24h: 188.80,
        volume24h: 72000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'USD/BRL',
        name: 'US Dollar / Brazilian Real',
        baseCurrency: 'USD',
        quoteCurrency: 'BRL',
        category: 'forex',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 88,
        currentPrice: 5.1250,
        change24h: 0.0250,
        changePercent24h: 0.49,
        high24h: 5.1500,
        low24h: 5.1000,
        volume24h: 65000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'BTC/USD',
        name: 'Bitcoin / US Dollar',
        baseCurrency: 'BTC',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 43250.00,
        change24h: 1250.00,
        changePercent24h: 2.98,
        high24h: 43500.00,
        low24h: 42000.00,
        volume24h: 2500000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'ETH/USD',
        name: 'Ethereum / US Dollar',
        baseCurrency: 'ETH',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 2650.00,
        change24h: -45.00,
        changePercent24h: -1.67,
        high24h: 2700.00,
        low24h: 2600.00,
        volume24h: 850000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'BNB/USD',
        name: 'Binance Coin / US Dollar',
        baseCurrency: 'BNB',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 315.50,
        change24h: 5.20,
        changePercent24h: 1.68,
        high24h: 320.00,
        low24h: 310.00,
        volume24h: 150000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'SOL/USD',
        name: 'Solana / US Dollar',
        baseCurrency: 'SOL',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 98.75,
        change24h: 2.15,
        changePercent24h: 2.23,
        high24h: 100.00,
        low24h: 96.50,
        volume24h: 800000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'XRP/USD',
        name: 'Ripple / US Dollar',
        baseCurrency: 'XRP',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.6250,
        change24h: 0.0125,
        changePercent24h: 2.04,
        high24h: 0.6300,
        low24h: 0.6100,
        volume24h: 1200000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'DOGE/USD',
        name: 'Dogecoin / US Dollar',
        baseCurrency: 'DOGE',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.0850,
        change24h: -0.0015,
        changePercent24h: -1.73,
        high24h: 0.0870,
        low24h: 0.0830,
        volume24h: 600000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'ADA/USD',
        name: 'Cardano / US Dollar',
        baseCurrency: 'ADA',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.4850,
        change24h: 0.0085,
        changePercent24h: 1.78,
        high24h: 0.4900,
        low24h: 0.4800,
        volume24h: 400000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'AVAX/USD',
        name: 'Avalanche / US Dollar',
        baseCurrency: 'AVAX',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 36.80,
        change24h: 0.75,
        changePercent24h: 2.08,
        high24h: 37.50,
        low24h: 36.00,
        volume24h: 250000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'DOT/USD',
        name: 'Polkadot / US Dollar',
        baseCurrency: 'DOT',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 7.25,
        change24h: 0.15,
        changePercent24h: 2.11,
        high24h: 7.35,
        low24h: 7.15,
        volume24h: 180000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'MATIC/USD',
        name: 'Polygon / US Dollar',
        baseCurrency: 'MATIC',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.9250,
        change24h: 0.0125,
        changePercent24h: 1.37,
        high24h: 0.9350,
        low24h: 0.9150,
        volume24h: 350000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'LINK/USD',
        name: 'Chainlink / US Dollar',
        baseCurrency: 'LINK',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 14.85,
        change24h: 0.35,
        changePercent24h: 2.41,
        high24h: 15.00,
        low24h: 14.50,
        volume24h: 220000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'UNI/USD',
        name: 'Uniswap / US Dollar',
        baseCurrency: 'UNI',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 6.25,
        change24h: 0.15,
        changePercent24h: 2.46,
        high24h: 6.35,
        low24h: 6.15,
        volume24h: 150000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'LTC/USD',
        name: 'Litecoin / US Dollar',
        baseCurrency: 'LTC',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 72.50,
        change24h: 1.25,
        changePercent24h: 1.75,
        high24h: 73.50,
        low24h: 71.50,
        volume24h: 300000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'ATOM/USD',
        name: 'Cosmos / US Dollar',
        baseCurrency: 'ATOM',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 9.85,
        change24h: 0.20,
        changePercent24h: 2.07,
        high24h: 10.00,
        low24h: 9.70,
        volume24h: 120000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'ETC/USD',
        name: 'Ethereum Classic / US Dollar',
        baseCurrency: 'ETC',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 23.45,
        change24h: 0.35,
        changePercent24h: 1.51,
        high24h: 23.80,
        low24h: 23.20,
        volume24h: 180000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'XLM/USD',
        name: 'Stellar / US Dollar',
        baseCurrency: 'XLM',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.1250,
        change24h: 0.0025,
        changePercent24h: 2.04,
        high24h: 0.1275,
        low24h: 0.1225,
        volume24h: 200000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'ALGO/USD',
        name: 'Algorand / US Dollar',
        baseCurrency: 'ALGO',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.1850,
        change24h: 0.0035,
        changePercent24h: 1.93,
        high24h: 0.1880,
        low24h: 0.1820,
        volume24h: 100000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'VET/USD',
        name: 'VeChain / US Dollar',
        baseCurrency: 'VET',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.0325,
        change24h: 0.0008,
        changePercent24h: 2.52,
        high24h: 0.0330,
        low24h: 0.0320,
        volume24h: 150000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'FIL/USD',
        name: 'Filecoin / US Dollar',
        baseCurrency: 'FIL',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 5.45,
        change24h: 0.12,
        changePercent24h: 2.25,
        high24h: 5.50,
        low24h: 5.40,
        volume24h: 120000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'TRX/USD',
        name: 'Tron / US Dollar',
        baseCurrency: 'TRX',
        quoteCurrency: 'USD',
        category: 'crypto',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 5000,
        payout: 90,
        currentPrice: 0.1050,
        change24h: 0.0015,
        changePercent24h: 1.45,
        high24h: 0.1065,
        low24h: 0.1040,
        volume24h: 400000000,
        lastUpdate: Date.now()
      },

      // ==================== COMMODITIES ====================
      {
        symbol: 'XAU/USD',
        name: 'Ouro / US Dollar',
        baseCurrency: 'XAU',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 2350.00,
        change24h: 12.50,
        changePercent24h: 0.53,
        high24h: 2360.00,
        low24h: 2335.00,
        volume24h: 180000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'XAG/USD',
        name: 'Prata / US Dollar',
        baseCurrency: 'XAG',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 27.50,
        change24h: 0.35,
        changePercent24h: 1.29,
        high24h: 27.80,
        low24h: 27.10,
        volume24h: 95000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'WTI/USD',
        name: 'Petróleo WTI / US Dollar',
        baseCurrency: 'WTI',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 78.50,
        change24h: -0.80,
        changePercent24h: -1.01,
        high24h: 79.80,
        low24h: 77.90,
        volume24h: 250000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'XBR/USD',
        name: 'Petróleo Brent / US Dollar',
        baseCurrency: 'XBR',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 82.30,
        change24h: -0.65,
        changePercent24h: -0.78,
        high24h: 83.20,
        low24h: 81.80,
        volume24h: 200000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'NG/USD',
        name: 'Gás Natural / US Dollar',
        baseCurrency: 'NG',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 2.85,
        change24h: 0.05,
        changePercent24h: 1.79,
        high24h: 2.92,
        low24h: 2.78,
        volume24h: 110000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'XPT/USD',
        name: 'Platina / US Dollar',
        baseCurrency: 'XPT',
        quoteCurrency: 'USD',
        category: 'commodities',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 980.00,
        change24h: 5.50,
        changePercent24h: 0.56,
        high24h: 988.00,
        low24h: 972.00,
        volume24h: 45000000,
        lastUpdate: Date.now()
      },

      // ==================== ÍNDICES ====================
      {
        symbol: 'SPX',
        name: 'S&P 500',
        baseCurrency: 'SPX',
        quoteCurrency: 'USD',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 5250.00,
        change24h: 25.00,
        changePercent24h: 0.48,
        high24h: 5270.00,
        low24h: 5220.00,
        volume24h: 3500000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'IXIC',
        name: 'NASDAQ Composite',
        baseCurrency: 'IXIC',
        quoteCurrency: 'USD',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 16500.00,
        change24h: 85.00,
        changePercent24h: 0.52,
        high24h: 16580.00,
        low24h: 16400.00,
        volume24h: 4200000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'DJI',
        name: 'Dow Jones Industrial',
        baseCurrency: 'DJI',
        quoteCurrency: 'USD',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 39200.00,
        change24h: 150.00,
        changePercent24h: 0.38,
        high24h: 39350.00,
        low24h: 39050.00,
        volume24h: 2800000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'FTSE',
        name: 'FTSE 100',
        baseCurrency: 'FTSE',
        quoteCurrency: 'GBP',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 7950.00,
        change24h: 30.00,
        changePercent24h: 0.38,
        high24h: 7980.00,
        low24h: 7920.00,
        volume24h: 1200000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'DAX',
        name: 'DAX 40',
        baseCurrency: 'DAX',
        quoteCurrency: 'EUR',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 18200.00,
        change24h: 75.00,
        changePercent24h: 0.41,
        high24h: 18280.00,
        low24h: 18120.00,
        volume24h: 1500000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'N225',
        name: 'Nikkei 225',
        baseCurrency: 'N225',
        quoteCurrency: 'JPY',
        category: 'indices',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 38500.00,
        change24h: 200.00,
        changePercent24h: 0.52,
        high24h: 38700.00,
        low24h: 38300.00,
        volume24h: 2100000000,
        lastUpdate: Date.now()
      },

      // ==================== AÇÕES ====================
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        baseCurrency: 'AAPL',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 192.50,
        change24h: 1.80,
        changePercent24h: 0.94,
        high24h: 193.50,
        low24h: 190.80,
        volume24h: 55000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        baseCurrency: 'GOOGL',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 175.20,
        change24h: 2.30,
        changePercent24h: 1.33,
        high24h: 176.50,
        low24h: 173.00,
        volume24h: 28000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        baseCurrency: 'MSFT',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 420.00,
        change24h: 3.50,
        changePercent24h: 0.84,
        high24h: 422.00,
        low24h: 417.00,
        volume24h: 22000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'AMZN',
        name: 'Amazon.com Inc.',
        baseCurrency: 'AMZN',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 185.00,
        change24h: 1.20,
        changePercent24h: 0.65,
        high24h: 186.50,
        low24h: 183.50,
        volume24h: 45000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        baseCurrency: 'TSLA',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 245.00,
        change24h: -3.50,
        changePercent24h: -1.41,
        high24h: 250.00,
        low24h: 243.00,
        volume24h: 95000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'META',
        name: 'Meta Platforms Inc.',
        baseCurrency: 'META',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 505.00,
        change24h: 4.50,
        changePercent24h: 0.90,
        high24h: 508.00,
        low24h: 500.00,
        volume24h: 18000000,
        lastUpdate: Date.now()
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        baseCurrency: 'NVDA',
        quoteCurrency: 'USD',
        category: 'stocks',
        enabled: true,
        minTradeAmount: 10,
        maxTradeAmount: 10000,
        payout: 85,
        currentPrice: 880.00,
        change24h: 15.00,
        changePercent24h: 1.73,
        high24h: 890.00,
        low24h: 865.00,
        volume24h: 42000000,
        lastUpdate: Date.now()
      }
    ];

    defaultPairs.forEach(pair => {
      this.pairs.set(pair.symbol, pair);
    });
  }

  /**
   * Obtém todos os pares disponíveis
   */
  public getPairs(category?: CurrencyPair['category']): CurrencyPair[] {
    const pairs = Array.from(this.pairs.values());
    if (category) {
      return pairs.filter(p => p.category === category && p.enabled);
    }
    return pairs.filter(p => p.enabled);
  }

  /**
   * Obtém um par específico
   */
  public getPair(symbol: string): CurrencyPair | undefined {
    return this.pairs.get(symbol);
  }

  /**
   * Busca dados históricos de candles
   */
  public async getHistoricalCandles(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1m',
    limit: number = 100
  ): Promise<CandlestickData[]> {
    const pair = this.pairs.get(symbol);
    if (!pair) {
      throw new Error(`Pair ${symbol} not found`);
    }

    // Simular busca de dados históricos
    // Em produção, isso viria de uma API real
    return this.generateHistoricalCandles(pair, timeframe, limit);
  }

  /**
   * Gera candles históricos simulados
   */
  private generateHistoricalCandles(
    pair: CurrencyPair,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    limit: number
  ): CandlestickData[] {
    const candles: CandlestickData[] = [];
    const now = Date.now();
    
    // Intervalo em milissegundos baseado no timeframe
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    const interval = intervals[timeframe];
    let price = pair.currentPrice;
    let seed = Math.floor(now / 1000);

    // Random Walk para dados históricos (sem seno)
    const volatility = 0.0002; // 0.02% de volatilidade
    let drift = 0; // Tendência inicial
    
    for (let i = limit - 1; i >= 0; i--) {
      const time = now - (i * interval);
      
      // Random Walk (Geometric Brownian Motion)
      // Usar distribuição normal aproximada para ruído
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // N(0,1)
      
      // Atualizar drift baseado em tendência aleatória
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
      
      const volume = Math.random() * 10000 + 5000;

      candles.push({
        timestamp: time,
        open,
        high,
        low,
        close,
        volume
      });

      price = close;
    }

    return candles;
  }

  /**
   * Inicia atualização de preços em tempo real
   */
  public startPriceUpdates(symbol: string, callback: (data: MarketDataResponse) => void): () => void {
    if (!this.priceSubscribers.has(symbol)) {
      this.priceSubscribers.set(symbol, new Set());
    }

    this.priceSubscribers.get(symbol)!.add(callback);

    // Iniciar atualização se ainda não estiver ativa
    if (!this.updateIntervals.has(symbol)) {
      this.startPriceUpdateInterval(symbol);
    }

    // Retornar função de unsubscribe
    return () => {
      const subscribers = this.priceSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.stopPriceUpdates(symbol);
        }
      }
    };
  }

  /**
   * Inicia intervalo de atualização de preços
   */
  private startPriceUpdateInterval(symbol: string): void {
    const pair = this.pairs.get(symbol);
    if (!pair) return;

    const interval = setInterval(() => {
      this.updatePrice(symbol);
    }, 1000); // Atualizar a cada 1 segundo

    this.updateIntervals.set(symbol, interval);
  }

  /**
   * Para atualização de preços
   */
  private stopPriceUpdates(symbol: string): void {
    const interval = this.updateIntervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(symbol);
    }
  }

  /**
   * Atualiza preço de um par
   */
  private updatePrice(symbol: string): void {
    const pair = this.pairs.get(symbol);
    if (!pair) return;

    // Simular variação de preço
    const variation = (Math.random() - 0.5) * 0.0002; // Variação de até 0.02%
    const newPrice = pair.currentPrice * (1 + variation);
    
    pair.currentPrice = newPrice;
    pair.lastUpdate = Date.now();

    // Atualizar high/low 24h
    if (newPrice > pair.high24h) {
      pair.high24h = newPrice;
    }
    if (newPrice < pair.low24h) {
      pair.low24h = newPrice;
    }

    // Notificar subscribers
    const subscribers = this.priceSubscribers.get(symbol);
    if (subscribers) {
      const data: MarketDataResponse = {
        symbol,
        price: newPrice,
        timestamp: Date.now()
      };

      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in price subscriber:', error);
        }
      });
    }
  }

  /**
   * Inicia atualização de candles em tempo real
   */
  public startCandleUpdates(
    symbol: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    callback: (candles: CandlestickData[]) => void
  ): () => void {
    const key = `${symbol}-${timeframe}`;
    
    if (!this.candleSubscribers.has(key)) {
      this.candleSubscribers.set(key, new Set());
    }

    this.candleSubscribers.get(key)!.add(callback);

    // Retornar função de unsubscribe
    return () => {
      const subscribers = this.candleSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  /**
   * Busca preço atual
   */
  public getCurrentPrice(symbol: string): number | null {
    const pair = this.pairs.get(symbol);
    return pair?.currentPrice ?? null;
  }
}

// Singleton
export const marketService = new MarketService();

