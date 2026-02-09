/**
 * Smooth Renderer - Renderização suave com RAF
 * 
 * Gerencia renderização otimizada usando requestAnimationFrame
 * para garantir 60 FPS constante
 */

export type RenderCallback = () => void;

export class SmoothRenderer {
  private animationFrameId: number | null = null;
  private renderCallback: RenderCallback | null = null;
  private isRunning: boolean = false;
  private lastRenderTime: number = 0;
  private targetFPS: number = 60;
  private frameInterval: number;

  constructor(targetFPS: number = 60) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }

  /**
   * Inicia loop de renderização
   */
  start(callback: RenderCallback) {
    if (this.isRunning) {
      return;
    }

    this.renderCallback = callback;
    this.isRunning = true;
    this.lastRenderTime = performance.now();
    this.scheduleFrame();
  }

  /**
   * Para loop de renderização
   */
  stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
    this.renderCallback = null;
  }

  /**
   * Agenda próximo frame
   */
  private scheduleFrame() {
    if (!this.isRunning) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((currentTime) => {
      this.animationFrameId = null;

      // Verificar se passou tempo suficiente para o target FPS
      const elapsed = currentTime - this.lastRenderTime;
      
      if (elapsed >= this.frameInterval) {
        // Renderizar
        if (this.renderCallback) {
          this.renderCallback();
        }
        this.lastRenderTime = currentTime - (elapsed % this.frameInterval);
      }

      // Continuar loop
      this.scheduleFrame();
    });
  }

  /**
   * Força renderização imediata (útil para atualizações críticas)
   */
  forceRender() {
    if (this.renderCallback) {
      this.renderCallback();
    }
  }

  /**
   * Verifica se está rodando
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

