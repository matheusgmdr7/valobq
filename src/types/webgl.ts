// Tipos para o sistema WebGL

export interface WebGLContextInfo {
  version: string;
  vendor: string;
  renderer: string;
  shadingLanguageVersion: string;
  isWebGL2: boolean;
}

export interface CanvasDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartConfig {
  width: number;
  height: number;
  backgroundColor: Color;
  gridColor: Color;
  candleUpColor: Color;
  candleDownColor: Color;
  lineColor: Color;
}

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface WebGLError {
  message: string;
  code?: string;
  line?: number;
}

// Enums
export enum ChartType {
  CANDLESTICK = 'candlestick',
  LINE = 'line',
  AREA = 'area'
}

export enum Timeframe {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d'
}

export enum InteractionMode {
  NONE = 'none',
  ZOOM = 'zoom',
  PAN = 'pan',
  SELECT = 'select'
}

