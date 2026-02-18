import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WebGLContext } from '../../engine/webgl/WebGLContext';
import { Renderer } from '../../engine/webgl/Renderer';
import { CandlestickData } from '../../types/chart';
import { ViewState, VisibleRange } from '../../engine/charts/ChartManager';
import { logger } from '../../utils/logger';

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
  onContextReady?: (context: WebGLContext, renderer: Renderer) => void;
  chartType?: 'candlestick' | 'line' | 'area';
  candlestickData?: CandlestickData[];
  onViewChange?: (info: { viewState: ViewState | null; visibleRange: VisibleRange | null }) => void;
  onPointerHover?: (info: {
    x: number;
    y: number;
    canvasWidth: number;
    canvasHeight: number;
    isDragging: boolean;
  }) => void;
  onPointerLeave?: () => void;
  onPointerClick?: (info: {
    x: number;
    y: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  onRegionStart?: (info: {
    startX: number;
    startY: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => boolean;
  onRegionUpdate?: (info: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  onRegionEnd?: (info: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    canvasWidth: number;
    canvasHeight: number;
    cancelled: boolean;
  }) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
  width = 0, 
  height = 0, 
  className = '',
  onContextReady,
  chartType = 'candlestick',
  candlestickData,
  onViewChange,
  onPointerHover,
  onPointerLeave,
  onPointerClick,
  onRegionStart,
  onRegionUpdate,
  onRegionEnd
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglContextRef = useRef<WebGLContext | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const lastXRef = useRef<number | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{
    x: number;
    y: number;
    canvasWidth: number;
    canvasHeight: number;
    isDragging: boolean;
  } | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const pendingWheelRef = useRef<{
    offsetX: number;
    canvasWidth: number;
    deltaY: number;
  } | null>(null);

  const latestCandlestickDataRef = useRef<CandlestickData[] | undefined>(candlestickData);
  const latestChartTypeRef = useRef(chartType);
  const latestOnViewChangeRef = useRef<typeof onViewChange>(onViewChange);
  const onContextReadyRef = useRef<typeof onContextReady>(onContextReady);

  useEffect(() => {
    latestCandlestickDataRef.current = candlestickData;
  }, [candlestickData]);

  useEffect(() => {
    latestChartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    latestOnViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onContextReadyRef.current = onContextReady;
  }, [onContextReady]);

  const notifyViewChange = useCallback(() => {
    const rendererInstance = rendererRef.current;
    const onViewChangeCb = latestOnViewChangeRef.current;
    if (!rendererInstance || !onViewChangeCb) {
      return;
    }

    const viewState = rendererInstance.getViewState();
    const data = latestCandlestickDataRef.current;
    const chartTypeSnapshot = latestChartTypeRef.current;

    const visibleRange =
      chartTypeSnapshot === 'candlestick' && data && data.length
        ? rendererInstance.getVisibleRange(data)
        : null;

    onViewChangeCb({ viewState, visibleRange });
  }, []);

  useEffect(() => {
    notifyViewChange();
  }, [notifyViewChange, chartType, candlestickData]);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Inicializar WebGL context
      webglContextRef.current = new WebGLContext(canvasRef.current);
      
      // Inicializar renderer
      const gl = webglContextRef.current.getContext();
      if (gl) {
        rendererRef.current = new Renderer(gl, canvasRef.current);
        
        // Configurar resize handler
        const handleResize = () => {
          webglContextRef.current?.resize();
          notifyViewChange();
        };

        // Configurar render loop
        const renderLoop = () => {
          if (rendererRef.current?.isInitialized()) {
            rendererRef.current.render();
          }
          requestAnimationFrame(renderLoop);
        };

        // Iniciar render loop
        renderLoop();
        
        // Configurar event listeners
        window.addEventListener('resize', handleResize);
        
        // Notificar que o contexto está pronto
        const contextReadyCb = onContextReadyRef.current;
        if (contextReadyCb) {
          contextReadyCb(webglContextRef.current, rendererRef.current);
        }
        
        setIsInitialized(true);
        notifyViewChange();
        
        return () => {
          window.removeEventListener('resize', handleResize);
          webglContextRef.current?.destroy();
          rendererRef.current?.destroy();
        };
      }
    } catch (error) {
      logger.error('Failed to initialize WebGL Canvas:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  // Render loop para manter a tela atualizada
  useEffect(() => {
    if (!isInitialized) return;

    const renderLoop = () => {
      if (rendererRef.current?.isInitialized()) {
        rendererRef.current.render();
      }
      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }, [isInitialized]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isInitialized) return;
    
    // Usar rendererRef diretamente dentro do handler para garantir que está atualizado
    const getRenderer = () => rendererRef.current;

    let regionActive = false;
    let regionStart: { x: number; y: number } | null = null;

    const handleMouseDown = (event: MouseEvent) => {
      const renderer = getRenderer();
      if (!renderer) return;
      
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      if (event.shiftKey && onRegionStart) {
        const accepted = onRegionStart({
          startX: localX,
          startY: localY,
          canvasWidth: rect.width,
          canvasHeight: rect.height
        });
        if (accepted) {
          regionActive = true;
          regionStart = { x: localX, y: localY };
          canvas.style.cursor = 'crosshair';
          return;
        }
      }

      isDraggingRef.current = true;
      lastXRef.current = event.clientX;
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      if (regionActive && regionStart && onRegionUpdate) {
        onRegionUpdate({
          startX: regionStart.x,
          startY: regionStart.y,
          currentX: localX,
          currentY: localY,
          canvasWidth: rect.width,
          canvasHeight: rect.height
        });
        return;
      }

      if (onPointerHover) {
        pendingHoverRef.current = {
          x: localX,
          y: localY,
          canvasWidth: rect.width,
          canvasHeight: rect.height,
          isDragging: isDraggingRef.current
        };
        if (hoverFrameRef.current === null) {
          hoverFrameRef.current = requestAnimationFrame(() => {
            hoverFrameRef.current = null;
            if (pendingHoverRef.current) {
              onPointerHover?.(pendingHoverRef.current);
              pendingHoverRef.current = null;
            }
          });
        }
      }

      if (isDraggingRef.current && lastXRef.current !== null) {
        const currentRenderer = getRenderer();
        if (currentRenderer) {
        const deltaX = event.clientX - lastXRef.current;
          currentRenderer.panPixels(deltaX);
        lastXRef.current = event.clientX;
        notifyViewChange();
        }
      }
    };

    const finalizeRegion = (event?: MouseEvent, cancelled = false) => {
      if (!regionActive || !regionStart || !onRegionEnd) {
        regionActive = false;
        regionStart = null;
        canvas.style.cursor = 'default';
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const endX = event ? event.clientX - rect.left : regionStart.x;
      const endY = event ? event.clientY - rect.top : regionStart.y;

      onRegionEnd({
        startX: regionStart.x,
        startY: regionStart.y,
        endX,
        endY,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        cancelled
      });

      regionActive = false;
      regionStart = null;
      canvas.style.cursor = 'default';
    };

    const endDrag = (event?: MouseEvent) => {
      if (regionActive) {
        finalizeRegion(event, false);
        return;
      }

      isDraggingRef.current = false;
      lastXRef.current = null;
      canvas.style.cursor = 'default';
    };

    const handleClick = (event: MouseEvent) => {
      if (!canvas || !onPointerClick) return;

      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;

      onPointerClick({
        x: localX,
        y: localY,
        canvasWidth: rect.width,
        canvasHeight: rect.height
      });
    };

    const handleMouseLeave = () => {
      if (regionActive) {
        finalizeRegion(undefined, true);
      } else {
        endDrag();
      }
      if (onPointerLeave) {
        onPointerLeave();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (!canvas) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      pendingWheelRef.current = {
        offsetX: event.clientX - rect.left,
        canvasWidth: rect.width,
        deltaY: event.deltaY
      };
      if (wheelFrameRef.current === null) {
        wheelFrameRef.current = requestAnimationFrame(() => {
          wheelFrameRef.current = null;
          const payload = pendingWheelRef.current;
          pendingWheelRef.current = null;
          if (!payload) {
            return;
          }
          const currentRenderer = getRenderer();
          if (currentRenderer) {
            currentRenderer.zoomAtPixel(payload.offsetX, payload.canvasWidth, payload.deltaY);
          notifyViewChange();
          }
        });
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('click', handleClick);
    window.addEventListener('mouseup', endDrag);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', endDrag);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('mouseup', endDrag);
      canvas.style.cursor = 'default';
      if (regionActive) {
        finalizeRegion(undefined, true);
      }
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverRef.current = null;
      if (wheelFrameRef.current !== null) {
        cancelAnimationFrame(wheelFrameRef.current);
        wheelFrameRef.current = null;
      }
      pendingWheelRef.current = null;
    };
  }, [
    isInitialized,
    notifyViewChange,
    onPointerHover,
    onPointerLeave,
    onPointerClick,
    onRegionStart,
    onRegionUpdate,
    onRegionEnd
  ]);

  useEffect(() => {
    if (!isInitialized) return;
    notifyViewChange();
  }, [isInitialized, notifyViewChange, candlestickData, chartType]);

  if (error) {
    return (
      <div className={`webgl-error ${className}`} style={{ width: width || '100%', height: height || '100%' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: '4px',
          color: '#666'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h3>WebGL Error</h3>
            <p>{error}</p>
            <p>Please try refreshing the page or use a different browser.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <canvas
      id="glcanvas"
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
