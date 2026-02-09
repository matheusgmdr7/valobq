import { recordMetric } from '@/utils/monitoring';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // ms
  drawCalls: number;
  vertices: number;
  triangles: number;
  bufferSize: number; // bytes
  timestamp: number;
}

export interface PerformanceStats {
  current: PerformanceMetrics;
  average: PerformanceMetrics;
  min: PerformanceMetrics;
  max: PerformanceMetrics;
  samples: number;
}

export class PerformanceMonitor {
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private drawCallsHistory: number[] = [];
  private verticesHistory: number[] = [];
  private trianglesHistory: number[] = [];
  private bufferSizeHistory: number[] = [];
  private readonly maxHistorySize = 60; // 1 segundo a 60fps
  private readonly updateInterval = 1000; // Atualizar estatísticas a cada 1s
  private lastUpdateTime = 0;
  private currentMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    vertices: 0,
    triangles: 0,
    bufferSize: 0,
    timestamp: 0
  };
  private stats: PerformanceStats = {
    current: this.currentMetrics,
    average: this.currentMetrics,
    min: this.currentMetrics,
    max: this.currentMetrics,
    samples: 0
  };
  private enabled = false;
  private frameStartTime = 0;
  private currentFrameDrawCalls = 0;
  private currentFrameVertices = 0;
  private currentFrameTriangles = 0;
  private currentFrameBufferSize = 0;

  constructor(enabled = false) {
    this.enabled = enabled;
    this.lastFrameTime = performance.now();
    this.lastUpdateTime = performance.now();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public startFrame(): void {
    if (!this.enabled) return;
    this.frameStartTime = performance.now();
    this.currentFrameDrawCalls = 0;
    this.currentFrameVertices = 0;
    this.currentFrameTriangles = 0;
    this.currentFrameBufferSize = 0;
  }

  public endFrame(): void {
    if (!this.enabled) return;

    const now = performance.now();
    const frameTime = now - this.frameStartTime;
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Calcular FPS
    const fps = deltaTime > 0 ? 1000 / deltaTime : 0;

    // Atualizar métricas atuais
    this.currentMetrics = {
      fps,
      frameTime,
      drawCalls: this.currentFrameDrawCalls,
      vertices: this.currentFrameVertices,
      triangles: this.currentFrameTriangles,
      bufferSize: this.currentFrameBufferSize,
      timestamp: now
    };

    // Adicionar ao histórico
    this.fpsHistory.push(fps);
    this.frameTimeHistory.push(frameTime);
    this.drawCallsHistory.push(this.currentFrameDrawCalls);
    this.verticesHistory.push(this.currentFrameVertices);
    this.trianglesHistory.push(this.currentFrameTriangles);
    this.bufferSizeHistory.push(this.currentFrameBufferSize);

    // Limitar tamanho do histórico
    if (this.fpsHistory.length > this.maxHistorySize) {
      this.fpsHistory.shift();
      this.frameTimeHistory.shift();
      this.drawCallsHistory.shift();
      this.verticesHistory.shift();
      this.trianglesHistory.shift();
      this.bufferSizeHistory.shift();
    }

    // Atualizar estatísticas periodicamente
    if (now - this.lastUpdateTime >= this.updateInterval) {
      this.updateStats();
      
      // Enviar métricas para sistema de monitoramento
      if (this.stats.samples > 0) {
        recordMetric({
          name: 'chart.fps',
          value: this.stats.average.fps,
          unit: 'fps',
          timestamp: now,
          tags: { type: 'average' }
        });
        
        recordMetric({
          name: 'chart.frameTime',
          value: this.stats.average.frameTime,
          unit: 'ms',
          timestamp: now,
          tags: { type: 'average' }
        });
        
        // Alertar se FPS muito baixo
        if (this.stats.average.fps < 30) {
          recordMetric({
            name: 'chart.performance.warning',
            value: this.stats.average.fps,
            unit: 'fps',
            timestamp: now,
            tags: { level: 'warning', threshold: '30' }
          });
        }
      }
      
      this.lastUpdateTime = now;
    }

    this.frameCount++;
  }

  public recordDrawCall(vertices: number, triangles: number, bufferSize: number = 0): void {
    if (!this.enabled) return;
    this.currentFrameDrawCalls++;
    this.currentFrameVertices += vertices;
    this.currentFrameTriangles += triangles;
    this.currentFrameBufferSize += bufferSize;
  }

  private updateStats(): void {
    if (this.fpsHistory.length === 0) return;

    const calculateAverage = (arr: number[]) =>
      arr.reduce((sum, val) => sum + val, 0) / arr.length;

    const calculateMin = (arr: number[]) => Math.min(...arr);
    const calculateMax = (arr: number[]) => Math.max(...arr);

    this.stats = {
      current: { ...this.currentMetrics },
      average: {
        fps: calculateAverage(this.fpsHistory),
        frameTime: calculateAverage(this.frameTimeHistory),
        drawCalls: calculateAverage(this.drawCallsHistory),
        vertices: calculateAverage(this.verticesHistory),
        triangles: calculateAverage(this.trianglesHistory),
        bufferSize: calculateAverage(this.bufferSizeHistory),
        timestamp: performance.now()
      },
      min: {
        fps: calculateMin(this.fpsHistory),
        frameTime: calculateMin(this.frameTimeHistory),
        drawCalls: calculateMin(this.drawCallsHistory),
        vertices: calculateMin(this.verticesHistory),
        triangles: calculateMin(this.trianglesHistory),
        bufferSize: calculateMin(this.bufferSizeHistory),
        timestamp: performance.now()
      },
      max: {
        fps: calculateMax(this.fpsHistory),
        frameTime: calculateMax(this.frameTimeHistory),
        drawCalls: calculateMax(this.drawCallsHistory),
        vertices: calculateMax(this.verticesHistory),
        triangles: calculateMax(this.trianglesHistory),
        bufferSize: calculateMax(this.bufferSizeHistory),
        timestamp: performance.now()
      },
      samples: this.fpsHistory.length
    };
  }

  public getStats(): PerformanceStats {
    return { ...this.stats };
  }

  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  public reset(): void {
    this.frameCount = 0;
    this.fpsHistory = [];
    this.frameTimeHistory = [];
    this.drawCallsHistory = [];
    this.verticesHistory = [];
    this.trianglesHistory = [];
    this.bufferSizeHistory = [];
    this.currentMetrics = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      vertices: 0,
      triangles: 0,
      bufferSize: 0,
      timestamp: 0
    };
    this.stats = {
      current: this.currentMetrics,
      average: this.currentMetrics,
      min: this.currentMetrics,
      max: this.currentMetrics,
      samples: 0
    };
  }

  public getFrameCount(): number {
    return this.frameCount;
  }
}

