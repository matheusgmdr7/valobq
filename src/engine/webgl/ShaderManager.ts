export class ShaderManager {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.gl = gl;
  }

  public createShader(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) {
      console.error('Failed to create shader');
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      console.error(`Shader compilation error:`, error);
      console.error('Shader source:', source);
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  public createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const program = this.gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      return null;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      console.error('Program linking error:', error);
      this.gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  public loadShaders(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders');
      return null;
    }

    const program = this.createProgram(vertexShader, fragmentShader);

    // Limpar shaders após criar o programa
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  public getAttributeLocation(program: WebGLProgram, name: string): number {
    const location = this.gl.getAttribLocation(program, name);
    // Attribute not found - silently ignored
    return location;
  }

  public getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    const location = this.gl.getUniformLocation(program, name);
    // Uniform not found - silently ignored
    return location;
  }
}

