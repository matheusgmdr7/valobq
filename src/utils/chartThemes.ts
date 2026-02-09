/**
 * Temas de Visualização para Gráficos
 */

export interface ChartTheme {
  name: string;
  colors: {
    background: string;
    grid: string;
    text: string;
    textSecondary: string;
    bullish: string;
    bearish: string;
    line: string;
    area: string;
    crosshair: string;
    selection: string;
  };
}

export const chartThemes: Record<string, ChartTheme> = {
  dark: {
    name: 'Escuro',
    colors: {
      background: '#0F172A',
      grid: '#1E293B',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      bullish: '#10B981',
      bearish: '#EF4444',
      line: '#3B82F6',
      area: '#3B82F6',
      crosshair: '#94A3B8',
      selection: '#3B82F6'
    }
  },
  light: {
    name: 'Claro',
    colors: {
      background: '#FFFFFF',
      grid: '#E5E7EB',
      text: '#111827',
      textSecondary: '#6B7280',
      bullish: '#059669',
      bearish: '#DC2626',
      line: '#2563EB',
      area: '#2563EB',
      crosshair: '#6B7280',
      selection: '#2563EB'
    }
  },
  blue: {
    name: 'Azul',
    colors: {
      background: '#0A1929',
      grid: '#132F4C',
      text: '#E3F2FD',
      textSecondary: '#90CAF9',
      bullish: '#4CAF50',
      bearish: '#F44336',
      line: '#2196F3',
      area: '#2196F3',
      crosshair: '#90CAF9',
      selection: '#2196F3'
    }
  },
  green: {
    name: 'Verde',
    colors: {
      background: '#0A1F0A',
      grid: '#1A3D1A',
      text: '#E8F5E9',
      textSecondary: '#A5D6A7',
      bullish: '#4CAF50',
      bearish: '#F44336',
      line: '#66BB6A',
      area: '#66BB6A',
      crosshair: '#A5D6A7',
      selection: '#66BB6A'
    }
  }
};

export const defaultTheme = chartThemes.dark;

/**
 * Aplica transição suave entre temas
 */
export function applyThemeTransition(
  element: HTMLElement,
  property: string,
  value: string,
  duration: number = 300
): void {
  element.style.transition = `${property} ${duration}ms ease-in-out`;
  element.style.setProperty(property, value);
}

