/**
 * Sistema de Analytics Básico
 * 
 * Tracking de eventos e métricas de uso
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
}

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private sessionId: string;
  private maxStoredEvents = 500;
  private enabled = true;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * Gera ID de sessão
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Habilita/desabilita analytics
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Verifica se está habilitado
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Registra evento
   */
  public track(event: AnalyticsEvent): void {
    if (!this.enabled) {
      return;
    }

    const eventData: AnalyticsEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      sessionId: this.sessionId,
    };

    this.events.push(eventData);

    // Limitar tamanho
    if (this.events.length > this.maxStoredEvents) {
      this.events.shift();
    }

    // Enviar para servidor (se configurado)
    this.sendEventToServer(eventData).catch(() => {
      // Falha silenciosa
    });

    // Analytics event tracked
  }

  /**
   * Envia evento para servidor
   */
  private async sendEventToServer(event: AnalyticsEvent): Promise<void> {
    // Implementar endpoint de analytics se necessário
    // Por enquanto, apenas armazena localmente
  }

  /**
   * Track de página view
   */
  public pageView(path: string, properties?: Record<string, any>): void {
    this.track({
      name: 'page_view',
      properties: {
        path,
        ...properties,
      },
    });
  }

  /**
   * Track de ação do usuário
   */
  public userAction(action: string, properties?: Record<string, any>): void {
    this.track({
      name: 'user_action',
      properties: {
        action,
        ...properties,
      },
    });
  }

  /**
   * Track de evento de trading
   */
  public tradingEvent(eventType: string, properties?: Record<string, any>): void {
    this.track({
      name: 'trading_event',
      properties: {
        event_type: eventType,
        ...properties,
      },
    });
  }

  /**
   * Track de evento de gráfico
   */
  public chartEvent(eventType: string, properties?: Record<string, any>): void {
    this.track({
      name: 'chart_event',
      properties: {
        event_type: eventType,
        ...properties,
      },
    });
  }

  /**
   * Obtém eventos armazenados
   */
  public getStoredEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Limpa eventos armazenados
   */
  public clearStoredEvents(): void {
    this.events = [];
  }

  /**
   * Obtém estatísticas
   */
  public getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentEvents = this.events.filter(e => (e.timestamp || 0) > oneHourAgo).length;

    const eventsByType: Record<string, number> = {};
    this.events.forEach(event => {
      eventsByType[event.name] = (eventsByType[event.name] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      eventsByType,
      recentEvents,
    };
  }
}

// Singleton
export const analytics = new AnalyticsService();

/**
 * Inicializa analytics
 */
export function initAnalytics(enabled: boolean = true): void {
  analytics.setEnabled(enabled);
}

/**
 * Track evento
 */
export function trackEvent(event: AnalyticsEvent): void {
  analytics.track(event);
}

/**
 * Track página view
 */
export function trackPageView(path: string, properties?: Record<string, any>): void {
  analytics.pageView(path, properties);
}

/**
 * Track ação do usuário
 */
export function trackUserAction(action: string, properties?: Record<string, any>): void {
  analytics.userAction(action, properties);
}

/**
 * Track evento de trading
 */
export function trackTradingEvent(eventType: string, properties?: Record<string, any>): void {
  analytics.tradingEvent(eventType, properties);
}

/**
 * Track evento de gráfico
 */
export function trackChartEvent(eventType: string, properties?: Record<string, any>): void {
  analytics.chartEvent(eventType, properties);
}

