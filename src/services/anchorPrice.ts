/**
 * Preço-âncora compartilhado entre API histórica e MarketDataServer.
 * Garante que histórico OTC e primeiro tick realtime partem do mesmo valor.
 */

import { createClient } from 'redis';
import { PRICE_DEFAULTS } from '@/config/priceDefaults';

export type AnchorPriceSource = 'redis' | 'twelvedata' | 'default';

export interface AnchorPriceResult {
  price: number;
  source: AnchorPriceSource;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_KEY_PREFIX = 'PRICE:LATEST:';

async function fetchRedisLatest(symbol: string): Promise<number> {
  let client: ReturnType<typeof createClient> | null = null;
  try {
    client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 3000,
        reconnectStrategy: () => false,
      },
    });
    client.on('error', () => {});
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    const raw = await client.get(`${REDIS_KEY_PREFIX}${symbol}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const price = parseFloat(parsed.price ?? parsed.close ?? 0);
    return isFinite(price) && price > 0 ? price : 0;
  } catch {
    return 0;
  } finally {
    try {
      if (client?.isOpen) await client.quit();
    } catch {
      /* ignore */
    }
  }
}

async function fetchTwelveDataPrice(symbol: string): Promise<number> {
  const apiKey = process.env.TWELVEDATA_API_KEY || '';
  if (!apiKey) return 0;

  try {
    const priceUrl = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const priceRes = await fetch(priceUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (priceRes.ok) {
      const priceData: any = await priceRes.json();
      if (priceData.price) {
        const p = parseFloat(priceData.price);
        if (isFinite(p) && p > 0) return p;
      }
    }
  } catch {
    /* fallback abaixo */
  }

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1&timezone=UTC&apikey=${apiKey}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data: any = await response.json();
      if (data.values?.length > 0) {
        const p = parseFloat(data.values[0].close);
        if (isFinite(p) && p > 0) return p;
      }
    }
  } catch {
    /* fallback abaixo */
  }

  return 0;
}

export interface ResolveAnchorPriceOptions {
  /** Pula TwelveData (categorias sintéticas) — Redis → default apenas */
  skipTwelveData?: boolean;
}

/**
 * Resolve o preço-âncora para um símbolo (Redis → TwelveData → default).
 */
export async function resolveAnchorPrice(
  symbol: string,
  options?: ResolveAnchorPriceOptions
): Promise<AnchorPriceResult> {
  const fromRedis = await fetchRedisLatest(symbol);
  if (fromRedis > 0) {
    return { price: fromRedis, source: 'redis' };
  }

  if (options?.skipTwelveData) {
    return {
      price: PRICE_DEFAULTS[symbol] || 100,
      source: 'default',
    };
  }

  const fromApi = await fetchTwelveDataPrice(symbol);
  if (fromApi > 0) {
    return { price: fromApi, source: 'twelvedata' };
  }

  return {
    price: PRICE_DEFAULTS[symbol] || 100,
    source: 'default',
  };
}

/** Versão síncrona quando só há cache local disponível */
export function resolveAnchorPriceSync(
  symbol: string,
  cachedRealPrice?: number
): AnchorPriceResult {
  if (cachedRealPrice && cachedRealPrice > 0) {
    return { price: cachedRealPrice, source: 'redis' };
  }
  return {
    price: PRICE_DEFAULTS[symbol] || 100,
    source: 'default',
  };
}
