import { CandlestickData, ChartConfig, ShaderProgram } from '@/types/chart';

export class CandlestickRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private config: ChartConfig;
  private shaderProgram: ShaderProgram | null = null;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, config: ChartConfig) {
    this.gl = gl;
    this.config = config;
  }

  public setShaderProgram(shaderProgram: ShaderProgram): void {
    this.shaderProgram = shaderProgram;
  }

  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1, 1];

    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1.0
    ];
  }

  private createGeometry(data: CandlestickData[]) {
    const bodyVertices: number[] = [];
    const bodyColors: number[] = [];
    const bodyIndices: number[] = [];
    const wickVertices: number[] = [];
    const wickColors: number[] = [];

    const prices = data.flatMap(candle => [candle.open, candle.high, candle.low, candle.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const spacing = 2 / data.length;
    const halfWidth = spacing * 0.3;

    data.forEach((candle, index) => {
      const centerX = -1 + (index + 0.5) * spacing;

      const openY = ((candle.open - minPrice) / priceRange) * 2 - 1;
      const highY = ((candle.high - minPrice) / priceRange) * 2 - 1;
      const lowY = ((candle.low - minPrice) / priceRange) * 2 - 1;
      const closeY = ((candle.close - minPrice) / priceRange) * 2 - 1;

      const isBullish = candle.close >= candle.open;
      const color = isBullish ? this.hexToRgb(this.config.colors.bullish) : this.hexToRgb(this.config.colors.bearish);

      const bodyTop = Math.max(openY, closeY);
      const bodyBottom = Math.min(openY, closeY);
      const bodyHeight = bodyTop - bodyBottom;

      if (bodyHeight > 0) {
        const baseIndex = bodyVertices.length / 2;
        bodyVertices.push(
          centerX - halfWidth, bodyBottom,
          centerX + halfWidth, bodyBottom,
          centerX + halfWidth, bodyTop,
          centerX - halfWidth, bodyTop
        );

        for (let i = 0; i < 4; i++) {
          bodyColors.push(...color);
        }

        bodyIndices.push(
          baseIndex, baseIndex + 1, baseIndex + 2,
          baseIndex, baseIndex + 2, baseIndex + 3
        );
      }

      wickVertices.push(centerX, lowY, centerX, highY);
      wickColors.push(...color, ...color);
    });

    const geometry = {
      bodyVertices: new Float32Array(bodyVertices),
      bodyColors: new Float32Array(bodyColors),
      bodyIndices: new Uint16Array(bodyIndices),
      wickVertices: new Float32Array(wickVertices),
      wickColors: new Float32Array(wickColors)
    };

    return geometry;
  }

  public render(data: CandlestickData[]): void {
    if (!this.shaderProgram || !data.length) return;

    const geometry = this.createGeometry(data);

    const positionLocation = this.shaderProgram.attributes.a_position;
    const colorLocation = this.shaderProgram.attributes.a_color;

    const bodyVertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bodyVertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.bodyVertices, this.gl.STATIC_DRAW);
    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    const bodyColorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bodyColorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.bodyColors, this.gl.STATIC_DRAW);
    if (colorLocation >= 0) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    }

    const bodyIndexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, bodyIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, geometry.bodyIndices, this.gl.STATIC_DRAW);
    this.gl.drawElements(this.gl.TRIANGLES, geometry.bodyIndices.length, this.gl.UNSIGNED_SHORT, 0);

    let error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error('CandlestickRenderer body draw error', error);
    }

    this.gl.deleteBuffer(bodyVertexBuffer);
    this.gl.deleteBuffer(bodyColorBuffer);
    this.gl.deleteBuffer(bodyIndexBuffer);

    const wickVertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, wickVertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.wickVertices, this.gl.STATIC_DRAW);
    if (positionLocation >= 0) {
      this.gl.enableVertexAttribArray(positionLocation);
      this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
    }

    const wickColorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, wickColorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.wickColors, this.gl.STATIC_DRAW);
    if (colorLocation >= 0) {
      this.gl.enableVertexAttribArray(colorLocation);
      this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.drawArrays(this.gl.LINES, 0, geometry.wickVertices.length / 2);

    error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error('CandlestickRenderer wick draw error', error);
    }

    this.gl.deleteBuffer(wickVertexBuffer);
    this.gl.deleteBuffer(wickColorBuffer);
  }

  public updateConfig(config: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...config } as ChartConfig;
  }
}
