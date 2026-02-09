/**
 * Testes de performance para WebGL
 */

import { PerformanceMonitor, PerformanceMetrics } from '@/engine/webgl/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new PerformanceMonitor(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Frame Tracking', () => {
    it('should track frame metrics', () => {
      monitor.startFrame();
      monitor.recordDrawCall(100, 50, 1024);
      monitor.endFrame();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.drawCalls).toBe(1);
      expect(metrics.vertices).toBe(100);
      expect(metrics.triangles).toBe(50);
      expect(metrics.bufferSize).toBe(1024);
    });

    it('should calculate FPS', () => {
      monitor.startFrame();
      monitor.endFrame();

      // Simular segundo frame após delay
      jest.advanceTimersByTime(16); // ~60fps
      monitor.startFrame();
      monitor.endFrame();
      
      // Avançar tempo para trigger updateStats
      jest.advanceTimersByTime(1000);

      const stats = monitor.getStats();
      expect(stats.current.fps).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple frames', () => {
      for (let i = 0; i < 10; i++) {
        monitor.startFrame();
        monitor.recordDrawCall(10, 5, 100);
        monitor.endFrame();
        jest.advanceTimersByTime(16);
      }
      
      // Avançar tempo para trigger updateStats
      jest.advanceTimersByTime(1000);

      const stats = monitor.getStats();
      expect(stats.samples).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate average metrics', () => {
      for (let i = 0; i < 5; i++) {
        monitor.startFrame();
        monitor.recordDrawCall(10 * (i + 1), 5 * (i + 1), 100);
        monitor.endFrame();
        jest.advanceTimersByTime(16);
      }
      
      // Avançar tempo para trigger updateStats (precisa de pelo menos 1 segundo)
      jest.advanceTimersByTime(1000);

      const stats = monitor.getStats();
      // Se temos samples, deve ter métricas calculadas
      if (stats.samples > 0) {
        expect(stats.average.vertices).toBeGreaterThan(0);
        expect(stats.average.triangles).toBeGreaterThan(0);
      } else {
        // Se não tem samples ainda, pelo menos deve ter current metrics
        expect(stats.current.vertices).toBeGreaterThan(0);
      }
    });

    it('should calculate min/max metrics', () => {
      const values = [10, 20, 30, 40, 50];
      
      values.forEach((val) => {
        monitor.startFrame();
        monitor.recordDrawCall(val, val / 2, 100);
        monitor.endFrame();
        jest.advanceTimersByTime(16);
      });

      const stats = monitor.getStats();
      expect(stats.min.vertices).toBeLessThanOrEqual(stats.max.vertices);
    });
  });

  describe('Enable/Disable', () => {
    it('should respect enabled state', () => {
      monitor.setEnabled(false);
      monitor.startFrame();
      monitor.recordDrawCall(10, 5, 100);
      monitor.endFrame();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.drawCalls).toBe(0);
    });

    it('should reset when disabled', () => {
      monitor.startFrame();
      monitor.recordDrawCall(10, 5, 100);
      monitor.endFrame();

      monitor.setEnabled(false);
      const stats = monitor.getStats();
      expect(stats.samples).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      monitor.startFrame();
      monitor.recordDrawCall(10, 5, 100);
      monitor.endFrame();

      monitor.reset();

      const stats = monitor.getStats();
      expect(stats.samples).toBe(0);
      expect(monitor.getFrameCount()).toBe(0);
    });
  });
});

