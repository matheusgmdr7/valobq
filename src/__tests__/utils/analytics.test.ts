/**
 * Testes para sistema de analytics
 */

import { analytics, initAnalytics, trackEvent, trackPageView, trackChartEvent } from '@/utils/analytics';

describe('Analytics System', () => {
  beforeEach(() => {
    analytics.clearStoredEvents();
  });

  describe('Event Tracking', () => {
    it('should track events', () => {
      trackEvent({
        name: 'test_event',
        properties: { key: 'value' },
      });

      const events = analytics.getStoredEvents();
      expect(events.length).toBe(1);
      expect(events[0].name).toBe('test_event');
      expect(events[0].properties).toEqual({ key: 'value' });
    });

    it('should include session ID', () => {
      trackEvent({ name: 'test_event' });

      const events = analytics.getStoredEvents();
      expect(events[0].sessionId).toBeDefined();
    });

    it('should include timestamp', () => {
      const before = Date.now();
      trackEvent({ name: 'test_event' });
      const after = Date.now();

      const events = analytics.getStoredEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should limit stored events', () => {
      for (let i = 0; i < 600; i++) {
        trackEvent({ name: `event_${i}` });
      }

      const events = analytics.getStoredEvents();
      expect(events.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Page View Tracking', () => {
    it('should track page views', () => {
      trackPageView('/dashboard/trading', { referrer: '/dashboard' });

      const events = analytics.getStoredEvents();
      expect(events.length).toBe(1);
      expect(events[0].name).toBe('page_view');
      expect(events[0].properties?.path).toBe('/dashboard/trading');
    });
  });

  describe('Chart Event Tracking', () => {
    it('should track chart events', () => {
      trackChartEvent('indicator_added', {
        indicator: 'SMA',
        period: 20,
      });

      const events = analytics.getStoredEvents();
      expect(events.length).toBe(1);
      expect(events[0].name).toBe('chart_event');
      expect(events[0].properties?.event_type).toBe('indicator_added');
      expect(events[0].properties?.indicator).toBe('SMA');
    });
  });

  describe('Enable/Disable', () => {
    it('should respect enabled state', () => {
      analytics.setEnabled(false);
      trackEvent({ name: 'test_event' });

      const events = analytics.getStoredEvents();
      expect(events.length).toBe(0);

      analytics.setEnabled(true);
      trackEvent({ name: 'test_event' });

      const newEvents = analytics.getStoredEvents();
      expect(newEvents.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should provide event statistics', () => {
      trackEvent({ name: 'event1' });
      trackEvent({ name: 'event2' });
      trackEvent({ name: 'event1' });

      const stats = analytics.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType['event1']).toBe(2);
      expect(stats.eventsByType['event2']).toBe(1);
    });
  });

  describe('Initialization', () => {
    it('should initialize analytics', () => {
      expect(() => {
        initAnalytics(true);
      }).not.toThrow();
      expect(analytics.isEnabled()).toBe(true);
    });

    it('should initialize with disabled state', () => {
      initAnalytics(false);
      expect(analytics.isEnabled()).toBe(false);
    });
  });
});

