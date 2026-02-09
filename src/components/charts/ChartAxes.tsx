import React from 'react';
import { VisibleRange, ViewState } from '@/engine/charts/ChartManager';
import { CandlestickData } from '@/types/chart';

interface ChartAxesProps {
  canvasWidth: number;
  canvasHeight: number;
  data: CandlestickData[];
  visibleRange: VisibleRange | null;
  viewState: ViewState | null;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Componente para renderizar eixos de tempo e preço sobre o gráfico WebGL
 */
export function ChartAxes({
  canvasWidth,
  canvasHeight,
  data,
  visibleRange,
  viewState,
  padding = { top: 20, right: 80, bottom: 40, left: 80 }
}: ChartAxesProps) {
  if (!visibleRange || !viewState || data.length === 0) {
    return null;
  }
  
  // Log removido para reduzir spam no console

  const chartWidth = canvasWidth - padding.left - padding.right;
  const chartHeight = canvasHeight - padding.top - padding.bottom;
  const chartX = padding.left;
  const chartY = padding.top;

  // Calcular posições dos candles visíveis
  const visibleCandles = data.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  const timeRange = visibleRange.timeEnd - visibleRange.timeStart;
  const priceRange = visibleRange.priceMax - visibleRange.priceMin;

  // Formatar tempo
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Formatar preço
  const formatPrice = (price: number): string => {
    // Determinar casas decimais baseado no range de preço
    if (priceRange < 0.01) {
      return price.toFixed(5);
    } else if (priceRange < 0.1) {
      return price.toFixed(4);
    } else if (priceRange < 1) {
      return price.toFixed(3);
    } else if (priceRange < 10) {
      return price.toFixed(2);
    } else {
      return price.toFixed(1);
    }
  };

  // Calcular posições dos labels de tempo (eixo X)
  // O último candle (tempo atual) deve sempre estar no centro
  const totalCandles = data.length;
  const candleSpacing = totalCandles > 0 ? 2 / totalCandles : 0;
  const lastCandleIndex = totalCandles - 1;
  const lastCandle = data[lastCandleIndex];
  const centerX = chartX + chartWidth / 2; // Centro do gráfico
  
  const timeLabels: Array<{ x: number; label: string; timestamp: number }> = [];
  
  // Verificar se o último candle está realmente centralizado
  const lastCandleOriginalX = -1 + (lastCandleIndex + 0.5) * candleSpacing;
  const lastCandleClipX = viewState.scaleX * lastCandleOriginalX + viewState.translateX;
  const isLastCandleCentered = Math.abs(lastCandleClipX) < 0.15; // Tolerância maior
  
  // Sempre adicionar o último candle (tempo atual) no centro do eixo X
  if (lastCandle) {
    timeLabels.push({
      x: centerX,
      label: formatTime(lastCandle.timestamp),
      timestamp: lastCandle.timestamp
    });
  }
  
  // Adicionar labels adicionais distribuídos ao redor do centro
  if (isLastCandleCentered) {
    // Quando centralizado: distribuir labels simetricamente ao redor do centro
    const numTimeLabels = Math.min(6, Math.max(3, Math.floor(visibleCandles.length / 2)));
    const spacing = chartWidth / (numTimeLabels + 2); // Espaçamento simétrico
    
    for (let i = 0; i < numTimeLabels; i++) {
      // Distribuir: -3, -2, -1, +1, +2, +3 (sem o 0 que é o centro)
      const offset = (i + 1) - Math.ceil(numTimeLabels / 2);
      if (offset === 0) continue; // Pular o centro
      
      const relativeX = offset * spacing;
      const canvasX = centerX + relativeX;
      
      // Converter posição canvas para índice do candle
      const clipX = ((canvasX - chartX) / chartWidth) * 2 - 1;
      const originalX = (clipX - viewState.translateX) / viewState.scaleX;
      const dataIndex = Math.round(((originalX + 1) / candleSpacing) - 0.5);
      
      if (dataIndex >= 0 && dataIndex < totalCandles && dataIndex !== lastCandleIndex) {
        const candle = data[dataIndex];
        if (candle) {
          timeLabels.push({
            x: canvasX,
            label: formatTime(candle.timestamp),
            timestamp: candle.timestamp
          });
        }
      }
    }
  } else {
    // Se não está centralizado, calcular posições baseadas no viewState
    const numTimeLabels = Math.min(7, visibleCandles.length - 1);
    
    for (let i = 0; i < numTimeLabels; i++) {
      const relativeIndex = i / Math.max(1, numTimeLabels - 1);
      const dataIndex = Math.floor(
        visibleRange.startIndex + relativeIndex * (visibleRange.endIndex - visibleRange.startIndex)
      );
      const candle = data[dataIndex];
      
      if (candle && candle.timestamp !== lastCandle?.timestamp) {
        const originalX = -1 + (dataIndex + 0.5) * candleSpacing;
        const clipX = viewState.scaleX * originalX + viewState.translateX;
        const canvasX = chartX + ((clipX + 1) / 2) * chartWidth;
        
        if (canvasX >= chartX - 30 && canvasX <= chartX + chartWidth + 30) {
          timeLabels.push({
            x: canvasX,
            label: formatTime(candle.timestamp),
            timestamp: candle.timestamp
          });
        }
      }
    }
  }
  
  // Ordenar por posição X para renderização correta
  timeLabels.sort((a, b) => a.x - b.x);

  // Calcular posições dos labels de preço (eixo Y)
  // Usar a mesma lógica do ChartManager: priceToClipY
  const priceLabels: Array<{ y: number; label: string; price: number }> = [];
  const numPriceLabels = 8;
  
  // Função para converter preço para clipY (mesma lógica do ChartManager)
  const priceToClipY = (price: number): number => {
    const normalized = (price - visibleRange.priceMin) / priceRange;
    return 1 - (normalized * 2); // Inverter: 0 = topo (preço max), 1 = base (preço min)
  };
  
  for (let i = 0; i < numPriceLabels; i++) {
    const ratio = i / (numPriceLabels - 1);
    const price = visibleRange.priceMax - (priceRange * ratio);
    
    // Calcular posição Y usando clipY
    const clipY = priceToClipY(price);
    // Aplicar transformação Y se houver (por enquanto assumimos translateY = 0, scaleY = 1)
    const transformedClipY = viewState.scaleY * clipY + viewState.translateY;
    // Converter clipY para canvas Y (clip space -1 a 1 -> canvas 0 a height)
    const canvasY = chartY + ((1 - transformedClipY) / 2) * chartHeight;
    
    if (canvasY >= chartY - 10 && canvasY <= chartY + chartHeight + 10) {
      priceLabels.push({
        y: canvasY,
        label: formatPrice(price),
        price
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {/* SVG para linhas de grid */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: canvasWidth,
          height: canvasHeight,
          pointerEvents: 'none'
        }}
      >
        {/* Linhas de grid horizontais (preço) */}
        {priceLabels.map((label, index) => (
          <line
            key={`price-line-${index}`}
            x1={chartX}
            y1={label.y}
            x2={chartX + chartWidth}
            y2={label.y}
            stroke="rgba(148, 163, 184, 0.15)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}
        {/* Linhas de grid verticais (tempo) */}
        {timeLabels.map((label, index) => (
          <line
            key={`time-line-${index}`}
            x1={label.x}
            y1={chartY}
            x2={label.x}
            y2={chartY + chartHeight}
            stroke="rgba(148, 163, 184, 0.15)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}
      </svg>

      {/* Labels de preço (eixo Y - direita) */}
      {priceLabels.map((label, index) => (
        <div
          key={`price-label-${index}`}
          style={{
            position: 'absolute',
            right: padding.right - 65,
            top: label.y - 8,
            color: '#94A3B8',
            fontSize: '11px',
            fontFamily: 'monospace',
            textAlign: 'right',
            userSelect: 'none',
            pointerEvents: 'none',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            minWidth: '50px'
          }}
        >
          {label.label}
        </div>
      ))}

      {/* Labels de tempo (eixo X - inferior) */}
      {timeLabels.map((label, index) => (
        <div
          key={`time-label-${index}`}
          style={{
            position: 'absolute',
            left: label.x - 30,
            bottom: padding.bottom - 20,
            color: '#94A3B8',
            fontSize: '11px',
            fontFamily: 'monospace',
            textAlign: 'center',
            width: 60,
            userSelect: 'none',
            pointerEvents: 'none',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '2px 4px',
            borderRadius: '3px'
          }}
        >
          {label.label}
        </div>
      ))}
    </div>
  );
}

