/**
 * WebAssembly Module Wrapper for Technical Indicators
 * 
 * Este módulo fornece uma interface TypeScript para os cálculos
 * de indicadores técnicos compilados em WebAssembly.
 */

// Tipos para estruturas C
export interface BollingerBandsResult {
  upper: Float64Array;
  middle: Float64Array;
  lower: Float64Array;
}

export interface MACDResult {
  macd: Float64Array;
  signal: Float64Array;
  histogram: Float64Array;
}

export interface StochasticResult {
  k: Float64Array;
  d: Float64Array;
}

// Tipo para o módulo WebAssembly
interface WasmModule {
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPF64: Float64Array;
  _calculateSMA(
    pricesPtr: number,
    length: number,
    period: number,
    resultPtr: number
  ): number;
  _calculateEMA(
    pricesPtr: number,
    length: number,
    period: number,
    resultPtr: number
  ): number;
  _calculateWMA(
    pricesPtr: number,
    length: number,
    period: number,
    resultPtr: number
  ): number;
  _calculateBollingerBands(
    pricesPtr: number,
    length: number,
    period: number,
    stdDev: number,
    upperPtr: number,
    middlePtr: number,
    lowerPtr: number
  ): number;
  _calculateRSI(
    pricesPtr: number,
    length: number,
    period: number,
    resultPtr: number
  ): number;
  _calculateMACD(
    pricesPtr: number,
    length: number,
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
    macdPtr: number,
    signalPtr: number,
    histogramPtr: number
  ): number;
  _calculateStochastic(
    highPtr: number,
    lowPtr: number,
    closePtr: number,
    length: number,
    kPeriod: number,
    dPeriod: number,
    kPtr: number,
    dPtr: number
  ): number;
  _calculateVWAP(
    highPtr: number,
    lowPtr: number,
    closePtr: number,
    volumePtr: number,
    length: number,
    resultPtr: number
  ): number;
  _calculateOBV(
    closePtr: number,
    volumePtr: number,
    length: number,
    resultPtr: number
  ): number;
}

let wasmModule: WasmModule | null = null;
let isInitialized = false;

// ============================================================================
// Memory Pool for Buffer Reuse
// ============================================================================

interface BufferPool {
  size: number;
  buffers: number[];
  maxPoolSize: number;
}

const bufferPools: Map<number, BufferPool> = new Map();
const MAX_POOL_SIZE = 10; // Máximo de buffers por tamanho no pool

/**
 * Obtém um buffer do pool ou aloca um novo
 */
function getBufferFromPool(size: number): number {
  const pool = bufferPools.get(size) || { size, buffers: [], maxPoolSize: MAX_POOL_SIZE };
  
  if (pool.buffers.length > 0) {
    return pool.buffers.pop()!;
  }
  
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized');
  }
  
  const ptr = wasmModule._malloc(size * 8); // 8 bytes per double
  if (ptr === 0) {
    throw new Error('Failed to allocate memory');
  }
  
  return ptr;
}

/**
 * Retorna um buffer para o pool
 */
function returnBufferToPool(ptr: number, size: number): void {
  const pool = bufferPools.get(size) || { size, buffers: [], maxPoolSize: MAX_POOL_SIZE };
  
  if (pool.buffers.length < pool.maxPoolSize) {
    pool.buffers.push(ptr);
    bufferPools.set(size, pool);
  } else {
    // Pool cheio, liberar memória
    if (wasmModule) {
      wasmModule._free(ptr);
    }
  }
}

/**
 * Limpa todos os pools de memória
 */
export function clearMemoryPools(): void {
  if (!wasmModule) {
    return;
  }
  
  for (const pool of bufferPools.values()) {
    for (const ptr of pool.buffers) {
      wasmModule._free(ptr);
    }
    pool.buffers.length = 0;
  }
  bufferPools.clear();
}

// ============================================================================
// Calculation Cache
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const calculationCache: Map<string, CacheEntry<Float64Array | BollingerBandsResult | MACDResult | StochasticResult>> = new Map();
const CACHE_EXPIRATION_MS = 5000; // 5 segundos
const MAX_CACHE_SIZE = 100; // Máximo de entradas no cache

