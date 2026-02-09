/**
 * Update Batcher - Agrupa atualizações para renderização eficiente
 * 
 * Evita renderizar a cada mensagem WebSocket
 * Agrupa múltiplas atualizações e renderiza em batches
 */

export interface UpdateBatcherConfig {
  batchInterval?: number; // Intervalo entre batches em ms (padrão: 16ms = ~60 FPS)
  maxBatchSize?: number; // Tamanho máximo do batch (padrão: 100)
}

export type BatchCallback = (updates: any[]) => void;

export class UpdateBatcher {
  private pendingUpdates: any[] = [];
  private batchCallback: BatchCallback;
  private batchInterval: number;
  private maxBatchSize: number;
  private lastRender: number = 0;
  private scheduledRender: number | null = null;

  constructor(
    callback: BatchCallback,
    config: UpdateBatcherConfig = {}
  ) {
    this.batchCallback = callback;
    this.batchInterval = config.batchInterval ?? 16; // ~60 FPS
    this.maxBatchSize = config.maxBatchSize ?? 100;
  }

  /**
   * Adiciona atualização ao batch
   */
  add(update: any) {
    this.pendingUpdates.push(update);

    // Se o batch estiver muito grande, renderizar imediatamente
    if (this.pendingUpdates.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Agendar renderização
    this.scheduleRender();
  }

  /**
   * Agenda renderização
   */
  private scheduleRender() {
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRender;

    // Se já passou tempo suficiente, renderizar imediatamente
    if (timeSinceLastRender >= this.batchInterval) {
      this.flush();
      return;
    }

    // Se já há uma renderização agendada, não agendar outra
    if (this.scheduledRender !== null) {
      return;
    }

    // Agendar renderização
    const delay = this.batchInterval - timeSinceLastRender;
    this.scheduledRender = window.setTimeout(() => {
      this.flush();
    }, delay);
  }

  /**
   * Renderiza todas as atualizações pendentes
   */
  flush() {
    if (this.pendingUpdates.length === 0) {
      return;
    }

    // Limpar agendamento
    if (this.scheduledRender !== null) {
      clearTimeout(this.scheduledRender);
      this.scheduledRender = null;
    }

    // Copiar atualizações e limpar
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];

    // Atualizar timestamp
    this.lastRender = performance.now();

    // Chamar callback com atualizações
    this.batchCallback(updates);
  }

  /**
   * Limpa todas as atualizações pendentes
   */
  clear() {
    this.pendingUpdates = [];
    if (this.scheduledRender !== null) {
      clearTimeout(this.scheduledRender);
      this.scheduledRender = null;
    }
  }

  /**
   * Obtém número de atualizações pendentes
   */
  getPendingCount(): number {
    return this.pendingUpdates.length;
  }
}

