import { ShaderManager } from './ShaderManager';
import { CoordinateSystem } from './CoordinateSystem';
import { ChartManager, ViewState, VisibleRange } from '../charts/ChartManager';
import { CandlestickRenderer } from '../charts/CandlestickRenderer';
import { LineRenderer } from '../charts/LineRenderer';
import { AreaRenderer } from '../charts/AreaRenderer';
import { ChartConfig, CandlestickData, LineData, AreaData, DrawingShape } from '@/types/chart';
import { PerformanceMonitor, PerformanceStats } from './PerformanceMonitor';

export class Renderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private shaderManager: ShaderManager;
  private coordinateSystem: CoordinateSystem | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private chartManager: ChartManager | null = null;
  private candlestickRenderer: CandlestickRenderer | null = null;
  private lineRenderer: LineRenderer | null = null;
  private areaRenderer: AreaRenderer | null = null;
  private chartConfig: ChartConfig;
  private activeChartType: 'candlestick' | 'line' | 'area' | null = null;
  private lastCandlestickData: CandlestickData[] = [];
  private lastLineData: LineData[] = [];
  private lastAreaData: AreaData[] = [];
  private drawingShapes: DrawingShape[] = [];
  private viewHistory: ViewState[] = [];
  private historyPointer = -1;
  private readonly maxHistoryEntries = 50;
  private historyDebounceHandle: number | null = null;
  private readonly historyDebounceDelay = 120;
  private isApplyingHistory = false;
  private readonly minScale = 1;
  private readonly maxScale = 5;
  private performanceMonitor: PerformanceMonitor;
  private performanceEnabled = false;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, canvas: HTMLCanvasElement) {
    this.gl = gl;
    this.canvas = canvas;
    this.shaderManager = new ShaderManager(gl);
    this.chartConfig = this.createDefaultChartConfig();
    this.performanceMonitor = new PerformanceMonitor(this.performanceEnabled);
    this.init();
  }

  private init(): void {
    // Carregar shaders básicos
    const vertexSource = "#version 300 es\n" +
      "in vec2 a_position;\n" +
      "uniform mat3 u_transform;\n" +
      "void main() {\n" +
      "  vec3 position = u_transform * vec3(a_position, 1.0);\n" +
      "  gl_Position = vec4(position.xy, 0.0, 1.0);\n" +
      "}";

    const fragmentSource = "#version 300 es\n" +
      "precision mediump float;\n" +
      "uniform vec4 u_color;\n" +
      "out vec4 fragColor;\n" +
      "void main() {\n" +
      "  fragColor = u_color;\n" +
      "}";

    this.program = this.shaderManager.loadShaders(vertexSource, fragmentSource);
    
    if (this.program) {
      this.coordinateSystem = new CoordinateSystem(this.gl, this.program);
      this.initChartRenderers();
    } else {
      console.error('[Renderer] Error: Shader compilation failed');
    }
  }

  private createDefaultChartConfig(): ChartConfig {
    return {
      width: 800,
      height: 600,
      padding: {
        top: 20,
        right: 20,
        bottom: 40,
        left: 60
      },
      colors: {
        background: '#1a1a1a',
        grid: '#333333',
        text: '#ffffff',
        bullish: '#00ff88',
        bearish: '#ff4444',
        line: '#00aaff',
        area: '#00aaff'
      },
      drawings: {
        trendline: {
          color: '#FBBF24',
          width: 2
        },
        horizontal: {
          color: '#38BDF8',
          width: 2
        },
        rectangle: {
          borderColor: '#F472B6',
          borderWidth: 1.5,
          fillColor: '#F472B6',
          fillOpacity: 0.12
        }
      },
      timeRange: {
        start: Date.now() - 3600000, // 1 hora atrás
        end: Date.now()
      },
      priceRange: {
        min: 1.20,
        max: 1.25
      }
    };
  }

  private initChartRenderers(): void {
    this.chartManager = new ChartManager(this.gl, this.chartConfig);
    this.candlestickRenderer = new CandlestickRenderer(this.gl, this.chartConfig);
    this.lineRenderer = new LineRenderer(this.gl, this.chartConfig);
    this.areaRenderer = new AreaRenderer(this.gl, this.chartConfig);

    this.recordCurrentViewState(true);
  }

  public render(): void {
    if (!this.program || !this.coordinateSystem || !this.canvas) {
      return;
    }

    this.performanceMonitor.startFrame();

    this.gl.useProgram(this.program);
    
    // Configurar viewport
    this.coordinateSystem.setViewport(this.canvas.width, this.canvas.height);
    
    // Limpar tela com cor de fundo
    this.clear([0.1, 0.1, 0.1, 1.0]); // Cinza escuro

    // Desenhar último gráfico solicitado
    switch (this.activeChartType) {
      case 'candlestick':
        if (this.lastCandlestickData.length && this.chartManager) {
          this.chartManager.renderCandlestick(this.lastCandlestickData, this.drawingShapes);
        }
        break;
      case 'line':
        if (this.lastLineData.length && this.chartManager) {
          this.chartManager.renderLine(this.lastLineData);
        }
        break;
      case 'area':
        if (this.lastAreaData.length && this.chartManager) {
          this.chartManager.renderArea(this.lastAreaData);
        }
        break;
      default:
        break;
    }

    this.performanceMonitor.endFrame();
  }

  public clear(color: [number, number, number, number] = [0, 0, 0, 1]): void {
    this.gl.clearColor(color[0], color[1], color[2], color[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  public setColor(r: number, g: number, b: number, a: number = 1.0): void {
    if (this.coordinateSystem) {
      this.coordinateSystem.setColor(r, g, b, a);
    }
  }

  public getProgram(): WebGLProgram | null {
    return this.program;
  }

  public getCoordinateSystem(): CoordinateSystem | null {
    return this.coordinateSystem;
  }

  public isInitialized(): boolean {
    return this.program !== null && this.coordinateSystem !== null;
  }

  // Métodos para renderizar gráficos
  public renderCandlestick(data: CandlestickData[]): void {
    if (!this.chartManager) return;
    // Log removido para evitar spam (chamado a cada frame ~60 FPS)
    this.activeChartType = 'candlestick';
    this.lastCandlestickData = data.slice();
    this.chartManager.renderCandlestick(this.lastCandlestickData, this.drawingShapes);
  }

  public renderLine(data: LineData[]): void {
    if (!this.chartManager || !this.lineRenderer) return;
    this.activeChartType = 'line';
    this.lastLineData = data.slice();
    this.chartManager.renderLine(this.lastLineData);
  }

  public renderArea(data: AreaData[]): void {
    if (!this.chartManager || !this.areaRenderer) return;
    this.activeChartType = 'area';
    this.lastAreaData = data.slice();
    this.chartManager.renderArea(this.lastAreaData);
  }

  public panPixels(deltaX: number): void {
    if (!this.chartManager || !this.canvas || deltaX === 0) return;

    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const deltaClip = (deltaX / width) * 2;
    const view = this.chartManager.getViewState();
    const newTranslate = this.clampTranslate(view.scaleX, view.translateX - deltaClip);

    this.chartManager.updateViewState({ translateX: newTranslate });
    this.scheduleHistorySnapshot();
  }

  public zoomAtPixel(pixelX: number, canvasWidth: number, deltaY: number): void {
    if (!this.chartManager || !this.canvas || canvasWidth <= 0) return;
    if (deltaY === 0) return;

    const clipX = (pixelX / canvasWidth) * 2 - 1;
    const view = this.chartManager.getViewState();

    const zoomAmount = 1 + Math.min(Math.abs(deltaY) * 0.0015, 0.5);
    const scaleFactor = deltaY > 0 ? 1 / zoomAmount : zoomAmount;
    const targetScale = this.clampScale(view.scaleX * scaleFactor);

    const baseX = (clipX - view.translateX) / (view.scaleX || 1);
    const newTranslate = clipX - targetScale * baseX;
    const clampedTranslate = this.clampTranslate(targetScale, newTranslate);

    this.chartManager.updateViewState({
      scaleX: targetScale,
      translateX: clampedTranslate
    });
    this.scheduleHistorySnapshot();
  }

  public zoomToRange(originalLeft: number, originalRight: number): void {
    if (!this.chartManager) return;

    const min = Math.min(originalLeft, originalRight);
    const max = Math.max(originalLeft, originalRight);
    const span = max - min;

    if (span <= 0) {
      return;
    }

    const targetScale = this.clampScale(2 / span);
    const translate = this.clampTranslate(targetScale, -1 - targetScale * min);

    this.chartManager.updateViewState({
      scaleX: targetScale,
      translateX: translate
    });
    this.recordCurrentViewState();
  }

  public centerOnCandle(candleX: number, visibleCandles: number, totalCandles: number): void {
    if (!this.chartManager) return;

    // Calcular scaleX para mostrar aproximadamente visibleCandles candles
    const candleSpacing = 2 / totalCandles;
    const rangeWidth = visibleCandles * candleSpacing;
    let targetScale = this.clampScale(2 / rangeWidth);
    
    // Calcular translateX para centralizar o candle em x' = 0
    // x' = scaleX * x + translateX
    // 0 = scaleX * candleX + translateX
    // translateX = -scaleX * candleX
    let translateX = -targetScale * candleX;
    
    // Verificar se o translateX necessário está dentro dos limites
    const maxTranslate = Math.max(0, targetScale - 1);
    
    // Se o translateX necessário exceder o limite, aumentar o scaleX
    // para que o limite seja maior
    if (Math.abs(translateX) > maxTranslate) {
      // Aumentar scaleX até que o translateX caiba no limite
      // Queremos: |translateX| = scaleX * |candleX| <= maxTranslate = scaleX - 1
      // scaleX * |candleX| <= scaleX - 1
      // scaleX * (|candleX| - 1) <= -1
      // Como candleX está próximo de 1, precisamos de scaleX grande
      // scaleX >= 1 / (1 - |candleX|)
      if (Math.abs(candleX) < 0.9999) {
        const minScale = 1 / (1 - Math.abs(candleX));
        if (minScale > targetScale && minScale <= this.maxScale) {
          targetScale = this.clampScale(minScale);
          translateX = -targetScale * candleX;
        }
      }
    }
    
    // Aplicar clamp final
    translateX = this.clampTranslate(targetScale, translateX);

    this.chartManager.updateViewState({
      scaleX: targetScale,
      translateX: translateX
    });
    this.recordCurrentViewState();
  }

  public getScaleBounds(): { min: number; max: number } {
    return {
      min: this.minScale,
      max: this.maxScale
    };
  }

  public getViewState(): ViewState | null {
    if (!this.chartManager) return null;
    return this.chartManager.getViewState();
  }

  public getVisibleRange(data: CandlestickData[]): VisibleRange | null {
    if (!this.chartManager) return null;
    return this.chartManager.computeVisibleRange(data);
  }

  public updateViewState(viewState: Partial<ViewState>): void {
    if (!this.chartManager) return;
    this.chartManager.updateViewState(viewState);
    this.recordCurrentViewState();
  }

  public resetView(): void {
    if (!this.chartManager) return;
    this.chartManager.updateViewState({
      scaleX: 1,
      scaleY: 1,
      translateX: 0,
      translateY: 0
    });
    this.recordCurrentViewState(true);
  }

  public undoView(): boolean {
    if (!this.chartManager || this.historyPointer <= 0) {
      return false;
    }

    if (this.historyDebounceHandle !== null) {
      window.clearTimeout(this.historyDebounceHandle);
      this.historyDebounceHandle = null;
    }

    this.isApplyingHistory = true;
    this.historyPointer = Math.max(0, this.historyPointer - 1);
    const target = this.viewHistory[this.historyPointer];
    this.chartManager.updateViewState({ ...target });
    this.isApplyingHistory = false;
    return true;
  }

  public canUndoView(): boolean {
    return this.historyPointer > 0;
  }

  private recordCurrentViewState(force: boolean = false): void {
    if (!this.chartManager) return;
    if (this.isApplyingHistory) return;

    const currentView = this.chartManager.getViewState();
    const snapshot: ViewState = { ...currentView };
    const last = this.viewHistory[this.historyPointer];

    if (!force && last && this.areViewStatesSimilar(last, snapshot)) {
      return;
    }

    if (this.historyPointer < this.viewHistory.length - 1) {
      this.viewHistory = this.viewHistory.slice(0, this.historyPointer + 1);
    }

    this.viewHistory.push(snapshot);

    if (this.viewHistory.length > this.maxHistoryEntries) {
      const overflow = this.viewHistory.length - this.maxHistoryEntries;
      this.viewHistory.splice(0, overflow);
      this.historyPointer = this.viewHistory.length - 1;
    } else {
      this.historyPointer = this.viewHistory.length - 1;
    }
  }

  private scheduleHistorySnapshot(): void {
    if (this.isApplyingHistory) return;
    if (this.historyDebounceHandle !== null) {
      window.clearTimeout(this.historyDebounceHandle);
    }

    this.historyDebounceHandle = window.setTimeout(() => {
      this.historyDebounceHandle = null;
      this.recordCurrentViewState();
    }, this.historyDebounceDelay);
  }

  private areViewStatesSimilar(a: ViewState, b: ViewState): boolean {
    const epsilon = 0.0005;
    return (
      Math.abs(a.scaleX - b.scaleX) < epsilon &&
      Math.abs(a.scaleY - b.scaleY) < epsilon &&
      Math.abs(a.translateX - b.translateX) < epsilon &&
      Math.abs(a.translateY - b.translateY) < epsilon
    );
  }

  private clampScale(scale: number): number {
    if (Number.isNaN(scale) || !Number.isFinite(scale)) {
      return this.minScale;
    }
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  }

  private clampTranslate(scale: number, translate: number): number {
    const maxTranslate = Math.max(0, scale - 1);
    return Math.min(maxTranslate, Math.max(-maxTranslate, translate));
  }

  // Atualizar configuração do gráfico
  public updateChartConfig(config: Partial<ChartConfig>): void {
    this.chartConfig = { ...this.chartConfig, ...config };
    
    if (this.chartManager) {
      this.chartManager.updateConfig(this.chartConfig);
    }
    if (this.candlestickRenderer) {
      this.candlestickRenderer.updateConfig(this.chartConfig);
    }
    if (this.lineRenderer) {
      this.lineRenderer.updateConfig(this.chartConfig);
    }
    if (this.areaRenderer) {
      this.areaRenderer.updateConfig(this.chartConfig);
    }
  }

  public getChartConfig(): ChartConfig {
    return this.chartConfig;
  }

  public setDrawingShapes(shapes: DrawingShape[]): void {
    this.drawingShapes = shapes.slice();
  }

  public destroy(): void {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    this.coordinateSystem = null;
    
    if (this.chartManager) {
      this.chartManager.destroy();
      this.chartManager = null;
    }
    this.candlestickRenderer = null;
    this.lineRenderer = null;
    this.areaRenderer = null;
    this.viewHistory = [];
    this.historyPointer = -1;
    if (this.historyDebounceHandle !== null) {
      window.clearTimeout(this.historyDebounceHandle);
      this.historyDebounceHandle = null;
    }
  }

  // Performance monitoring methods
  public enablePerformanceMonitoring(enabled: boolean): void {
    this.performanceEnabled = enabled;
    this.performanceMonitor.setEnabled(enabled);
  }

  public getPerformanceStats(): PerformanceStats {
    return this.performanceMonitor.getStats();
  }

  public getPerformanceMetrics() {
    return this.performanceMonitor.getCurrentMetrics();
  }

  public resetPerformanceStats(): void {
    this.performanceMonitor.reset();
  }
}
