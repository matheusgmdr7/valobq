/**
 * Fallback para Polling quando WebSocket não está disponível
 * 
 * Implementa polling HTTP como alternativa quando:
 * - WebSocket não está disponível
 * - Conexão WebSocket falha repetidamente
 * - Servidor não suporta WebSocket
 */

export interface PollingConfig {
  url: string;
  interval?: number; // Intervalo em milissegundos
  params?: Record<string, string>;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: any;
}

export interface PollingOptions {
  enabled?: boolean;
  maxAttempts?: number;
  retryDelay?: number;
  onData?: (data: any) => void;
  onError?: (error: Error) => void;
  onMaxAttemptsReached?: () => void;
}

export class PollingFallback {
  private config: Required<PollingConfig>;
  private options: PollingOptions & {
    enabled: boolean;
    maxAttempts: number;
    retryDelay: number;
  };
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private attempts = 0;

  constructor(config: PollingConfig, options: PollingOptions = {}) {
    this.config = {
      url: config.url,
      interval: config.interval || 5000, // 5 segundos por padrão
      params: config.params || {},
      headers: config.headers || {},
      method: config.method || 'GET',
      body: config.body
    };

    this.options = {
      enabled: options.enabled !== false,
      maxAttempts: options.maxAttempts || 10,
      retryDelay: options.retryDelay || 1000,
      onData: options.onData || (() => {}),
      onError: options.onError || (() => {}),
      onMaxAttemptsReached: options.onMaxAttemptsReached || (() => {})
    };
  }

  /**
   * Inicia polling
   */
  public start(): void {
    if (this.isPolling) {
      return;
    }

    if (!this.options.enabled) {
      return;
    }

    this.isPolling = true;
    this.attempts = 0;
    this.poll();
  }

  /**
   * Para polling
   */
  public stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    this.attempts = 0;
  }

  /**
   * Verifica se está fazendo polling
   */
  public isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Atualiza configuração
   */
  public updateConfig(config: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Atualiza opções
   */
  public updateOptions(options: Partial<PollingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Executa uma requisição de polling
   */
  private async poll(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    try {
      const url = this.buildUrl();
      const response = await fetch(url, {
        method: this.config.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: this.config.method === 'POST' && this.config.body
          ? JSON.stringify(this.config.body)
          : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.attempts = 0; // Reset attempts on success
      
      if (this.options.onData) {
        this.options.onData(data);
      }

      // Agendar próximo poll
      this.scheduleNext();
    } catch (error) {
      this.attempts++;
      
      if (this.options.onError) {
        this.options.onError(error as Error);
      }

      if (this.attempts >= this.options.maxAttempts) {
        this.stop();
        // Notificar que atingiu o máximo
        if (this.options.onMaxAttemptsReached) {
          this.options.onMaxAttemptsReached();
        }
        // Não tentar novamente - parar completamente
        return;
      } else {
        // Retry com delay
        this.intervalId = setTimeout(() => {
          if (this.isPolling) {
          this.poll();
          }
        }, this.options.retryDelay);
      }
    }
  }

  /**
   * Constrói URL com parâmetros
   */
  private buildUrl(): string {
    // Se a URL é relativa, usar window.location.origin
    let baseUrl = this.config.url;
    
    // Verificar se é URL relativa (começa com /)
    if (baseUrl.startsWith('/')) {
      // Em ambiente de servidor, retornar URL relativa sem construir URL absoluta
      if (typeof window === 'undefined') {
        // No servidor, apenas retornar a URL relativa com parâmetros
        const params = new URLSearchParams(this.config.params);
        const queryString = params.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
      }
      // No cliente, construir URL absoluta
      baseUrl = `${window.location.origin}${baseUrl}`;
    }
    
    // Verificar se é URL válida
    try {
      const url = new URL(baseUrl);
    
    Object.entries(this.config.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return url.toString();
    } catch (error) {
      // Se falhar, retornar URL relativa com parâmetros
      const params = new URLSearchParams(this.config.params);
      const queryString = params.toString();
      return queryString ? `${this.config.url}?${queryString}` : this.config.url;
    }
  }

  /**
   * Agenda próximo poll
   */
  private scheduleNext(): void {
    if (!this.isPolling) {
      return;
    }

    this.intervalId = setTimeout(() => {
      this.poll();
    }, this.config.interval);
  }
}

