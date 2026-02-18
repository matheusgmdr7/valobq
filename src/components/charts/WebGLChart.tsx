import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Canvas } from './Canvas';
import { WebGLContext } from '../../engine/webgl/WebGLContext';
import { CandlestickData, LineData, AreaData, ChartConfig, DrawingShape, DrawingPoint } from '../../types/chart';
import { ViewState, VisibleRange } from '../../engine/charts/ChartManager';
import { PerformanceOverlay } from './PerformanceOverlay';
import { PerformanceStats } from '../../engine/webgl/PerformanceMonitor';
import { useRealtimeData } from '../../hooks/useRealtimeData';
import { trackChartEvent } from '@/utils/analytics';
import { rafThrottle, throttle } from '@/utils/performance';
import { SmoothRenderer } from '@/utils/smoothRenderer';
import { ChartAxes } from './ChartAxes';
import clsx from 'clsx';
import { logger } from '@/utils/logger';

interface WebGLChartProps {
  width?: number;
  height?: number;
  className?: string;
  chartType?: 'candlestick' | 'line' | 'area';
  data?: CandlestickData[] | LineData[] | AreaData[];
  // WebSocket/Realtime Data Configuration
  realtimeConfig?: {
    symbol: string;
    websocketUrl?: string;
    pollingUrl?: string;
    pollingInterval?: number;
    enableWebSocket?: boolean;
    enablePolling?: boolean;
    maxCandles?: number;
  };
  onZoomChange?: (isCustom: boolean) => void;
  onCandleSelect?: (candle: CandlestickData | null) => void;
  onRegionSelect?: (info: {
    startCandle: CandlestickData;
    endCandle: CandlestickData;
    priceStart: number;
    priceEnd: number;
    priceRange: number;
    candleCount: number;
    timeStart: number;
    timeEnd: number;
  } | null) => void;
  onRealtimeStatusChange?: (status: 'connected' | 'disconnected' | 'polling') => void;
}

interface HoverState {
  candle: CandlestickData;
  index: number;
  canvasWidth: number;
  canvasHeight: number;
  x: number;
  y: number;
  localX: number;
  localY: number;
}

interface CrosshairState {
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  clipX: number;
  clipY: number;
  originalX: number;
}

interface SelectionState {
  candle: CandlestickData;
  index: number;
}

interface RegionSelectionState {
  mode: 'idle' | 'active' | 'completed';
  start: RegionPoint;
  current: RegionPoint;
  end?: RegionPoint;
}

interface RegionPoint {
  pixelX: number;
  pixelY: number;
  clipX: number;
  clipY: number;
  originalX: number;
  index: number;
  price: number;
  time: number;
}

interface HudState {
  viewState: ViewState | null;
  visibleRange: VisibleRange | null;
}

const INITIAL_HUD_STATE: HudState = {
  viewState: null,
  visibleRange: null
};

const createRegionPoint = (): RegionPoint => ({
  pixelX: 0,
  pixelY: 0,
  clipX: 0,
  clipY: 0,
  originalX: 0,
  index: 0,
  price: 0,
  time: 0
});

type DrawingMode = 'none' | 'trendline' | 'horizontal' | 'rectangle';

let drawingIdCounter = 0;
const generateDrawingId = () => `drawing-${Date.now()}-${drawingIdCounter++}`;

const toDrawingPoint = (point: RegionPoint): DrawingPoint => ({
  originalX: point.originalX,
  price: point.price
});

const areHudStatesEqual = (a: HudState, b: HudState): boolean => {
  if (a === b) return true;
  if (!a || !b) {
    return !a?.viewState && !a?.visibleRange && !b?.viewState && !b?.visibleRange;
  }

  const viewA = a.viewState;
  const viewB = b.viewState;
  const visibleA = a.visibleRange;
  const visibleB = b.visibleRange;

  const viewEqual =
    (!viewA && !viewB) ||
    (viewA &&
      viewB &&
      Math.abs(viewA.scaleX - viewB.scaleX) < 1e-6 &&
      Math.abs(viewA.scaleY - viewB.scaleY) < 1e-6 &&
      Math.abs(viewA.translateX - viewB.translateX) < 1e-6 &&
      Math.abs(viewA.translateY - viewB.translateY) < 1e-6);

  const visibleEqual =
    (!visibleA && !visibleB) ||
    (visibleA &&
      visibleB &&
      visibleA.timeStart === visibleB.timeStart &&
      visibleA.timeEnd === visibleB.timeEnd &&
      Math.abs(visibleA.priceMin - visibleB.priceMin) < 1e-6 &&
      Math.abs(visibleA.priceMax - visibleB.priceMax) < 1e-6 &&
      visibleA.startIndex === visibleB.startIndex &&
      visibleA.endIndex === visibleB.endIndex &&
      visibleA.candleCount === visibleB.candleCount);

  return Boolean(viewEqual && visibleEqual);
};


const sanitizeStoredDrawing = (raw: any): DrawingShape | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const isPoint = (point: any): point is DrawingPoint =>
    point &&
    typeof point.originalX === 'number' &&
    Number.isFinite(point.originalX) &&
    typeof point.price === 'number' &&
    Number.isFinite(point.price);

  switch (raw.type) {
    case 'trendline':
      if (isPoint(raw.start) && isPoint(raw.end)) {
        return {
          id: typeof raw.id === 'string' ? raw.id : generateDrawingId(),
          type: 'trendline',
          start: raw.start,
          end: raw.end
        };
      }
      return null;
    case 'horizontal':
      if (typeof raw.price === 'number' && Number.isFinite(raw.price)) {
        return {
          id: typeof raw.id === 'string' ? raw.id : generateDrawingId(),
          type: 'horizontal',
          price: raw.price
        };
      }
      return null;
    case 'rectangle':
      if (isPoint(raw.start) && isPoint(raw.end)) {
        return {
          id: typeof raw.id === 'string' ? raw.id : generateDrawingId(),
          type: 'rectangle',
          start: raw.start,
          end: raw.end
        };
      }
      return null;
    default:
      return null;
  }
};