/**
 * Gera uma chave de cache baseada nos parâmetros
 */
function getCacheKey(indicator: string, params: any[]): string {
  // Criar hash simples dos parâmetros
  const paramsStr = params.map(p => {
    if (Array.isArray(p)) {
      // Para arrays, usar apenas o primeiro e último elemento + tamanho
      return `${p.length}:${p[0]}:${p[p.length - 1]}`;
    }
    return String(p);
  }).join('|');
  return `${indicator}:${paramsStr}`;
}

/**
 * Obtém resultado do cache se ainda válido
 */
function getCachedResult<T>(key: string): T | null {
  const entry = calculationCache.get(key);
  if (entry && (Date.now() - entry.timestamp < CACHE_EXPIRATION_MS)) {
    // Criar cópia do resultado para evitar mutação
    if (entry.data instanceof Float64Array) {
      return new Float64Array(entry.data) as T;
    }
    // Para objetos complexos, fazer deep copy
    return JSON.parse(JSON.stringify(entry.data)) as T;
  }
  
  // Remover entrada expirada
  if (entry) {
    calculationCache.delete(key);
  }
  
  return null;
}

/**
 * Armazena resultado no cache
 */
function setCachedResult<T>(key: string, data: T): void {
  // Limpar cache se estiver muito grande
  if (calculationCache.size >= MAX_CACHE_SIZE) {
    // Remover entradas mais antigas
    const entries = Array.from(calculationCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remover 20% das entradas mais antigas
    const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) {
      calculationCache.delete(entries[i][0]);
    }
  }
  
  // Criar cópia dos dados para armazenar
  let dataCopy: any;
  if (data instanceof Float64Array) {
    dataCopy = new Float64Array(data);
  } else {
    dataCopy = JSON.parse(JSON.stringify(data));
  }
  
  calculationCache.set(key, { data: dataCopy, timestamp: Date.now() });
}

/**
 * Limpa o cache de cálculos
 */
export function clearCalculationCache(): void {
  calculationCache.clear();
}

/**
 * Inicializa o módulo WebAssembly
 */
export async function initWasm(): Promise<void> {
  if (isInitialized && wasmModule) {
    return;
  }

  if (typeof window === 'undefined') {
    // Serverside - não inicializar WebAssembly
    return;
  }

  try {
    // Importar módulo WebAssembly do diretório build
    // @ts-ignore - O módulo será gerado pelo Emscripten
    const createModule = await import('./build/indicators.js');
    
    // Com SINGLE_FILE=1, o WASM está embutido no JS
    // Não passar locateFile para evitar tentativas de fetch de arquivo .wasm separado
    wasmModule = await createModule.default({
      // Não definir locateFile - o WASM está embutido no JS
      // O Emscripten com SINGLE_FILE=1 deve usar o binário embutido automaticamente
    });
    
    isInitialized = true;
  } catch (error) {
    // Fallback para JavaScript
    isInitialized = false;
  }
}

/**
 * Aloca memória no heap do WebAssembly (com pool de memória)
 */
function allocateArray(data: number[]): { ptr: number; length: number } {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  // Verificar se HEAPF64 está disponível
  if (!wasmModule.HEAPF64) {
    throw new Error('WebAssembly HEAPF64 not available. Module may not be fully initialized.');
  }

  const length = data.length;
  
  // Tentar obter buffer do pool
  const ptr = getBufferFromPool(length);

  // Copiar dados para o heap
  const heap = wasmModule.HEAPF64;
  const start = ptr / 8; // 8 bytes per double
  
  // Verificar se o índice está dentro dos limites do heap
  if (start + length > heap.length) {
    // Liberar buffer se a alocação falhar
    if (wasmModule) {
      wasmModule._free(ptr);
    }
    throw new Error(`Heap allocation failed: requested ${length} elements starting at ${start}, but heap size is ${heap.length}`);
  }
  
  for (let i = 0; i < length; i++) {
    heap[start + i] = data[i];
  }

  return { ptr, length };
}

/**
 * Libera memória do heap do WebAssembly (retorna para o pool)
 */
