/**
 * KlineAggregator — agrega ticks de preço em klines 1m com OHLC + isClosed
 * Formato compatível com Binance kline_1m para o frontend tratar forex/OTC como crypto.
 */

export interface KlineTick {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  isClosed?: boolean;
  isOTC?: boolean;
}

export interface RawPriceTick {
  symbol: string;
  price: number;
  timestamp?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  isOTC?: boolean;
}

interface KlineState {
  periodStart: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  isOTC?: boolean;
}

export type KlineEmitHandler = (tick: KlineTick) => void;

const DEFAULT_PERIOD_MS = 60_000;

export class KlineAggregator {
  private readonly periodMs: number;
  private readonly onEmit: KlineEmitHandler;
  private readonly states = new Map<string, KlineState>();
  private readonly tickCounter = new Map<string, number>();
  private rolloverInterval: ReturnType<typeof setInterval> | null = null;

  constructor(onEmit: KlineEmitHandler, periodMs = DEFAULT_PERIOD_MS) {
    this.onEmit = onEmit;
    this.periodMs = periodMs;
    this.rolloverInterval = setInterval(() => this.checkPeriodRollovers(), 1000);
  }

  dispose(): void {
    if (this.rolloverInterval) {
      clearInterval(this.rolloverInterval);
      this.rolloverInterval = null;
    }
    this.states.clear();
    this.tickCounter.clear();
  }

  /** Remove estado de um símbolo (ex.: unsubscribe) */
  resetSymbol(symbol: string): void {
    this.states.delete(symbol);
    this.tickCounter.delete(symbol);
  }

  /**
   * Alinha estado interno ao preço-âncora sem emitir tick (re-anchor TwelveData → OTC).
   */
  seed(symbol: string, price: number, options?: { isOTC?: boolean; timestamp?: number }): void {
    if (!symbol || !price || !isFinite(price) || price <= 0) return;

    const timestamp = options?.timestamp ?? Date.now();
    const periodStart = this.getPeriodStart(timestamp);

    this.states.set(symbol, {
      periodStart,
      open: price,
      high: price,
      low: price,
      close: price,
      isOTC: options?.isOTC,
    });
  }

  /** Alinha timestamp ao início do período 1m */
  getPeriodStart(timestampMs: number): number {
    return Math.floor(timestampMs / this.periodMs) * this.periodMs;
  }

  ingest(raw: RawPriceTick): void {
    if (!raw.symbol || !raw.price || !isFinite(raw.price) || raw.price <= 0) return;

    const timestamp = raw.timestamp ?? Date.now();
    const periodStart = this.getPeriodStart(timestamp);
    const existing = this.states.get(raw.symbol);

    if (!existing) {
      const state: KlineState = {
        periodStart,
        open: raw.price,
        high: raw.price,
        low: raw.price,
        close: raw.price,
        bid: raw.bid,
        ask: raw.ask,
        change: raw.change,
        changePercent: raw.changePercent,
        isOTC: raw.isOTC,
      };
      this.states.set(raw.symbol, state);
      this.emit(raw.symbol, state, false);
      return;
    }

    if (periodStart > existing.periodStart) {
      this.emit(raw.symbol, existing, true);
      const prevClose = existing.close;
      const next: KlineState = {
        periodStart,
        open: prevClose,
        high: Math.max(prevClose, raw.price),
        low: Math.min(prevClose, raw.price),
        close: raw.price,
        bid: raw.bid,
        ask: raw.ask,
        change: raw.change,
        changePercent: raw.changePercent,
        isOTC: raw.isOTC ?? existing.isOTC,
      };
      this.states.set(raw.symbol, next);
      this.emit(raw.symbol, next, false);
      return;
    }

    existing.high = Math.max(existing.high, raw.price);
    existing.low = Math.min(existing.low, raw.price);
    existing.close = raw.price;
    if (raw.bid !== undefined) existing.bid = raw.bid;
    if (raw.ask !== undefined) existing.ask = raw.ask;
    if (raw.change !== undefined) existing.change = raw.change;
    if (raw.changePercent !== undefined) existing.changePercent = raw.changePercent;
    if (raw.isOTC !== undefined) existing.isOTC = raw.isOTC;

    this.emit(raw.symbol, existing, false);
  }

  /** Fecha candles quando o período muda sem novos ticks (mercado quieto / fim de semana) */
  private checkPeriodRollovers(): void {
    const now = Date.now();
    const currentPeriodStart = this.getPeriodStart(now);

    for (const [symbol, state] of this.states.entries()) {
      if (currentPeriodStart <= state.periodStart) continue;

      this.emit(symbol, state, true);

      const prevClose = state.close;
      const next: KlineState = {
        periodStart: currentPeriodStart,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        bid: state.bid,
        ask: state.ask,
        isOTC: state.isOTC,
      };
      this.states.set(symbol, next);
      this.emit(symbol, next, false);
    }
  }

  private emit(symbol: string, state: KlineState, isClosed: boolean): void {
    const baseTs = Date.now();
    const counter = (this.tickCounter.get(symbol) || 0) + 1;
    this.tickCounter.set(symbol, counter);

    const tick: KlineTick = {
      symbol,
      price: state.close,
      timestamp: baseTs + (counter % 1000),
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      isClosed,
      bid: state.bid ?? state.low,
      ask: state.ask ?? state.high,
      change: state.change,
      changePercent: state.changePercent,
      isOTC: state.isOTC,
    };

    this.onEmit(tick);
  }
}
