export class CoordinateSystem {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private program: WebGLProgram;
  private transformLocation: WebGLUniformLocation | null = null;
  private colorLocation: WebGLUniformLocation | null = null;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, program: WebGLProgram) {
    this.gl = gl;
    this.program = program;
    this.transformLocation = gl.getUniformLocation(program, 'u_transform');
    this.colorLocation = gl.getUniformLocation(program, 'u_color');
  }

  public setViewport(width: number, height: number): void {
    // Configurar matriz de projeção ortogonal
    // Coordenadas: (0,0) no topo-esquerda, (width,height) no bottom-direita
    const left = 0;
    const right = width;
    const bottom = height;
    const top = 0;
    const near = -1;
    const far = 1;

    const transform = this.createOrthographicMatrix(left, right, bottom, top, near, far);
    
    if (this.transformLocation) {
      this.gl.uniformMatrix3fv(this.transformLocation, false, transform);
    }
  }

  public setColor(r: number, g: number, b: number, a: number = 1.0): void {
    if (this.colorLocation) {
      this.gl.uniform4f(this.colorLocation, r, g, b, a);
    }
  }

  private createOrthographicMatrix(
    left: number, 
    right: number, 
    bottom: number, 
    top: number, 
    near: number, 
    far: number
  ): Float32Array {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    // Matriz 3x3 para transformação 2D
    return new Float32Array([
      2 * lr, 0, 0,
      0, 2 * bt, 0,
      (left + right) * lr, (top + bottom) * bt, 1
    ]);
  }

  public screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): [number, number] {
    // Converter coordenadas da tela para coordenadas do mundo
    const worldX = screenX;
    const worldY = canvasHeight - screenY; // Inverter Y (tela tem Y para baixo, mundo tem Y para cima)
    
    return [worldX, worldY];
  }

  public worldToScreen(worldX: number, worldY: number, canvasWidth: number, canvasHeight: number): [number, number] {
    // Converter coordenadas do mundo para coordenadas da tela
    const screenX = worldX;
    const screenY = canvasHeight - worldY; // Inverter Y
    
    return [screenX, screenY];
  }
}