function freeArray(ptr: number, length: number): void {
  if (!wasmModule || ptr === 0) {
    return;
  }
  
  // Retornar buffer para o pool em vez de liberar imediatamente
  returnBufferToPool(ptr, length);
}

/**
 * Lê array do heap do WebAssembly
 */
function readArray(ptr: number, length: number): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized');
  }

  const bytesPerElement = 8;
  const start = ptr / bytesPerElement;
  const heap = wasmModule.HEAPF64;
  
  return new Float64Array(heap.buffer, start * bytesPerElement, length);
}

// ============================================================================
// Moving Averages
// ============================================================================

export function calculateSMA(prices: number[], period: number): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  // Verificar cache
  const cacheKey = getCacheKey('SMA', [prices, period]);
  const cached = getCachedResult<Float64Array>(cacheKey);
  if (cached) {
    return cached;
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateSMA(pricesPtr, length, period, resultPtr);
    if (result !== 0) {
      throw new Error('SMA calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    
    // Armazenar no cache
    setCachedResult(cacheKey, resultCopy);
    
    return resultCopy;
  } finally {
    freeArray(pricesPtr, length);
    freeArray(resultPtr, length);
  }
}

export function calculateEMA(prices: number[], period: number): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  // Verificar cache
  const cacheKey = getCacheKey('EMA', [prices, period]);
  const cached = getCachedResult<Float64Array>(cacheKey);
  if (cached) {
    return cached;
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateEMA(pricesPtr, length, period, resultPtr);
    if (result !== 0) {
      throw new Error('EMA calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    
    // Armazenar no cache
    setCachedResult(cacheKey, resultCopy);
    
    return resultCopy;
  } finally {
    freeArray(pricesPtr, length);
    freeArray(resultPtr, length);
  }
}

export function calculateWMA(prices: number[], period: number): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateWMA(pricesPtr, length, period, resultPtr);
    if (result !== 0) {
      throw new Error('WMA calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    return resultCopy;
  } finally {
    freeArray(pricesPtr, length);
    freeArray(resultPtr, length);
  }
}

// ============================================================================
// Bollinger Bands
// ============================================================================

export function calculateBollingerBands(
  prices: number[],
  period: number,
  stdDev: number = 2.0
): BollingerBandsResult {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  // Verificar cache
  const cacheKey = getCacheKey('BollingerBands', [prices, period, stdDev]);
  const cached = getCachedResult<BollingerBandsResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: upperPtr } = allocateArray(new Array(length).fill(0));
  const { ptr: middlePtr } = allocateArray(new Array(length).fill(0));
  const { ptr: lowerPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateBollingerBands(
      pricesPtr,
      length,
      period,
      stdDev,
      upperPtr,
      middlePtr,
      lowerPtr
    );

    if (result !== 0) {
      throw new Error('Bollinger Bands calculation failed');
    }

    // Criar cópias dos resultados antes de liberar buffers
    const upperArray = readArray(upperPtr, length);
    const middleArray = readArray(middlePtr, length);
    const lowerArray = readArray(lowerPtr, length);
    
    const resultObj = {
      upper: new Float64Array(upperArray),
      middle: new Float64Array(middleArray),
      lower: new Float64Array(lowerArray)
    };
    
    // Armazenar no cache
    setCachedResult(cacheKey, resultObj);
    
    return resultObj;
  } finally {
    freeArray(pricesPtr, length);
    freeArray(upperPtr, length);
    freeArray(middlePtr, length);
    freeArray(lowerPtr, length);
  }
}

// ============================================================================
// RSI
// ============================================================================

export function calculateRSI(prices: number[], period: number = 14): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateRSI(pricesPtr, length, period, resultPtr);
    if (result !== 0) {
      throw new Error('RSI calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    return resultCopy;
  } finally {
    freeArray(pricesPtr, length);
    freeArray(resultPtr, length);
  }
}

// ============================================================================
// MACD
// ============================================================================

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  const { ptr: pricesPtr, length } = allocateArray(prices);
  const { ptr: macdPtr } = allocateArray(new Array(length).fill(0));
  const { ptr: signalPtr } = allocateArray(new Array(length).fill(0));
  const { ptr: histogramPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateMACD(
      pricesPtr,
      length,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      macdPtr,
      signalPtr,
      histogramPtr
    );

    if (result !== 0) {
      throw new Error('MACD calculation failed');
    }

    // Criar cópias dos resultados antes de liberar buffers
    const macdArray = readArray(macdPtr, length);
    const signalArray = readArray(signalPtr, length);
    const histogramArray = readArray(histogramPtr, length);
    
    return {
      macd: new Float64Array(macdArray),
      signal: new Float64Array(signalArray),
      histogram: new Float64Array(histogramArray)
    };
  } finally {
    freeArray(pricesPtr, length);
    freeArray(macdPtr, length);
    freeArray(signalPtr, length);
    freeArray(histogramPtr, length);
  }
}

