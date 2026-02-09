/**
 * Testes para sistema de monitoramento
 */

import { monitoring, initMonitoring, captureError, captureMessage, recordMetric } from '@/utils/monitoring';

describe('Monitoring System', () => {
  beforeEach(() => {
    monitoring.clearStoredErrors();
    monitoring.clearStoredMetrics();
  });

  describe('Error Tracking', () => {
    it('should capture errors', () => {
      const error = new Error('Test error');
      captureError(error, { userId: 'test123' });

      const errors = monitoring.getStoredErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].error.message).toBe('Test error');
      expect(errors[0].context.userId).toBe('test123');
    });

    it('should store error context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        action: 'trade',
        symbol: 'EURUSD',
      };

      captureError(error, context);

      const errors = monitoring.getStoredErrors();
      expect(errors[0].context).toMatchObject(context);
    });

    it('should limit stored errors', () => {
      for (let i = 0; i < 150; i++) {
        captureError(new Error(`Error ${i}`));
      }

      const errors = monitoring.getStoredErrors();
      expect(errors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Message Tracking', () => {
    it('should capture info messages', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      captureMessage('Test message', 'info', { key: 'value' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        expect.objectContaining({ key: 'value' })
      );
      
      consoleSpy.mockRestore();
    });

    it('should capture warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      captureMessage('Warning message', 'warning');
      
      // Pode usar console.warn ou console.log como fallback
      // Verificar que pelo menos um foi chamado
      const wasCalled = consoleSpy.mock.calls.length > 0 || consoleLogSpy.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
      
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should capture error messages', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      captureMessage('Error message', 'error');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Metrics', () => {
    it('should record metrics', () => {
      recordMetric({
        name: 'test.metric',
        value: 100,
        unit: 'ms',
        timestamp: Date.now(),
      });

      const metrics = monitoring.getStoredMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0].name).toBe('test.metric');
      expect(metrics[0].value).toBe(100);
    });

    it('should limit stored metrics', () => {
      for (let i = 0; i < 1500; i++) {
        recordMetric({
          name: 'test.metric',
          value: i,
          unit: 'ms',
        });
      }

      const metrics = monitoring.getStoredMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });

    it('should store metric tags', () => {
      recordMetric({
        name: 'test.metric',
        value: 50,
        unit: 'fps',
        tags: { type: 'chart', indicator: 'SMA' },
      });

      const metrics = monitoring.getStoredMetrics();
      expect(metrics[0].tags).toEqual({ type: 'chart', indicator: 'SMA' });
    });
  });

  describe('Statistics', () => {
    it('should provide error statistics', () => {
      captureError(new Error('Error 1'));
      captureError(new Error('Error 2'));

      const stats = monitoring.getStats();
      expect(stats.errorCount).toBe(2);
    });

    it('should provide metric statistics', () => {
      recordMetric({ name: 'metric1', value: 10, unit: 'ms' });
      recordMetric({ name: 'metric2', value: 20, unit: 'ms' });

      const stats = monitoring.getStats();
      expect(stats.metricCount).toBe(2);
    });
  });

  describe('Initialization', () => {
    it('should initialize without Sentry DSN', () => {
      expect(() => {
        initMonitoring();
      }).not.toThrow();
    });

    it('should initialize with Sentry DSN', () => {
      expect(() => {
        initMonitoring('https://test@sentry.io/123');
      }).not.toThrow();
    });
  });
});

