/**
 * Price Animator - Interpolação suave de preços
 * 
 * Anima transições de preço para criar movimento fluido
 * em vez de saltos bruscos
 */

export interface PriceAnimatorConfig {
  speed?: number; // 0-1, quanto maior, mais rápido (padrão: 0.15)
  easing?: 'linear' | 'easeOut' | 'easeInOut';
  minDifference?: number; // Diferença mínima para animar (padrão: 0.0001)
}

export class PriceAnimator {
  private currentPrice: number = 0;
  private targetPrice: number = 0;
  private speed: number;
  private easing: string;
  private minDifference: number;
  private isAnimating: boolean = false;

  constructor(config: PriceAnimatorConfig = {}) {
    this.speed = config.speed ?? 0.15;
    this.easing = config.easing ?? 'easeOut';
    this.minDifference = config.minDifference ?? 0.0001;
  }

  /**
   * Define preço alvo (inicia animação)
   */
  setTarget(price: number) {
    if (Math.abs(price - this.targetPrice) < this.minDifference) {
      return; // Diferença muito pequena, não animar
    }

    this.targetPrice = price;
    this.isAnimating = true;
  }

  /**
   * Atualiza animação (deve ser chamado a cada frame)
   * Retorna o preço atual interpolado
   */
  update(): number {
    if (!this.isAnimating) {
      return this.currentPrice;
    }

    const diff = this.targetPrice - this.currentPrice;
    
    // Se a diferença for muito pequena, finalizar animação
    if (Math.abs(diff) < this.minDifference) {
      this.currentPrice = this.targetPrice;
      this.isAnimating = false;
      return this.currentPrice;
    }

    // Aplicar easing
    let t = this.speed;
    if (this.easing === 'easeOut') {
      t = this.easeOutQuad(this.speed);
    } else if (this.easing === 'easeInOut') {
      t = this.easeInOutQuad(this.speed);
    }

    // Interpolar
    this.currentPrice += diff * t;

    return this.currentPrice;
  }

  /**
   * Obtém preço atual
   */
  getCurrent(): number {
    return this.currentPrice;
  }

  /**
   * Obtém preço alvo
   */
  getTarget(): number {
    return this.targetPrice;
  }

  /**
   * Verifica se está animando
   */
  isActive(): boolean {
    return this.isAnimating;
  }

  /**
   * Define preço diretamente (sem animação)
   */
  setDirect(price: number) {
    this.currentPrice = price;
    this.targetPrice = price;
    this.isAnimating = false;
  }

  /**
   * Easing function: easeOutQuad
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Easing function: easeInOutQuad
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5
      ? 2 * t * t
      : -1 + (4 - 2 * t) * t;
  }
}