// ============================================================================
// Stochastic
// ============================================================================

export function calculateStochastic(
  high: number[],
  low: number[],
  close: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  if (high.length !== low.length || high.length !== close.length) {
    throw new Error('Arrays must have the same length');
  }

  const { ptr: highPtr, length } = allocateArray(high);
  const { ptr: lowPtr } = allocateArray(low);
  const { ptr: closePtr } = allocateArray(close);
  const { ptr: kPtr } = allocateArray(new Array(length).fill(0));
  const { ptr: dPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateStochastic(
      highPtr,
      lowPtr,
      closePtr,
      length,
      kPeriod,
      dPeriod,
      kPtr,
      dPtr
    );

    if (result !== 0) {
      throw new Error('Stochastic calculation failed');
    }

    // Criar cópias dos resultados antes de liberar buffers
    const kArray = readArray(kPtr, length);
    const dArray = readArray(dPtr, length);
    
    return {
      k: new Float64Array(kArray),
      d: new Float64Array(dArray)
    };
  } finally {
    freeArray(highPtr, length);
    freeArray(lowPtr, length);
    freeArray(closePtr, length);
    freeArray(kPtr, length);
    freeArray(dPtr, length);
  }
}

// ============================================================================
// Volume Indicators
// ============================================================================

export function calculateVWAP(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  if (high.length !== low.length || high.length !== close.length || high.length !== volume.length) {
    throw new Error('Arrays must have the same length');
  }

  const { ptr: highPtr, length } = allocateArray(high);
  const { ptr: lowPtr } = allocateArray(low);
  const { ptr: closePtr } = allocateArray(close);
  const { ptr: volumePtr } = allocateArray(volume);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateVWAP(
      highPtr,
      lowPtr,
      closePtr,
      volumePtr,
      length,
      resultPtr
    );

    if (result !== 0) {
      throw new Error('VWAP calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    return resultCopy;
  } finally {
    freeArray(highPtr, length);
    freeArray(lowPtr, length);
    freeArray(closePtr, length);
    freeArray(volumePtr, length);
    freeArray(resultPtr, length);
  }
}

export function calculateOBV(close: number[], volume: number[]): Float64Array {
  if (!wasmModule) {
    throw new Error('WebAssembly module not initialized. Call initWasm() first.');
  }

  if (close.length !== volume.length) {
    throw new Error('Arrays must have the same length');
  }

  const { ptr: closePtr, length } = allocateArray(close);
  const { ptr: volumePtr } = allocateArray(volume);
  const { ptr: resultPtr } = allocateArray(new Array(length).fill(0));

  try {
    const result = wasmModule._calculateOBV(closePtr, volumePtr, length, resultPtr);
    if (result !== 0) {
      throw new Error('OBV calculation failed');
    }

    // Criar cópia do resultado antes de liberar buffers
    const resultArray = readArray(resultPtr, length);
    const resultCopy = new Float64Array(resultArray);
    return resultCopy;
  } finally {
    freeArray(closePtr, length);
    freeArray(volumePtr, length);
    freeArray(resultPtr, length);
  }
}

/**
 * Verifica se o módulo WebAssembly está inicializado
 */
export function isWasmReady(): boolean {
  return isInitialized && wasmModule !== null && wasmModule.HEAPF64 !== undefined;
}

