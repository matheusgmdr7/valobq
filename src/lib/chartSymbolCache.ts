/**
 * Cache de estado do gráfico por símbolo/timeframe na sessão do browser.
 * Evita regenerar histórico OTC e perder candles ao alternar ativos.
 */

export interface CachedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface CachedChartState {
  version: number;
  savedAt: number;
  candles: CachedCandle[];
  liveCandle: CachedCandle | null;
  lastCandleTime: number | null;
  engine: {
    realPrice: number;
    visualPrice: number;
    velocity: number;
    inertia: number;
  };
  viewport: {
    visibleStartIndex: number;
    visibleCandleCount: number;
    isAtEnd: boolean;
  };
  displayedPrice: number;
  isCrypto: boolean;
}

/** Incrementar quando a estrutura/validação do cache mudar (invalida entradas antigas). */
export const CHART_CACHE_VERSION = 3;

/** Cache mais velho que isso é descartado ao restaurar (forex/OTC). */
export const CHART_CACHE_MAX_AGE_MS = 3 * 60 * 1000;

/** Último candle mais de N períodos atrás → resync em vez de restaurar cache. */
export const CHART_CACHE_MAX_GAP_PERIODS = 5;

const PERIOD_MS: Record<string, number> = {
  '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
  '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
  '4h': 14400000, '8h': 28800000, '12h': 43200000,
  '1d': 86400000, '1w': 604800000, '1M': 2592000000,
};

export function getTimeframePeriodMs(timeframe: string): number {
  return PERIOD_MS[timeframe] ?? 60000;
}

export function getBarPeriodStart(timeMs: number, timeframe: string): number {
  const periodMs = getTimeframePeriodMs(timeframe);
  return Math.floor(timeMs / periodMs) * periodMs;
}

export function getLastCachedCandlePeriod(
  state: CachedChartState,
  timeframe: string,
): number | null {
  const last = state.liveCandle ?? state.candles[state.candles.length - 1];
  if (!last?.time) return null;
  return getBarPeriodStart(last.time, timeframe);
}

/** Cache expirado ou série muito defasada em relação ao relógio atual. */
export function isChartCacheStale(
  state: CachedChartState,
  timeframe: string,
  nowMs: number = Date.now(),
): boolean {
  const savedAt = state.savedAt ?? 0;
  if (!savedAt || nowMs - savedAt > CHART_CACHE_MAX_AGE_MS) {
    return true;
  }

  const lastPeriod = getLastCachedCandlePeriod(state, timeframe);
  if (lastPeriod === null) return true;

  const currentPeriod = getBarPeriodStart(nowMs, timeframe);
  const periodMs = getTimeframePeriodMs(timeframe);
  const gapPeriods = (currentPeriod - lastPeriod) / periodMs;

  return gapPeriods > CHART_CACHE_MAX_GAP_PERIODS;
}

const store = new Map<string, CachedChartState>();

const CRYPTO_BASES = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'LINK',
  'LTC', 'AVAX', 'UNI', 'ATOM', 'SHIB', 'TRX',
]);

export function normalizeChartSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase();
}

/** Crypto usa dados reais (Binance) — não cachear série (live candle muda a cada tick). */
export function isCryptoSymbol(symbol: string): boolean {
  return CRYPTO_BASES.has(symbol.split('/')[0]?.toUpperCase() || '');
}

function medianPrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Rejeita cache corrompido (ex.: ticks de outro ativo misturados antes do fix). */
export function isChartCacheValid(symbol: string, state: CachedChartState): boolean {
  if (state.version !== CHART_CACHE_VERSION) return false;
  if (isCryptoSymbol(symbol)) return false;
  if (state.candles.length === 0) return false;

  const allCandles = state.liveCandle
    ? [...state.candles, state.liveCandle]
    : state.candles;

  const allPrices = allCandles
    .flatMap((c) => [c.open, c.high, c.low, c.close])
    .filter((p) => p > 0 && isFinite(p));

  if (allPrices.length === 0) return false;

  const mid = medianPrice(allPrices);
  if (mid <= 0) return false;

  for (const p of allPrices) {
    const ratio = p / mid;
    if (ratio > 2.5 || ratio < 0.4) return false;
  }

  for (const c of allCandles) {
    const wick = c.high - c.low;
    if (wick / mid > 0.025) return false;
  }

  const enginePrices = [state.engine.realPrice, state.engine.visualPrice, state.displayedPrice]
    .filter((p) => p > 0 && isFinite(p));
  for (const p of enginePrices) {
    const ratio = p / mid;
    if (ratio > 2.5 || ratio < 0.4) return false;
  }

  return true;
}

export function chartCacheKey(symbol: string, timeframe: string): string {
  return `${symbol}\0${timeframe}`;
}

export function deleteChartCache(key: string): void {
  store.delete(key);
}

export function getChartCache(key: string): CachedChartState | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  return {
    ...entry,
    candles: entry.candles.map((c) => ({ ...c })),
    liveCandle: entry.liveCandle ? { ...entry.liveCandle } : null,
    engine: { ...entry.engine },
    viewport: { ...entry.viewport },
  };
}

export function setChartCache(key: string, state: CachedChartState): void {
  store.set(key, {
    ...state,
    version: CHART_CACHE_VERSION,
    savedAt: state.savedAt ?? Date.now(),
    candles: state.candles.map((c) => ({ ...c })),
    liveCandle: state.liveCandle ? { ...state.liveCandle } : null,
    engine: { ...state.engine },
    viewport: { ...state.viewport },
  });
}

/** Rejeita tick com preço incoerente em relação ao candle atual (contaminação entre ativos). */
export function isTickPricePlausible(
  symbol: string,
  tickPrice: number,
  referencePrice: number
): boolean {
  if (!tickPrice || !isFinite(tickPrice) || tickPrice <= 0) return false;
  if (!referencePrice || !isFinite(referencePrice) || referencePrice <= 0) return true;

  if (isCryptoSymbol(symbol)) {
    const ratio = tickPrice / referencePrice;
    return ratio > 0.85 && ratio < 1.15;
  }

  const ratio = tickPrice / referencePrice;
  return ratio > 0.75 && ratio < 1.25;
}

/** Remove candles com preços incoerentes (contaminação de outro ativo). */
export function filterOutlierCandles<T extends CachedCandle>(symbol: string, candles: T[]): T[] {
  if (candles.length === 0 || isCryptoSymbol(symbol)) return candles;

  const closes = candles.map((c) => c.close).filter((p) => p > 0 && isFinite(p));
  const mid = medianPrice(closes);
  if (mid <= 0) return candles;

  return candles.filter((c) => {
    const prices = [c.open, c.high, c.low, c.close];
    if (!prices.every((p) => p > 0 && isFinite(p))) return false;
    if (!prices.every((p) => p / mid > 0.5 && p / mid < 2)) return false;
    return (c.high - c.low) / mid <= 0.025;
  });
}
