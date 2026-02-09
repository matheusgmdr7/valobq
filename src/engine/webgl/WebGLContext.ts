export class WebGLContext {
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isWebGL2: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
  }

  private init(): void {
    if (!this.canvas) {
      throw new Error('Canvas element is required');
    }

    // Tentar WebGL 2.0 primeiro
    this.gl = this.canvas.getContext('webgl2');
    
    if (!this.gl) {
      // Fallback para WebGL 1.0
      const gl1 = this.canvas.getContext('webgl');
      if (!gl1) {
        throw new Error('WebGL is not supported in this browser');
      }
      this.gl = gl1;
      this.isWebGL2 = false;
    } else {
      this.isWebGL2 = true;
    }

    this.setupContext();
  }

  private setupContext(): void {
    if (!this.gl) return;

    // Configurações básicas
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Configurar viewport
    this.resize();
  }

  public resize(): void {
    if (!this.gl || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Configurar dimensões do canvas (2x scaling para Retina)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Configurar viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public getContext(): WebGL2RenderingContext | WebGLRenderingContext | null {
    return this.gl;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public isWebGL2Supported(): boolean {
    return this.isWebGL2;
  }

  public clear(color: [number, number, number, number] = [0, 0, 0, 1]): void {
    if (!this.gl) return;
    
    this.gl.clearColor(color[0], color[1], color[2], color[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  public destroy(): void {
    if (this.gl) {
      // Limpar recursos WebGL
      this.gl = null;
    }
    this.canvas = null;
  }
}