export const WebGLChart: React.FC<WebGLChartProps> = ({ 
  width = 800, 
  height = 600, 
  className = '',
  chartType = 'candlestick',
  data = [],
  realtimeConfig,
  onZoomChange,
  onCandleSelect,
  onRegionSelect,
  onRealtimeStatusChange
}) => {
  const [webglContext, setWebglContext] = useState<WebGLContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [renderer, setRenderer] = useState<any>(null);
  const [hudState, setHudState] = useState<HudState>(INITIAL_HUD_STATE);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [performanceVisible, setPerformanceVisible] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverState | null>(null);
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [regionSelection, setRegionSelection] = useState<RegionSelectionState>({
    mode: 'idle',
    start: createRegionPoint(),
    current: createRegionPoint()
  });
  const [isCustomZoom, setIsCustomZoom] = useState(false);
  const [canUndoZoom, setCanUndoZoom] = useState(false);
  const hasCenteredInitialCandleRef = useRef(false);
  const lastCandleTimestampRef = useRef<number | null>(null); // Rastrear timestamp do último candle
  const [selectionHistory, setSelectionHistory] = useState<SelectionState[]>([]);
  const prevRegionModeRef = useRef<RegionSelectionState['mode']>(regionSelection.mode);
  const latestDataRef = useRef<typeof data>(data); // Inicializar com data, será atualizado depois
  const latestChartTypeRef = useRef(chartType);
  const latestRendererRef = useRef<any>(null);
  const latestZoomChangeRef = useRef(onZoomChange);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [drawings, setDrawings] = useState<DrawingShape[]>([]);
  const [pendingDrawing, setPendingDrawing] = useState<{ type: 'trendline' | 'rectangle'; start: DrawingPoint } | null>(null);
  const [previewShape, setPreviewShape] = useState<DrawingShape | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const smoothRendererRef = useRef<SmoothRenderer | null>(null);
  const pendingRenderRef = useRef(false);

  // Realtime Data Hook (se configurado)
  const realtimeData = useRealtimeData({
    symbol: realtimeConfig?.symbol || '',
    websocketUrl: realtimeConfig?.websocketUrl,
    pollingUrl: realtimeConfig?.pollingUrl,
    pollingInterval: realtimeConfig?.pollingInterval,
    enableWebSocket: realtimeConfig?.enableWebSocket,
    enablePolling: realtimeConfig?.enablePolling,
    maxCandles: realtimeConfig?.maxCandles,
    initialData: realtimeConfig && chartType === 'candlestick' ? (data as CandlestickData[]) : [],
    autoStart: !!realtimeConfig,
    onDataUpdate: (candles) => {
      // Dados atualizados via WebSocket/Polling
      // latestDataRef será atualizado no useEffect abaixo
    },
    onStatusChange: (status) => {
      onRealtimeStatusChange?.(status);
    }
  });

  // Usar dados em tempo real se configurado, senão usar prop data
  const effectiveData = realtimeConfig && chartType === 'candlestick' 
    ? realtimeData.candles 
    : data;
  

  // Inicializar SmoothRenderer para renderização suave
  useEffect(() => {
    if (!renderer) return;

    if (!smoothRendererRef.current) {
      smoothRendererRef.current = new SmoothRenderer(60); // 60 FPS
    }

    const smoothRenderer = smoothRendererRef.current;
    
    // Função de renderização suave
    const renderSmooth = () => {
      if (!renderer) {
        return;
      }
      
      // Se não há renderização pendente, não renderizar (economiza recursos)
      if (!pendingRenderRef.current) {
        return;
      }
      
      const dataSnapshot = effectiveData;
      if (!dataSnapshot || dataSnapshot.length === 0) {
        pendingRenderRef.current = false;
        return;
      }

      try {
        if (chartType === 'candlestick') {
          const candles = dataSnapshot as CandlestickData[];
          renderer.renderCandlestick(candles);
        } else if (chartType === 'line') {
          renderer.renderLine(dataSnapshot as LineData[]);
        } else if (chartType === 'area') {
          renderer.renderArea(dataSnapshot as AreaData[]);
        }
        pendingRenderRef.current = false;
      } catch (error) {
        logger.error('[WebGLChart]', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Iniciar loop de renderização suave
    smoothRenderer.start(renderSmooth);

    return () => {
      smoothRenderer.stop();
    };
  }, [renderer, chartType, effectiveData]);

  // Criar hash dos dados para detectar mudanças de conteúdo (não apenas referência)
  const dataHash = useMemo(() => {
    if (!effectiveData || effectiveData.length === 0) return '';
    const lastCandle = effectiveData[effectiveData.length - 1] as CandlestickData;
    const hash = `${effectiveData.length}-${lastCandle.timestamp}-${lastCandle.close.toFixed(5)}-${lastCandle.high.toFixed(5)}-${lastCandle.low.toFixed(5)}`;
    return hash;
  }, [effectiveData]);

  // Atualizar latestDataRef quando effectiveData mudar
  useEffect(() => {
    const prevLength = latestDataRef.current?.length || 0;
    // IMPORTANTE: Ler prevLastCandle ANTES de atualizar latestDataRef
    const prevLastCandle = latestDataRef.current?.[latestDataRef.current.length - 1] as CandlestickData | undefined;
    const currentLastCandle = effectiveData[effectiveData.length - 1] as CandlestickData | undefined;
    
    // Verificar se dados realmente mudaram (comparação profunda)
    const lengthChanged = prevLength !== effectiveData.length;
    
    // Comparar usando valores numéricos (não referências)
    let lastCandleChanged = false;
    if (prevLastCandle && currentLastCandle) {
      const closeDiff = Math.abs(prevLastCandle.close - currentLastCandle.close);
      const highDiff = Math.abs(prevLastCandle.high - currentLastCandle.high);
      const lowDiff = Math.abs(prevLastCandle.low - currentLastCandle.low);
      const timestampChanged = prevLastCandle.timestamp !== currentLastCandle.timestamp;
      
      lastCandleChanged = closeDiff > 0.00001 || highDiff > 0.00001 || lowDiff > 0.00001 || timestampChanged;
    } else if (currentLastCandle) {
      lastCandleChanged = true;
    }
    
    // Atualizar referência DEPOIS da comparação
    latestDataRef.current = effectiveData;
    
    // Resetar flag de centralização quando dados mudam significativamente
    if (effectiveData.length === 0 || lengthChanged) {
      hasCenteredInitialCandleRef.current = false;
    }
    
    // Marcar renderização pendente quando dados mudam (length ou conteúdo)
    // Isso garante que o SmoothRenderer processe as atualizações suavemente
    if (effectiveData.length > 0 && renderer && (lengthChanged || lastCandleChanged)) {
      pendingRenderRef.current = true;
    }
  }, [dataHash, effectiveData, renderer]);

  const STORAGE_KEYS = {
    drawings: 'webgl_chart_drawings',
    drawingMode: 'webgl_chart_drawing_mode',
    panelCollapsed: 'webgl_chart_panel_collapsed'
  } as const;

  const hasRestoredDrawingsRef = useRef(false);
  const hasRestoredPanelRef = useRef(false);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    latestChartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    latestRendererRef.current = renderer;
  }, [renderer]);

  useEffect(() => {
    latestZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);


  useEffect(() => {
    if (hasRestoredPanelRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedPanel = window.localStorage.getItem(STORAGE_KEYS.panelCollapsed);
      if (storedPanel !== null) {
        setIsPanelCollapsed(storedPanel === 'true');
      }
    } catch {
      // Silently ignore restore failures
    }
    hasRestoredPanelRef.current = true;
  }, []);

  useEffect(() => {
    if (!renderer || chartType !== 'candlestick') {
      return;
    }
    if (hasRestoredDrawingsRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedDrawings = window.localStorage.getItem(STORAGE_KEYS.drawings);
      if (storedDrawings) {
        const parsed = JSON.parse(storedDrawings);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map(sanitizeStoredDrawing)
            .filter((shape): shape is DrawingShape => Boolean(shape));
          if (sanitized.length) {
            setDrawings(sanitized);
          }
        }
      }

      const storedMode = window.localStorage.getItem(STORAGE_KEYS.drawingMode);
      if (
        storedMode &&
        (storedMode === 'none' ||
          storedMode === 'trendline' ||
          storedMode === 'horizontal' ||
          storedMode === 'rectangle')
      ) {
        setDrawingMode(storedMode as DrawingMode);
      }
    } catch {
      // Silently ignore restore failures
    }
    hasRestoredDrawingsRef.current = true;
  }, [renderer, chartType]);

  useEffect(() => {
    if (!hasRestoredDrawingsRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const serializable = drawings
        .filter((shape) => !shape.isDraft)
        .map(({ isDraft, ...rest }) => rest);
      if (serializable.length) {
        window.localStorage.setItem(STORAGE_KEYS.drawings, JSON.stringify(serializable));
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.drawings);
      }
    } catch {
      // Silently ignore persist failures
    }
  }, [drawings]);

  useEffect(() => {
    if (!hasRestoredDrawingsRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.drawingMode, drawingMode);
    } catch {
      // Silently ignore persist failures
    }
  }, [drawingMode]);

  useEffect(() => {
    if (!hasRestoredPanelRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.panelCollapsed, String(isPanelCollapsed));
    } catch {
      // Silently ignore persist failures
    }
  }, [isPanelCollapsed]);

  useEffect(() => {
    if (!renderer?.setDrawingShapes) {
      return;
    }
    if (chartType !== 'candlestick') {
      renderer.setDrawingShapes([]);
      return;
    }
    const combined = previewShape
      ? [...drawings, { ...previewShape, id: '__preview__' }]
      : drawings;
    renderer.setDrawingShapes(combined);
  }, [renderer, drawings, previewShape, chartType]);


  const handleContextReady = useCallback((context: WebGLContext, rendererInstance: any) => {
    // Track chart initialization
    trackChartEvent('chart_initialized', {
      chartType,
      hasRealtime: !!realtimeConfig,
      dataLength: effectiveData.length
    });

    setWebglContext((prev) => (prev === context ? prev : context));
    setRenderer((prev: any) => (prev === rendererInstance ? prev : rendererInstance));
    setIsReady((prev) => (prev ? prev : true));

    const nextCanUndo = rendererInstance?.canUndoView?.() ?? false;
    setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));

    const dataSnapshot = latestDataRef.current;
    if (!rendererInstance || !dataSnapshot || dataSnapshot.length === 0) {
      setHudState((prev) => (areHudStatesEqual(prev, INITIAL_HUD_STATE) ? prev : INITIAL_HUD_STATE));
      return;
    }

    const chartTypeSnapshot = latestChartTypeRef.current;

    switch (chartTypeSnapshot) {
      case 'candlestick':
        rendererInstance.renderCandlestick(dataSnapshot as CandlestickData[]);
        break;
      case 'line':
        rendererInstance.renderLine(dataSnapshot as LineData[]);
        break;
      case 'area':
        rendererInstance.renderArea(dataSnapshot as AreaData[]);
        break;
    }

    if (chartTypeSnapshot === 'candlestick') {
      const viewState: ViewState | null = rendererInstance.getViewState?.() ?? null;
      const visibleRange: VisibleRange | null = rendererInstance.getVisibleRange
        ? rendererInstance.getVisibleRange(dataSnapshot as CandlestickData[])
        : null;
      const nextState: HudState = { viewState, visibleRange };
      setHudState((prev) => (areHudStatesEqual(prev, nextState) ? prev : nextState));
    } else {
      setHudState((prev) => (areHudStatesEqual(prev, INITIAL_HUD_STATE) ? prev : INITIAL_HUD_STATE));
    }

  }, []);

  const syncHudState = useCallback(() => {
    if (!renderer || chartType !== 'candlestick' || effectiveData.length === 0) {
      setHudState((prev) => (areHudStatesEqual(prev, INITIAL_HUD_STATE) ? prev : INITIAL_HUD_STATE));
      const nextCanUndo = renderer?.canUndoView?.() ?? false;
      setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
      return;
    }

    const viewState: ViewState | null = renderer.getViewState?.() ?? null;
    const visibleRange: VisibleRange | null = renderer.getVisibleRange
      ? renderer.getVisibleRange(effectiveData as CandlestickData[])
      : null;

    const nextState: HudState = { viewState, visibleRange };
    setHudState((prev) => (areHudStatesEqual(prev, nextState) ? prev : nextState));
    const nextCanUndo = renderer.canUndoView?.() ?? false;
    setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
  }, [renderer, chartType, effectiveData]);

  // Throttled version of syncHudState for performance
  const throttledSyncHudState = useMemo(
    () => throttle(syncHudState, 16), // ~60fps
    [syncHudState]
  );

  const handleViewChange = useCallback((info: { viewState: ViewState | null; visibleRange: VisibleRange | null }) => {
    const prevHudState = hudState;
    setHudState((prev) => (areHudStatesEqual(prev, info) ? prev : info));
    const nextCanUndo = renderer?.canUndoView?.() ?? false;
    setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
    
    // Detectar se o usuário fez zoom ou pan (mudança no viewState)
    // Se o viewState mudou e não é a centralização inicial, setar isCustomZoom
    if (info.viewState && prevHudState.viewState) {
      const prevView = prevHudState.viewState;
      const currentView = info.viewState;
      const hasChanged = 
        Math.abs(prevView.scaleX - currentView.scaleX) > 0.001 ||
        Math.abs(prevView.translateX - currentView.translateX) > 0.001;
      
      // Se mudou e não está na centralização inicial, é zoom/pan do usuário
      if (hasChanged && hasCenteredInitialCandleRef.current && !isCustomZoom) {
        setIsCustomZoom(true);
        latestZoomChangeRef.current?.(true);
      }
    }
  }, [renderer, hudState, isCustomZoom]);

  const convertPixelToPoint = useCallback(
    (
      pixelX: number,
      pixelY: number,
      canvasWidth: number,
      canvasHeight: number
    ): RegionPoint | null => {
      if (chartType !== 'candlestick' || data.length === 0) {
        return null;
      }

      const candles = effectiveData as CandlestickData[];

      const defaultView: ViewState = hudState.viewState ?? {
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0
      };

      const clipX = (pixelX / canvasWidth) * 2 - 1;
      const clipY = ((canvasHeight - pixelY) / canvasHeight) * 2 - 1;
      const originalX = (clipX - defaultView.translateX) / (defaultView.scaleX || 1);
      const candleSpacing = 2 / candles.length;
      const indexFloat = ((originalX + 1) / 2) * (candles.length - 1);
      const index = Math.max(0, Math.min(candles.length - 1, Math.round(indexFloat)));
      const candle = candles[index];

      if (!candle) {
        return null;
      }

      const visibleRange = hudState.visibleRange;
      const minPrice = visibleRange?.priceMin ?? candle.low;
      const maxPrice = visibleRange?.priceMax ?? candle.high;
      const priceSpan = maxPrice - minPrice || 1;
      const priceRatio = Math.max(0, Math.min(1, (clipY + 1) / 2));
      const price = minPrice + priceSpan * priceRatio;

      return {
        pixelX,
        pixelY,
        clipX,
        clipY,
        originalX,
        index,
        price,
        time: candle.timestamp
      };
    },
    [hudState.viewState, hudState.visibleRange, chartType, data]
  );

  // Throttled pointer hover handler for better performance
  const handlePointerHoverInternal = useCallback((info: {
    x: number;
    y: number;
    canvasWidth: number;
    canvasHeight: number;
    isDragging: boolean;
  }) => {
    if (chartType !== 'candlestick' || !renderer || !data.length || info.isDragging) {
      setHoverInfo(null);
      setCrosshair(null);
      if (!pendingDrawing && drawingMode === 'horizontal') {
        setPreviewShape(null);
      }
      return;
    }

    const viewState: ViewState | null = renderer.getViewState?.() ?? null;
    if (!viewState || !viewState.scaleX) {
      setHoverInfo(null);
      setCrosshair(null);
      if (!pendingDrawing && drawingMode === 'horizontal') {
        setPreviewShape(null);
      }
      return;
    }

    const candles = effectiveData as CandlestickData[];
    const candleSpacing = 2 / candles.length;
    const halfWidth = (candleSpacing * 0.6) / 2;

    const clipX = (info.x / info.canvasWidth) * 2 - 1;
    const clipY = ((info.canvasHeight - info.y) / info.canvasHeight) * 2 - 1;
    const originalX = (clipX - viewState.translateX) / viewState.scaleX;

    const relative = (originalX + 1) / candleSpacing;
    const index = Math.round(relative - 0.5);

    if (index < 0 || index >= candles.length) {
      setHoverInfo(null);
      setCrosshair(null);
      return;
    }

    const center = -1 + (index + 0.5) * candleSpacing;
    if (Math.abs(originalX - center) > halfWidth) {
      setHoverInfo(null);
      setCrosshair(null);
      return;
    }

    setHoverInfo({
      candle: candles[index],
      index,
      canvasWidth: info.canvasWidth,
      canvasHeight: info.canvasHeight,
      x: info.x,
      y: info.y,
      localX: info.x,
      localY: info.y
    });

    setCrosshair({
      canvasX: info.x,
      canvasY: info.y,
      canvasWidth: info.canvasWidth,
      canvasHeight: info.canvasHeight,
      clipX,
      clipY,
      originalX
    });
    if (drawingMode !== 'none') {
      const point = convertPixelToPoint(info.x, info.y, info.canvasWidth, info.canvasHeight);
      if (!point) {
        if (!pendingDrawing && drawingMode === 'horizontal') {
          setPreviewShape(null);
        }
        return;
      }
      const draftPoint = toDrawingPoint(point);

      if (drawingMode === 'horizontal') {
        setPreviewShape({
          id: '__preview__',
          type: 'horizontal',
          price: draftPoint.price,
          isDraft: true
        });
        return;
      }

      if (pendingDrawing?.type === 'trendline' && drawingMode === 'trendline') {
        setPreviewShape({
          id: '__preview__',
          type: 'trendline',
          start: pendingDrawing.start,
          end: draftPoint,
          isDraft: true
        });
        return;
      }

      if (pendingDrawing?.type === 'rectangle' && drawingMode === 'rectangle') {
        setPreviewShape({
          id: '__preview__',
          type: 'rectangle',
          start: pendingDrawing.start,
          end: draftPoint,
          isDraft: true
        });
        return;
      }

      if (drawingMode === 'trendline' || drawingMode === 'rectangle') {
        setPreviewShape(null);
      }
    } else if (!pendingDrawing) {
      setPreviewShape(null);
    }
  }, [chartType, renderer, data, drawingMode, pendingDrawing, convertPixelToPoint, effectiveData]);

  // Throttled version using RAF for smooth 60fps updates
  const handlePointerHover = useMemo(
    () => rafThrottle(handlePointerHoverInternal),
    [handlePointerHoverInternal]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverInfo(null);
    setCrosshair(null);
    if (pendingDrawing) {
      const start = pendingDrawing.start;
      if (pendingDrawing.type === 'trendline') {
        setPreviewShape({
          id: '__preview__',
          type: 'trendline',
          start,
          end: start,
          isDraft: true
        });
      } else if (pendingDrawing.type === 'rectangle') {
        setPreviewShape({
          id: '__preview__',
          type: 'rectangle',
          start,
          end: start,
          isDraft: true
        });
      }
    } else if (drawingMode === 'horizontal') {
      setPreviewShape(null);
    }
  }, [pendingDrawing, drawingMode]);

  const handleResetZoom = useCallback(() => {
    if (!renderer) return;
    renderer.resetView();
    setIsCustomZoom(false);
    latestZoomChangeRef.current?.(false);
    
    // Track zoom reset
    trackChartEvent('zoom_reset', {
      chartType
    });
    
    const nextCanUndo = renderer.canUndoView?.() ?? false;
    setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
    setRegionSelection({
      mode: 'idle',
      start: createRegionPoint(),
      current: createRegionPoint()
    });
  }, [renderer, onZoomChange]);

  const handleUndoView = useCallback(() => {
    if (!renderer) return;
    if (renderer.undoView?.()) {
      setIsCustomZoom(true);
      latestZoomChangeRef.current?.(true);
      const nextCanUndo = renderer.canUndoView?.() ?? false;
      setCanUndoZoom((prev) => (prev === nextCanUndo ? prev : nextCanUndo));
      syncHudState();
    }
  }, [renderer, syncHudState]);

  // Removido: este useEffect estava resetando o view quando não havia zoom customizado,
  // causando problemas com o zoom do usuário. A centralização inicial é feita no useEffect de renderização.

  useEffect(() => {
    const rendererInstance = latestRendererRef.current;
    if (!rendererInstance) return;

    const dataSnapshot = latestDataRef.current;
    if (!dataSnapshot || dataSnapshot.length === 0) {
      setHudState((prev) => (areHudStatesEqual(prev, INITIAL_HUD_STATE) ? prev : INITIAL_HUD_STATE));
      hasCenteredInitialCandleRef.current = false;
      return;
    }

    switch (chartType) {
      case 'candlestick':
        rendererInstance.renderCandlestick(dataSnapshot as CandlestickData[]);
        break;
      case 'line':
        rendererInstance.renderLine(dataSnapshot as LineData[]);
        break;
      case 'area':
        rendererInstance.renderArea(dataSnapshot as AreaData[]);
        break;
    }

    if (chartType === 'candlestick') {
      // Função auxiliar para centralizar o último candle
      const centerOnLastCandle = () => {
        if (dataSnapshot.length === 0) return;
        
        const candleCount = dataSnapshot.length;
        const targetVisibleCandles = 100; // Mostrar aproximadamente 100 candles
        const candleSpacing = 2 / candleCount;
        const lastCandleIndex = candleCount - 1;
        const lastCandleX = -1 + (lastCandleIndex + 0.5) * candleSpacing;
        
        // Para centralizar o último candle, precisamos usar um range que permita translateX
        // A estratégia: usar zoomToRange com um range que termine no último candle
        // mas comece mais à esquerda, de forma que após o zoom, o último candle fique no centro
        
        // Calcular quantos candles mostrar à esquerda do último
        const candlesToShowLeft = Math.min(Math.floor(targetVisibleCandles / 2), lastCandleIndex);
        const startIndex = Math.max(0, lastCandleIndex - candlesToShowLeft);
        const startCandleX = -1 + (startIndex + 0.5) * candleSpacing;
        
        // Para centralizar o último candle, vamos:
        // 1. Usar zoomToRange para definir um range que termine no último candle
        // 2. Calcular o translateX necessário para centralizar o último candle
        // 3. Ajustar o translateX diretamente
        
        const rangeWidth = lastCandleX - startCandleX;
        // Usar um range 2x maior à esquerda para permitir centralização
        const adjustedStartX = Math.max(-1, startCandleX - rangeWidth);
        
        // Calcular diretamente o scaleX e translateX necessários para centralizar
        // Para centralizar lastCandleX em 0:
        // 0 = scaleX * lastCandleX + translateX
        // translateX = -scaleX * lastCandleX
        
        // Calcular scaleX para mostrar o range ajustado
        const adjustedRangeWidth = lastCandleX - adjustedStartX;
        const targetScale = Math.min(5, Math.max(1, 2 / adjustedRangeWidth));
        const requiredTranslateX = -targetScale * lastCandleX;
        const maxTranslate = Math.max(0, targetScale - 1);
        
        if (Math.abs(requiredTranslateX) <= maxTranslate && rendererInstance.updateViewState) {
          rendererInstance.updateViewState({
            scaleX: targetScale,
            translateX: requiredTranslateX
          });
        } else if (rendererInstance.centerOnCandle) {
          const reducedVisibleCandles = Math.min(50, Math.floor(candleCount / 2));
          rendererInstance.centerOnCandle(lastCandleX, reducedVisibleCandles, candleCount);
        }
      };
      
      // Verificar se o último candle mudou (novo timestamp)
      const lastCandle = dataSnapshot[dataSnapshot.length - 1];
      const currentLastTimestamp = lastCandle?.timestamp;
      const hasNewCandle = currentLastTimestamp && 
                          currentLastTimestamp !== lastCandleTimestampRef.current;
      
      // Sempre centralizar quando:
      // 1. Primeira renderização (não centralizou ainda)
      // 2. Novo candle chegou e não há zoom customizado
      const shouldCenter = (!hasCenteredInitialCandleRef.current || 
                           (hasNewCandle && !isCustomZoom)) && 
                          dataSnapshot.length > 0;
      
      if (shouldCenter) {
        centerOnLastCandle();
        rendererInstance.renderCandlestick(dataSnapshot as CandlestickData[]);
        hasCenteredInitialCandleRef.current = true;
        if (currentLastTimestamp) {
          lastCandleTimestampRef.current = currentLastTimestamp;
        }
        // Sincronizar estado após centralizar
        syncHudState();
      } else {
        // Renderizar normalmente sem centralizar
        rendererInstance.renderCandlestick(dataSnapshot as CandlestickData[]);
        syncHudState();
      }
      
      // Marcar renderização pendente para SmoothRenderer
      pendingRenderRef.current = true;
      } else {
      setHudState((prev) => (areHudStatesEqual(prev, INITIAL_HUD_STATE) ? prev : INITIAL_HUD_STATE));
    }
  }, [chartType, data, syncHudState, isCustomZoom]);

  useEffect(() => {
    if (chartType !== 'candlestick') {
      setHoverInfo(null);
      setCrosshair(null);
      setSelection(null);
      setRegionSelection({
        mode: 'idle',
        start: createRegionPoint(),
        current: createRegionPoint()
      });
      setDrawingMode('none');
      setPendingDrawing(null);
      setPreviewShape(null);
      if (isCustomZoom) {
        setIsCustomZoom(false);
        onZoomChange?.(false);
      }
      onCandleSelect?.(null);
      onRegionSelect?.(null);
    }
  }, [chartType, isCustomZoom, onZoomChange, onCandleSelect, onRegionSelect]);

  useEffect(() => {
    if (!selection || chartType !== 'candlestick') {
      return;
    }

    const candles = data as CandlestickData[];
    if (!candles.length) {
      setSelection(null);
      return;
    }

    let updatedIndex = selection.index;
    if (
      updatedIndex >= candles.length ||
      candles[updatedIndex].timestamp !== selection.candle.timestamp
    ) {
      updatedIndex = candles.findIndex((candle) => candle.timestamp === selection.candle.timestamp);
    }

    if (updatedIndex === -1) {
      setSelection(null);
    } else if (
      updatedIndex !== selection.index ||
      candles[updatedIndex] !== selection.candle
    ) {
      setSelection({
        candle: candles[updatedIndex],
        index: updatedIndex
      });
    }
  }, [data, chartType, selection]);

  useEffect(() => {
    if (chartType !== 'candlestick') return;
    onCandleSelect?.(selection?.candle ?? null);
  }, [selection, onCandleSelect, chartType]);

  useEffect(() => {
    if (!selection) return;
    setSelectionHistory((prev) => {
      const filtered = prev.filter((item) => item.candle.timestamp !== selection.candle.timestamp);
      return [selection, ...filtered].slice(0, 6);
    });
  }, [selection]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pendingDrawing) {
          setPendingDrawing(null);
          setPreviewShape(null);
          event.preventDefault();
          return;
        }
        if (drawingMode !== 'none') {
          setDrawingMode('none');
          setPreviewShape(null);
          event.preventDefault();
          return;
        }
      }

      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        if (renderer?.undoView?.()) {
          event.preventDefault();
          setIsCustomZoom(true);
          onZoomChange?.(true);
          setCanUndoZoom(renderer.canUndoView?.() ?? false);
          syncHudState();
        }
      } else if (key === '0') {
        event.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
    };
  }, [renderer, onZoomChange, syncHudState, handleResetZoom, drawingMode, pendingDrawing]);

  useEffect(() => {
    if (!selection || chartType !== 'candlestick') {
      return;
    }

    const candles = data as CandlestickData[];
    if (!candles.length) {
      setSelection(null);
      return;
    }

    let updatedIndex = selection.index;
    if (
      updatedIndex >= candles.length ||
      candles[updatedIndex].timestamp !== selection.candle.timestamp
    ) {
      updatedIndex = candles.findIndex((candle) => candle.timestamp === selection.candle.timestamp);
    }

    if (updatedIndex === -1) {
      setSelection(null);
    } else if (
      updatedIndex !== selection.index ||
      candles[updatedIndex] !== selection.candle
    ) {
      setSelection({
        candle: candles[updatedIndex],
        index: updatedIndex
      });
    }
  }, [data, chartType, selection]);

  useEffect(() => {
    if (chartType !== 'candlestick') return;
    onCandleSelect?.(selection?.candle ?? null);
  }, [selection, onCandleSelect, chartType]);

  useEffect(() => {
    setPendingDrawing(null);
    setPreviewShape(null);
  }, [drawingMode]);

  // Cleanup effect - limpar recursos quando componente for desmontado
  useEffect(() => {
    return () => {
      // Limpar refs
      latestDataRef.current = [];
      latestRendererRef.current = null;
      
      // Limpar estados que podem causar vazamentos
      setHoverInfo(null);
      setCrosshair(null);
      setSelection(null);
      setPreviewShape(null);
      setPendingDrawing(null);
      
      // Notificar callbacks de limpeza
      onCandleSelect?.(null);
      onRegionSelect?.(null);
    };
  }, [onCandleSelect, onRegionSelect]);

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
    setPendingDrawing(null);
    setPreviewShape(null);
  }, []);


  const canvasElement = webglContext?.getCanvas() as HTMLCanvasElement | null;
  
  // Responsive dimensions - adaptar para diferentes tamanhos de tela
  const [containerSize, setContainerSize] = useState({ 
    width: width || 800, 
    height: height || 600 
  });
  
  useEffect(() => {
    const updateSize = () => {
      if (canvasElement?.parentElement) {
        const rect = canvasElement.parentElement.getBoundingClientRect();
        setContainerSize({
          width: rect.width || width || 800,
          height: rect.height || height || 600
        });
      }
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (canvasElement?.parentElement) {
      resizeObserver.observe(canvasElement.parentElement);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasElement, width, height]);
  
  const canvasClientWidth = containerSize.width;
  const canvasClientHeight = containerSize.height;

  useEffect(() => {
    if (!renderer) return;

    const prevMode = prevRegionModeRef.current;
    const mode = regionSelection.mode;

    if (mode === prevMode) {
      return;
    }

    if (mode === 'completed' && regionSelection.end) {
      const minOriginal = Math.min(regionSelection.start.originalX, regionSelection.end.originalX);
      const maxOriginal = Math.max(regionSelection.start.originalX, regionSelection.end.originalX);
      if (Number.isFinite(minOriginal) && Number.isFinite(maxOriginal) && Math.abs(maxOriginal - minOriginal) >= 0.001) {
        renderer.zoomToRange(minOriginal, maxOriginal);
        if (!isCustomZoom) {
          setIsCustomZoom(true);
          onZoomChange?.(true);
        }

        const candles = data as CandlestickData[];
        const startCandle = candles[Math.max(0, Math.min(candles.length - 1, regionSelection.start.index))];
        const endCandle = candles[Math.max(0, Math.min(candles.length - 1, regionSelection.end.index))];
        if (startCandle && endCandle) {
          onRegionSelect?.({
            startCandle,
            endCandle,
            priceStart: regionSelection.start.price,
            priceEnd: regionSelection.end.price,
            priceRange: Math.abs(regionSelection.end.price - regionSelection.start.price),
            candleCount: Math.abs(regionSelection.end.index - regionSelection.start.index) + 1,
            timeStart: Math.min(regionSelection.start.time, regionSelection.end.time ?? regionSelection.start.time),
            timeEnd: Math.max(regionSelection.start.time, regionSelection.end.time ?? regionSelection.start.time)
          });
        }
      }
    } else if (mode === 'idle') {
      onRegionSelect?.(null);
    }

    prevRegionModeRef.current = mode;
  }, [regionSelection, renderer, onZoomChange, data, onRegionSelect, isCustomZoom]);

  // Update performance stats periodically
  useEffect(() => {
    if (!performanceVisible || !renderer) return;

    const interval = setInterval(() => {
      if (renderer?.getPerformanceStats) {
        const stats = renderer.getPerformanceStats();
        setPerformanceStats(stats);
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [performanceVisible, renderer]);

  // Enable/disable performance monitoring when visibility changes
  useEffect(() => {
    if (!renderer) return;
    if (renderer.enablePerformanceMonitoring) {
      renderer.enablePerformanceMonitoring(performanceVisible);
    }
  }, [performanceVisible, renderer]);

  const togglePerformanceMonitoring = useCallback(() => {
    setPerformanceVisible((prev) => !prev);
  }, []);

  return (
    <div className={clsx(
      'relative bg-gray-900 border border-gray-800 overflow-hidden selection:bg-blue-600/30 selection:text-white w-full h-full',
      className
    )}
    >
      <div className="chart-canvas-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Linha vertical central - marca o nascimento dos candles */}
        {chartType === 'candlestick' && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              pointerEvents: 'none',
              zIndex: 15,
              transform: 'translateX(-50%)'
            }}
          />
        )}
        <Canvas
          width={width || canvasClientWidth}
          height={height || canvasClientHeight}
          onContextReady={handleContextReady}
          className="main-chart-canvas"
          chartType={chartType}
          candlestickData={chartType === 'candlestick' ? (effectiveData as CandlestickData[]) : undefined}
          onViewChange={handleViewChange}
          onPointerHover={handlePointerHover}
          onPointerLeave={handlePointerLeave}
          onPointerClick={(info) => {
            if (drawingMode !== 'none') {
              const point = convertPixelToPoint(
                info.x,
                info.y,
                info.canvasWidth,
                info.canvasHeight
              );
              if (!point) {
                return;
              }
              const drawingPoint = toDrawingPoint(point);

              if (drawingMode === 'horizontal') {
                setDrawings((prev) => [
                  ...prev,
                  {
                    id: generateDrawingId(),
                    type: 'horizontal',
                    price: drawingPoint.price
                  }
                ]);
                return;
              }

              if (drawingMode === 'trendline') {
                if (!pendingDrawing) {
                  setPendingDrawing({
                    type: 'trendline',
                    start: drawingPoint
                  });
                  setPreviewShape({
                    id: '__preview__',
                    type: 'trendline',
                    start: drawingPoint,
                    end: drawingPoint,
                    isDraft: true
                  });
                } else {
                  setDrawings((prev) => [
                    ...prev,
                    {
                      id: generateDrawingId(),
                      type: 'trendline',
                      start: pendingDrawing.start,
                      end: drawingPoint
                    }
                  ]);
                  setPendingDrawing(null);
                  setPreviewShape(null);
                }
                return;
              }

              if (drawingMode === 'rectangle') {
                if (!pendingDrawing) {
                  setPendingDrawing({
                    type: 'rectangle',
                    start: drawingPoint
                  });
                  setPreviewShape({
                    id: '__preview__',
                    type: 'rectangle',
                    start: drawingPoint,
                    end: drawingPoint,
                    isDraft: true
                  });
                } else {
                  setDrawings((prev) => [
                    ...prev,
                    {
                      id: generateDrawingId(),
                      type: 'rectangle',
                      start: pendingDrawing.start,
                      end: drawingPoint
                    }
                  ]);
                  setPendingDrawing(null);
                  setPreviewShape(null);
                }
                return;
              }
            }

            if (chartType !== 'candlestick' || !renderer || !data.length) {
              setSelection(null);
              return;
            }

            const viewState: ViewState | null = renderer.getViewState?.() ?? null;
            if (!viewState || !viewState.scaleX) {
              setSelection(null);
              return;
            }

            const candles = data as CandlestickData[];
            const candleSpacing = 2 / candles.length;
            const halfWidth = (candleSpacing * 0.6) / 2;

            const clipX = (info.x / info.canvasWidth) * 2 - 1;
            const originalX = (clipX - viewState.translateX) / viewState.scaleX;
            const relative = (originalX + 1) / candleSpacing;
            const index = Math.round(relative - 0.5);

            if (index < 0 || index >= candles.length) {
              setSelection(null);
              return;
            }

            const center = -1 + (index + 0.5) * candleSpacing;
            if (Math.abs(originalX - center) > halfWidth) {
              setSelection(null);
              return;
            }

            if (selection?.index === index) {
              setSelection(null);
              return;
            }

            setSelection({
              candle: candles[index],
              index
            });
          }}
          onRegionStart={(info) => {
            const point = convertPixelToPoint(info.startX, info.startY, info.canvasWidth, info.canvasHeight);
            if (!point) return false;
            setRegionSelection({
              mode: 'active',
              start: point,
              current: point
            });
            return true;
          }}
          onRegionUpdate={(info) => {
            setRegionSelection((prev) => {
              if (prev.mode !== 'active') return prev;
              const point = convertPixelToPoint(info.currentX, info.currentY, info.canvasWidth, info.canvasHeight);
              if (!point) return prev;
              return {
                ...prev,
                current: point
              };
            });
          }}
          onRegionEnd={(info) => {
            setRegionSelection((prev) => {
              if (prev.mode !== 'active') return prev;

              const startPoint = convertPixelToPoint(info.startX, info.startY, info.canvasWidth, info.canvasHeight);
              const endPoint = convertPixelToPoint(info.endX, info.endY, info.canvasWidth, info.canvasHeight);

              if (!startPoint || !endPoint || info.cancelled) {
                return {
                  mode: 'idle',
                  start: createRegionPoint(),
                  current: createRegionPoint()
                };
              }

              const minDelta = 6;
              if (
                Math.abs(info.endX - info.startX) < minDelta ||
                Math.abs(info.endY - info.startY) < minDelta
              ) {
                return {
                  mode: 'idle',
                  start: createRegionPoint(),
                  current: createRegionPoint()
                };
              }

              return {
                mode: 'completed',
                start: startPoint,
                current: endPoint,
                end: endPoint
              };
            });
          }}
        />
        
        {!isReady && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: '#fff',
              fontSize: '16px'
            }}
          >
            Initializing WebGL...
          </div>
        )}
      </div>
      
      {/* Eixos de tempo e preço */}
      {chartType === 'candlestick' && hudState.visibleRange && hudState.viewState && (
        <ChartAxes
          canvasWidth={canvasClientWidth}
          canvasHeight={canvasClientHeight}
          data={effectiveData as CandlestickData[]}
          visibleRange={hudState.visibleRange}
          viewState={hudState.viewState}
        />
      )}

      {chartType === 'candlestick' && crosshair && hoverInfo && (
        <CrosshairOverlay crosshair={crosshair} hover={hoverInfo} visibleRange={hudState.visibleRange} />
      )}

      {chartType === 'candlestick' && selection && hudState.viewState && (
        <SelectionOverlay
          selection={selection}
          viewState={hudState.viewState}
          canvasWidth={canvasClientWidth}
          totalCandles={(effectiveData as CandlestickData[]).length}
        />
      )}

      {chartType === 'candlestick' && regionSelection.mode !== 'idle' && hudState.viewState && hudState.visibleRange && (
        <RegionSelectionOverlay
          region={regionSelection}
          canvasWidth={canvasClientWidth}
        />
      )}

      {chartType === 'candlestick' && (selection ? renderSelectionTooltip(selection) : hoverInfo && renderTooltip(hoverInfo))}
      {chartType === 'candlestick' && regionSelection.mode === 'completed' && (
        <RegionInfoCard region={regionSelection} />
      )}
      {chartType === 'candlestick' && selectionHistory.length > 0 && (
        <SelectionHistoryCard
          history={selectionHistory}
          activeTime={selection?.candle.timestamp}
          onSelect={(item) => setSelection(item)}
        />
      )}
      
      {performanceStats && (
        <PerformanceOverlay stats={performanceStats} visible={performanceVisible} />
      )}
      
      <button
        onClick={togglePerformanceMonitoring}
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          padding: '8px 12px',
          backgroundColor: performanceVisible ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.7)',
          border: `1px solid ${performanceVisible ? 'rgba(59,130,246,0.5)' : 'rgba(71,85,105,0.35)'}`,
          borderRadius: '6px',
          color: performanceVisible ? '#60A5FA' : '#94A3B8',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          zIndex: 1001,
          fontFamily: 'monospace'
        }}
        title="Toggle Performance Monitoring"
      >
        {performanceVisible ? '⚡ Perf ON' : '⚡ Perf OFF'}
      </button>
    </div>
  );
};

