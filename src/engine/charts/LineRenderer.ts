import { LineData, ChartConfig, RenderData } from '@/types/chart';

export class LineRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private config: ChartConfig;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, config: ChartConfig) {
    this.gl = gl;
    this.config = config;
  }

  // Gerar dados de renderização para linha
  public generateRenderData(data: LineData[]): RenderData {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const priceRange = this.config.priceRange.max - this.config.priceRange.min;
    const timeRange = this.config.timeRange.end - this.config.timeRange.start;
    const lineColor = this.hexToRgb(this.config.colors.line);

    // Gerar vértices da linha
    data.forEach((point, index) => {
      const x = this.normalizeTime(point.timestamp, timeRange);
      const y = this.normalizePrice(point.value, priceRange);
      
      vertices.push(x, y);
      colors.push(...lineColor);
    });

    // Gerar índices para desenhar linhas
    for (let i = 0; i < data.length - 1; i++) {
      indices.push(i, i + 1);
    }

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
      count: indices.length
    };
  }

  // Gerar dados para pontos na linha
  public generatePointData(data: LineData[]): RenderData {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const priceRange = this.config.priceRange.max - this.config.priceRange.min;
    const timeRange = this.config.timeRange.end - this.config.timeRange.start;
    const pointColor = this.hexToRgb(this.config.colors.line);

    data.forEach((point, index) => {
      const x = this.normalizeTime(point.timestamp, timeRange);
      const y = this.normalizePrice(point.value, priceRange);
      
      // Criar um quadrado pequeno para o ponto
      const size = 4; // Tamanho do ponto
      vertices.push(
        x - size, y - size,  // Bottom left
        x + size, y - size,  // Bottom right
        x + size, y + size,  // Top right
        x - size, y + size   // Top left
      );

      // Adicionar cores para o quadrado
      for (let i = 0; i < 4; i++) {
        colors.push(...pointColor);
      }

      // Adicionar índices para o quadrado
      const baseIndex = vertices.length / 2 - 4;
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,
        baseIndex, baseIndex + 2, baseIndex + 3
      );
    });

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
      count: indices.length
    };
  }

  // Normalizar tempo para coordenadas de tela
  private normalizeTime(timestamp: number, timeRange: number): number {
    const normalizedTime = (timestamp - this.config.timeRange.start) / timeRange;
    return this.config.padding.left + (normalizedTime * (this.config.width - this.config.padding.left - this.config.padding.right));
  }

  // Normalizar preço para coordenadas de tela
  private normalizePrice(price: number, priceRange: number): number {
    const normalizedPrice = (price - this.config.priceRange.min) / priceRange;
    return this.config.padding.top + (normalizedPrice * (this.config.height - this.config.padding.top - this.config.padding.bottom));
  }

  // Converter cor hex para RGB
  private hexToRgb(hex: string): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1, 1]; // Branco padrão
    
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1.0
    ];
  }

  // Atualizar configuração
  public updateConfig(config: Partial<ChartConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

