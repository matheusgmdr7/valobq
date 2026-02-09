/**
 * Utilitário para configurar URLs de WebSocket baseado no tipo de ativo
 */

import { CurrencyPair } from '@/services/marketService';

/**
 * Obtém a URL de WebSocket apropriada baseado na categoria do ativo
 */
export function getWebSocketUrl(symbol: string, pair?: CurrencyPair): string | undefined {
  const category = pair?.category || detectCategoryFromSymbol(symbol);
  
  switch (category) {
    case 'crypto':
      // Binance WebSocket para criptomoedas
      const cryptoUrl = process.env.NEXT_PUBLIC_WEBSOCKET_CRYPTO;
      if (cryptoUrl) {
        // Se a URL contém @ticker, substituir o símbolo
        if (cryptoUrl.includes('@ticker')) {
          const binanceSymbol = convertToBinanceSymbol(symbol);
          return cryptoUrl.replace('btcusdt', binanceSymbol.toLowerCase());
        }
        return cryptoUrl;
      }
      break;
      
    case 'forex':
      // TradingView WebSocket para forex
      return process.env.NEXT_PUBLIC_WEBSOCKET_FOREX || 
             process.env.NEXT_PUBLIC_WEBSOCKET_STOCKS;
      
    case 'stocks':
      // TradingView WebSocket para ações
      return process.env.NEXT_PUBLIC_WEBSOCKET_STOCKS || 
             process.env.NEXT_PUBLIC_WEBSOCKET_FOREX;
      
    case 'commodities':
      // TradingView WebSocket para commodities
      return process.env.NEXT_PUBLIC_WEBSOCKET_STOCKS || 
             process.env.NEXT_PUBLIC_WEBSOCKET_FOREX;
      
    default:
      // Fallback para URL genérica
      return process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  }
  
  // Fallback para URL genérica se nenhuma específica estiver configurada
  return process.env.NEXT_PUBLIC_WEBSOCKET_URL;
}

/**
 * Detecta a categoria do ativo baseado no símbolo
 */
function detectCategoryFromSymbol(symbol: string): CurrencyPair['category'] {
  const upperSymbol = symbol.toUpperCase();
  
  // Criptomoedas conhecidas
  const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'MATIC', 'LTC'];
  if (cryptoSymbols.some(c => upperSymbol.includes(c))) {
    return 'crypto';
  }
  
  // Forex - geralmente tem "/" no símbolo
  if (upperSymbol.includes('/')) {
    return 'forex';
  }
  
  // Ações - geralmente são nomes curtos sem "/"
  // Commodities - geralmente são nomes como "Gold", "Oil", etc.
  if (['GOLD', 'OIL', 'SILVER', 'COPPER'].some(c => upperSymbol.includes(c))) {
    return 'commodities';
  }
  
  // Padrão: assumir que é ação
  return 'stocks';
}

/**
 * Converte símbolo para formato Binance
 * Ex: BTC/USD -> btcusdt, ETH/USD -> ethusdt
 */
function convertToBinanceSymbol(symbol: string): string {
  // Remover "/" e converter para minúsculas
  let binanceSymbol = symbol.replace('/', '').toLowerCase();
  
  // Se termina com /USD, substituir por usdt
  if (binanceSymbol.endsWith('usd')) {
    binanceSymbol = binanceSymbol.replace('usd', 'usdt');
  }
  
  // Mapeamentos comuns
  const mappings: Record<string, string> = {
    'btc/usd': 'btcusdt',
    'eth/usd': 'ethusdt',
    'bnb/usd': 'bnbusdt',
    'ada/usd': 'adausdt',
    'sol/usd': 'solusdt',
    'xrp/usd': 'xrpusdt',
    'dot/usd': 'dotusdt',
    'doge/usd': 'dogeusdt',
    'matic/usd': 'maticusdt',
    'ltc/usd': 'ltcusdt'
  };
  
  return mappings[symbol.toLowerCase()] || binanceSymbol;
}

/**
 * Obtém a URL de polling (fallback)
 */
export function getPollingUrl(symbol: string): string {
  return process.env.NEXT_PUBLIC_POLLING_URL || `/api/market-data/${symbol}`;
}


















