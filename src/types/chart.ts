// Tipos para dados de gráficos
export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LineData {
  timestamp: number;
  value: number;
}

export interface AreaData {
  timestamp: number;
  value: number;
}

export type ChartDataType = CandlestickData | LineData | AreaData;

// Tipos para configuração de gráficos
export interface ChartConfig {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  colors: {
    background: string;
    grid: string;
    text: string;
    bullish: string;
    bearish: string;
    line: string;
    area: string;
  };
  drawings: {
    trendline: {
      color: string;
      width: number;
    };
    horizontal: {
      color: string;
      width: number;
    };
    rectangle: {
      borderColor: string;
      borderWidth: number;
      fillColor: string;
      fillOpacity: number;
    };
  };
  timeRange: {
    start: number;
    end: number;
  };
  priceRange: {
    min: number;
    max: number;
  };
}

// Tipos para renderização
export interface RenderData {
  vertices: Float32Array;
  indices: Uint16Array;
  colors: Float32Array;
  count: number;
}

// Tipos para shaders
export interface ShaderProgram {
  program: WebGLProgram;
  attributes: {
    position: number;
    color: number;
  };
  uniforms: {
    transform: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
}

// Tipos para buffers
export interface ChartBuffers {
  position: WebGLBuffer | null;
  color: WebGLBuffer | null;
  index: WebGLBuffer | null;
}

// Tipos para interação
export interface ChartInteraction {
  zoom: number;
  panX: number;
  panY: number;
  hoverIndex: number;
  selectedIndex: number;
}

// Tipos para eventos
export interface ChartEvent {
  type: 'click' | 'hover' | 'zoom' | 'pan';
  data: any;
  position: { x: number; y: number };
}

export interface DrawingPoint {
  originalX: number;
  price: number;
}

export type DrawingShape =
  | {
      id: string;
      type: 'trendline';
      start: DrawingPoint;
      end: DrawingPoint;
      color?: string;
      width?: number;
      isDraft?: boolean;
    }
  | {
      id: string;
      type: 'horizontal';
      price: number;
      color?: string;
      width?: number;
      isDraft?: boolean;
    }
  | {
      id: string;
      type: 'rectangle';
      start: DrawingPoint;
      end: DrawingPoint;
      borderColor?: string;
      borderWidth?: number;
      fillColor?: string;
      fillOpacity?: number;
      isDraft?: boolean;
    };

