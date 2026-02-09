/**
 * Sistema de Monitoramento e Error Tracking
 * 
 * Suporta Sentry (opcional) e fallback próprio
 */

export interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

class MonitoringService {
  private sentryEnabled = false;
  private errors: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private maxStoredErrors = 100;
  private maxStoredMetrics = 1000;

  /**
   * Inicializa Sentry (se disponível)
   * Nota: Requer instalação de @sentry/nextjs para funcionar
   */
  public initSentry(dsn?: string): void {
    if (typeof window === 'undefined' || !dsn) {
      return;
    }

    // Tentar carregar Sentry dinamicamente
    // Usar função helper para evitar erro de build
    this.loadSentry(dsn).catch(() => {
      // Sentry não disponível, usar fallback
    });
  }

  /**
   * Carrega módulo Sentry de forma segura (não quebra build se não instalado)
   */
  private async loadSentryModule(): Promise<any> {
    // Usar Function constructor para evitar análise estática do bundler
    const dynamicImport = new Function('moduleName', 'return import(moduleName)');
    return dynamicImport('@sentry/nextjs');
  }

  /**
   * Carrega Sentry de forma segura (não quebra build se não instalado)
   */
  private async loadSentry(dsn: string): Promise<void> {
    try {
      const Sentry = await this.loadSentryModule();
      
      if (Sentry && Sentry.init) {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 1.0,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
          integrations: [
            new Sentry.BrowserTracing(),
            new Sentry.Replay(),
          ],
        });
        this.sentryEnabled = true;
      }
    } catch (error) {
      // Módulo não encontrado ou erro de inicialização
      throw error;
    }
  }

  /**
   * Captura erro
   */
  public captureError(error: Error, context: ErrorContext = {}): void {
    const errorData = {
      error,
      context: {
        ...context,
        userId: context.userId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    // Enviar para Sentry se disponível
    if (this.sentryEnabled && typeof window !== 'undefined') {
      // Import dinâmico com tratamento de erro
      this.loadSentryModule()
        .then((Sentry) => {
          if (Sentry && Sentry.captureException) {
            Sentry.captureException(error, {
              contexts: {
                custom: context,
              },
            });
          } else {
            this.storeError(errorData);
          }
        })
        .catch(() => {
          // Fallback para armazenamento local
          this.storeError(errorData);
        });
    } else {
      // Armazenar localmente
      this.storeError(errorData);
    }

    // Log no console em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', error, context);
    }
  }

  /**
   * Armazena erro localmente
   */
  private storeError(errorData: {
    error: Error;
    context: ErrorContext;
    timestamp: number;
  }): void {
    this.errors.push(errorData);

    // Limitar tamanho
    if (this.errors.length > this.maxStoredErrors) {
      this.errors.shift();
    }

    // Tentar enviar para servidor (se configurado)
    this.sendErrorToServer(errorData).catch(() => {
      // Falha silenciosa
    });
  }

  /**
   * Envia erro para servidor
   */
  private async sendErrorToServer(errorData: {
    error: Error;
    context: ErrorContext;
    timestamp: number;
  }): Promise<void> {
    // Implementar endpoint de erro se necessário
    // Por enquanto, apenas armazena localmente
  }

  /**
   * Captura mensagem
   */
  public captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: ErrorContext = {}): void {
    if (this.sentryEnabled && typeof window !== 'undefined') {
      this.loadSentryModule()
        .then((Sentry) => {
          if (Sentry && Sentry.captureMessage) {
            Sentry.captureMessage(message, {
              level: level as any,
              contexts: {
                custom: context,
              },
            });
          }
        })
        .catch(() => {
          // Fallback silencioso
        });
    }
  }

  /**
   * Registra métrica de performance
   */
  public recordMetric(metric: PerformanceMetric): void {
    this.performanceMetrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });

    // Limitar tamanho
    if (this.performanceMetrics.length > this.maxStoredMetrics) {
      this.performanceMetrics.shift();
    }

    // Enviar para Sentry se disponível
    if (this.sentryEnabled && typeof window !== 'undefined') {
      this.loadSentryModule()
        .then((Sentry) => {
          if (Sentry && Sentry.metrics && Sentry.metrics.distribution) {
            Sentry.metrics.distribution(metric.name, metric.value, {
              unit: metric.unit,
              tags: metric.tags,
            });
          }
        })
        .catch(() => {
          // Fallback - métrica já está armazenada localmente
        });
    }
  }

  /**
   * Obtém erros armazenados
   */
  public getStoredErrors(): Array<{ error: Error; context: ErrorContext; timestamp: number }> {
    return [...this.errors];
  }

  /**
   * Obtém métricas armazenadas
   */
  public getStoredMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  /**
   * Limpa erros armazenados
   */
  public clearStoredErrors(): void {
    this.errors = [];
  }

  /**
   * Limpa métricas armazenadas
   */
  public clearStoredMetrics(): void {
    this.performanceMetrics = [];
  }

  /**
   * Obtém estatísticas
   */
  public getStats(): {
    errorCount: number;
    metricCount: number;
    recentErrors: number;
    recentMetrics: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentErrors = this.errors.filter(e => e.timestamp > oneHourAgo).length;
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp > oneHourAgo).length;

    return {
      errorCount: this.errors.length,
      metricCount: this.performanceMetrics.length,
      recentErrors,
      recentMetrics,
    };
  }
}

// Singleton
export const monitoring = new MonitoringService();

/**
 * Inicializa monitoramento
 */
export function initMonitoring(sentryDsn?: string): void {
  monitoring.initSentry(sentryDsn);
  
  // Capturar erros não tratados
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      monitoring.captureError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      monitoring.captureError(
        event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason)),
        {
          type: 'unhandledrejection',
        }
      );
    });
  }
}

/**
 * Hook para capturar erros em componentes React
 */
export function captureError(error: Error, context?: ErrorContext): void {
  monitoring.captureError(error, context);
}

/**
 * Hook para capturar mensagens
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  monitoring.captureMessage(message, level, context);
}

/**
 * Registra métrica de performance
 */
export function recordMetric(metric: PerformanceMetric): void {
  monitoring.recordMetric(metric);
}

