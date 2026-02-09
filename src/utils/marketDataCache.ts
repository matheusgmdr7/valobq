/**
 * Cache de dados de mercado
 * 
 * Gerencia cache de candles e dados de mercado com TTL
 */

export interface CachedMarketData {
  data: any;
  timestamp: number;
  ttl: number;
}

const MARKET_DATA_CACHE_KEY = 'valoren-market-data-cache';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtém dados do cache se ainda válidos
 */
export function getCachedMarketData(key: string): any | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cacheStr = localStorage.getItem(`${MARKET_DATA_CACHE_KEY}-${key}`);
    if (!cacheStr) {
      return null;
    }

    const cached: CachedMarketData = JSON.parse(cacheStr);
    const age = Date.now() - cached.timestamp;

    if (age > cached.ttl) {
      // Cache expirado
      localStorage.removeItem(`${MARKET_DATA_CACHE_KEY}-${key}`);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Failed to get cached market data:', error);
    return null;
  }
}

/**
 * Armazena dados no cache
 */
export function setCachedMarketData(
  key: string,
  data: any,
  ttl: number = DEFAULT_TTL
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const cached: CachedMarketData = {
      data,
      timestamp: Date.now(),
      ttl
    };

    localStorage.setItem(
      `${MARKET_DATA_CACHE_KEY}-${key}`,
      JSON.stringify(cached)
    );
  } catch (error) {
    console.error('Failed to cache market data:', error);
    // Se localStorage estiver cheio, limpar caches antigos
    clearExpiredCache();
  }
}

/**
 * Remove dados do cache
 */
export function removeCachedMarketData(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(`${MARKET_DATA_CACHE_KEY}-${key}`);
}

/**
 * Limpa todos os caches de dados de mercado
 */
export function clearMarketDataCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(MARKET_DATA_CACHE_KEY)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Limpa apenas caches expirados
 */
export function clearExpiredCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const keys = Object.keys(localStorage);
  const now = Date.now();

  keys.forEach(key => {
    if (key.startsWith(MARKET_DATA_CACHE_KEY)) {
      try {
        const cacheStr = localStorage.getItem(key);
        if (cacheStr) {
          const cached: CachedMarketData = JSON.parse(cacheStr);
          const age = now - cached.timestamp;
          if (age > cached.ttl) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Remover entrada corrompida
        localStorage.removeItem(key);
      }
    }
  });
}

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): {
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
  totalSize: number;
} {
  if (typeof window === 'undefined') {
    return {
      totalEntries: 0,
      expiredEntries: 0,
      validEntries: 0,
      totalSize: 0
    };
  }

  const keys = Object.keys(localStorage);
  const marketDataKeys = keys.filter(key => key.startsWith(MARKET_DATA_CACHE_KEY));
  const now = Date.now();

  let expiredEntries = 0;
  let validEntries = 0;
  let totalSize = 0;

  marketDataKeys.forEach(key => {
    try {
      const cacheStr = localStorage.getItem(key);
      if (cacheStr) {
        totalSize += cacheStr.length;
        const cached: CachedMarketData = JSON.parse(cacheStr);
        const age = now - cached.timestamp;
        if (age > cached.ttl) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      }
    } catch (error) {
      expiredEntries++;
    }
  });

  return {
    totalEntries: marketDataKeys.length,
    expiredEntries,
    validEntries,
    totalSize
  };
}

/**
 * Gera chave de cache para símbolo e timeframe
 */
export function getMarketDataCacheKey(symbol: string, timeframe?: string): string {
  return timeframe ? `${symbol}-${timeframe}` : symbol;
}