function formatHudTime(timestamp: number): string {
  if (!timestamp || Number.isNaN(timestamp)) {
    return '--:--:--';
  }

  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

interface HudRowProps {
  label: string;
  value: string;
}

function HudRow({ label, value }: HudRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', columnGap: '12px' }}>
      <span style={{ color: '#94A3B8', fontSize: '11px' }}>{label}</span>
      <span style={{ color: '#F8FAFC', fontWeight: 500, textAlign: 'right', flex: '1' }}>{value}</span>
    </div>
  );
}

interface CrosshairOverlayProps {
  crosshair: CrosshairState;
  hover: HoverState;
  visibleRange?: VisibleRange | null;
}

function CrosshairOverlay({ crosshair, hover, visibleRange }: CrosshairOverlayProps) {
  const priceMin = visibleRange?.priceMin ?? hover.candle.low;
  const priceMax = visibleRange?.priceMax ?? hover.candle.high;
  const priceSpan = priceMax - priceMin || 1;

  const verticalStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: `${crosshair.canvasX}px`,
    width: '1px',
    background: 'rgba(148, 163, 184, 0.45)',
    pointerEvents: 'none',
    transform: 'translateX(-0.5px)'
  };

  const horizontalStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${crosshair.canvasY}px`,
    height: '1px',
    background: 'rgba(148, 163, 184, 0.45)',
    pointerEvents: 'none',
    transform: 'translateY(-0.5px)'
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const priceRatio = clamp((crosshair.clipY + 1) / 2, 0, 1);
  const priceValue = priceMin + priceSpan * priceRatio;

  const priceLabelWidth = 90;
  let priceLeft = crosshair.canvasX + 12;
  if (priceLeft + priceLabelWidth > crosshair.canvasWidth - 8) {
    priceLeft = crosshair.canvasX - priceLabelWidth - 12;
  }
  priceLeft = clamp(priceLeft, 8, crosshair.canvasWidth - priceLabelWidth - 8);

  const priceTop = clamp(crosshair.canvasY - 18, 8, crosshair.canvasHeight - 32);

  const timeLabelWidth = 110;
  const timeLeft = clamp(crosshair.canvasX - timeLabelWidth / 2, 8, crosshair.canvasWidth - timeLabelWidth - 8);
  const timeTop = crosshair.canvasHeight - 28;

  return (
    <>
      <div style={verticalStyle} />
      <div style={horizontalStyle} />
      <div
        style={{
          position: 'absolute',
          left: `${crosshair.canvasX - 4}px`,
          top: `${crosshair.canvasY - 4}px`,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.9)',
          border: '1px solid rgba(191, 219, 254, 0.8)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${priceLeft}px`,
          top: `${priceTop}px`,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          color: '#F8FAFC',
          fontSize: '11px',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          pointerEvents: 'none'
        }}
      >
        {priceValue.toFixed(5)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${timeLeft}px`,
          top: `${timeTop}px`,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          color: '#F8FAFC',
          fontSize: '11px',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          pointerEvents: 'none'
        }}
      >
        {formatHudTime(hover.candle.timestamp)}
      </div>
    </>
  );
}

interface SelectionOverlayProps {
  selection: SelectionState;
  viewState: ViewState;
  canvasWidth: number;
  totalCandles: number;
}

function SelectionOverlay({
  selection,
  viewState,
  canvasWidth,
  totalCandles
}: SelectionOverlayProps) {
  if (!viewState || totalCandles === 0) {
    return null;
  }

  const candleSpacing = 2 / totalCandles;
  const halfWidth = (candleSpacing * 0.6) / 2;
  const center = -1 + (selection.index + 0.5) * candleSpacing;

  const normalizedLeft = center - halfWidth;
  const normalizedRight = center + halfWidth;

  const clipLeft = viewState.scaleX * normalizedLeft + viewState.translateX;
  const clipRight = viewState.scaleX * normalizedRight + viewState.translateX;

  const toCanvasX = (clip: number) => ((clip + 1) / 2) * canvasWidth;
  const leftPx = toCanvasX(clipLeft);
  const rightPx = toCanvasX(clipRight);
  const widthPx = Math.max(2, rightPx - leftPx);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        top: 0,
        bottom: 0,
        background: 'linear-gradient(180deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.06) 100%)',
        borderLeft: '1px solid rgba(59,130,246,0.45)',
        borderRight: '1px solid rgba(59,130,246,0.45)',
        pointerEvents: 'none'
      }}
    />
  );
}

interface RegionSelectionOverlayProps {
  region: RegionSelectionState;
  canvasWidth: number;
}

function RegionSelectionOverlay({
  region,
  canvasWidth
}: RegionSelectionOverlayProps) {
  if (region.mode === 'idle') return null;

  const start = region.start;
  const current = region.current;
  const left = Math.min(start.pixelX, current.pixelX);
  const right = Math.max(start.pixelX, current.pixelX);
  const top = Math.min(start.pixelY, current.pixelY);
  const bottom = Math.max(start.pixelY, current.pixelY);
  const widthPx = Math.max(1, right - left);
  const heightPx = Math.max(1, bottom - top);

  const background = region.mode === 'active'
    ? 'rgba(59,130,246,0.2)'
    : 'linear-gradient(180deg, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0.08) 100%)';
  const borderStyle = region.mode === 'active' ? '1px dashed rgba(96,165,250,0.75)' : '1px solid rgba(59,130,246,0.45)';

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: widthPx,
        height: heightPx,
        background,
        border: borderStyle,
        pointerEvents: 'none'
      }}
    />
  );
}

interface RegionInfoCardProps {
  region: RegionSelectionState;
}

function RegionInfoCard({ region }: RegionInfoCardProps) {
  if (region.mode !== 'completed' || !region.end) {
    return null;
  }

  const indexStart = Math.min(region.start.index, region.end.index);
  const indexEnd = Math.max(region.start.index, region.end.index);
  const priceStart = region.start.price;
  const priceEnd = region.end.price;
  const timeStart = Math.min(region.start.time, region.end.time ?? region.start.time);
  const timeEnd = Math.max(region.start.time, region.end.time ?? region.start.time);

  return (
    <div
      style={{
        position: 'absolute',
        left: '12px',
        top: '12px',
        backgroundColor: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(96,165,250,0.35)',
        borderRadius: '8px',
        padding: '12px 14px',
        color: '#E2E8F0',
        fontSize: '12px',
        lineHeight: 1.5,
        boxShadow: '0 12px 30px rgba(15,23,42,0.4)'
      }}
    >
      <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '8px' }}>
        Seleção de Região
      </div>
      <TooltipRow label="Velas" value={`${indexStart + 1} → ${indexEnd + 1}`} />
      <TooltipRow label="Tempo" value={`${formatHudTime(timeStart)} → ${formatHudTime(timeEnd)}`} />
      <TooltipRow label="Preço" value={`${priceStart.toFixed(5)} → ${priceEnd.toFixed(5)}`} />
      <TooltipRow label="Amplitude" value={`${Math.abs(priceEnd - priceStart).toFixed(5)}`} />
    </div>
  );
}

interface SelectionHistoryCardProps {
  history: SelectionState[];
  activeTime?: number;
  onSelect: (item: SelectionState) => void;
}

function SelectionHistoryCard({ history, activeTime, onSelect }: SelectionHistoryCardProps) {
  return (
    <div
      style={{
        position: 'absolute',
        right: '12px',
        top: '180px',
        width: '220px',
        backgroundColor: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(59,130,246,0.35)',
        borderRadius: '8px',
        padding: '12px 14px',
        color: '#E2E8F0',
        fontSize: '12px',
        lineHeight: 1.5,
        boxShadow: '0 12px 24px rgba(15,23,42,0.35)'
      }}
    >
      <div
        style={{
          fontSize: '11px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#94A3B8',
          marginBottom: '8px'
        }}
      >
        Histórico de Seleções
      </div>
      <div style={{ display: 'grid', rowGap: '6px' }}>
        {history.map((item) => {
          const isActive = item.candle.timestamp === activeTime;
          return (
            <button
              key={item.candle.timestamp}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: isActive ? 'rgba(59,130,246,0.25)' : 'rgba(30,41,59,0.55)',
                border: '1px solid rgba(59,130,246,0.35)',
                borderRadius: '6px',
                padding: '6px 8px',
                color: '#E2E8F0',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <span>{formatHudTime(item.candle.timestamp)}</span>
              <span style={{ fontWeight: 600 }}>{item.candle.close.toFixed(5)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function renderTooltip(info: HoverState) {
  const tooltipWidth = 200;
  const tooltipHeight = 140;
  const offset = 16;

  let left = info.x + offset;
  let top = info.y - tooltipHeight - offset;

  if (left + tooltipWidth > info.canvasWidth - 8) {
    left = info.canvasWidth - tooltipWidth - 8;
  }
  if (left < 8) {
    left = 8;
  }

  if (top < 8) {
    top = info.y + offset;
    if (top + tooltipHeight > info.canvasHeight - 8) {
      top = info.canvasHeight - tooltipHeight - 8;
    }
  }

  const candle = info.candle;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: `${tooltipWidth}px`,
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderRadius: '8px',
        border: '1px solid rgba(30,41,59,0.9)',
        padding: '14px 16px',
        pointerEvents: 'none',
        color: '#E2E8F0',
        boxShadow: '0 18px 32px rgba(15,23,42,0.45)',
        fontSize: '12px',
        lineHeight: 1.5
      }}
    >
      <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: '8px' }}>
        Vela #{info.index + 1}
      </div>
      <TooltipRow label="Horário" value={formatHudTime(candle.timestamp)} />
      <TooltipRow label="Abertura" value={candle.open.toFixed(5)} />
      <TooltipRow label="Fechamento" value={candle.close.toFixed(5)} />
      <TooltipRow label="Máxima" value={candle.high.toFixed(5)} />
      <TooltipRow label="Mínima" value={candle.low.toFixed(5)} />
    </div>
  );
}

interface TooltipRowProps {
  label: string;
  value: string;
}

function TooltipRow({ label, value }: TooltipRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span style={{ color: '#F8FAFC', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function renderSelectionTooltip(selection: SelectionState) {
  const candle = selection.candle;

  return (
    <div
      style={{
        position: 'absolute',
        right: '12px',
        top: '80px',
        width: '220px',
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderRadius: '8px',
        border: '1px solid rgba(59,130,246,0.5)',
        padding: '14px 16px',
        pointerEvents: 'none',
        color: '#E2E8F0',
        boxShadow: '0 18px 32px rgba(15,23,42,0.45)',
        fontSize: '12px',
        lineHeight: 1.5
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8' }}>
          Vela Selecionada
        </div>
        <div style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#60A5FA', fontSize: '11px', padding: '2px 6px', borderRadius: '999px' }}>
          #{selection.index + 1}
        </div>
      </div>
      <TooltipRow label="Horário" value={formatHudTime(candle.timestamp)} />
      <TooltipRow label="Abertura" value={candle.open.toFixed(5)} />
      <TooltipRow label="Fechamento" value={candle.close.toFixed(5)} />
      <TooltipRow label="Máxima" value={candle.high.toFixed(5)} />
      <TooltipRow label="Mínima" value={candle.low.toFixed(5)} />
    </div>
  );
}

