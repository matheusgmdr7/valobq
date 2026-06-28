import { KlineAggregator, KlineTick } from '@/engine/klineAggregator';

describe('KlineAggregator', () => {
  const PERIOD_MS = 60_000;

  function createHarness(periodMs = PERIOD_MS) {
    const emitted: KlineTick[] = [];
    const aggregator = new KlineAggregator((tick) => emitted.push({ ...tick }), periodMs);
    return { aggregator, emitted };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emite kline em formação com OHLC e isClosed=false no primeiro tick', () => {
    const { aggregator, emitted } = createHarness();
    const t0 = 1_700_000_000_000;

    aggregator.ingest({ symbol: 'EUR/USD', price: 1.085, timestamp: t0 });

    expect(emitted).toHaveLength(1);
    expect(emitted[0].isClosed).toBe(false);
    expect(emitted[0].open).toBe(1.085);
    expect(emitted[0].high).toBe(1.085);
    expect(emitted[0].low).toBe(1.085);
    expect(emitted[0].close).toBe(1.085);
    aggregator.dispose();
  });

  it('fecha período anterior e abre novo com open=close anterior', () => {
    const { aggregator, emitted } = createHarness();
    const periodStart = 1_700_000_000_000;
    const nextPeriod = periodStart + PERIOD_MS;

    aggregator.ingest({ symbol: 'EUR/USD', price: 1.08, timestamp: periodStart + 1000 });
    aggregator.ingest({ symbol: 'EUR/USD', price: 1.09, timestamp: periodStart + 5000 });
    emitted.length = 0;

    aggregator.ingest({ symbol: 'EUR/USD', price: 1.1, timestamp: nextPeriod + 1000 });

    expect(emitted.length).toBeGreaterThanOrEqual(2);
    expect(emitted[0].isClosed).toBe(true);
    expect(emitted[0].close).toBe(1.09);
    expect(emitted[1].isClosed).toBe(false);
    expect(emitted[1].open).toBe(1.09);
    expect(emitted[1].close).toBe(1.1);
    aggregator.dispose();
  });

  it('fecha candle no rollover por timer quando não há ticks', () => {
    jest.useFakeTimers();
    const { aggregator, emitted } = createHarness();
    const periodStart = 1_700_000_000_000;
    jest.setSystemTime(periodStart + 10_000);

    aggregator.ingest({ symbol: 'EUR/USD', price: 1.085, timestamp: periodStart + 1000 });
    emitted.length = 0;

    jest.setSystemTime(periodStart + PERIOD_MS + 500);
    jest.advanceTimersByTime(1000);

    const closed = emitted.find((t) => t.isClosed === true);
    const forming = emitted.find((t) => t.isClosed === false);
    expect(closed).toBeDefined();
    expect(closed?.close).toBe(1.085);
    expect(forming).toBeDefined();
    expect(forming?.open).toBe(1.085);
    aggregator.dispose();
  });

  it('seed alinha estado interno sem emitir tick', () => {
    const { aggregator, emitted } = createHarness();
    aggregator.seed('EUR/USD', 1.085, { isOTC: true });
    expect(emitted).toHaveLength(0);

    aggregator.ingest({ symbol: 'EUR/USD', price: 1.086, timestamp: Date.now() });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].open).toBe(1.085);
    expect(emitted[0].close).toBe(1.086);
    aggregator.dispose();
  });
});
