import { AreaData, ChartConfig, RenderData } from '@/types/chart';

export class AreaRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private config: ChartConfig;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, config: ChartConfig) {
    this.gl = gl;
    this.config = config;
  }

  // Gerar dados de renderização para área
  public generateRenderData(data: AreaData[]): RenderData {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const priceRange = this.config.priceRange.max - this.config.priceRange.min;
    const timeRange = this.config.timeRange.end - this.config.timeRange.start;
    const areaColor = this.hexToRgb(this.config.colors.area);
    const bottomY = this.config.padding.bottom;

    // Gerar vértices da área
    data.forEach((point, index) => {
      const x = this.normalizeTime(point.timestamp, timeRange);
      const y = this.normalizePrice(point.value, priceRange);
      
      // Vértice superior (dados)
      vertices.push(x, y);
      colors.push(...areaColor);
      
      // Vértice inferior (base)
      vertices.push(x, bottomY);
      colors.push(...areaColor);
    });

    // Gerar índices para desenhar triângulos
    for (let i = 0; i < data.length - 1; i++) {
      const baseIndex = i * 2;
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,     // Primeiro triângulo
        baseIndex + 1, baseIndex + 2, baseIndex + 3  // Segundo triângulo
      );
    }

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
      indices: new Uint16Array(indices),
      count: indices.length
    };
  }

  // Gerar dados para área com gradiente
  public generateGradientData(data: AreaData[]): RenderData {
    const vertices: number[] = [];
    const colors: number[] = [];
    const gradientColors: number[] = [];
    const indices: number[] = [];

    const priceRange = this.config.priceRange.max - this.config.priceRange.min;
    const timeRange = this.config.timeRange.end - this.config.timeRange.start;
    const areaColor = this.hexToRgb(this.config.colors.area);
    const gradientColor = this.hexToRgb(this.config.colors.area + '80'); // Com transparência
    const bottomY = this.config.padding.bottom;

    // Gerar vértices da área
    data.forEach((point, index) => {
      const x = this.normalizeTime(point.timestamp, timeRange);
      const y = this.normalizePrice(point.value, priceRange);
      
      // Vértice superior (dados)
      vertices.push(x, y);
      colors.push(...areaColor);
      gradientColors.push(...gradientColor);
      
      // Vértice inferior (base)
      vertices.push(x, bottomY);
      colors.push(...areaColor);
      gradientColors.push(...gradientColor);
    });

    // Gerar índices para desenhar triângulos
    for (let i = 0; i < data.length - 1; i++) {
      const baseIndex = i * 2;
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,     // Primeiro triângulo
        baseIndex + 1, baseIndex + 2, baseIndex + 3  // Segundo triângulo
      );
    }

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

