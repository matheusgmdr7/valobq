# Alternativa: TradingView Lightweight Charts

## 📦 Instalação

```bash
npm install lightweight-charts
```

## 🚀 Implementação Básica

### Componente Simplificado

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';

interface TradingViewChartProps {
  data: CandlestickData[];
  symbol: string;
  width?: number;
  height?: number;
}

export function TradingViewChart({ data, symbol, width = 800, height = 600 }: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Criar gráfico
    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#485158',
      },
      timeScale: {
        borderColor: '#485158',
      },
    });

    // Criar série de candlesticks
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff4444',
      borderVisible: false,
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    return () => {
      chart.remove();
    };
  }, []);

  // Atualizar dados
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    // Converter para formato TradingView
    const tvData = data.map(candle => ({
      time: (candle.timestamp / 1000) as any, // TradingView espera timestamp em segundos
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    seriesRef.current.setData(tvData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div 
      ref={chartContainerRef} 
      style={{ width, height }}
      className="tradingview-chart"
    />
  );
}
```

## ✅ Vantagens

1. **Performance**: Otimizado para grandes volumes de dados
2. **Tempo Real**: Suporte nativo a atualizações em tempo real
3. **Documentação**: Excelente documentação e exemplos
4. **Manutenção**: Biblioteca mantida ativamente
5. **Features**: Zoom, pan, crosshair, etc. já implementados

## ⚠️ Considerações

- Perde controle total sobre renderização WebGL
- Pode precisar customizar estilos para match com design
- Dependência externa (mas é open source)

## 🔄 Migração

Se decidirmos migrar, podemos:
1. Manter WebGL como fallback
2. Criar wrapper que escolhe entre WebGL e TradingView
3. Migrar gradualmente

