import { 
  CandlestickData, 
  LineData, 
  AreaData, 
  ChartConfig, 
  RenderData,
  ChartBuffers,
  ShaderProgram,
  DrawingShape
} from '@/types/chart';
import { 
  CandlestickVertexShader, 
  CandlestickFragmentShader, 
  WickVertexShader, 
  WickFragmentShader 
} from '../shaders/CandlestickShaders';
import { 
  LineVertexShader, 
  LineFragmentShader, 
  PointVertexShader, 
  PointFragmentShader 
} from '../shaders/LineShaders';
import { 
  AreaVertexShader, 
  AreaFragmentShader, 
  GradientAreaVertexShader, 
  GradientAreaFragmentShader 
} from '../shaders/AreaShaders';
import {
  initWasm,
  isWasmReady,
  calculateSMA as wasmCalculateSMA,
  calculateEMA as wasmCalculateEMA,
  calculateBollingerBands as wasmCalculateBollingerBands
} from '../wasm/IndicatorsWasm';

export interface ViewState {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

export interface VisibleRange {
  timeStart: number;
  timeEnd: number;
  priceMin: number;
  priceMax: number;
  startIndex: number;
  endIndex: number;
  candleCount: number;
}

interface CandlestickGeometry {
  bodyVertices: Float32Array;
  bodyColors: Float32Array;
  bodyIndices: Uint16Array;
  wickVertices: Float32Array;
  wickColors: Float32Array;
  halfWidth: number;
  candleSpacing: number;
  gap: number;
  priceMin: number;
  priceMax: number;
  priceRange: number;
}

export class ChartManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private config: ChartConfig;
  private shaderPrograms: Map<string, ShaderProgram> = new Map();
  private buffers: Map<string, ChartBuffers> = new Map();
  private viewState: ViewState = {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0
  };
  private candlestickMetrics: { 
    halfWidth: number; 
    candleSpacing: number; 
    gap: number;
    priceMin: number;
    priceMax: number;
    priceRange: number;
  } | null = null;
  private wasmInitialized: boolean = false;
  private wasmErrorLogged: Set<string> = new Set();
  private wasmErrorThrottle: Map<string, number> = new Map();
  private readonly WASM_ERROR_THROTTLE_MS = 5000; // 5 segundos entre logs do mesmo erro

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, config: ChartConfig) {
    this.gl = gl;
    this.config = config;
    this.initShaders();
    // Inicializar WebAssembly de forma assíncrona (não bloqueia o construtor)
    this.initWasm().catch((error) => {
      console.error('[ChartManager] Error:', error instanceof Error ? error.message : 'Unknown error');
      this.wasmInitialized = false;
    });
  }

  private async initWasm(): Promise<void> {
    try {
      await initWasm();
      this.wasmInitialized = isWasmReady();
    } catch (error) {
      console.error('[ChartManager] Error:', error instanceof Error ? error.message : 'Unknown error');
      this.wasmInitialized = false;
    }
  }

  /**
   * Loga erro do WebAssembly com throttling para evitar spam no console
   */
  private logWasmError(indicator: string, error: any): void {
    const errorKey = `${indicator}_${error?.message || 'unknown'}`;
    const now = Date.now();
    const lastLogTime = this.wasmErrorThrottle.get(errorKey) || 0;
    
    // Se já logou este erro recentemente, não logar novamente
    if (now - lastLogTime < this.WASM_ERROR_THROTTLE_MS) {
      return;
    }
    
    // Se este é o primeiro log deste erro, marcar como logado
    if (!this.wasmErrorLogged.has(errorKey)) {
      this.wasmErrorLogged.add(errorKey);
      console.error('[ChartManager] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    this.wasmErrorThrottle.set(errorKey, now);
    
    // Limpar entradas antigas do throttle (mais de 1 minuto)
    const oneMinuteAgo = now - 60000;
    for (const [key, time] of this.wasmErrorThrottle.entries()) {
      if (time < oneMinuteAgo) {
        this.wasmErrorThrottle.delete(key);
        this.wasmErrorLogged.delete(key);
      }
    }
  }

  private initShaders(): void {
    // Candlestick shaders
    this.createShaderProgram('candlestick', CandlestickVertexShader, CandlestickFragmentShader);
    this.createShaderProgram('wick', WickVertexShader, WickFragmentShader);
    
    // Line shaders
    this.createShaderProgram('line', LineVertexShader, LineFragmentShader);
    this.createShaderProgram('point', PointVertexShader, PointFragmentShader);
    
    // Area shaders
    this.createShaderProgram('area', AreaVertexShader, AreaFragmentShader);
    this.createShaderProgram('gradientArea', GradientAreaVertexShader, GradientAreaFragmentShader);
  }

  private createShaderProgram(name: string, vertexSource: string, fragmentSource: string): void {
    const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      console.error('[ChartManager] Error: Failed to create shaders');
      return;
    }

    const program = this.gl.createProgram();
    if (!program) {
      console.error('[ChartManager] Error: Failed to create program');
      return;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('[ChartManager] Error: Program linking failed');
      this.gl.deleteProgram(program);
      return;
    }

    const shaderProgram: ShaderProgram = {
      program,
      attributes: {
        position: this.gl.getAttribLocation(program, 'a_position'),
        color: this.gl.getAttribLocation(program, 'a_color')
      },
      uniforms: {
        transform: this.gl.getUniformLocation(program, 'u_transform'),
        time: this.gl.getUniformLocation(program, 'u_time')
      }
    };

    this.shaderPrograms.set(name, shaderProgram);
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) {
      console.error('[ChartManager] Error: Failed to create shader');
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('[ChartManager] Error: Shader compilation failed');
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  public updateViewState(partial: Partial<ViewState>): void {
    this.viewState = { ...this.viewState, ...partial };
  }

  public getViewState(): ViewState {
    return this.viewState;
  }

  private setupTransformMatrix(program: ShaderProgram): void {
    if (program.uniforms.transform) {
      const { scaleX: viewScaleX, scaleY: viewScaleY, translateX: viewTranslateX, translateY: viewTranslateY } = this.viewState;

      const transform = new Float32Array([
        viewScaleX, 0, viewTranslateX,
        0, viewScaleY, viewTranslateY,
        0, 0, 1
      ]);

      this.gl.uniformMatrix3fv(program.uniforms.transform, false, transform);
    }
  }

  private generateCandlestickGeometry(data: CandlestickData[]): CandlestickGeometry {
    const bodyVertices: number[] = [];
    const bodyColors: number[] = [];
    const bodyIndices: number[] = [];
    const wickVertices: number[] = [];
    const wickColors: number[] = [];

    const prices = data.flatMap(candle => [candle.open, candle.high, candle.low, candle.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const rawRange = maxPrice - minPrice;
    const padding = rawRange === 0 ? Math.max(minPrice * 0.005, 0.0005) : rawRange * 0.08;
    const adjustedMin = minPrice - padding;
    const adjustedMax = maxPrice + padding;
    const priceRange = adjustedMax - adjustedMin || 1;

    const candleCount = data.length;
    const candleSpacing = candleCount > 0 ? 2 / candleCount : 0;
    const gap = candleCount > 0 
      ? Math.min(Math.max(candleSpacing * 0.15, 0.02), candleSpacing * 0.55)
      : 0;
    const candleWidth = candleSpacing - gap;
    const halfWidth = candleWidth / 2;

    const normalize = (price: number) => (price - adjustedMin) / priceRange;
    const toClipY = (price: number) => {
      const normalized = normalize(price);
      return -1 + normalized * 2;
    };

    data.forEach((candle, index) => {
      const centerX = -1 + (index + 0.5) * candleSpacing;

      const openY = toClipY(candle.open);
      const highY = toClipY(candle.high);
      const lowY = toClipY(candle.low);
      const closeY = toClipY(candle.close);

      const isBullish = candle.close >= candle.open;
      const color = isBullish ? this.hexToRgba(this.config.colors.bullish) : this.hexToRgba(this.config.colors.bearish);

      const bodyTop = Math.max(openY, closeY);
      const bodyBottom = Math.min(openY, closeY);
      const bodyHeight = bodyTop - bodyBottom;

      if (bodyHeight > 0) {
        const baseVertexIndex = bodyVertices.length / 2;
        bodyVertices.push(
          centerX - halfWidth, bodyBottom,
          centerX + halfWidth, bodyBottom,
          centerX + halfWidth, bodyTop,
          centerX - halfWidth, bodyTop
        );

        for (let i = 0; i < 4; i++) {
          bodyColors.push(...color);
        }

        bodyIndices.push(
          baseVertexIndex, baseVertexIndex + 1, baseVertexIndex + 2,
          baseVertexIndex, baseVertexIndex + 2, baseVertexIndex + 3
        );
      }

      wickVertices.push(centerX, lowY, centerX, highY);
      wickColors.push(...color, ...color);
    });

    return {
      bodyVertices: new Float32Array(bodyVertices),
      bodyColors: new Float32Array(bodyColors),
      bodyIndices: new Uint16Array(bodyIndices),
      wickVertices: new Float32Array(wickVertices),
      wickColors: new Float32Array(wickColors),
      halfWidth,
      candleSpacing,
      gap,
      priceMin: adjustedMin,
      priceMax: adjustedMax,
      priceRange
    };
  }

  private getOrCreateBuffers(key: string, includeIndex: boolean): ChartBuffers {
    let buffers = this.buffers.get(key);
    if (!buffers) {
      buffers = {
        position: this.gl.createBuffer(),
        color: this.gl.createBuffer(),
        index: includeIndex ? this.gl.createBuffer() : null
      };
      this.buffers.set(key, buffers);
    } else if (includeIndex && !buffers.index) {
      buffers.index = this.gl.createBuffer();
    }

    if (!buffers.position || !buffers.color || (includeIndex && !buffers.index)) {
      throw new Error(`ChartManager: Unable to allocate buffers for key "${key}"`);
    }

    return buffers;
  }

  private drawTriangles(
    program: ShaderProgram,
    vertices: Float32Array,
    colors: Float32Array,
    indices: Uint16Array | undefined,
    bufferKey: string
  ): void {
    if (vertices.length === 0) return;

    const positionLocation = program.attributes.position;
    const colorLocation = program.attributes.color;

    const buffers = this.getOrCreateBuffers(bufferKey, Boolean(indices && indices.length));

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.position);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.color);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);

    if (colorLocation >= 0) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    }

    if (indices && indices.length) {
      if (!buffers.index) {
        throw new Error(`ChartManager: Missing index buffer for key "${bufferKey}"`);
      }
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffers.index);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.DYNAMIC_DRAW);
      this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
    } else {
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length / 2);
    }

    if (positionLocation >= 0) {
      this.gl.disableVertexAttribArray(positionLocation);
    }
    if (colorLocation >= 0) {
      this.gl.disableVertexAttribArray(colorLocation);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  private drawLines(
    program: ShaderProgram,
    vertices: Float32Array,
    colors: Float32Array,
    bufferKey: string
  ): void {
    if (vertices.length === 0) return;

    const positionLocation = program.attributes.position;
    const colorLocation = program.attributes.color;

    const buffers = this.getOrCreateBuffers(bufferKey, false);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.position);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.color);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);

    if (colorLocation >= 0) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.drawArrays(this.gl.LINES, 0, vertices.length / 2);

    if (positionLocation >= 0) {
      this.gl.disableVertexAttribArray(positionLocation);
    }
    if (colorLocation >= 0) {
      this.gl.disableVertexAttribArray(colorLocation);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  private drawLineStrip(
    program: ShaderProgram,
    vertices: Float32Array,
    colors: Float32Array,
    bufferKey: string
  ): void {
    if (vertices.length === 0) return;

    const positionLocation = program.attributes.position;
    const colorLocation = program.attributes.color;

    const buffers = this.getOrCreateBuffers(bufferKey, false);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.position);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);

    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.color);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);

    if (colorLocation >= 0) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.drawArrays(this.gl.LINE_STRIP, 0, vertices.length / 2);

    if (positionLocation >= 0) {
      this.gl.disableVertexAttribArray(positionLocation);
    }
    if (colorLocation >= 0) {
      this.gl.disableVertexAttribArray(colorLocation);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }


  private renderDrawings(
    program: ShaderProgram,
    drawings: DrawingShape[],
    metrics: CandlestickGeometry
  ): void {
    if (!drawings.length) {
      return;
    }

    const applyX = (originalX: number) =>
      this.viewState.scaleX * originalX + this.viewState.translateX;
    const toClipY = (price: number) => this.priceToClipY(price, metrics.priceMin, metrics.priceRange);

    const trendlineVertices: number[] = [];
    const trendlineColors: number[] = [];
    const horizontalVertices: number[] = [];
    const horizontalColors: number[] = [];
    const rectangleFillVertices: number[] = [];
    const rectangleFillColors: number[] = [];
    const rectangleFillIndices: number[] = [];
    const rectangleBorderVertices: number[] = [];
    const rectangleBorderColors: number[] = [];

    const trendStyle = this.config.drawings.trendline;
    const horizontalStyle = this.config.drawings.horizontal;
    const rectangleStyle = this.config.drawings.rectangle;

    const toRgba = (hex: string, alphaMultiplier = 1) => {
      const color = this.hexToRgba(hex);
      color[3] = Math.min(1, Math.max(0, color[3] * alphaMultiplier));
      return color;
    };

    const lineColor = (hex: string, isDraft?: boolean) =>
      toRgba(hex, isDraft ? 0.45 : 1);

    const fillColor = (hex: string, opacity: number, isDraft?: boolean) =>
      toRgba(hex, (isDraft ? 0.45 : 1) * opacity);

    let rectangleCount = 0;

    drawings.forEach((shape) => {
      switch (shape.type) {
        case 'trendline': {
          const startX = applyX(shape.start.originalX);
          const startY = toClipY(shape.start.price);
          const endX = applyX(shape.end.originalX);
          const endY = toClipY(shape.end.price);
          const color = lineColor(shape.color ?? trendStyle.color, shape.isDraft);

          trendlineVertices.push(startX, startY, endX, endY);
          trendlineColors.push(...color, ...color);
          break;
        }
        case 'horizontal': {
          const y = toClipY(shape.price);
          const leftX = applyX(-1);
          const rightX = applyX(1);
          const color = lineColor(shape.color ?? horizontalStyle.color, shape.isDraft);

          horizontalVertices.push(leftX, y, rightX, y);
          horizontalColors.push(...color, ...color);
          break;
        }
        case 'rectangle': {
          const startX = applyX(shape.start.originalX);
          const startY = toClipY(shape.start.price);
          const endX = applyX(shape.end.originalX);
          const endY = toClipY(shape.end.price);

          const xMin = Math.min(startX, endX);
          const xMax = Math.max(startX, endX);
          const yMin = Math.min(startY, endY);
          const yMax = Math.max(startY, endY);

          const fill = fillColor(
            shape.fillColor ?? rectangleStyle.fillColor,
            shape.fillOpacity ?? rectangleStyle.fillOpacity,
            shape.isDraft
          );
          const border = lineColor(shape.borderColor ?? rectangleStyle.borderColor, shape.isDraft);

          const base = rectangleCount * 4;
          rectangleCount += 1;

          rectangleFillVertices.push(
            xMin, yMin,
            xMax, yMin,
            xMax, yMax,
            xMin, yMax
          );
          for (let i = 0; i < 4; i++) {
            rectangleFillColors.push(...fill);
          }
          rectangleFillIndices.push(
            base, base + 1, base + 2,
            base, base + 2, base + 3
          );

          rectangleBorderVertices.push(
            xMin, yMin, xMax, yMin,
            xMax, yMin, xMax, yMax,
            xMax, yMax, xMin, yMax,
            xMin, yMax, xMin, yMin
          );
          for (let i = 0; i < 8; i++) {
            rectangleBorderColors.push(...border);
          }
          break;
        }
      }
    });

    if (rectangleFillVertices.length) {
      this.drawTriangles(
        program,
        new Float32Array(rectangleFillVertices),
        new Float32Array(rectangleFillColors),
        new Uint16Array(rectangleFillIndices),
        'drawings::rectFill'
      );
    }

    if (rectangleBorderVertices.length) {
      this.drawLines(
        program,
        new Float32Array(rectangleBorderVertices),
        new Float32Array(rectangleBorderColors),
        'drawings::rectBorder'
      );
    }

    if (trendlineVertices.length) {
      this.drawLines(
        program,
        new Float32Array(trendlineVertices),
        new Float32Array(trendlineColors),
        'drawings::trendline'
      );
    }

    if (horizontalVertices.length) {
      this.drawLines(
        program,
        new Float32Array(horizontalVertices),
        new Float32Array(horizontalColors),
        'drawings::horizontal'
      );
    }
  }

  private buildLineSeries(
    values: Array<number | null>,
    candleSpacing: number,
    colorHex: string,
    normalizePrice: (price: number) => number
  ): { vertices: Float32Array; colors: Float32Array } {
    const vertices: number[] = [];
    const colors: number[] = [];
    const color = this.hexToRgba(colorHex);

    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (value == null || !Number.isFinite(value)) {
        continue;
      }

      const x = -1 + (index + 0.5) * candleSpacing;
      const y = normalizePrice(value);
      vertices.push(x, y);
      colors.push(...color);
    }

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors)
    };
  }

  private priceToClipY(price: number, priceMin: number, priceRange: number): number {
    if (!Number.isFinite(price)) {
      return -1;
    }
    const normalized = (price - priceMin) / (priceRange || 1);
    return -1 + Math.max(0, Math.min(1, normalized)) * 2;
  }

  private calculateSMA(data: CandlestickData[], period: number): Array<number | null> {
    if (!data.length || period <= 1) {
      return data.map((candle) => {
        const value = candle.close ?? candle.open ?? candle.high ?? candle.low ?? null;
        return value;
      });
    }

    // Tentar usar WebAssembly se disponível e totalmente inicializado
    if (this.wasmInitialized && isWasmReady()) {
      try {
        // Extrair preços de fechamento
        const prices = data.map((candle) => 
          candle.close ?? candle.open ?? candle.high ?? candle.low ?? 0
        );

        // Calcular usando WebAssembly
        const wasmResult = wasmCalculateSMA(prices, period);
        
        // Converter Float64Array para Array<number | null>
        const result: Array<number | null> = [];
        for (let i = 0; i < wasmResult.length; i++) {
          const value = wasmResult[i];
          result.push(isNaN(value) ? null : value);
        }
        return result;
      } catch (error) {
        this.logWasmError('SMA', error);
        // Desabilitar WebAssembly para este indicador se falhar repetidamente
        if (this.wasmErrorLogged.size > 3) {
          this.wasmInitialized = false;
        }
        // Fallback para JavaScript
      }
    }

    // Fallback para JavaScript
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

  private calculateEMA(data: CandlestickData[], period: number): Array<number | null> {
    if (!data.length) {
      return new Array(data.length).fill(null);
    }

    // Tentar usar WebAssembly se disponível
    if (this.wasmInitialized && isWasmReady()) {
      try {
        // Extrair preços de fechamento
        const prices = data.map((candle) => 
          candle.close ?? candle.open ?? candle.high ?? candle.low ?? 0
        );

        // Calcular usando WebAssembly
        const wasmResult = wasmCalculateEMA(prices, period);
        
        // Converter Float64Array para Array<number | null>
        const result: Array<number | null> = [];
        for (let i = 0; i < wasmResult.length; i++) {
          const value = wasmResult[i];
          result.push(isNaN(value) ? null : value);
        }
        return result;
      } catch (error) {
        this.logWasmError('EMA', error);
        // Fallback para JavaScript
      }
    }

    // Fallback para JavaScript
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

  private calculateBollinger(
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
    if (this.wasmInitialized && isWasmReady()) {
      try {
        // Extrair preços de fechamento
        const prices = data.map((candle) => 
          candle.close ?? candle.open ?? candle.high ?? candle.low ?? 0
        );

        // Calcular usando WebAssembly
        const wasmResult = wasmCalculateBollingerBands(prices, period, stdDevMultiplier);
        
        // Converter Float64Array para Array<number | null>
        for (let i = 0; i < data.length; i++) {
          const upperValue = wasmResult.upper[i];
          const lowerValue = wasmResult.lower[i];
          const middleValue = wasmResult.middle[i];
          
          upper[i] = isNaN(upperValue) ? null : upperValue;
          lower[i] = isNaN(lowerValue) ? null : lowerValue;
          middle[i] = isNaN(middleValue) ? null : middleValue;
        }
        return { upper, lower, middle };
      } catch (error) {
        this.logWasmError('Bollinger Bands', error);
        // Fallback para JavaScript
      }
    }

    // Fallback para JavaScript
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

  private hexToRgba(hex: string): number[] {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return [1, 1, 1, 1];

    return [
      parseInt(match[1], 16) / 255,
      parseInt(match[2], 16) / 255,
      parseInt(match[3], 16) / 255,
      1
    ];
  }

  public computeVisibleRange(data: CandlestickData[]): VisibleRange | null {
    if (!data.length) {
      return null;
    }

    const { scaleX, translateX } = this.viewState;
    const metrics = this.candlestickMetrics;

    const candleSpacing = metrics?.candleSpacing ?? (data.length > 0 ? 2 / data.length : 0);
    const halfWidth = metrics?.halfWidth ?? (candleSpacing * 0.35);

    let minIndex = data.length - 1;
    let maxIndex = 0;

    data.forEach((_, index) => {
      const centerX = -1 + (index + 0.5) * candleSpacing;
      const xLeft = centerX - halfWidth;
      const xRight = centerX + halfWidth;

      const transformedLeft = scaleX * xLeft + translateX;
      const transformedRight = scaleX * xRight + translateX;

      const isVisible = transformedRight >= -1 && transformedLeft <= 1;
      if (!isVisible) {
        return;
      }

      if (index < minIndex) {
        minIndex = index;
      }
      if (index > maxIndex) {
        maxIndex = index;
      }
    });

    if (minIndex > maxIndex) {
      minIndex = 0;
      maxIndex = data.length - 1;
    }

    const visibleSlice = data.slice(minIndex, maxIndex + 1);
    const priceMin = Math.min(...visibleSlice.map((candle) => candle.low));
    const priceMax = Math.max(...visibleSlice.map((candle) => candle.high));

    // Usar timestamp do primeiro e último candle visível
    const timeStart = visibleSlice[0]?.timestamp ?? minIndex;
    const timeEnd = visibleSlice[visibleSlice.length - 1]?.timestamp ?? maxIndex;

    return {
      timeStart,
      timeEnd,
      priceMin,
      priceMax,
      startIndex: minIndex,
      endIndex: maxIndex,
      candleCount: visibleSlice.length
    };
  }

  // Renderizar linha
  public renderLine(data: LineData[]): void {
    const program = this.shaderPrograms.get('line');
    if (!program) return;

    this.gl.useProgram(program.program);
    
    // TODO: Implementar renderização de linha
    // Log removido para evitar spam no console
  }

  // Renderizar área
  public renderArea(data: AreaData[]): void {
    const program = this.shaderPrograms.get('area');
    if (!program) return;

    this.gl.useProgram(program.program);
    
    // TODO: Implementar renderização de área
    // Log removido para evitar spam no console
  }

  // Renderizar candlestick
  public renderCandlestick(data: CandlestickData[], drawings: DrawingShape[] = []): void {
    const program = this.shaderPrograms.get('candlestick');
    if (!program || !data.length) return;

    // Logs removidos para evitar spam no console (executado a cada frame ~60 FPS)
    // Para debug, use: if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) { ... }

    this.gl.useProgram(program.program);

    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    const geometry = this.generateCandlestickGeometry(data);
    this.setupTransformMatrix(program);

    this.candlestickMetrics = {
      halfWidth: geometry.halfWidth,
      candleSpacing: geometry.candleSpacing,
      gap: geometry.gap,
      priceMin: geometry.priceMin,
      priceMax: geometry.priceMax,
      priceRange: geometry.priceRange
    };
    this.drawTriangles(
      program,
      geometry.bodyVertices,
      geometry.bodyColors,
      geometry.bodyIndices,
      'candlestick::body'
    );
    this.drawLines(
      program,
      geometry.wickVertices,
      geometry.wickColors,
      'candlestick::wick'
    );
    this.renderDrawings(program, drawings, geometry);
  }

  // Atualizar configuração
  public updateConfig(config: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Limpar recursos
  public destroy(): void {
    this.shaderPrograms.forEach((program) => {
      this.gl.deleteProgram(program.program);
    });
    this.shaderPrograms.clear();
    
    this.buffers.forEach((buffer) => {
      if (buffer.position) this.gl.deleteBuffer(buffer.position);
      if (buffer.color) this.gl.deleteBuffer(buffer.color);
      if (buffer.index) this.gl.deleteBuffer(buffer.index);
    });
    this.buffers.clear();
  }
}
