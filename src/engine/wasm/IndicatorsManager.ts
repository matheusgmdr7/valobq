/**
 * Indicators Manager - Gerencia cálculos de indicadores usando WebAssembly ou fallback JavaScript
 * 
 * Este módulo tenta usar WebAssembly para cálculos de alta performance,
 * mas faz fallback para JavaScript se WebAssembly não estiver disponível.
 */

import { CandlestickData } from '@/types/chart';
import * as WasmIndicators from './IndicatorsWasm';

let wasmInitialized = false;
let wasmInitializing = false;
let wasmAvailable = false;

/**
 * Inicializa o módulo WebAssembly (assíncrono)
 */
export async function initWasm(): Promise<boolean> {
  if (wasmInitialized) {
    return wasmAvailable;
  }

  if (wasmInitializing) {
    // Aguardar inicialização em andamento
    while (wasmInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return wasmAvailable;
  }

  wasmInitializing = true;

  try {
    await WasmIndicators.initWasm();
    wasmAvailable = WasmIndicators.isWasmReady();
    wasmInitialized = true;
    return wasmAvailable;
  } catch (error) {
    wasmAvailable = false;
    wasmInitialized = true;
    return false;
  } finally {
    wasmInitializing = false;
  }
}

/**
 * Verifica se WebAssembly está disponível
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable && wasmInitialized;
}

/**
 * Extrai array de preços de fechamento dos dados de candlestick
 */
function extractClosePrices(data: CandlestickData[]): number[] {
  return data.map(candle => 
    candle.close ?? candle.open ?? candle.high ?? candle.low ?? 0
  );
}

/**
 * Converte Float64Array para Array<number | null>, tratando NaN
 */
function float64ArrayToNullableArray(arr: Float64Array): Array<number | null> {
  return Array.from(arr).map(val => isNaN(val) ? null : val);
}

// ============================================================================
// SMA (Simple Moving Average)
// ============================================================================

export function calculateSMA(
  data: CandlestickData[],
  period: number
): Array<number | null> {
  if (!data.length || period <= 1) {
    return data.map((candle) => {
      const value = candle.close ?? candle.open ?? candle.high ?? candle.low ?? null;
      return value;
    });
  }

  // Tentar usar WebAssembly se disponível
  if (isWasmAvailable()) {
    try {
      const prices = extractClosePrices(data);
      const result = WasmIndicators.calculateSMA(prices, period);
      return float64ArrayToNullableArray(result);
    } catch (error) {
      // Fallback para JavaScript
    }
  }

  // Fallback JavaScript
  return calculateSMAJS(data, period);
}

function calculateSMAJS(data: CandlestickData[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(data.length).fill(null);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const close = data[i].close ?? data[i].open ?? data[i].high ?? data[i].low ?? 0;
    sum += close;

    if (i >= period) {
      const removeClose = data[i - period].close ?? data[i - period].open ?? data[i - period].high ?? data[i - period].low ?? 0;
      sum -= removeClose;
    }

    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

// ============================================================================
// EMA (Exponential Moving Average)
// ============================================================================

export function calculateEMA(
  data: CandlestickData[],
  period: number
): Array<number | null> {
  if (!data.length) {
    return new Array(data.length).fill(null);
  }

  // Tentar usar WebAssembly se disponível
  if (isWasmAvailable()) {
    try {
      const prices = extractClosePrices(data);
      const result = WasmIndicators.calculateEMA(prices, period);
      return float64ArrayToNullableArray(result);
    } catch (error) {
      // Fallback para JavaScript
    }
  }

  // Fallback JavaScript
  return calculateEMAJS(data, period);
}

function calculateEMAJS(data: CandlestickData[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(data.length).fill(null);
  const smoothing = 2 / (period + 1);
  let ema = data[0].close ?? data[0].open ?? data[0].high ?? data[0].low ?? 0;
  result[0] = ema;

  for (let i = 1; i < data.length; i++) {
    const close = data[i].close ?? data[i].open ?? ema;
    ema = close * smoothing + ema * (1 - smoothing);
    result[i] = ema;
  }

  return result;
}

// ============================================================================
// Bollinger Bands
// ============================================================================

export function calculateBollinger(
  data: CandlestickData[],
  period: number,
  stdDevMultiplier: number
): { upper: Array<number | null>; lower: Array<number | null>; middle: Array<number | null> } {
  const upper: Array<number | null> = new Array(data.length).fill(null);
  const lower: Array<number | null> = new Array(data.length).fill(null);
  const middle: Array<number | null> = new Array(data.length).fill(null);

  if (!data.length || period < 2) {
    return { upper, lower, middle };
  }

  // Tentar usar WebAssembly se disponível
  if (isWasmAvailable()) {
    try {
      const prices = extractClosePrices(data);
      const result = WasmIndicators.calculateBollingerBands(prices, period, stdDevMultiplier);
      return {
        upper: float64ArrayToNullableArray(result.upper),
        middle: float64ArrayToNullableArray(result.middle),
        lower: float64ArrayToNullableArray(result.lower)
      };
    } catch (error) {
      // Fallback para JavaScript
    }
  }

  // Fallback JavaScript
  return calculateBollingerJS(data, period, stdDevMultiplier);
}

function calculateBollingerJS(
  data: CandlestickData[],
  period: number,
  stdDevMultiplier: number
): { upper: Array<number | null>; lower: Array<number | null>; middle: Array<number | null> } {
  const upper: Array<number | null> = new Array(data.length).fill(null);
  const lower: Array<number | null> = new Array(data.length).fill(null);
  const middle: Array<number | null> = new Array(data.length).fill(null);

  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < data.length; i++) {
    const close = data[i].close ?? data[i].open ?? 0;
    sum += close;
    sumSq += close * close;

    if (i >= period) {
      const prevClose = data[i - period].close ?? data[i - period].open ?? 0;
      sum -= prevClose;
      sumSq -= prevClose * prevClose;
    }

    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max(sumSq / period - mean * mean, 0);
      const stdDev = Math.sqrt(variance);
      middle[i] = mean;
      upper[i] = mean + stdDevMultiplier * stdDev;
      lower[i] = mean - stdDevMultiplier * stdDev;
    }
  }

  return { upper, lower, middle };
}

