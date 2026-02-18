/**
 * AnimatedCanvasChart - Componente de gráfico usando Canvas nativo com animação forçada
 * 
 * Alternativa ao TradingView quando a renderização não funciona
 * Renderiza diretamente no canvas com animação garantida
 */

'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';
import { logger } from '@/utils/logger';
import { IndicatorEngine, CandleData as IndicatorCandleData } from '@/utils/indicators';
import { supabase } from '@/lib/supabase';

export type Timeframe = '1m' | '2m' | '5m' | '10m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d' | '1w' | '1M';

export interface GraphicToolData {
  id: string;
  type: 'line' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci';
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
  points: Array<{ x: number; y: number; price?: number; time?: number }>;
}

export interface IndicatorConfig {
  id: string;
  type: 'sma' | 'ema' | 'bollinger' | 'rsi' | 'macd' | 'volume';
  period?: number;
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface AnimatedCanvasChartProps {
  symbol: string;
  timeframe?: Timeframe;
  width?: number;
  height?: number;
  className?: string;
  onPriceUpdate?: (price: number) => void;
  candleUpColor?: string;
  candleDownColor?: string;
  chartType?: 'candlestick' | 'line' | 'bar' | 'heikin-ashi';
  lineColor?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWithShadow?: boolean;
  graphicTools?: GraphicToolData[]; // Ferramentas gráficas para renderizar
  selectedToolType?: string | null; // Tipo de ferramenta selecionada para desenhar
  onToolDrawing?: (points: Array<{ x: number; y: number; price?: number; time?: number }>) => void; // Callback quando desenha ferramenta
  period?: '30d' | '1d' | '3h' | '30m' | '15m' | '5m' | '2m'; // Período de visualização do gráfico
  onToolComplete?: (tool: GraphicToolData) => void; // Callback quando completa o desenho
  onToolClick?: (toolId: string, toolType: string, position: { x: number; y: number }) => void; // Callback quando clica em uma ferramenta
  selectedToolId?: string | null; // ID da ferramenta selecionada no gráfico
  onToolMove?: (toolId: string, newPoints: Array<{ x: number; y: number; price?: number; time?: number }>) => void; // Callback quando move uma ferramenta
  indicators?: IndicatorConfig[]; // Lista de indicadores ativos
  period?: '30d' | '1d' | '3h' | '30m' | '15m' | '5m' | '2m'; // Período de visualização do gráfico
  expirationTime?: Date; // Horário de expiração para linha vertical
  currentTime?: Date; // Horário atual para calcular segundos restantes
  buyButtonHover?: boolean; // Estado de hover do botão de compra
  sellButtonHover?: boolean; // Estado de hover do botão de venda
  activeTrades?: Array<{ // Trades ativos para feedback visual de P&L
    id: string;
    entryPrice: number;
    expiration: number;
    type: 'call' | 'put';
    amount: number; // Valor investido no trade
    result?: 'win' | 'loss';
    profit?: number; // Lucro/prejuízo do trade
    symbol?: string; // Símbolo do ativo para filtrar trades por ativo
  }>;
  onCloseSnapshot?: (tradeId: string) => void; // Callback para fechar snapshot
  onExpirationTimeChange?: (newExpirationTime: Date) => void; // Callback quando timer zera e precisa atualizar expirationTime
  onMarketStatusChange?: (status: { isOpen: boolean; isOTC: boolean; category: string; message: string } | null) => void;
}

export interface AnimatedCanvasChartRef {
  exportAsImage: (format: 'png' | 'jpeg') => Promise<string | null>;
  exportAsCSV: () => string;
  exportAsJSON: () => string;
  copyToClipboard: () => Promise<boolean>;
  print: () => void;
  getTimelineState: () => {
    currentDeadline: number;
    currentExpiration: number;
    timeLeft: number;
    canTrade: boolean; // true se ainda está dentro do tempo de compra
  } | null;
  getCurrentPrice: () => number; // Retorna o preço visual atual (visualPrice)
}

interface CandleData {
  time: number; // timestamp em milissegundos
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Calcula o início do período baseado no timeframe
 */
function getBarTime(timestampMs: number, timeframe: Timeframe = '1m'): number {
  const timeframeMs: Record<Timeframe, number> = {
    '1m': 60000,
    '2m': 120000,
    '5m': 300000,
    '10m': 600000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '8h': 28800000,
    '12h': 43200000,
    '1d': 86400000,
    '1w': 604800000,
    '1M': 2592000000, // 30 dias
  };
  
  const periodMs = timeframeMs[timeframe];
  return Math.floor(timestampMs / periodMs) * periodMs;
}

/**
 * Converte timeframe para segundos
 */
function getTimeFrameInSeconds(timeframe: Timeframe): number {
  const timeframeSeconds: Record<Timeframe, number> = {
    '1m': 60,
    '2m': 120,
    '5m': 300,
    '10m': 600,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '8h': 28800,
    '12h': 43200,
    '1d': 86400,
    '1w': 604800,
    '1M': 2592000, // 30 dias
  };
  
  return timeframeSeconds[timeframe];
}

/**
 * Calcula aceleração ajustada baseada no timeframe
 * Grupos de time frames com níveis de aceleração específicos:
 * - 1min, 2min: Velocidade padrão
 * - 5min, 10min, 15min: Pouco menos velocidade
 * - 30min, 1h, 2h: Menos velocidade
 * - 4h, 8h, 12h: Menos velocidade
 * - 1d, 1w, 1M: Menos velocidade
 */
function getAdjustedAcceleration(timeFrameInSeconds: number): number {
  // Aceleração mais alta = preço visual chega ao alvo mais rápido (menos "escorregadio")
  const accelerationLevels: Record<number, number> = {
    60: 0.35,   // 1min — rápido
    120: 0.35,  // 2min
    300: 0.28,  // 5min
    600: 0.28,  // 10min
    900: 0.28,  // 15min
    1800: 0.20, // 30min
    3600: 0.20, // 1h
    7200: 0.20, // 2h
    14400: 0.15, // 4h
    28800: 0.15, // 8h
    43200: 0.15, // 12h
    86400: 0.10,     // 1d
    604800: 0.10,    // 1w
    2592000: 0.10,   // 1M
  };
  return accelerationLevels[timeFrameInSeconds] || 0.28;
}

/**
 * Calcula jitter ajustado baseado no timeframe
 * Segue a mesma lógica de grupos da aceleração
 * Time frames longos: jitter quase zero (movimento mais estável)
 * Time frames curtos: jitter normal (movimento mais "vivo")
 */
function getAdjustedJitter(timeFrameInSeconds: number): number {
  // Jitter reduzido — menos "tremor" cosmético, movimento mais preciso
  const jitterLevels: Record<number, number> = {
    60: 0.0000005,   // 1min
    120: 0.0000005,  // 2min
    300: 0.0000003,  // 5min
    600: 0.0000003,  // 10min
    900: 0.0000003,  // 15min
    1800: 0.0000001, // 30min
    3600: 0.0000001, // 1h
    7200: 0.0000001, // 2h
    14400: 0.00000005,  // 4h
    28800: 0.00000005,  // 8h
    43200: 0.00000005,  // 12h
    86400: 0.00000002,     // 1d
    604800: 0.00000002,    // 1w
    2592000: 0.00000002,   // 1M
  };
  return jitterLevels[timeFrameInSeconds] || 0.0000003;
}

/**
 * Agrupa candles menores em candles maiores baseado no timeframe
 * Garante que cada candle tenha exatamente o intervalo do timeframe selecionado
 */
function groupCandlesByTimeframe(candles: CandleData[], targetTimeframe: Timeframe): CandleData[] {
  if (candles.length === 0) return [];
  
  // Criar mapa para agrupar candles por período
  const groupedMap = new Map<number, CandleData>();
  
  for (const candle of candles) {
    const periodStart = getBarTime(candle.time, targetTimeframe);
    
    if (groupedMap.has(periodStart)) {
      // Já existe um candle para este período, agregar valores
      const existing = groupedMap.get(periodStart)!;
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close; // O close do último candle do período
      // O open permanece o mesmo (primeiro candle do período)
    } else {
      // Primeiro candle deste período
      groupedMap.set(periodStart, {
        time: periodStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    }
  }
  
  // Converter mapa para array e ordenar por tempo
  return Array.from(groupedMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Formata o preço com precisão adequada baseado no range
 * Similar ao TradingView que ajusta a precisão automaticamente
 */
function formatPrice(price: number, priceRange: number): string {
  // Determinar número de casas decimais baseado no range
  if (priceRange >= 1000) {
    return price.toFixed(2);
  } else if (priceRange >= 100) {
    return price.toFixed(3);
  } else if (priceRange >= 10) {
    return price.toFixed(4);
  } else if (priceRange >= 1) {
    return price.toFixed(5);
  } else if (priceRange >= 0.1) {
    return price.toFixed(6);
  } else {
    return price.toFixed(8);
  }
}

export const AnimatedCanvasChart = forwardRef<AnimatedCanvasChartRef, AnimatedCanvasChartProps>(
  ({ symbol, timeframe = '1m', width, height, className = '', onPriceUpdate, candleUpColor = '#22c55e', candleDownColor = '#f87171', chartType = 'candlestick', lineColor = '#f59e0b', lineStyle = 'solid', lineWithShadow = true, graphicTools = [], selectedToolType = null, onToolDrawing, onToolComplete, onToolClick, selectedToolId = null, onToolMove, indicators = [], period = '30m', expirationTime, currentTime, buyButtonHover = false, sellButtonHover = false, activeTrades = [], onCloseSnapshot, onExpirationTimeChange, onMarketStatusChange }, ref) => {
    useEffect(() => {
      // activeTrades ref is updated in activeTradesRef
    }, [activeTrades]);
    
    // Ref para manter activeTrades atualizado no drawChart
    const activeTradesRef = useRef(activeTrades);
    useEffect(() => {
      activeTradesRef.current = activeTrades;
    }, [activeTrades]);
    
    // Ref para armazenar posições dos botões de fechar dos snapshots
    const snapshotCloseButtonsRef = useRef<Map<string, { x: number; y: number; size: number; tradeId: string }>>(new Map());
    
    // Ref para armazenar posições dos snapshots (para desabilitar pan quando mouse estiver sobre eles)
    const snapshotPositionsRef = useRef<Map<string, { x: number; y: number; width: number; height: number; tradeId: string }>>(new Map());
    
    // Ref para armazenar posição X do círculo pulsante (para sincronizar balão/seta)
    const pulseCandleCenterXRef = useRef<number>(0);
    
    // Estado para rastrear qual botão está sendo hovered
    const [hoveredCloseButton, setHoveredCloseButton] = useState<string | null>(null);
    
    // Estado para rastrear se o mouse está sobre um snapshot
    const [isOverSnapshot, setIsOverSnapshot] = useState(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const candlesRef = useRef<CandleData[]>([]);
    const lastCandleTimeRef = useRef<number | null>(null); // Apenas para rastrear o período do último candle
    const historicalDataLoadedRef = useRef(false);
    const isLoadingRef = useRef(false); // Flag para controlar estado de carregamento
    const watermarkImageRef = useRef<HTMLImageElement | null>(null);
    
    // Live Candle - Candle em tempo real que é atualizado a cada tick
    // Este candle nunca fica "no passado", sempre mostra o preço atual
    const liveCandleRef = useRef<CandleData | null>(null);
    const lastRenderedLiveCandleTimeRef = useRef<number | null>(null);
    
    // Estado de "Warm-up" - garante que temos dados suficientes antes de iniciar o motor
    const isDataReadyRef = useRef(false); // Só true quando há dados históricos suficientes
    const firstTickAfterHistoryRef = useRef(true); // Flag para sincronizar primeiro ticket após histórico
    const lastProcessedTickRef = useRef<number | null>(null); // Rastrear último tick processado (por timestamp)
    
    // CRYPTO: Detectar se o ativo é crypto (recebe isClosed da Binance)
    // Para crypto, live candles só devem ser criados pelo tick useEffect (via isClosed)
    // checkAndCreateLiveCandle e drawChart fallback NÃO devem criar live candles para crypto
    const isCryptoAssetRef = useRef(false);
    
    // Layout do gráfico — atualizado pelo drawChart a cada frame
    // Os handlers de mouse usam estes valores para coordenadas consistentes
    const chartLayoutRef = useRef({
      chartX: 40, chartY: 40,
      chartWidth: 800, chartHeight: 400,
      actualMinPrice: 0, actualMaxPrice: 1,
      actualPriceRange: 1,
    });
    
    // Motor de Física de Partículas - Candle Engine
    // Sistema que mantém o candle sempre em movimento, nunca estático
    const candleEngineRef = useRef<{
      realPrice: number;      // O último preço recebido do WebSocket
      visualPrice: number;    // O preço que o Canvas está desenhando agora
      velocity: number;       // Velocidade atual do movimento
      inertia: number;        // Direção e força do último movimento real
      friction: number;        // Resistência (0.7 a 0.9). Menor = mais pesado.
      acceleration: number;    // Atração (0.05 a 0.2). Maior = mais rápido.
      jitter: number;         // Intensidade do pulso de vida
      lastTickTime: number;   // Timestamp do último ticket recebido
      lastFrameTime: number;  // Timestamp do último frame para Delta Time
    }>({
      realPrice: 0,
      visualPrice: 0,
      velocity: 0,
      inertia: 0,
      friction: 0.45,         // Mais resistência = menos derrapagem
      acceleration: 0.35,     // Atração forte = chega rápido ao alvo
      jitter: 0.0000003,      // Micro-tremor mínimo
      lastTickTime: Date.now(),
      lastFrameTime: performance.now()
    });

    // Ref para suavizar o preço exibido no retângulo azul (evitar mudanças muito rápidas)
    const displayedPriceRef = useRef<number>(0);
    
    // Interpolação suave para animação fluida
    const interpolatedCandlesRef = useRef<Map<number, CandleData>>(new Map()); // Cache de candles interpolados
    const lastFrameTimeRef = useRef<number>(0);
    
    // Engine de indicadores técnicos
    const indicatorEngineRef = useRef<IndicatorEngine>(new IndicatorEngine());
    const indicatorValuesRef = useRef<Map<string, any>>(new Map());
    
    // Viewport e interação
    const viewportRef = useRef({
      visibleStartIndex: 0, // Índice do primeiro candle visível
      visibleCandleCount: 100, // Número de candles visíveis
      isDragging: false,
      dragStartX: 0,
      dragStartIndex: 0,
      mouseX: -1,
      mouseY: -1,
      isAtEnd: true, // Indica se está mostrando os últimos candles (auto-scroll)
      visualExpirationX: 0, // Posição visual X da linha de expiração (para transição suave)
      visualFinishLineX: 0, // Posição visual X da linha de chegada (para transição suave)
    });
    
    // Timeline Engine - Gerenciador de ciclos de expiração
    const timelineEngineRef = useRef({
      currentDeadline: 0,
      currentExpiration: 0,
      visualDeadlineX: null as number | null,
      isTransitioning: false,
      shouldMoveImmediately: false, // Flag para movimento imediato quando timer zera ou expirationTime muda
      // Posições congeladas quando há operação ativa
      frozenDeadlineX: null as number | null,
      frozenFinishLineX: null as number | null,
      frozenTargetExpiration: null as number | null,
      frozenTargetDeadline: null as number | null,
      wasTradeActive: false, // Para detectar quando uma operação é aberta
    });
    
    // Estado de desenho de ferramentas
    const toolDrawingRef = useRef<{
      isDrawing: boolean;
      toolType: string | null;
      points: Array<{ x: number; y: number; price?: number; time?: number }>;
      startPoint: { x: number; y: number; price?: number; time?: number } | null;
      isCompleting: boolean; // Flag para evitar dupla conclusão
      pendingSecondPoint: { x: number; y: number; price?: number; time?: number } | null; // Segundo ponto pendente para adicionar no mouseUp
    }>({
      isDrawing: false,
      toolType: null,
      points: [],
      startPoint: null,
      isCompleting: false,
      pendingSecondPoint: null,
    });
    
    // Estado de arraste de ferramentas
    const toolDraggingRef = useRef<{
      isDragging: boolean;
      toolId: string | null;
      toolType: string | null;
      startMouseX: number;
      startMouseY: number;
      startPrice: number | null;
      startTime: number | null;
      // Delta inicial (offset entre mouse e ponto da ferramenta no início do drag)
      initialDeltaPrice: number | null;
      initialDeltaTime: number | null;
      // Coordenadas originais dos pontos (para restaurar se necessário)
      originalPoints: Array<{ price?: number; time?: number }> | null;
    }>({
      isDragging: false,
      toolId: null,
      toolType: null,
      startMouseX: 0,
      startMouseY: 0,
      startPrice: null,
      startTime: null,
      initialDeltaPrice: null,
      initialDeltaTime: null,
      originalPoints: null,
    });
    
    // Ref para manter o selectedToolType atualizado nos handlers
    const selectedToolTypeRef = useRef<string | null>(selectedToolType);
    
    // Ref para manter graphicTools atualizado no drawChart
    const graphicToolsRef = useRef<GraphicToolData[]>(graphicTools);
    
    // Ref para manter selectedToolId atualizado
    const selectedToolIdRef = useRef<string | null>(selectedToolId);
    
    // Atualizar refs quando props mudarem
    useEffect(() => {
      selectedToolTypeRef.current = selectedToolType;
    }, [selectedToolType]);
    
    useEffect(() => {
      selectedToolIdRef.current = selectedToolId;
    }, [selectedToolId]);
    
    useEffect(() => {
      graphicToolsRef.current = graphicTools;
    }, [graphicTools]);
    
    // Ref para manter expirationTime atualizado no drawChart
    const expirationTimeRef = useRef<Date | undefined>(expirationTime);
    const prevExpirationTimeRef = useRef<Date | undefined>(expirationTime);
    const expirationTimeChangedRef = useRef(false);
    
    useEffect(() => {
      // Detectar mudanças no expirationTime manual
      if (expirationTime && expirationTime instanceof Date) {
        const prevTime = prevExpirationTimeRef.current;
        const currentTime = expirationTime.getTime();
        
        // Se o expirationTime mudou manualmente, resetar posições visuais para forçar movimento imediato
        if (!prevTime || prevTime.getTime() !== currentTime) {
          // Forçar atualização imediata das linhas
          timelineEngineRef.current.visualDeadlineX = null;
          viewportRef.current.visualFinishLineX = 0;
          timelineEngineRef.current.shouldMoveImmediately = true;
          expirationTimeChangedRef.current = true;
        } else {
          // Se não mudou, garantir que a flag está false
          expirationTimeChangedRef.current = false;
        }
      } else {
        expirationTimeChangedRef.current = false;
      }
      
      prevExpirationTimeRef.current = expirationTime;
      expirationTimeRef.current = expirationTime;
    }, [expirationTime]);
    
    // Ref para manter currentTime atualizado no drawChart
    const currentTimeRef = useRef<Date | undefined>(currentTime);
    useEffect(() => {
      currentTimeRef.current = currentTime;
    }, [currentTime]);

    // Ref para manter buyButtonHover e sellButtonHover atualizados no drawChart
    const buyButtonHoverRef = useRef<boolean>(buyButtonHover);
    useEffect(() => {
      buyButtonHoverRef.current = buyButtonHover;
    }, [buyButtonHover]);

    const sellButtonHoverRef = useRef<boolean>(sellButtonHover);
    useEffect(() => {
      sellButtonHoverRef.current = sellButtonHover;
    }, [sellButtonHover]);

    // Carregar imagem da marca d'água
    useEffect(() => {
      if (typeof window === 'undefined') return;

      const setImageFromUrl = (url: string) => {
        if (watermarkImageRef.current && watermarkImageRef.current.src === url) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { watermarkImageRef.current = img; };
        img.onerror = () => { watermarkImageRef.current = null; };
        img.src = url;
      };

      // 1) Cache local instantâneo
      const cachedUrl = localStorage.getItem('broker_watermark')
        || localStorage.getItem('broker_logo_dark')
        || localStorage.getItem('broker_logo');
      if (cachedUrl) setImageFromUrl(cachedUrl);

      // 2) Atualizar do Supabase em background
      const syncFromDB = async () => {
        if (!supabase) return;
        try {
          const keys = ['broker_watermark', 'broker_logo_dark', 'broker_logo'];
          const { data } = await supabase
            .from('platform_settings')
            .select('key, value')
            .in('key', keys);

          if (!data) return;
          const settings = Object.fromEntries(data.map((r: { key: string; value: unknown }) => [r.key, r.value as string]));
          const url = settings['broker_watermark'] || settings['broker_logo_dark'] || settings['broker_logo'];
          if (url) {
            setImageFromUrl(url);
            if (settings['broker_watermark']) localStorage.setItem('broker_watermark', url);
            else if (settings['broker_logo_dark']) localStorage.setItem('broker_logo_dark', url);
            else localStorage.setItem('broker_logo', url);
          }
        } catch { /* cache local já carregado */ }
      };
      syncFromDB();

      // Revalidar periodicamente (a cada 30s, não 2s)
      const interval = setInterval(syncFromDB, 30000);
      
      // Também escutar eventos de storage (dispara em outras abas)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'broker_watermark' || e.key === 'broker_logo_dark' || e.key === 'broker_logo') {
          loadWatermark();
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorageChange);
      };
    }, []);

    // Refs para animação suave do viewport quando período muda
    const viewportAnimationRef = useRef<{
      isAnimating: boolean;
      startCandleCount: number;
      targetCandleCount: number;
      startStartIndex: number;
      targetStartIndex: number;
      startTime: number;
      duration: number; // Duração da animação em ms
    } | null>(null);

    // Ajustar viewport baseado no período selecionado com animação suave
    useEffect(() => {
      if (candlesRef.current.length === 0) return;
      
      // Calcular quantos candles mostrar baseado no período
      const getCandleCountForPeriod = (period: string): number => {
        switch (period) {
          case '30d': return Math.min(500, candlesRef.current.length); // Mostrar mais candles para períodos longos
          case '1d': return Math.min(300, candlesRef.current.length);
          case '3h': return Math.min(200, candlesRef.current.length);
          case '30m': return Math.min(150, candlesRef.current.length);
          case '15m': return Math.min(100, candlesRef.current.length);
          case '5m': return Math.min(80, candlesRef.current.length);
          case '2m': return Math.min(60, candlesRef.current.length);
          default: return Math.min(100, candlesRef.current.length);
        }
      };
      
      const newCandleCount = getCandleCountForPeriod(period);
      const maxStartIndex = Math.max(0, candlesRef.current.length - newCandleCount);
      
      // Valores atuais do viewport
      const currentCandleCount = viewportRef.current.visibleCandleCount;
      const currentStartIndex = viewportRef.current.visibleStartIndex;
      
      // Se os valores são diferentes, iniciar animação suave
      if (currentCandleCount !== newCandleCount || currentStartIndex !== maxStartIndex) {
        viewportAnimationRef.current = {
          isAnimating: true,
          startCandleCount: currentCandleCount,
          targetCandleCount: newCandleCount,
          startStartIndex: currentStartIndex,
          targetStartIndex: maxStartIndex,
          startTime: Date.now(),
          duration: 600 // 600ms para transição suave
        };
      }
    }, [period]);

    // Função para atualizar animação do viewport
    const updateViewportAnimation = useCallback(() => {
      if (!viewportAnimationRef.current || !viewportAnimationRef.current.isAnimating) {
        return;
      }

      const anim = viewportAnimationRef.current;
      const elapsed = Date.now() - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1); // 0 a 1

      // Função de easing suave (ease-out cubic)
      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
      };

      const easedProgress = easeOutCubic(progress);

      // Interpolar valores
      const currentCandleCount = Math.round(
        anim.startCandleCount + (anim.targetCandleCount - anim.startCandleCount) * easedProgress
      );
      const currentStartIndex = Math.round(
        anim.startStartIndex + (anim.targetStartIndex - anim.startStartIndex) * easedProgress
      );

      // Atualizar viewport
      viewportRef.current.visibleCandleCount = currentCandleCount;
      viewportRef.current.visibleStartIndex = currentStartIndex;

      // Se a animação terminou, finalizar
      if (progress >= 1) {
        viewportRef.current.visibleCandleCount = anim.targetCandleCount;
        viewportRef.current.visibleStartIndex = anim.targetStartIndex;
        viewportRef.current.isAtEnd = true;
        viewportAnimationRef.current.isAnimating = false;
      }
    }, []);

    /**
     * Calcula o período máximo necessário dos indicadores
     * Retorna o maior período entre todos os indicadores ativos
     */
    const getMaxIndicatorPeriod = useCallback((): number => {
      if (indicators.length === 0) {
        return 20; // Valor padrão mínimo
      }
      
      const periods = indicators
        .map(ind => ind.period || 20)
        .filter(p => p > 0);
      
      return periods.length > 0 ? Math.max(...periods) : 20;
    }, [indicators]);

    // Motor de Física - Atualiza o preço visual com física de partículas
    // Usa Delta Time para velocidade constante independente do FPS
    const updateCandlePhysics = useCallback(() => {
      const engine = candleEngineRef.current;
      
      // WARM-UP: Não permitir que o motor rode até que tenhamos dados suficientes
      // Isso evita cálculos instáveis com poucos candles
      if (!isDataReadyRef.current) {
        return;
      }
      
      // Se ainda não temos um preço real, não fazer nada
      if (engine.realPrice === 0) {
        return;
      }

      // DELTA TIME: Normalizar velocidade para 60 FPS (16.67ms por frame)
      const now = performance.now();
      const dt = (now - engine.lastFrameTime) / 16.67; // Normaliza para 60 FPS
      engine.lastFrameTime = now;

      const timeSinceLastTick = Date.now() - engine.lastTickTime;

      // Calcular distância entre preço visual e real (para smoothing dinâmico)
      const priceDistance = Math.abs(engine.realPrice - engine.visualPrice);
      const priceRange = engine.realPrice * 0.001; // 0.1% do preço como referência
      
      // SMOOTHING FACTOR DINÂMICO:
      // Gap grande → atração máxima (chega rápido)
      // Perto do alvo → atração moderada (sem tremor)
      let smoothingFactor = engine.acceleration;
      if (priceDistance > priceRange * 2) {
        smoothingFactor = engine.acceleration * 2.0;
      } else if (priceDistance < priceRange * 0.05) {
        smoothingFactor = engine.acceleration * 0.15;
      }

      // 1. FORÇA DE ATRAÇÃO — direto ao alvo
      const attraction = (engine.realPrice - engine.visualPrice) * (smoothingFactor * dt);

      // 2. MICRO-PULSO — apenas cosmético quando muito perto
      let pulse = 0;
      if (priceDistance < priceRange * 0.1) {
        pulse = (Math.random() - 0.5) * (engine.realPrice * engine.jitter * dt);
      }

      // 3. INÉRCIA REDUZIDA — quase nenhuma derrapagem
      let finalForce = attraction + pulse;
      if (timeSinceLastTick > 200) {
        finalForce += engine.inertia * 0.01 * dt;
      }

      // 4. INTEGRAÇÃO COM ATRITO FORTE
      const currentFriction = Math.pow(engine.friction, dt);
      engine.velocity = (engine.velocity + finalForce) * currentFriction;

      // 5. ATUALIZAÇÃO DA POSIÇÃO VISUAL
      engine.visualPrice += engine.velocity * dt;
      
      engine.inertia = engine.velocity;
    }, []);

    // Sincronizar indicadores quando a prop mudar
    const previousIndicatorsRef = useRef<typeof indicators>([]);
    
    useEffect(() => {
      // Comparar profundamente se os indicadores realmente mudaram
      const currentKey = JSON.stringify(indicators.map(i => ({ id: i.id, type: i.type, period: i.period, color: i.color })).sort((a, b) => a.id.localeCompare(b.id)));
      const previousKey = JSON.stringify(previousIndicatorsRef.current.map(i => ({ id: i.id, type: i.type, period: i.period, color: i.color })).sort((a, b) => a.id.localeCompare(b.id)));
      
      // Se apenas configurações visuais mudaram (cor, lineWidth, style), não recalcular
      if (currentKey === previousKey && previousIndicatorsRef.current.length === indicators.length) {
        // Apenas atualizar configurações visuais (cor, lineWidth, style) sem recalcular valores
        indicators.forEach(indicator => {
          const existing = indicatorEngineRef.current.getConfig(indicator.id);
          if (existing) {
            // Atualizar apenas configurações visuais, preservando valores históricos
            indicatorEngineRef.current.updateIndicatorConfig(indicator.id, {
              color: indicator.color,
              lineWidth: indicator.lineWidth,
              style: indicator.style
            });
          }
        });
        // Não recalcular valores históricos, apenas atualizar configurações
        return;
      }
      
      // Se realmente mudou (adicionar/remover/mudar período), recalcular tudo
      previousIndicatorsRef.current = indicators.map(i => ({ ...i }));
      
      const engine = indicatorEngineRef.current;
      engine.clear();
      
      indicators.forEach(indicator => {
        engine.addIndicator(indicator.id, {
          type: indicator.type,
          period: indicator.period,
          color: indicator.color,
          lineWidth: indicator.lineWidth,
          style: indicator.style
        });
      });
      
      // Recalcular valores históricos se houver candles carregados
      if (historicalDataLoadedRef.current && candlesRef.current.length > 0) {
        const indicatorCandles: IndicatorCandleData[] = candlesRef.current.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: (c as any).volume
        }));
        
        // Calcular indicadores para cada candle histórico
        for (let i = 0; i < candlesRef.current.length; i++) {
          const candle = candlesRef.current[i];
          engine.onTick(
            indicatorCandles.slice(0, i + 1),
            candle.close
          );
        }
      }
      
    }, [indicators]);

    // Hook para dados em tempo real via WebSocket
    const { isConnected, lastTick, error, marketStatus } = useRealtimeStream({
      symbol,
      wsUrl: process.env.NEXT_PUBLIC_MARKET_DATA_WS_URL || 'ws://localhost:8080'
    });
    
    // Propagar status do mercado para o componente pai
    useEffect(() => {
      if (onMarketStatusChange) {
        onMarketStatusChange(marketStatus);
      }
    }, [marketStatus, onMarketStatusChange]);
    
    // CRYPTO: Confirmar detecção via marketStatus (chega antes dos ticks)
    useEffect(() => {
      if (marketStatus && marketStatus.category === 'crypto') {
        isCryptoAssetRef.current = true;
      }
    }, [marketStatus]);

    // ===== PROCESSAMENTO DE TICKS — SIMPLIFICADO =====
    // Lógica clara em 2 caminhos:
    // - Crypto (Binance): usa isClosed da API para saber quando fechar candle
    // - Forex/OTC: usa cálculo de período temporal
    // Regra de ouro: open do live candle = close do último candle no histórico. Sempre.
    
    // Helper: limpar todos os caches de interpolação de live candles
    const clearLiveCandleCache = useCallback(() => {
      const keysToDelete: number[] = [];
      interpolatedCandlesRef.current.forEach((_, key) => {
        if (key < 0) keysToDelete.push(key);
      });
      keysToDelete.forEach(key => interpolatedCandlesRef.current.delete(key));
    }, []);
    
    // Helper: congelar live candle atual no histórico
    const freezeLiveCandle = useCallback(() => {
      if (!liveCandleRef.current) return;
      
      const engine = candleEngineRef.current;
      const finalClose = engine.visualPrice > 0 ? engine.visualPrice : liveCandleRef.current.close;
      const high = Math.max(liveCandleRef.current.high, finalClose);
      const low = Math.min(liveCandleRef.current.low, finalClose);
      const close = Math.max(low, Math.min(high, finalClose));
      
      const closedCandle: CandleData = {
        time: liveCandleRef.current.time,
        open: liveCandleRef.current.open,
        high, low, close,
      };
      
      candlesRef.current = [...candlesRef.current, closedCandle];
      liveCandleRef.current = null;
      clearLiveCandleCache();
      
      // Ajustar viewport
      if (viewportRef.current.isAtEnd) {
        const maxStart = Math.max(0, candlesRef.current.length - viewportRef.current.visibleCandleCount);
        viewportRef.current.visibleStartIndex = maxStart;
      }
    }, [clearLiveCandleCache]);
    
    // Helper: criar novo live candle (open = close do último histórico)
    const createLiveCandle = useCallback((periodStart: number, tickPrice: number, tickTime: number) => {
      if (candlesRef.current.length === 0) return;
      
      const prevClose = candlesRef.current[candlesRef.current.length - 1].close;
      
      liveCandleRef.current = {
        time: periodStart,
        open: prevClose,  // REGRA DE OURO: open = close anterior
        high: Math.max(prevClose, tickPrice),
        low: Math.min(prevClose, tickPrice),
        close: tickPrice,
      };
      
      clearLiveCandleCache();
      
      // Resetar motor de física
      const engine = candleEngineRef.current;
      engine.realPrice = tickPrice;
      engine.visualPrice = tickPrice;
      engine.velocity = 0;
      engine.inertia = 0;
      engine.lastTickTime = tickTime;
    }, [clearLiveCandleCache]);

    useEffect(() => {
      if (!lastTick || !historicalDataLoadedRef.current) return;

      const tick = lastTick;
      const tickPrice = tick.price;
      const tickTime = tick.timestamp;

      // Evitar processar mesmo tick 2x
      if (lastProcessedTickRef.current === tickTime) return;
      lastProcessedTickRef.current = tickTime;

      // Sem candles ainda — criar o primeiro
      if (candlesRef.current.length === 0) {
        const periodStart = getBarTime(tickTime, timeframe);
        candlesRef.current = [{
          time: periodStart, open: tickPrice, high: tickPrice, low: tickPrice, close: tickPrice,
        }];
        lastCandleTimeRef.current = periodStart;
        const engine = candleEngineRef.current;
        engine.realPrice = tickPrice;
        engine.visualPrice = tickPrice;
        engine.velocity = 0;
        engine.inertia = 0;
        engine.lastTickTime = tickTime;
        engine.lastFrameTime = performance.now();
        if (onPriceUpdate) onPriceUpdate(tickPrice);
        return;
      }

      // ===== CAMINHO CRYPTO (Binance com isClosed) =====
      if (tick.isClosed !== undefined) {
        // Marcar como ativo crypto — impede checkAndCreateLiveCandle e drawChart fallback
        // de criar live candles prematuramente (crypto usa APENAS isClosed)
        isCryptoAssetRef.current = true;
        
        if (tick.isClosed) {
          // Candle FECHOU — finalizar e NÃO criar novo live candle ainda
          // Isso garante que o próximo live candle será criado com open = este close
          if (liveCandleRef.current) {
            // Usar o close real da Binance como close final
            liveCandleRef.current.close = tickPrice;
            liveCandleRef.current.high = Math.max(liveCandleRef.current.high, tickPrice);
            liveCandleRef.current.low = Math.min(liveCandleRef.current.low, tickPrice);
            
            // Verificar se é referência compartilhada (candle já está no candlesRef)
            const lastHist = candlesRef.current[candlesRef.current.length - 1];
            if (lastHist === liveCandleRef.current) {
              // REFERÊNCIA COMPARTILHADA: candle já está no histórico, só limpar liveCandleRef
              liveCandleRef.current = null;
              clearLiveCandleCache();
            } else {
              // Objeto separado (criado via createLiveCandle): usar freezeLiveCandle para adicionar ao histórico
              freezeLiveCandle();
            }
          }
          // Motor de física: atualizar com close final
          const engine = candleEngineRef.current;
          engine.realPrice = tickPrice;
          engine.lastTickTime = tickTime;
        } else {
          // Candle EM FORMAÇÃO — atualizar ou criar live candle
          const periodStart = getBarTime(tickTime, timeframe);
          
          if (!liveCandleRef.current) {
            // Não existe live candle — verificar se o último candle histórico é do mesmo período
            const lastHist = candlesRef.current[candlesRef.current.length - 1];
            const lastHistPeriod = lastHist ? getBarTime(lastHist.time, timeframe) : 0;
            
            if (lastHist && periodStart === lastHistPeriod) {
              // REFERÊNCIA COMPARTILHADA: apontar liveCandleRef para o candle já existente no histórico
              // Sem pop — o candle fica no candlesRef E no liveCandleRef (mesmo objeto)
              liveCandleRef.current = lastHist;
              liveCandleRef.current.high = Math.max(liveCandleRef.current.high, tickPrice);
              liveCandleRef.current.low = Math.min(liveCandleRef.current.low, tickPrice);
              liveCandleRef.current.close = tickPrice;
              const engine = candleEngineRef.current;
              engine.realPrice = tickPrice;
              engine.visualPrice = tickPrice;
              engine.velocity = 0;
              engine.inertia = 0;
              engine.lastTickTime = tickTime;
            } else {
              // Período diferente — criar novo live candle separado (open = close do último histórico)
              createLiveCandle(periodStart, tickPrice, tickTime);
            }
          } else {
            // SAFETY NET: Detectar mudança de período mesmo sem ter recebido isClosed=true
            // Isso cobre o caso onde o sinal de fechamento foi perdido por qualquer motivo
            const currentLivePeriod = getBarTime(liveCandleRef.current.time, timeframe);
            if (periodStart > currentLivePeriod) {
              // Período mudou! Congelar candle anterior e criar novo
              liveCandleRef.current.close = tickPrice;
              freezeLiveCandle();
              createLiveCandle(periodStart, tickPrice, tickTime);
            } else {
              // Mesmo período — apenas atualizar high/low e motor de física
              liveCandleRef.current.high = Math.max(liveCandleRef.current.high, tickPrice);
              liveCandleRef.current.low = Math.min(liveCandleRef.current.low, tickPrice);
              // close é atualizado pelo motor de física no drawChart
              const engine = candleEngineRef.current;
              engine.realPrice = tickPrice;
              engine.lastTickTime = tickTime;
            }
          }
        }
      } else {
        // ===== CAMINHO FOREX/OTC (sem isClosed, usa período temporal) =====
        const periodStart = getBarTime(tickTime, timeframe);
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        const lastPeriod = getBarTime(lastCandle.time, timeframe);
        
        if (periodStart > lastPeriod) {
          // Novo período — congelar live candle anterior, criar novo
          if (liveCandleRef.current) {
            freezeLiveCandle();
          }
          createLiveCandle(periodStart, tickPrice, tickTime);
        } else {
          // Mesmo período — atualizar live candle existente ou criar
          if (!liveCandleRef.current) {
            createLiveCandle(periodStart, tickPrice, tickTime);
          } else {
            liveCandleRef.current.high = Math.max(liveCandleRef.current.high, tickPrice);
            liveCandleRef.current.low = Math.min(liveCandleRef.current.low, tickPrice);
            const engine = candleEngineRef.current;
            engine.realPrice = tickPrice;
            engine.lastTickTime = tickTime;
          }
        }
      }

      if (onPriceUpdate) onPriceUpdate(tickPrice);
    }, [lastTick, timeframe, onPriceUpdate, freezeLiveCandle, createLiveCandle]);

    // CRÍTICO: Criar live candle imediatamente quando o período muda, sem esperar por tick
    // Isso elimina o delay na abertura do novo candle
    useEffect(() => {
      if (!historicalDataLoadedRef.current || candlesRef.current.length === 0) {
        return;
      }

      const checkAndCreateLiveCandle = () => {
        // CRYPTO: Não criar live candles por timer para crypto
        // Crypto usa exclusivamente isClosed da Binance para gerenciar candles
        if (isCryptoAssetRef.current) return;
        
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const currentTime = validCurrentTime.getTime();
        const currentCandlePeriodStart = getBarTime(currentTime, timeframe);
        
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        const lastCandlePeriodStart = getBarTime(lastCandle.time, timeframe);
        
        // CRÍTICO: Limitar o gap temporal entre o último candle histórico e o live candle
        // Isso evita que o gráfico fique com um enorme espaço vazio quando o mercado está fechado
        // (ex: forex no fim de semana, ações fora do horário de negociação)
        const timeframeMsLocal: Record<string, number> = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        };
        const periodMsLocal = timeframeMsLocal[timeframe] || 60000;
        const maxGapPeriods = 3; // Máximo de 3 períodos de gap
        const maxGapMs = periodMsLocal * maxGapPeriods;
        const gapMs = currentCandlePeriodStart - lastCandlePeriodStart;
        
        // Se o gap é muito grande (mercado fechado), posicionar o live candle logo após o último histórico
        const effectivePeriodStart = gapMs > maxGapMs
          ? lastCandlePeriodStart + periodMsLocal
          : currentCandlePeriodStart;
        
        // Se o período atual é maior que o último histórico, criar live candle imediatamente
        if (effectivePeriodStart > lastCandlePeriodStart) {
          // CRÍTICO: Fechar o live candle anterior se existir e adicionar ao histórico
          if (liveCandleRef.current && liveCandleRef.current.time < effectivePeriodStart) {
            // Fechar o live candle anterior usando o visualPrice final do motor de física
            const engine = candleEngineRef.current;
            const finalClose = engine.visualPrice > 0 ? engine.visualPrice : liveCandleRef.current.close;
            
            // CRÍTICO: Garantir consistência entre high, low e close para evitar bug visual
            const consistentHigh = Math.max(liveCandleRef.current.high, finalClose);
            const consistentLow = Math.min(liveCandleRef.current.low, finalClose);
            const consistentClose = Math.max(consistentLow, Math.min(consistentHigh, finalClose));
            
            // Criar candle fechado com os valores finais consistentes
            const closedCandle: CandleData = {
              time: liveCandleRef.current.time,
              open: liveCandleRef.current.open,
              high: consistentHigh,
              low: consistentLow,
              close: consistentClose,
            };
            
            // Adicionar ao histórico
            candlesRef.current = [...candlesRef.current, closedCandle];
          }
          
          // Verificar se já existe live candle para este período
          if (!liveCandleRef.current || liveCandleRef.current.time !== effectivePeriodStart) {
            // Usar o último candle do histórico atualizado
            const updatedLastCandle = candlesRef.current[candlesRef.current.length - 1];
            
            // Criar live candle imediatamente com o close do último candle histórico como open
            const engine = candleEngineRef.current;
            const initialPrice = engine.visualPrice > 0 ? engine.visualPrice : updatedLastCandle.close;
            
            liveCandleRef.current = {
              time: effectivePeriodStart,
              open: updatedLastCandle.close, // FIXO: nunca mudar depois de criado
              high: initialPrice,
              low: initialPrice,
              close: initialPrice, // Será atualizado pelo visualPrice no render
            };
            
            // Atualizar motor de física
            engine.realPrice = initialPrice;
            engine.visualPrice = initialPrice;
            engine.velocity = 0;
            engine.inertia = 0;
            engine.lastTickTime = currentTime;
            
            // Limpar caches de live candle para renderização limpa
            clearLiveCandleCache();
          }
        }
      };

      // Verificar imediatamente
      checkAndCreateLiveCandle();

      // Verificar a cada segundo para detectar mudança de período rapidamente
      const interval = setInterval(checkAndCreateLiveCandle, 1000);
      
      return () => clearInterval(interval);
    }, [timeframe, historicalDataLoadedRef.current]);

    /**
     * Carrega dados históricos
     */
    const loadHistoricalData = async (): Promise<void> => {
      isLoadingRef.current = true; // Iniciar estado de carregamento
      historicalDataLoadedRef.current = false; // Resetar flag de dados carregados
      liveCandleRef.current = null; // Resetar live candle ao trocar de ativo
      
      // CRYPTO: Detectar imediatamente por símbolo para bloquear checkAndCreateLiveCandle
      // e drawChart fallback ANTES de qualquer timer executar
      const cryptoBases = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'LINK', 'LTC', 'AVAX', 'UNI', 'ATOM', 'SHIB', 'TRX'];
      const base = symbol.split('/')[0]?.toUpperCase() || '';
      isCryptoAssetRef.current = cryptoBases.includes(base);
      
      
      try {
        const url = `/api/market/historical?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=500`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.warn(`⚠️ [AnimatedCanvasChart] Erro ao buscar dados históricos (${response.status}): ${errorText}`);
          // Continuar mesmo com erro - o gráfico funcionará apenas com dados em tempo real
          candlesRef.current = [];
        } else {
          const data = await response.json();
          if (data.candles && data.candles.length > 0) {
            // Converter candles recebidos da API
            const rawCandles = data.candles.map((candle: any) => ({
              time: candle.time * 1000, // Converter de segundos para ms
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }));
            
            // Agrupar candles pelo timeframe selecionado para garantir intervalo correto
            // Isso é necessário porque a API pode retornar candles em intervalos diferentes
            // (ex: sempre retorna 1m, mas precisamos agrupar em 5m, 15m, etc.)
            candlesRef.current = groupCandlesByTimeframe(rawCandles, timeframe);
            
            if (candlesRef.current.length > 0) {
              const lastCandle = candlesRef.current[candlesRef.current.length - 1];
              lastCandleTimeRef.current = getBarTime(lastCandle.time, timeframe);
              
              // LIMPEZA DE BUFFER: Inicializar motor de física com o exato último preço do histórico
              // Isso evita que o motor comece com valores errados (zero ou primeiro ticket)
              const engine = candleEngineRef.current;
              engine.realPrice = lastCandle.close;
              engine.visualPrice = lastCandle.close; // Sincronizar visualPrice com realPrice
              engine.velocity = 0;
              engine.inertia = 0;
              engine.lastTickTime = Date.now();
              engine.lastFrameTime = performance.now();
              
              // Ajustar aceleração e jitter baseado no timeframe
              const timeFrameSeconds = getTimeFrameInSeconds(timeframe);
              engine.acceleration = getAdjustedAcceleration(timeFrameSeconds);
              engine.jitter = getAdjustedJitter(timeFrameSeconds);
              
              // Inicializar preço exibido
              displayedPriceRef.current = lastCandle.close;
              
              // WARM-UP: Verificar se temos dados suficientes para iniciar o motor
              // Precisamos de pelo menos o período máximo dos indicadores ou 100 candles (o que for maior)
              const maxIndicatorPeriod = getMaxIndicatorPeriod();
              const minCandlesRequired = Math.max(100, maxIndicatorPeriod);
              const hasEnoughData = candlesRef.current.length >= minCandlesRequired;
              
              // Marcar como pronto apenas se tivermos dados suficientes
              isDataReadyRef.current = hasEnoughData;
              firstTickAfterHistoryRef.current = true; // Próximo ticket será o primeiro após histórico
              
              if (!hasEnoughData) {
                logger.warn(`⚠️ [AnimatedCanvasChart] Apenas ${candlesRef.current.length} candles carregados, necessário ${minCandlesRequired}. Motor aguardando mais dados...`);
              }
              
              // Inicializar viewport para mostrar os últimos candles
              // Sempre mostrar os últimos candles por padrão
              const initialCandleCount = Math.min(100, candlesRef.current.length);
              viewportRef.current.visibleCandleCount = initialCandleCount;
              // Sempre começar mostrando os últimos candles (auto-scroll ativo)
              viewportRef.current.visibleStartIndex = Math.max(0, candlesRef.current.length - initialCandleCount);
              viewportRef.current.isAtEnd = true; // Marcar que está no final
              
              // CRYPTO: Usar REFERÊNCIA COMPARTILHADA para o candle em formação
              // O último candle do histórico É o candle em formação — não remover, apenas apontar liveCandleRef para ele
              // Isso garante: (1) sem delay, (2) sem duplicação, (3) sem conflito com cache de interpolação
              if (isCryptoAssetRef.current && candlesRef.current.length > 1) {
                const lastCandlePeriod = getBarTime(lastCandle.time, timeframe);
                const currentPeriod = getBarTime(Date.now(), timeframe);
                
                if (lastCandlePeriod === currentPeriod) {
                  // Apontar liveCandleRef para o MESMO OBJETO no candlesRef (referência compartilhada)
                  // Quando drawChart atualizar liveCandleRef.current.close, também atualiza o candle no histórico
                  liveCandleRef.current = candlesRef.current[candlesRef.current.length - 1];
                }
              }
            }
            
            // Calcular valores históricos dos indicadores
            if (candlesRef.current.length > 0) {
              const indicatorCandles: IndicatorCandleData[] = candlesRef.current.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: (c as any).volume
              }));
              
              // Calcular indicadores para cada candle histórico
              for (let i = 0; i < candlesRef.current.length; i++) {
                const candle = candlesRef.current[i];
                indicatorEngineRef.current.onTick(
                  indicatorCandles.slice(0, i + 1),
                  candle.close
                );
              }
            }
          } else {
            logger.warn(`⚠️ [AnimatedCanvasChart] Nenhum candle histórico retornado para ${symbol}, continuando apenas com dados em tempo real`);
            candlesRef.current = [];
          }
        }
      } catch (error) {
        logger.error(`❌ [AnimatedCanvasChart] Erro ao carregar dados históricos para ${symbol}:`, error);
        // Continuar mesmo com erro - o gráfico funcionará apenas com dados em tempo real
        candlesRef.current = [];
      } finally {
        historicalDataLoadedRef.current = true;
        isLoadingRef.current = false; // Finalizar estado de carregamento
      }
    };

    /**
     * Interpola suavemente entre dois valores com easing ease-out para movimento "vivo" e natural
     * Técnica extraída de motores de gráfico de alta performance (IQ Option, Deriv)
     */
    const smoothInterpolate = (start: number, end: number, factor: number): number => {
      // Easing ease-out cubic para movimento orgânico e "vivo"
      // Cria efeito de "mola" suave que deixa o movimento pulsante
      const eased = 1 - Math.pow(1 - Math.min(1, factor), 3);
      return start + (end - start) * eased;
    };

    /**
     * Desenha o gráfico no canvas com interpolação suave
     */
    const drawChart = () => {
      // Limpar posições dos botões de fechar e snapshots antes de redesenhar
      snapshotCloseButtonsRef.current.clear();
      snapshotPositionsRef.current.clear(); // Limpar posições para recalcular apenas os snapshots visíveis
      
      // CRÍTICO: Usar activeTradesRef.current para valor atualizado no loop de animação
      const drawChartActiveTrades = activeTradesRef.current;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { 
        alpha: false, // Melhor performance
        desynchronized: true, // Renderização mais suave
      });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      ctx.scale(dpr, dpr);
      
      // Habilitar suavização (antialiasing) para renderização mais suave
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // TÉCNICA DE INTERPOLAÇÃO LINEAR "ESCORREGADIA" COM MOVIMENTO CONTÍNUO:
      // Aplicar interpolação suave do preço atual para o preço alvo (técnica de alta performance)
      // Isso cria movimento "mola" ou suavização que deixa o movimento orgânico e "escorregadio"
      // CRÍTICO: Garantir movimento contínuo mesmo quando não há novos ticks
      if (candlesRef.current.length > 0) {
        const engine = candleEngineRef.current;
        
        updateCandlePhysics();
        
        const visualPrice = engine.visualPrice;
        
        const lastIndex = candlesRef.current.length - 1;
        const lastCandle = candlesRef.current[lastIndex];
        
        // GUARDA: Só atualizar candle se visualPrice for válido (> 0 e finito)
        // Evita corromper high/low/close com 0 ou NaN quando motor ainda não inicializou
        // CRYPTO FIX: Só atualizar o último candle do histórico se ele É o live candle (ref compartilhada)
        // ou se não existe live candle separado. Se existe live candle separado, o candle do histórico
        // já está FECHADO e não deve ser modificado.
        const isSharedRef = liveCandleRef.current === lastCandle;
        const hasSeparateLiveCandle = liveCandleRef.current && !isSharedRef;
        
        if (visualPrice > 0 && isFinite(visualPrice) && !hasSeparateLiveCandle) {
          lastCandle.high = Math.max(lastCandle.high, visualPrice);
          lastCandle.low = Math.min(lastCandle.low, visualPrice);
          lastCandle.close = visualPrice;
        }
        
        // Atualizar indicadores (apenas com visualPrice válido)
        if (visualPrice > 0 && isFinite(visualPrice)) {
          const indicatorCandles: IndicatorCandleData[] = candlesRef.current.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: (c as any).volume
          }));
          const indicatorResults = indicatorEngineRef.current.onTick(indicatorCandles, visualPrice);
          indicatorValuesRef.current = indicatorResults;
        }
      }
      
      // Calcular tempo desde o último frame para interpolação "viva" e pulsante
      // Sincronizado com 60 FPS (requestAnimationFrame)
      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      // Velocidade otimizada para movimento "vivo" e pulsante (técnica de motores de alta performance)
      // Fator ajustado para criar movimento orgânico sem ser lento
      const interpolationSpeed = 0.18; // Velocidade que cria movimento "vivo" e pulsante
      const interpolationFactor = Math.min(1, (deltaTime / 16.67) * interpolationSpeed); // Normalizar para 60fps (16.67ms por frame)

      // Limpar canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Desenhar marca d'água do logo no fundo do gráfico
      if (watermarkImageRef.current && watermarkImageRef.current.complete) {
        // Calcular dimensões retangulares mantendo proporção da imagem original
        const imgAspectRatio = watermarkImageRef.current.naturalWidth / watermarkImageRef.current.naturalHeight;
        
        // Usar 95% da menor dimensão como base (aumentado de 90%)
        const baseSize = Math.min(canvasWidth, canvasHeight) * 0.95;
        
        // Calcular largura e altura mantendo proporção (formato retangular)
        let watermarkWidth = baseSize;
        let watermarkHeight = baseSize / imgAspectRatio;
        
        // Se a altura for muito grande, ajustar pela altura
        if (watermarkHeight > canvasHeight * 0.85) {
          watermarkHeight = canvasHeight * 0.85;
          watermarkWidth = watermarkHeight * imgAspectRatio;
        }
        
        // Garantir que não ultrapasse os limites
        watermarkWidth = Math.min(watermarkWidth, canvasWidth * 0.98);
        watermarkHeight = Math.min(watermarkHeight, canvasHeight * 0.85);
        
        // Centralizar
        const watermarkX = (canvasWidth - watermarkWidth) / 2;
        const watermarkY = (canvasHeight - watermarkHeight) / 2;
        
        ctx.save();
        ctx.globalAlpha = 0.09; // Opacidade em 9%
        ctx.drawImage(watermarkImageRef.current, watermarkX, watermarkY, watermarkWidth, watermarkHeight);
        ctx.restore();
      }

      const candles = candlesRef.current;
      const isLoading = isLoadingRef.current || candles.length === 0 || !historicalDataLoadedRef.current;
      
      if (isLoading) {
        // BARRA DE CARREGAMENTO LATERAL SIMPLES
        const loadingAnimationTime = Date.now() / 1000; // Tempo em segundos
        const centerY = canvasHeight / 2;
        const centerX = canvasWidth / 2;
        
        // Dimensões da barra
        const barWidth = Math.min(canvasWidth * 0.4, 300);
        const barHeight = 3;
        const barX = centerX - barWidth / 2;
        const barY = centerY - barHeight / 2;
        
        // Fundo da barra
        ctx.fillStyle = 'rgba(55, 65, 81, 0.3)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Barra animada - movimento único da esquerda para direita, sempre dentro do espaço cinza
        const animationPhase = (loadingAnimationTime * 0.67) % 1; // 1.5s por ciclo
        const barProgress = animationPhase; // 0 a 1 (esquerda para direita)
        
        const barFillWidth = barWidth * 0.4;
        // A barra começa completamente dentro à esquerda (0) e termina completamente dentro à direita
        // O movimento máximo é barWidth - barFillWidth para que a barra não ultrapasse os limites
        const maxPosition = barWidth - barFillWidth;
        const barPosition = barProgress * maxPosition;
        
        // Gradiente da barra
        const barGradient = ctx.createLinearGradient(
          barX + barPosition, barY,
          barX + barPosition + barFillWidth, barY
        );
        barGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        barGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)');
        barGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
        
        ctx.fillStyle = barGradient;
        ctx.fillRect(barX + barPosition, barY, barFillWidth, barHeight);
        
        // Texto de carregamento
        const textOpacity = 0.4 + Math.sin(loadingAnimationTime * 2) * 0.2;
        ctx.fillStyle = `rgba(107, 114, 128, ${textOpacity})`;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Carregando dados do mercado...', centerX, barY + 30);
        return;
      }

      // Configurações do gráfico - estilo TradingView
      const priceScaleWidth = 80; // Largura da régua de preços (lado direito)
      const rightPadding = 10; // Padding direito para não colar o candle na régua
      
      // Verificar quais indicadores são osciladores (precisam de sub-janela)
      const activeIndicatorsList = indicatorEngineRef.current.getActiveIndicators();
      const oscillatorIndicators = activeIndicatorsList.filter(id => {
        const config = indicatorEngineRef.current.getConfig(id);
        return config && (config.type === 'rsi' || config.type === 'macd');
      });
      const hasVolume = activeIndicatorsList.some(id => {
        const config = indicatorEngineRef.current.getConfig(id);
        return config && config.type === 'volume';
      });
      
      // Calcular altura das sub-janelas (20% cada se houver osciladores)
      const subWindowHeight = oscillatorIndicators.length > 0 ? canvasHeight * 0.2 : 0;
      const volumeHeight = hasVolume ? canvasHeight * 0.15 : 0;
      // Aumentar altura total considerando o aumento de 20% nas subjanelas + espaço para labels de tempo + 20px de espaçamento
      const timeLabelsHeight = 15; // Espaço mínimo para os horários aparecerem (reduzido)
      const extraSpacing = 0; // Espaçamento extra removido
      const totalSubWindowsHeight = (subWindowHeight * 1.2 * oscillatorIndicators.length) + (volumeHeight * 1.2) + timeLabelsHeight + extraSpacing;
      
      // Aumentar padding bottom para evitar que horários sejam cortados + espaço para sub-janelas
      // Os horários são desenhados em chartY + chartHeight + 15, então precisamos de pelo menos 15px de padding
      const padding = { 
        top: 40, 
        right: priceScaleWidth + rightPadding, 
        bottom: Math.max(15, timeLabelsHeight) + (totalSubWindowsHeight > 0 ? totalSubWindowsHeight : 0), // Padding bottom mínimo de 15px para horários
        left: 40 // Reduzido de 60 para 40 para diminuir espaço à esquerda 
      };
      const chartWidth = canvasWidth - padding.left - padding.right;
      // Usar os paddings diretamente sem redução para garantir que horários e ícones apareçam
      const adjustedTopPadding = padding.top;
      const adjustedBottomPadding = padding.bottom;
      const baseChartHeight = canvasHeight - adjustedTopPadding - adjustedBottomPadding;
      const chartHeight = baseChartHeight; // Altura total sem aumento adicional
      const chartX = padding.left;
      // Altura superior fixa em 40px para evitar corte do cronômetro e ícones
      const chartY = 40; // Altura superior fixa de 40px
      const priceScaleX = canvasWidth - priceScaleWidth; // Posição X da régua de preços

      const viewport = viewportRef.current;
      
      // Ajustar viewport para não ultrapassar limites
      const maxStartIndex = Math.max(0, candles.length - viewport.visibleCandleCount);
      
      // Limpar cache de interpolação se o viewport mudou significativamente (pan ou zoom)
      const oldStartIndex = viewport.visibleStartIndex;
      
      // CRÍTICO: Se estava no final (mostrando últimos candles), manter no final após ajuste
      const wasAtEnd = viewport.isAtEnd || viewport.visibleStartIndex >= maxStartIndex - 1;
      
      if (wasAtEnd && candles.length > 0) {
        // Sempre manter no final se estava no final
        viewport.visibleStartIndex = maxStartIndex;
        viewport.isAtEnd = true;
      } else {
        // Ajustar normalmente se não estava no final
        viewport.visibleStartIndex = Math.max(0, Math.min(viewport.visibleStartIndex, maxStartIndex));
        viewport.isAtEnd = viewport.visibleStartIndex >= maxStartIndex - 1;
      }
      
      // Limpar cache se o viewport mudou muito (pan ou zoom significativo)
      if (Math.abs(viewport.visibleStartIndex - oldStartIndex) > 10) {
        interpolatedCandlesRef.current.clear();
      }
      
      // Live Candle: preferencialmente criado/atualizado no useEffect de ticks.
      // Aqui atualizamos o preço visual (close) e garantimos fallback de criação
      // quando um novo período começa sem tick imediato (evita "traço" antes do live candle).
      if (liveCandleRef.current) {
        const engine = candleEngineRef.current;
        if (engine.visualPrice > 0) {
          // Atualizar apenas o close com o preço visual (para animação suave)
          // O high e low são atualizados no useEffect quando chegam ticks reais
          liveCandleRef.current.close = engine.visualPrice;
        }
      }
      
      // Fallback: se o período mudou e ainda não há live candle do novo período, criar imediatamente
      // CRYPTO: Não criar live candles via fallback — crypto usa exclusivamente isClosed
      if (viewport.isAtEnd && candles.length > 0 && !isCryptoAssetRef.current) {
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const currentPeriodStart = getBarTime(validCurrentTime.getTime(), timeframe);
        
        // CRÍTICO: Limitar o gap entre último candle histórico e o live candle
        // Evita gráfico esticado quando mercado está fechado (forex fim de semana, ações fora do horário)
        const lastHistoricalCandle = candles[candles.length - 1];
        const lastHistoricalPeriodStart = getBarTime(lastHistoricalCandle.time, timeframe);
        const periodMsFallback = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        }[timeframe] || 60000;
        const gapPeriods = (currentPeriodStart - lastHistoricalPeriodStart) / periodMsFallback;
        const maxGapPeriods = 3;
        const effectivePeriodStartFallback = gapPeriods > maxGapPeriods
          ? lastHistoricalPeriodStart + periodMsFallback
          : currentPeriodStart;
        
        if (!liveCandleRef.current || liveCandleRef.current.time < effectivePeriodStartFallback) {
          const engine = candleEngineRef.current;
          const fallbackPrice = engine.visualPrice > 0 ? engine.visualPrice : candles[candles.length - 1].close;
          
          // Se ainda houver um live candle antigo não fechado, fechar antes de criar o novo
          if (liveCandleRef.current) {
            const lastHistorical = candlesRef.current[candlesRef.current.length - 1];
            if (!lastHistorical || lastHistorical.time !== liveCandleRef.current.time) {
              const consistentHigh = Math.max(liveCandleRef.current.high, fallbackPrice);
              const consistentLow = Math.min(liveCandleRef.current.low, fallbackPrice);
              const consistentClose = Math.max(consistentLow, Math.min(consistentHigh, fallbackPrice));
              const closedCandle: CandleData = {
                time: liveCandleRef.current.time,
                open: liveCandleRef.current.open,
                high: consistentHigh,
                low: consistentLow,
                close: consistentClose,
              };
              candlesRef.current = [...candlesRef.current, closedCandle];
            }
          }
          
          const lastClose = candlesRef.current[candlesRef.current.length - 1]?.close ?? fallbackPrice;
          liveCandleRef.current = {
            time: effectivePeriodStartFallback,
            open: lastClose,
            high: fallbackPrice,
            low: fallbackPrice,
            close: fallbackPrice,
          };
          
          // Limpar cache de live candle para garantir primeiro frame correto
          const keysToDelete: number[] = [];
          interpolatedCandlesRef.current.forEach((_, key) => {
            if (key < 0) {
              keysToDelete.push(key);
            }
          });
          keysToDelete.forEach(key => interpolatedCandlesRef.current.delete(key));
          lastRenderedLiveCandleTimeRef.current = null;
        }
      }

      // Calcular candles visíveis
      let visibleCandles = candles.slice(
        viewport.visibleStartIndex,
        viewport.visibleStartIndex + viewport.visibleCandleCount
      );
      
      // Flag para indicar se o Live Candle foi incluído
      let hasLiveCandle = false;
      
      // Incluir Live Candle se estiver visível (viewport no final)
      if (liveCandleRef.current && viewport.isAtEnd) {
        const lastVisibleIndex = visibleCandles.length - 1;
        const lastVisibleCandle = lastVisibleIndex >= 0 ? visibleCandles[lastVisibleIndex] : null;
        
        // REFERÊNCIA COMPARTILHADA: se liveCandleRef aponta para o mesmo objeto que o último candle visível,
        // NÃO adicionar novamente — ele já está em visibleCandles e é atualizado in-place
        if (lastVisibleCandle && lastVisibleCandle === liveCandleRef.current) {
          hasLiveCandle = true;
        } else {
          // Objeto SEPARADO (criado via createLiveCandle após isClosed: true)
          const liveCandlePeriod = getBarTime(liveCandleRef.current.time, timeframe);
          const lastVisibleCandlePeriod = lastVisibleCandle ? getBarTime(lastVisibleCandle.time, timeframe) : null;
          
          if (lastVisibleCandle && lastVisibleCandlePeriod === liveCandlePeriod) {
            // Mesmo período — substituir
            visibleCandles = [
              ...visibleCandles.slice(0, lastVisibleIndex),
              { ...liveCandleRef.current },
            ];
            hasLiveCandle = true;
          } else {
            // Período novo — adicionar ao final
            visibleCandles = [...visibleCandles, { ...liveCandleRef.current }];
            hasLiveCandle = true;
          }
        }
      }
      
      if (visibleCandles.length === 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sem dados para exibir', canvasWidth / 2, canvasHeight / 2);
        return;
      }

      // CRÍTICO: Calcular availableWidth ANTES de calcular firstTimeForCandles e lastTimeForCandles
      // Isso garante que getCandleXFromTime tenha o valor correto desde o primeiro frame
      const rightMargin = chartWidth * 0.05; // 5% de margem à direita
      const availableWidth = (chartWidth - rightMargin) * 1.065; // Aumentado em 6.5% para preencher o espaço
      const candlesAreaWidth = availableWidth * 0.75; // 75% do espaço disponível para os candles
      const candlesAreaOffset = 0; // Sem offset adicional, começando do início
      
      // CRÍTICO: Calcular firstTimeForCandles e lastTimeForCandles DEPOIS de availableWidth
      // Isso garante que no primeiro frame, quando o live candle é adicionado, os valores sejam calculados corretamente
      // e estejam disponíveis para todos os cálculos subsequentes (espaçamento, etc.)
      let firstTimeForCandles: number = 0;
      let lastTimeForCandles: number = 0;
      // CRÍTICO: Armazenar o tempo do live candle usado para calcular lastTimeForCandles
      // Isso garante que o cálculo de posição use o mesmo valor, evitando problemas de timing no primeiro frame
      let liveCandleTimeForPosition: number | null = null;
      if (visibleCandles.length > 0) {
        // CRÍTICO: Usar o primeiro candle em visibleCandles, que pode incluir o live candle se foi adicionado
        // Isso garante que firstTimeForCandles seja calculado corretamente mesmo quando o live candle é adicionado
        firstTimeForCandles = visibleCandles[0].time;
        const timeframeMsMap: Record<Timeframe, number> = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        };
        const periodMs = timeframeMsMap[timeframe] || 60000;
        
        // Usar live candle no cálculo somente quando ele já está presente em visibleCandles
        if (hasLiveCandle && liveCandleRef.current) {
          // CRÍTICO: Usar liveCandleRef.current diretamente aqui para garantir que estamos usando os valores mais recentes
          // mesmo no primeiro frame, quando pode haver um problema de timing entre useEffect e requestAnimationFrame
          const currentLiveCandleTime = liveCandleRef.current.time;
          const lastHistoricalCandle = candles.length > 0 ? candles[candles.length - 1] : null;
          const lastHistoricalPeriodStart = lastHistoricalCandle ? getBarTime(lastHistoricalCandle.time, timeframe) : currentLiveCandleTime;
          const expectedLiveCandleTime = lastHistoricalPeriodStart + periodMs;
          const liveCandlePeriodStart = Math.min(currentLiveCandleTime, expectedLiveCandleTime);
          
          liveCandleTimeForPosition = liveCandlePeriodStart;
          
          // Quando há live candle, calcular lastTimeForCandles de forma consistente
          // Primeiro, usar o fim do período do live candle como base
          const liveCandleEndTime = liveCandlePeriodStart + periodMs;
          
          // Estender para o futuro considerando expirationTime e futureExtension
          // CRÍTICO: Usar periodMs para calcular futureExtension proporcionalmente ao timeframe
          // Isso garante que timeframes maiores tenham extensão futura proporcional (ex: 5m = 5x mais que 1m)
          // CRÍTICO: Para garantir cálculo correto no primeiro frame após criação de novo live candle,
          // sempre considerar que o live candle está presente para o cálculo, mesmo se ainda não foi adicionado a visibleCandles
          // Isso garante que o cálculo de lastTimeForCandles seja correto desde o primeiro frame
          // Se hasLiveCandle é true, usar visibleCandles.length (já inclui o live candle)
          // Caso contrário, usar visibleCandles.length + 1 (considerando que o live candle será adicionado)
          const totalCandlesForFutureCandles = hasLiveCandle ? visibleCandles.length : (visibleCandles.length + 1);
          const expirationTimeValue = expirationTime && expirationTime instanceof Date ? expirationTime.getTime() : null;
          
          // Calcular futureExtension baseado no número de candles e no timeframe (proporcional a periodMs)
          // Para 1m (60000ms): < 5 candles = 2 períodos, < 10 candles = 5 períodos, < 20 candles = 15 períodos, >= 20 candles = 25 períodos
          // Para outros timeframes, multiplicar pelos mesmos fatores de período
          const futureExtensionBase = totalCandlesForFutureCandles < 5 ? 2 : (totalCandlesForFutureCandles < 10 ? 5 : (totalCandlesForFutureCandles < 20 ? 15 : 25));
          const futureExtensionPeriods = futureExtensionBase;
          const futureExtension = periodMs * futureExtensionPeriods;
          
          if (expirationTimeValue && expirationTimeValue > liveCandleEndTime) {
            lastTimeForCandles = expirationTimeValue + futureExtension;
          } else {
            // CRÍTICO: Garantir que lastTimeForCandles seja pelo menos o fim do live candle + extensão futura
            // Isso garante posicionamento correto desde o primeiro frame
            // IMPORTANTE: Usar currentLiveCandleTime (que é liveCandleRef.current.time) para garantir sincronização
            lastTimeForCandles = liveCandleEndTime + futureExtension;
          }
        } else {
          // Se não há live candle, usar o tempo do último candle visível
          // CRÍTICO: Limitar o gap para evitar gráfico esticado quando mercado está fechado
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const currentTimeValue = validCurrentTime.getTime();
          const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
          const lastCandlePeriodStartNoLive = getBarTime(lastCandleTime, timeframe);
          const currentPeriodStartNoLive = getBarTime(currentTimeValue, timeframe);
          const gapPeriodsNoLive = (currentPeriodStartNoLive - lastCandlePeriodStartNoLive) / periodMs;
          
          let baseTime: number;
          if (gapPeriodsNoLive > 3) {
            // Mercado fechado: limitar o range ao último candle + poucos períodos
            baseTime = lastCandlePeriodStartNoLive + periodMs * 2;
          } else {
            baseTime = Math.max(lastCandleTime, currentTimeValue);
            // Se estamos no final e o período já virou, fixar o baseTime no início do próximo período
            if (viewport.isAtEnd && currentPeriodStartNoLive > lastCandlePeriodStartNoLive) {
              baseTime = lastCandlePeriodStartNoLive + periodMs;
            }
          }
          
          lastTimeForCandles = baseTime;
          
          // Estender o lastTimeForCandles para o futuro
          // CRÍTICO: Usar periodMs para calcular futureExtension proporcionalmente ao timeframe
          // Usar visibleCandles.length para garantir que o cálculo seja baseado no estado real atual
          const totalCandlesForFutureCandles = visibleCandles.length;
          const expirationTimeValue = expirationTime && expirationTime instanceof Date ? expirationTime.getTime() : null;
          
          // Calcular futureExtension baseado no número de candles e no timeframe (proporcional a periodMs)
          const futureExtensionBase = totalCandlesForFutureCandles < 5 ? 2 : (totalCandlesForFutureCandles < 10 ? 5 : (totalCandlesForFutureCandles < 20 ? 15 : 25));
          const futureExtensionPeriods = futureExtensionBase;
          const futureExtension = periodMs * futureExtensionPeriods;
          
          if (expirationTimeValue && expirationTimeValue > lastTimeForCandles) {
            lastTimeForCandles = expirationTimeValue + futureExtension;
          } else {
            lastTimeForCandles = Math.max(lastTimeForCandles, baseTime + futureExtension);
          }
        }
      }

      // Calcular preços min/max dos candles visíveis (incluindo Live Candle se presente)
      const prices = visibleCandles.flatMap(c => [c.open, c.high, c.low, c.close]).filter(p => isFinite(p) && p > 0);
      if (prices.length === 0) return; // Sem dados válidos para desenhar
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      const pricePadding = Math.max(priceRange * 0.1, minPrice * 0.0001); // Padding mínimo para evitar range zero
      const actualMinPrice = minPrice - pricePadding;
      const actualMaxPrice = maxPrice + pricePadding;
      const actualPriceRange = actualMaxPrice - actualMinPrice;

      // Atualizar layout ref para handlers de mouse
      chartLayoutRef.current = { chartX, chartY, chartWidth, chartHeight, actualMinPrice, actualMaxPrice, actualPriceRange };

      // Desenhar fundo da régua de preços (lado direito) - igual ao TradingView
      // Fundo da mesma cor do gráfico (preto)
      ctx.fillStyle = '#000000'; // Mesma cor do gráfico
      ctx.fillRect(priceScaleX, chartY, priceScaleWidth, chartHeight);
      
      // Desenhar borda esquerda da régua de preços (separador sutil)
      ctx.strokeStyle = '#1a1b1e'; // Borda muito sutil
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(priceScaleX, chartY);
      ctx.lineTo(priceScaleX, chartY + chartHeight);
      ctx.stroke();

      // Calcular número reduzido de níveis de preço (usado para linhas horizontais e labels)
      const priceLevels = 4; // Máximo de 4 níveis de preço
      const dynamicLevels = actualPriceRange < 1 ? 4 : priceLevels; // Usar 4 em vez de 6 para manter máximo de 4 valores
      
      // Nota: As linhas horizontais serão desenhadas depois que availableWidth for calculado

      // Desenhar valores na régua de preços (lado direito) - design moderno
      ctx.textAlign = 'right';
      
      // Calcular último preço para destacar - usar visualPrice do motor de física
      const engine = candleEngineRef.current;
      const currentVisualPrice = engine.visualPrice || (visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : null);
      
      // Suavizar o preço exibido no retângulo azul (evitar mudanças muito rápidas)
      // Esta suavização é independente do movimento do candle (visualPrice)
      if (currentVisualPrice !== null && currentVisualPrice > 0) {
        if (displayedPriceRef.current === 0) {
          displayedPriceRef.current = currentVisualPrice;
        } else {
          // Interpolação muito suave para o preço exibido no retângulo azul
          // Fator reduzido para movimento mais suave e elegante
          const smoothingFactor = 0.08; // Fator de suavização bem mais lento para o retângulo azul
          displayedPriceRef.current = displayedPriceRef.current + (currentVisualPrice - displayedPriceRef.current) * smoothingFactor;
        }
      }
      
      // Para a linha azul e círculo pulsante, usar o preço atual direto (sem suavização) para eliminar delay
      const lastPriceForLine = currentVisualPrice !== null && currentVisualPrice > 0 
        ? currentVisualPrice 
        : (visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : null);
      const lastPriceY = lastPriceForLine !== null 
        ? chartY + chartHeight - ((lastPriceForLine - actualMinPrice) / actualPriceRange) * chartHeight
        : null;
      
      // Para o retângulo azul, usar o preço suavizado
      const lastPrice = displayedPriceRef.current > 0 ? displayedPriceRef.current : (visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : null);
      
      // Loop ajustado para gerar exatamente 4 valores (0, 1, 2, 3) em vez de 5 (0, 1, 2, 3, 4)
      for (let i = 0; i < dynamicLevels; i++) {
        const price = actualMinPrice + (actualPriceRange * i / (dynamicLevels - 1));
        const y = chartY + chartHeight - (i / (dynamicLevels - 1)) * chartHeight;
        
          // Cores mais modernas e suaves
          ctx.fillStyle = i % 2 === 0 ? '#9ca3af' : '#6b7280'; // Alternância sutil
          ctx.font = '400 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif';
        
        // Formatar preço com precisão adequada
        const priceStr = formatPrice(price, actualPriceRange);
        // Padding direito aumentado para evitar corte do texto no zoom máximo
        const textX = priceScaleX + priceScaleWidth - 12; // Aumentado de 8 para 12 para evitar corte
        ctx.fillText(priceStr, textX, y + 4);
      }
      
      // Desenhar caixas dos preços de entrada ANTES da caixa do preço atual (para ficarem atrás)
      // Usar activeTradesRef para garantir que temos a versão mais recente
      const currentActiveTradesForBoxes = activeTradesRef.current;
      if (currentActiveTradesForBoxes && currentActiveTradesForBoxes.length > 0 && visibleCandles.length > 0) {
        const tradesForCurrentSymbol = currentActiveTradesForBoxes.filter(t => !t.symbol || t.symbol === symbol);
        
        tradesForCurrentSymbol.forEach(trade => {
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const currentTime = validCurrentTime.getTime();
          const isTradeActive = trade.expiration > currentTime;
          const isTradeExpired = !isTradeActive && trade.result;
          
          if (!isTradeActive && !isTradeExpired) {
            return; // Pular trades expirados sem resultado
          }
          
          const entryY = chartY + chartHeight - ((trade.entryPrice - actualMinPrice) / actualPriceRange) * chartHeight;
          
          // Desenhar caixa do preço de entrada (será desenhada antes da caixa do preço atual)
          ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          const entryPriceStr = formatPrice(trade.entryPrice, actualPriceRange);
          
          const textMetrics = ctx.measureText(entryPriceStr);
          const textWidth = textMetrics.width;
          const boxPadding = 6;
          const boxWidth = textWidth + boxPadding * 2;
          const boxHeight = 20;
          const boxX = priceScaleX + priceScaleWidth - 8 - textWidth - boxPadding;
          const boxY = entryY - boxHeight / 2;
          
          // Determinar cor baseado no tipo de operação
          const entryBoxColor = trade.type === 'call' 
            ? 'rgba(34, 197, 94, 0.6)' // Verde com opacidade para CALL
            : 'rgba(239, 68, 68, 0.6)'; // Vermelho com opacidade para PUT
          
          // Caixa (retângulo) atrás do texto com cor da linha e opacidade
          ctx.fillStyle = entryBoxColor;
          ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
          
          // Borda da caixa (mesma cor, mais opaca)
          ctx.strokeStyle = trade.type === 'call' ? '#22c55e' : '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
          
          // Desenhar texto do preço de entrada (branco) - desenhar aqui para garantir ordem
          ctx.fillStyle = '#ffffff'; // Branco para o texto
          ctx.fillText(entryPriceStr, priceScaleX + priceScaleWidth - 8, entryY);
        });
      }
      
      // Sempre desenhar o marcador de preço atual no canto direito (independente do zoom)
      if (lastPriceY !== null && lastPrice !== null) {
        // Verificar se o último preço está dentro da área visível do gráfico
        if (lastPriceY >= chartY && lastPriceY <= chartY + chartHeight) {
          // Efeito pulsante no marcador de preço atual
          const pulseTime = Date.now() / 250; // Velocidade do pulso
          const pulseScale = 1 + Math.sin(pulseTime) * 0.1; // Escala varia 10%
          
          // Preparar contexto para medir o texto
          ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          const currentPriceStr = formatPrice(lastPrice, actualPriceRange);
          
          // Medir largura do texto para ajustar o tamanho do retângulo dinamicamente
          const textMetrics = ctx.measureText(currentPriceStr);
          const textWidth = textMetrics.width;
          
          const triangleSize = 8; // Tamanho do triângulo (seta apontando para a esquerda)
          const padding = 20; // Padding total aumentado (10px de cada lado) para evitar corte no zoom máximo
          const minBoxWidth = textWidth + padding; // Largura mínima baseada no texto
          // CRÍTICO: Garantir que boxWidth seja sempre maior que textWidth + padding para evitar corte
          // No zoom máximo, o texto pode ser longo, então garantir espaço suficiente
          const boxWidth = Math.max(minBoxWidth, textWidth + padding + 4); // Sempre garantir pelo menos 4px extra
          const boxHeight = 24 * pulseScale;
          const boxY = lastPriceY - boxHeight / 2;
          const rectX = priceScaleX + triangleSize;
          // CRÍTICO: Garantir que rectWidth não seja limitado pela régua, mas sim pelo texto
          // Se o texto for muito longo, permitir que a caixa se estenda além da régua
          const rectWidth = Math.max(boxWidth, textWidth + padding);
          
          // Desenhar forma de seta (retângulo + triângulo integrado) como uma única forma
          // A ponta da seta deve estar fora da régua, mais para dentro do gráfico
          const arrowTipX = priceScaleX - 10; // Ponta da seta (fora da régua, mais para dentro do gráfico)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Branco sólido com opacidade normal
          ctx.beginPath();
          // Retângulo
          ctx.rect(rectX, boxY, rectWidth, boxHeight);
          // Triângulo apontando para a esquerda (integrado ao retângulo)
          ctx.moveTo(arrowTipX, lastPriceY); // Ponto da seta (esquerda, fora da régua)
          ctx.lineTo(rectX, boxY); // Canto superior esquerdo do retângulo
          ctx.lineTo(rectX, boxY + boxHeight); // Canto inferior esquerdo do retângulo
          ctx.closePath();
          ctx.fill();
          
          // Borda branca no destaque (retângulo + triângulo sem linha de divisão)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // Branco sólido com opacidade normal
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // Contorno externo da forma completa (sem linha interna entre triângulo e retângulo)
          ctx.moveTo(arrowTipX, lastPriceY); // Ponto da seta (esquerda, fora da régua)
          ctx.lineTo(rectX, boxY); // Canto superior esquerdo do retângulo
          ctx.lineTo(rectX + rectWidth, boxY); // Canto superior direito do retângulo
          ctx.lineTo(rectX + rectWidth, boxY + boxHeight); // Canto inferior direito do retângulo
          ctx.lineTo(rectX, boxY + boxHeight); // Canto inferior esquerdo do retângulo
          ctx.closePath(); // Fecha voltando ao ponto inicial
          ctx.stroke();
          
          // Desenhar o valor do preço atual de forma bem clara (com padding adequado)
          ctx.fillStyle = '#000000'; // Preto para melhor visualização sobre o fundo branco
          // CRÍTICO: Usar padding de 10px da direita para evitar corte, garantindo que o texto fique dentro da caixa
          const textX = Math.min(rectX + rectWidth - 10, priceScaleX + priceScaleWidth - 4); // Garantir que não ultrapasse a régua
          ctx.fillText(currentPriceStr, textX, lastPriceY);
          ctx.textAlign = 'left'; // Restaurar alinhamento padrão
          ctx.textBaseline = 'alphabetic'; // Restaurar baseline padrão
        }
      }
      
      // availableWidth, candlesAreaWidth e candlesAreaOffset já foram calculados acima (antes de firstTimeForCandles)
      
      // Espaçamento entre candles (aumentado para melhor visualização)
      // IMPORTANTE: Usar viewport.visibleCandleCount para calcular o espaçamento, não visibleCandles.length
      // Isso garante que o Live Candle (se incluído) tenha o mesmo espaçamento dos outros candles
      // Manter padrão de espaçamento consistente: usar 0.50 como padrão (sem zoom ou pouco zoom)
      // Ajustar spacing dinamicamente apenas para zoom in extremo para evitar sobreposição
      const totalCandlesForSpacing = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
      // Padrão de espaçamento: 0.50 (sem zoom ou pouco zoom)
      // Ajuste para zoom in extremo:
      // - < 5 candles: spacing menor (0.48) para candles mais próximos no zoom extremo
      // - < 10 candles: spacing médio (0.48) para evitar sobreposição
      
      const dynamicSpacing = totalCandlesForSpacing < 5 ? 0.48 : (totalCandlesForSpacing < 10 ? 0.48 : 0.50);
      const candleWidth = Math.max(3, (candlesAreaWidth / totalCandlesForSpacing) * dynamicSpacing);
      
      // Desenhar linhas horizontais de grade para os preços (após calcular availableWidth)
      // Desenhar ANTES dos candles para ficarem visíveis
      ctx.strokeStyle = 'rgba(55, 65, 81, 0.4)'; // Mais visível
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]); // Linha reta
      
      // Loop ajustado para gerar exatamente 4 linhas horizontais (0, 1, 2, 3) em vez de 5
      for (let i = 0; i < dynamicLevels; i++) {
        const price = actualMinPrice + (actualPriceRange * i / (dynamicLevels - 1));
        const y = chartY + chartHeight - (i / (dynamicLevels - 1)) * chartHeight;
        
        // Pular a linha de grade se ela estiver na mesma posição Y do lastPriceY (para evitar pontilhado sobre a linha azul)
        if (lastPriceY !== null && Math.abs(y - lastPriceY) < 2) {
          continue; // Não desenhar linha de grade na posição do preço atual
        }
        
        // Desenhar linha horizontal de grade
        ctx.beginPath();
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + availableWidth, y);
        ctx.stroke();
      }
      
      // Desenhar linhas de grade verticais e labels de tempo ANTES dos candles
      // (para que fiquem visíveis atrás dos candles)
      ctx.fillStyle = '#787b86'; // Cor cinza TradingView
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Calcular intervalo de tempo dinamicamente baseado no zoom (máximo 5 linhas)
      const calculateDynamicTimeInterval = (timeRange: number): number => {
        // Dividir o tempo total por 5 para ter no máximo 5 linhas
        const targetInterval = timeRange / 5;
        
        // Intervalos "bonitos" em milissegundos (ordem crescente)
        const niceIntervals = [
          1000,        // 1 segundo
          5000,        // 5 segundos
          10000,       // 10 segundos
          15000,       // 15 segundos
          30000,       // 30 segundos
          60000,       // 1 minuto
          2 * 60000,   // 2 minutos
          5 * 60000,   // 5 minutos
          10 * 60000,  // 10 minutos
          15 * 60000,  // 15 minutos
          30 * 60000,  // 30 minutos
          60 * 60000,  // 1 hora
          2 * 60 * 60000,   // 2 horas
          4 * 60 * 60000,   // 4 horas
          6 * 60 * 60000,   // 6 horas
          12 * 60 * 60000,  // 12 horas
          24 * 60 * 60000,  // 1 dia
          7 * 24 * 60 * 60000,  // 1 semana
        ];
        
        // Encontrar o intervalo mais próximo que seja >= targetInterval
        for (let i = 0; i < niceIntervals.length; i++) {
          if (niceIntervals[i] >= targetInterval) {
            return niceIntervals[i];
          }
        }
        
        // Se o intervalo é muito grande, usar o maior disponível
        return niceIntervals[niceIntervals.length - 1];
      };
      
      if (visibleCandles.length > 0) {
        const firstTime = visibleCandles[0].time;
        // Para calcular lastTime, considerar Live Candle se existir
        let lastTime: number;
        // CRÍTICO: Verificar se há live candle ANTES de calcular isLastCandleCurrent
        // O live candle pode estar em visibleCandles mas não em candles
        const hasLiveCandle = liveCandleRef.current && viewport.isAtEnd;
        const isLastCandleCurrent = hasLiveCandle 
          ? (viewport.visibleStartIndex + visibleCandles.length - 1) >= candles.length - 1
          : (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
        
        // Usar o tempo atual real
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const currentTimeValue = validCurrentTime.getTime();
        const timeframeMsMapForLabels: Record<string, number> = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        };
        
        // CORREÇÃO: Se há live candle, usar seu tempo (que já está limitado pelo gap cap)
        // Isso garante que o eixo de tempo não mostre um range enorme quando o mercado está fechado
        if (hasLiveCandle && liveCandleRef.current) {
          // Usar o tempo do live candle (já limitado pelo gap cap) + extensão
          const liveCandleEndForLabels = liveCandleRef.current.time + (timeframeMsMapForLabels[timeframe] || 60000);
          lastTime = Math.max(liveCandleEndForLabels, visibleCandles[visibleCandles.length - 1].time);
        } else {
          // Caso contrário, usar o último candle visível (não Date.now() para evitar gap)
          const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
          const lastCandlePeriodForLabels = getBarTime(lastCandleTime, timeframe);
          const currentPeriodForLabels = getBarTime(currentTimeValue, timeframe);
          const gapPeriodsForLabels = (currentPeriodForLabels - lastCandlePeriodForLabels) / (timeframeMsMapForLabels[timeframe] || 60000);
          // Limitar gap para labels também
          lastTime = gapPeriodsForLabels > 3 ? lastCandleTime + (timeframeMsMapForLabels[timeframe] || 60000) * 2 : Math.max(lastCandleTime, currentTimeValue);
        }
        
        // Estender o eixo de tempo para o futuro para mostrar tempos futuros
        // Verificar se há linhas de expiração/chegada que estão no futuro
        // CRÍTICO: Usar periodMs para calcular futureExtension proporcionalmente ao timeframe
        // Isso garante que timeframes maiores tenham extensão futura proporcional (ex: 5m = 5x mais que 1m)
        const timeframeMsMap: Record<Timeframe, number> = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        };
        const periodMs = timeframeMsMap[timeframe] || 60000;
        
        const totalCandlesForFuture = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
        const expirationTimeValue = expirationTime && expirationTime instanceof Date ? expirationTime.getTime() : null;
        
        // Calcular futureExtension baseado no número de candles e no timeframe (proporcional a periodMs)
        const futureExtensionPeriods = totalCandlesForFuture < 5 ? 2 : (totalCandlesForFuture < 10 ? 5 : (totalCandlesForFuture < 20 ? 15 : 25));
        const futureExtension = periodMs * futureExtensionPeriods;
        
        if (expirationTimeValue && expirationTimeValue > lastTime) {
          lastTime = expirationTimeValue + futureExtension;
        } else {
          lastTime = Math.max(lastTime, currentTimeValue + futureExtension);
        }
        
        const timeRange = lastTime - firstTime;
        
        // Calcular intervalo dinâmico baseado no zoom
        const timeInterval = calculateDynamicTimeInterval(timeRange);
        
        // Função para arredondar tempo para o intervalo mais próximo (para baixo)
        const roundToInterval = (timestamp: number, interval: number): number => {
          return Math.floor(timestamp / interval) * interval;
        };
        
        // Função para formatar hora baseado no intervalo dinâmico
        const formatTime = (timestamp: number, interval: number): string => {
          const date = new Date(timestamp);
          const intervalMinutes = interval / 1000 / 60;
          const intervalHours = interval / 1000 / 60 / 60;
          const intervalDays = interval / 1000 / 60 / 60 / 24;
          
          if (intervalDays >= 1) {
            // Para intervalos de dias ou mais, mostrar data e hora
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            return `${day}/${month} ${hours}:00`;
          } else if (intervalHours >= 1) {
            // Para intervalos de horas, mostrar hora e minuto
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          } else if (intervalMinutes >= 1) {
            // Para intervalos de minutos, mostrar hora:minuto
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          } else {
            // Para intervalos de segundos, mostrar hora:minuto:segundo
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          }
        };
        
        // Calcular o primeiro label time arredondando para cima para o próximo múltiplo do intervalo
        let labelTime = roundToInterval(firstTime, timeInterval);
        if (labelTime < firstTime) {
          labelTime += timeInterval;
        }
        
        // Desenhar linhas de grade discretas e labels de tempo (máximo 5 linhas)
        const drawnTimes = new Set<number>();
        let lineCount = 0;
        const maxLines = 5;
        
        // Continuar desenhando labels até o último tempo (incluindo futuro)
        while (labelTime <= lastTime && lineCount < maxLines) {
          // Evitar duplicatas
          if (drawnTimes.has(labelTime)) {
            labelTime += timeInterval;
            continue;
          }
          drawnTimes.add(labelTime);
          lineCount++;
          
          // Calcular posição X baseada no tempo, não no índice do candle
          // Isso garante que as linhas apareçam nos tempos exatos
          // Usar availableWidth sem offset para evitar espaço preto à esquerda
          const timePosition = (labelTime - firstTime) / timeRange;
          const x = chartX + candlesAreaOffset + timePosition * availableWidth;
          
          // Desenhar se estiver dentro da área visível (incluindo futuro além de availableWidth)
          // Permitir desenhar até 20% além de availableWidth para mostrar tempos futuros
          const extendedWidth = availableWidth * 1.2;
          if (x >= chartX + candlesAreaOffset && x <= chartX + candlesAreaOffset + extendedWidth) {
            // Desenhar linha de grade discreta (vertical) na posição do horário
            // Linha reta, fina mas mais visível
            ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)'; // Mais visível
            ctx.lineWidth = 0.5; // Linha fina
            ctx.setLineDash([]); // Linha reta (sem tracejado)
            ctx.beginPath();
            ctx.moveTo(x, chartY);
            ctx.lineTo(x, chartY + chartHeight);
            ctx.stroke();
            
            // Formatar e desenhar o rótulo de tempo
            const timeStr = formatTime(labelTime, timeInterval);
            ctx.fillStyle = '#787b86'; // Cor cinza TradingView
            // Posicionar os horários dentro do padding bottom disponível
            const timeLabelY = chartY + chartHeight + 15; // Posição dos horários (reduzido ainda mais)
            if (timeLabelY < canvasHeight - 1) { // Verificar se está dentro do canvas
              ctx.fillText(timeStr, x, timeLabelY);
            }
          }
          
          // Avançar para o próximo intervalo
          labelTime += timeInterval;
        }
        
        // Sempre desenhar o último horário se não foi incluído e ainda temos espaço para mais linhas
        // Esta linha será posicionada mais à direita para usar melhor o espaço disponível
        if (lineCount < maxLines) {
          const lastCandle = visibleCandles[visibleCandles.length - 1];
          const isLastCandleCurrent = (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
          
          // Verificar se há Live Candle (candle em tempo real)
          const hasLiveCandle = liveCandleRef.current && viewport.isAtEnd;
          const isShowingLiveCandle = hasLiveCandle && isLastCandleCurrent;
          
          // CORREÇÃO: Para o candle atual ou Live Candle, usar o tempo atual real em vez do tempo do candle
          let lastTimeToDisplay: number;
          let timePosition: number;
          
          if (isShowingLiveCandle || isLastCandleCurrent) {
            // CRÍTICO: Para evitar que as linhas verticais se movam, usar o tempo do período do candle
            // arredondado para o intervalo, não o tempo atual em tempo real
            // Isso garante que as linhas sejam fixas baseadas em tempos arredondados
            const baseCandleTime = hasLiveCandle && liveCandleRef.current ? liveCandleRef.current.time : lastCandle.time;
            
            // Arredondar o tempo do período para o intervalo mais próximo (para baixo)
            // Isso garante que a linha seja fixa no início do período arredondado
            lastTimeToDisplay = roundToInterval(baseCandleTime, timeInterval);
            // Se o tempo arredondado for menor que o período, adicionar um intervalo para mostrar o próximo
            if (lastTimeToDisplay < baseCandleTime) {
              lastTimeToDisplay += timeInterval;
            }
            
            // Calcular posição baseada no tempo arredondado do período, não no tempo atual
            // Isso garante que a linha não se mova conforme os segundos passam
            timePosition = (lastTimeToDisplay - firstTime) / timeRange;
          } else {
            // Para candles históricos, usar o tempo do candle arredondado
            lastTimeToDisplay = roundToInterval(lastCandle.time, timeInterval);
            timePosition = (lastTimeToDisplay - firstTime) / timeRange;
          }
          
          // Se o último tempo não foi desenhado, desenhar
          if (!drawnTimes.has(lastTimeToDisplay) && lastTimeToDisplay <= (lastTime + timeInterval * 2)) {
            // Sem offset para evitar espaço preto à esquerda
            const lastX = chartX + candlesAreaOffset + timePosition * availableWidth;
            
            // Desenhar se estiver dentro da área visível (incluindo futuro)
            const extendedWidth = availableWidth * 1.2;
            if (lastX >= chartX + candlesAreaOffset && lastX <= chartX + candlesAreaOffset + extendedWidth) {
              // Desenhar linha de grade para o último ponto
              ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)'; // Mais visível
              ctx.lineWidth = 0.5; // Linha fina
              ctx.setLineDash([]); // Linha reta (sem tracejado)
              ctx.beginPath();
              ctx.moveTo(lastX, chartY);
              ctx.lineTo(lastX, chartY + chartHeight);
              ctx.stroke();
              
            const lastTimeStr = formatTime(lastTimeToDisplay, timeInterval);
              ctx.fillStyle = '#787b86'; // Cor cinza TradingView
            // Posicionar o último horário dentro do padding bottom disponível
            const lastTimeLabelY = chartY + chartHeight + 15; // Posição dos horários (reduzido ainda mais)
            if (lastTimeLabelY < canvasHeight - 1) { // Verificar se está dentro do canvas
              ctx.fillText(lastTimeStr, lastX, lastTimeLabelY);
            }
            }
          }
        }
      }

      // Desenhar linha indicadora do último preço com bola pulsante
      // Técnica extraída de motores de gráfico de alta performance
      if (lastPriceY !== null && visibleCandles.length > 0) {
        // Calcular posição X do último candle usando o EIXO DE TEMPO (mesma lógica dos candles)
        // Isso garante que a linha acompanhe o live candle e seja responsiva ao zoom
        let lastCandleX: number;
        
        if (visibleCandles.length > 0) {
          const firstTime = visibleCandles[0].time;
          let lastTime: number;
          const isLastCandleCurrent = (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
          const hasLiveCandle = liveCandleRef.current && viewport.isAtEnd;
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const currentTimeValue = validCurrentTime.getTime();
          
          // CRÍTICO: Para evitar que o círculo pulsante se mova, usar um valor FIXO baseado no período do live candle
          // O live candle já tem seu time limitado pelo gap cap
          if (hasLiveCandle && isLastCandleCurrent && liveCandleRef.current) {
            const periodMsForLine = {
              '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
              '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
              '4h': 14400000, '8h': 28800000, '12h': 43200000,
              '1d': 86400000, '1w': 604800000, '1M': 2592000000,
            }[timeframe] || 60000;
            // Usar o fim do período do live candle como base (tempo do período + período completo)
            lastTime = liveCandleRef.current.time + periodMsForLine;
          } else {
            const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
            // Limitar gap
            const lastCandlePeriodForPulse = getBarTime(lastCandleTime, timeframe);
            const currentPeriodForPulse = getBarTime(currentTimeValue, timeframe);
            const pulsePeriodMs = {
              '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
              '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
              '4h': 14400000, '8h': 28800000, '12h': 43200000,
              '1d': 86400000, '1w': 604800000, '1M': 2592000000,
            }[timeframe] || 60000;
            const pulseGapPeriods = (currentPeriodForPulse - lastCandlePeriodForPulse) / pulsePeriodMs;
            lastTime = pulseGapPeriods > 3 ? lastCandleTime + pulsePeriodMs * 2 : Math.max(lastCandleTime, currentTimeValue);
          }
          
          // Estender o lastTime para o futuro
          const timeframeMsMapLine: Record<Timeframe, number> = {
            '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
            '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
            '4h': 14400000, '8h': 28800000, '12h': 43200000,
            '1d': 86400000, '1w': 604800000, '1M': 2592000000,
          };
          const periodMs = timeframeMsMapLine[timeframe] || 60000;
          
          const totalCandlesForFutureLine = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
          const expirationTimeValue = expirationTime && expirationTime instanceof Date ? expirationTime.getTime() : null;
          
          const futureExtensionBase = totalCandlesForFutureLine < 5 ? 2 : (totalCandlesForFutureLine < 10 ? 5 : (totalCandlesForFutureLine < 20 ? 15 : 25));
          const futureExtensionPeriods = futureExtensionBase;
          const futureExtension = periodMs * futureExtensionPeriods;
          
          if (expirationTimeValue && expirationTimeValue > lastTime) {
            lastTime = expirationTimeValue + futureExtension;
          } else {
            if (hasLiveCandle && liveCandleRef.current) {
              const liveCandleEndTime = liveCandleRef.current.time + periodMs;
              lastTime = Math.max(lastTime, liveCandleEndTime + futureExtension);
            } else {
              lastTime = Math.max(lastTime, lastTime + futureExtension);
            }
          }
          
          const timeRange = lastTime - firstTime;
          
          // Calcular posição X do último candle usando o eixo de tempo
          // CRÍTICO: Para o live candle, usar o centro do candle (tempo do período + metade do período)
          let lastCandleTimeForX: number;
          if (hasLiveCandle && liveCandleRef.current && isLastCandleCurrent) {
            // Se há live candle, usar o centro do candle (tempo do período + metade do período)
            // Isso garante que a linha horizontal e o círculo pulsante fiquem no centro do live candle
            const timeframeMsMap: Record<Timeframe, number> = {
              '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
              '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
              '4h': 14400000, '8h': 28800000, '12h': 43200000,
              '1d': 86400000, '1w': 604800000, '1M': 2592000000,
            };
            const periodMs = timeframeMsMap[timeframe] || 60000;
            // Usar o tempo do período do live candle + metade do período para centralizar
            lastCandleTimeForX = liveCandleRef.current.time + (periodMs / 2);
          } else {
            // Usar o tempo do último candle
            lastCandleTimeForX = visibleCandles[visibleCandles.length - 1].time;
          }
          
          if (timeRange > 0) {
            const timePosition = (lastCandleTimeForX - firstTime) / timeRange;
            lastCandleX = chartX + candlesAreaOffset + timePosition * availableWidth;
          } else {
            // Fallback
            const lastCandleIndex = visibleCandles.length - 1;
            const totalCandlesForLastX = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
            lastCandleX = chartX + candlesAreaOffset + (lastCandleIndex / totalCandlesForLastX) * candlesAreaWidth;
          }
        } else {
          lastCandleX = chartX + candlesAreaOffset;
        }
        const triangleTipX = priceScaleX; // Ponta do triângulo (lado esquerdo do retângulo azul)
        
        // Calcular tempo restante para o candle fechar (relativo ao timeframe)
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const serverTime = validCurrentTime.getTime();
        
        // Obter o timeframe em milissegundos baseado no prop
        const timeframeMsMap: Record<Timeframe, number> = {
          '1m': 60000,
          '2m': 120000,
          '5m': 300000,
          '10m': 600000,
          '15m': 900000,
          '30m': 1800000,
          '1h': 3600000,
          '2h': 7200000,
          '4h': 14400000,
          '8h': 28800000,
          '12h': 43200000,
          '1d': 86400000,
          '1w': 604800000,
          '1M': 2592000000, // 30 dias
        };
        const timeframeMs = timeframeMsMap[timeframe] || 60000; // Default para 1m se não encontrado
        
        const lastCandle = visibleCandles[visibleCandles.length - 1];
        const candleStartTime = lastCandle.time;
        const candleEndTime = candleStartTime + timeframeMs;
        const timeRemaining = Math.max(0, candleEndTime - serverTime);
        const secondsRemaining = Math.floor(timeRemaining / 1000);
        const minutesRemaining = Math.floor(secondsRemaining / 60);
        const hoursRemaining = Math.floor(minutesRemaining / 60);
        const daysRemaining = Math.floor(hoursRemaining / 24);
        
        // Formatar timer baseado no tempo restante
        let timerText: string;
        if (daysRemaining > 0) {
          // Se tem mais de 1 dia: mostrar "XD HH:MM"
          const hours = hoursRemaining % 24;
          const minutes = minutesRemaining % 60;
          timerText = `${daysRemaining}D ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else if (hoursRemaining > 0) {
          // Se tem mais de 1 hora mas menos de 1 dia: mostrar "HH:MM"
          const minutes = minutesRemaining % 60;
          timerText = `${hoursRemaining.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else {
          // Se tem menos de 1 hora: mostrar "MM:SS"
          const secondsDisplay = secondsRemaining % 60;
          timerText = `${minutesRemaining.toString().padStart(2, '0')}:${secondsDisplay.toString().padStart(2, '0')}`;
        }
        
        // Linha dividida em duas partes: pontilhada à esquerda, reta até o círculo
        const arrowTipX = priceScaleX - 10; // Ponta da seta (apontando para a esquerda, mais para dentro do gráfico, fora da régua)
        const lineStartX = chartX + candlesAreaOffset; // Lado esquerdo do gráfico (onde começam os candles)
        
        // Preparar medidas do timer para criar espaço na linha
        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const timerMetrics = ctx.measureText(timerText);
        const timerWidth = timerMetrics.width + 25; // Largura do texto + padding aumentado (25px)
        
        // Posicionar timer baseado na posição antiga (após o candle) mas movido levemente para a esquerda
        // Posição antiga era: lastCandleX + 12, agora vamos usar uma posição intermediária
        const oldTimerX = lastCandleX + 12; // Posição antiga de referência
        const timerX = oldTimerX - (oldTimerX - arrowTipX) * 0.35; // Mover 35% em direção à ponta da seta (levemente mais à esquerda)
        const timerY = lastPriceY; // Mesma altura da linha
        
        // Parte 1: Linha pontilhada do lado esquerdo do gráfico até o círculo pulsante do último candle
        // Mudar cor da linha pontilhada baseado no hover dos botões
        let dottedLineStrokeStyle = 'rgba(255, 255, 255, 0.4)'; // Branco padrão (mais neutro)
        if (buyButtonHoverRef.current) {
          dottedLineStrokeStyle = 'rgba(34, 197, 94, 0.6)'; // Verde quando hover no botão comprar
        } else if (sellButtonHoverRef.current) {
          dottedLineStrokeStyle = 'rgba(239, 68, 68, 0.6)'; // Vermelho quando hover no botão vender
        }
        ctx.strokeStyle = dottedLineStrokeStyle;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]); // Linha pontilhada
        ctx.beginPath();
        ctx.moveTo(lineStartX, lastPriceY);
        ctx.lineTo(lastCandleX, lastPriceY); // Até o círculo pulsante do último candle
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Parte 2: Linha reta sólida do círculo pulsante até a ponta da seta (com espaço para o timer)
        // Mudar cor da linha baseado no hover dos botões
        ctx.setLineDash([]); // Linha sólida (resetar qualquer pontilhado anterior)
        let lineStrokeStyle = 'rgba(255, 255, 255, 0.7)'; // Branco padrão (mais neutro)
        if (buyButtonHoverRef.current) {
          lineStrokeStyle = 'rgba(34, 197, 94, 0.9)'; // Verde quando hover no botão comprar
        } else if (sellButtonHoverRef.current) {
          lineStrokeStyle = 'rgba(239, 68, 68, 0.9)'; // Vermelho quando hover no botão vender
        }
        ctx.strokeStyle = lineStrokeStyle;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'butt'; // Garantir que as linhas não se sobrepõem
        
        // Desenhar linha antes do timer (do círculo pulsante até o início do espaço do timer)
        ctx.beginPath();
        ctx.moveTo(lastCandleX, lastPriceY);
        ctx.lineTo(timerX - timerWidth / 2, lastPriceY);
        ctx.stroke();
        
        // Espaço vazio onde o timer fica (divisão/corte na linha)
        
        // Desenhar linha depois do timer (do final do espaço do timer até a ponta da seta)
          ctx.beginPath();
        ctx.moveTo(timerX + timerWidth / 2, lastPriceY);
        ctx.lineTo(arrowTipX, lastPriceY); // Até a ponta da seta
        ctx.stroke();
        
        // Desenhar timer sem caixa, dentro do espaço vazio da linha (cor mais discreta)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Branco com opacidade reduzida para ser mais discreto
        ctx.fillText(timerText, timerX, timerY);
        ctx.textAlign = 'left'; // Restaurar alinhamento padrão
        ctx.textBaseline = 'alphabetic'; // Restaurar baseline padrão
        
        // Desenhar sombra e seta baseado no hover dos botões
        if (buyButtonHoverRef.current && lastPriceY !== null) {
          // Sombra verde acima da linha (para compra) - cobrindo parte pontilhada e parte reta
          const shadowHeight = chartHeight * 0.3; // Altura da sombra (30% do gráfico)
          const shadowTop = Math.max(chartY, lastPriceY - shadowHeight);
          
          // Parte 1: Sombra sobre a linha pontilhada (lineStartX até lastCandleX)
          const shadowGradient1 = ctx.createLinearGradient(
            lineStartX, shadowTop,
            lineStartX, lastPriceY
          );
          shadowGradient1.addColorStop(0, 'rgba(34, 197, 94, 0)'); // Transparente no topo
          shadowGradient1.addColorStop(0.5, 'rgba(34, 197, 94, 0.15)'); // Verde translúcido no meio
          shadowGradient1.addColorStop(1, 'rgba(34, 197, 94, 0.25)'); // Verde mais opaco na linha
          ctx.fillStyle = shadowGradient1;
          ctx.fillRect(lineStartX, shadowTop, lastCandleX - lineStartX, lastPriceY - shadowTop);
          
          // Parte 2: Sombra sobre a linha reta (lastCandleX até arrowTipX)
          const shadowGradient2 = ctx.createLinearGradient(
            lastCandleX, shadowTop,
            lastCandleX, lastPriceY
          );
          shadowGradient2.addColorStop(0, 'rgba(34, 197, 94, 0)'); // Transparente no topo
          shadowGradient2.addColorStop(0.5, 'rgba(34, 197, 94, 0.15)'); // Verde translúcido no meio
          shadowGradient2.addColorStop(1, 'rgba(34, 197, 94, 0.25)'); // Verde mais opaco na linha
          ctx.fillStyle = shadowGradient2;
          ctx.fillRect(lastCandleX, shadowTop, arrowTipX - lastCandleX, lastPriceY - shadowTop);
          
          // Seta verde apontando para cima (centralizada em toda a linha)
          const arrowSize = 12;
          const arrowY = shadowTop - arrowSize / 2;
          const arrowCenterX = lineStartX + (lastCandleX - lineStartX) / 2;
          ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
          ctx.beginPath();
          ctx.moveTo(arrowCenterX, arrowY);
          ctx.lineTo(arrowCenterX - arrowSize / 2, arrowY + arrowSize);
          ctx.lineTo(arrowCenterX + arrowSize / 2, arrowY + arrowSize);
          ctx.closePath();
          ctx.fill();
        } else if (sellButtonHoverRef.current && lastPriceY !== null) {
          // Sombra vermelha abaixo da linha (para venda) - cobrindo parte pontilhada e parte reta
          const shadowHeight = chartHeight * 0.3; // Altura da sombra (30% do gráfico)
          const shadowBottom = Math.min(chartY + chartHeight, lastPriceY + shadowHeight);
          
          // Parte 1: Sombra sobre a linha pontilhada (lineStartX até lastCandleX)
          const shadowGradient1 = ctx.createLinearGradient(
            lineStartX, lastPriceY,
            lineStartX, shadowBottom
          );
          shadowGradient1.addColorStop(0, 'rgba(239, 68, 68, 0.25)'); // Vermelho mais opaco na linha
          shadowGradient1.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)'); // Vermelho translúcido no meio
          shadowGradient1.addColorStop(1, 'rgba(239, 68, 68, 0)'); // Transparente na parte inferior
          ctx.fillStyle = shadowGradient1;
          ctx.fillRect(lineStartX, lastPriceY, lastCandleX - lineStartX, shadowBottom - lastPriceY);
          
          // Parte 2: Sombra sobre a linha reta (lastCandleX até arrowTipX)
          const shadowGradient2 = ctx.createLinearGradient(
            lastCandleX, lastPriceY,
            lastCandleX, shadowBottom
          );
          shadowGradient2.addColorStop(0, 'rgba(239, 68, 68, 0.25)'); // Vermelho mais opaco na linha
          shadowGradient2.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)'); // Vermelho translúcido no meio
          shadowGradient2.addColorStop(1, 'rgba(239, 68, 68, 0)'); // Transparente na parte inferior
          ctx.fillStyle = shadowGradient2;
          ctx.fillRect(lastCandleX, lastPriceY, arrowTipX - lastCandleX, shadowBottom - lastPriceY);
          
          // Seta vermelha apontando para baixo (centralizada em toda a linha)
          const arrowSize = 12;
          const arrowY = shadowBottom + arrowSize / 2;
          const arrowCenterX = lineStartX + (lastCandleX - lineStartX) / 2;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.beginPath();
          ctx.moveTo(arrowCenterX, arrowY);
          ctx.lineTo(arrowCenterX - arrowSize / 2, arrowY - arrowSize);
          ctx.lineTo(arrowCenterX + arrowSize / 2, arrowY - arrowSize);
          ctx.closePath();
          ctx.fill();
        }
        
        // O círculo pulsante será desenhado DEPOIS do cálculo de firstTimeForCandles e lastTimeForCandles
        // para usar a mesma lógica do live candle
      }

      // Desenhar candles ou linhas/barras baseado no tipo
      // (availableWidth, candleWidth, spacing e rightMargin já foram calculados acima)
      
      // Função auxiliar para calcular posição X baseada no tempo (usando eixo de tempo)
      const getCandleXFromTime = (candleTime: number, firstTime: number, lastTime: number): number => {
        const timeRange = lastTime - firstTime;
        if (timeRange === 0) {
          // Fallback se não há range
          return chartX + candlesAreaOffset + candlesAreaWidth / 2;
        }
        const timePosition = (candleTime - firstTime) / timeRange;
        // Usar availableWidth para manter alinhamento com o eixo de tempo
        return chartX + candlesAreaOffset + timePosition * availableWidth;
      };
      
      // NOTA: firstTimeForCandles e lastTimeForCandles já foram calculados acima (logo após o live candle ser adicionado)
      // Isso garante que no primeiro frame, os valores sejam calculados corretamente antes de qualquer outro cálculo
      
      // Desenhar pequena bola verde pulsante (como uma luz que acende e apaga) na linha de preço
      // IMPORTANTE: Posicionar no CENTRO do live candle usando a mesma lógica do live candle
      // Agora que firstTimeForCandles e lastTimeForCandles estão calculados, podemos usar getCandleXFromTime
      // CRÍTICO: Usar a variável hasLiveCandle definida acima (linha 1514), que indica se o live candle foi realmente incluído
      if (lastPriceY !== null && visibleCandles.length > 0 && firstTimeForCandles > 0 && lastTimeForCandles > 0) {
        const isLastCandleCurrentForPulse = hasLiveCandle 
          ? (viewport.visibleStartIndex + visibleCandles.length - 1) >= candles.length - 1
          : (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
        let pulseCandleCenterX: number;
        
        // CORREÇÃO: Usar a flag hasLiveCandle que indica se o live candle está realmente em visibleCandles
        if (hasLiveCandle && liveCandleRef.current) {
          // CRÍTICO: Usar o MESMO tempo do live candle usado no posicionamento do candle
          // Isso mantém o círculo pulsante exatamente no centro do live candle
          const liveCenterTime = liveCandleTimeForPosition !== null
            ? liveCandleTimeForPosition
            : liveCandleRef.current.time;
          pulseCandleCenterX = getCandleXFromTime(liveCenterTime, firstTimeForCandles, lastTimeForCandles);
        } else {
          // Se não há live candle, usar posição do último candle
          const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
          pulseCandleCenterX = getCandleXFromTime(lastCandleTime, firstTimeForCandles, lastTimeForCandles);
        }
        
        // Salvar posição X do círculo pulsante na ref para uso pelos balões
        pulseCandleCenterXRef.current = pulseCandleCenterX;
        
        // Efeito pulsante como uma luz que acende e apaga (mais forte e mais fraco)
        const pulseTime = Date.now() / 500; // Velocidade do pulso
        // Intensidade varia de 0.3 a 1.0 (como uma luz que acende e apaga)
        const lightIntensity = 0.3 + (Math.sin(pulseTime) + 1) * 0.35; // Varia entre 0.3-1.0
        const pulseRadius = 6; // Raio aumentado
        const glowRadius = pulseRadius * 4; // Raio do brilho aumentado (mais transparente)
        
        // Desenhar brilho externo pulsante (halo de luz maior e mais transparente)
        const outerGlowGradient = ctx.createRadialGradient(
          pulseCandleCenterX, lastPriceY, 0,
          pulseCandleCenterX, lastPriceY, glowRadius
        );
        outerGlowGradient.addColorStop(0, `rgba(34, 197, 94, ${lightIntensity * 0.25})`); // Mais transparente
        outerGlowGradient.addColorStop(0.3, `rgba(16, 185, 129, ${lightIntensity * 0.15})`);
        outerGlowGradient.addColorStop(0.6, `rgba(5, 150, 105, ${lightIntensity * 0.08})`);
        outerGlowGradient.addColorStop(1, 'rgba(5, 150, 105, 0)');
        ctx.fillStyle = outerGlowGradient;
        ctx.beginPath();
        ctx.arc(pulseCandleCenterX, lastPriceY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Desenhar brilho médio pulsante (mais transparente)
        const midGlowGradient = ctx.createRadialGradient(
          pulseCandleCenterX, lastPriceY, 0,
          pulseCandleCenterX, lastPriceY, pulseRadius * 2.5
        );
        midGlowGradient.addColorStop(0, `rgba(34, 197, 94, ${lightIntensity * 0.5})`); // Mais transparente
        midGlowGradient.addColorStop(0.5, `rgba(16, 185, 129, ${lightIntensity * 0.25})`);
        midGlowGradient.addColorStop(1, 'rgba(5, 150, 105, 0)');
        ctx.fillStyle = midGlowGradient;
        ctx.beginPath();
        ctx.arc(pulseCandleCenterX, lastPriceY, pulseRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Desenhar a bola principal verde com gradiente radial pulsante (sem borda, mais transparente)
        const ballGradient = ctx.createRadialGradient(
          pulseCandleCenterX, lastPriceY, 0,
          pulseCandleCenterX, lastPriceY, pulseRadius
        );
        // Gradiente que pulsa como uma luz (mais intenso no centro, mais fraco nas bordas, mais transparente)
        ballGradient.addColorStop(0, `rgba(34, 197, 94, ${lightIntensity * 0.9})`); // Verde claro no centro (pulsa, mais transparente)
        ballGradient.addColorStop(0.4, `rgba(16, 185, 129, ${lightIntensity * 0.7})`); // Verde médio
        ballGradient.addColorStop(0.8, `rgba(5, 150, 105, ${lightIntensity * 0.4})`); // Verde escuro
        ballGradient.addColorStop(1, `rgba(5, 150, 105, ${lightIntensity * 0.15})`); // Quase transparente na borda
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(pulseCandleCenterX, lastPriceY, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        // Sem borda (sem stroke)
      }

      // Para gráfico de linha, desenhar a linha primeiro
      if (chartType === 'line') {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Aplicar estilo da linha
        if (lineStyle === 'dashed') {
          ctx.setLineDash([6, 4]);
        } else if (lineStyle === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([]);
        }
        
        ctx.beginPath();
        
        // Usar o mesmo divisor para manter espaçamento uniforme (incluindo Live Candle)
        const totalCandlesForLinePosition = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
        
        for (let i = 0; i < visibleCandles.length; i++) {
          const candle = visibleCandles[i];
          const candleKey = viewport.visibleStartIndex + i;
          
          let interpolatedCandle: CandleData;
          if (interpolatedCandlesRef.current.has(candleKey)) {
            const cached = interpolatedCandlesRef.current.get(candleKey)!;
            interpolatedCandle = {
              time: candle.time,
              open: smoothInterpolate(cached.open, candle.open, interpolationFactor),
              high: smoothInterpolate(cached.high, candle.high, interpolationFactor),
              low: smoothInterpolate(cached.low, candle.low, interpolationFactor),
              close: smoothInterpolate(cached.close, candle.close, interpolationFactor),
            };
          } else {
            interpolatedCandle = { ...candle };
          }
          
          // Calcular X usando o eixo de tempo
          const x = getCandleXFromTime(interpolatedCandle.time, firstTimeForCandles, lastTimeForCandles);
          const closeY = chartY + chartHeight - ((interpolatedCandle.close - actualMinPrice) / actualPriceRange) * chartHeight;
          
          if (i === 0) {
            ctx.moveTo(x, closeY);
          } else {
            ctx.lineTo(x, closeY);
          }
          
          // Atualizar cache
          interpolatedCandlesRef.current.set(candleKey, interpolatedCandle);
        }
        ctx.stroke();
        
        // Se lineWithShadow, desenhar área preenchida abaixo da linha
        if (lineWithShadow) {
          const lastX = chartX + candlesAreaOffset + ((visibleCandles.length - 1) / viewport.visibleCandleCount) * candlesAreaWidth;
          
          ctx.fillStyle = lineColor;
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(chartX, chartY + chartHeight);
          
          // Desenhar área preenchida seguindo a linha
          for (let i = 0; i < visibleCandles.length; i++) {
            const candle = visibleCandles[i];
            const candleKey = viewport.visibleStartIndex + i;
            let interpolatedCandle: CandleData;
            if (interpolatedCandlesRef.current.has(candleKey)) {
              const cached = interpolatedCandlesRef.current.get(candleKey)!;
              interpolatedCandle = {
                time: candle.time,
                open: smoothInterpolate(cached.open, candle.open, interpolationFactor),
                high: smoothInterpolate(cached.high, candle.high, interpolationFactor),
                low: smoothInterpolate(cached.low, candle.low, interpolationFactor),
                close: smoothInterpolate(cached.close, candle.close, interpolationFactor),
              };
            } else {
              interpolatedCandle = { ...candle };
            }
            
            // Calcular X usando o eixo de tempo
            const x = getCandleXFromTime(interpolatedCandle.time, firstTimeForCandles, lastTimeForCandles);
            const closeY = chartY + chartHeight - ((interpolatedCandle.close - actualMinPrice) / actualPriceRange) * chartHeight;
            ctx.lineTo(x, closeY);
          }
          ctx.lineTo(lastX, chartY + chartHeight);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      // Desenhar candles/barras/heikin-ashi
      for (let i = 0; i < visibleCandles.length; i++) {
        const candle = visibleCandles[i];
        // CRÍTICO: Para o live candle, usar uma chave especial baseada no tempo para evitar conflitos
        // O live candle não está em candles, então usar o tempo como chave única (número negativo grande)
        const isLiveCandle = hasLiveCandle && 
                            i === visibleCandles.length - 1 && 
                            liveCandleRef.current &&
                            viewport.isAtEnd &&
                            (viewport.visibleStartIndex + visibleCandles.length - 1) >= candles.length - 1;
        
        // CRÍTICO: Para o live candle, sempre usar liveCandleRef.current diretamente, não a cópia em visibleCandles
        // Isso garante que no primeiro frame, quando há um problema de timing entre useEffect e requestAnimationFrame,
        // sempre usamos os valores mais recentes de liveCandleRef.current
        const actualCandle = isLiveCandle && liveCandleRef.current ? liveCandleRef.current : candle;
        
        // Usar número negativo grande como chave especial para o live candle (baseado no tempo)
        const candleKey = isLiveCandle && liveCandleRef.current 
          ? -(Math.floor(liveCandleRef.current.time / 1000)) // Chave única negativa para o live candle
          : viewport.visibleStartIndex + i; // Chave única para candles históricos
        
        // Obter valores interpolados para animação suave e fluida
        let interpolatedCandle: CandleData;
        
        // CRÍTICO: Para o live candle recém-criado, limpar cache apenas no primeiro frame
        // Isso evita que valores do candle anterior sejam reutilizados e causem o "traço"
        let forceNoCacheForLiveCandle = false;
        if (isLiveCandle && liveCandleRef.current) {
          const liveCandleTime = liveCandleRef.current.time;
          const isNewLiveCandle = lastRenderedLiveCandleTimeRef.current === null ||
                                  lastRenderedLiveCandleTimeRef.current !== liveCandleTime;
          
          if (isNewLiveCandle) {
            // Limpar TODOS os caches relacionados ao live candle (chaves negativas)
            const keysToDelete: number[] = [];
            interpolatedCandlesRef.current.forEach((_, key) => {
              if (key < 0) {
                keysToDelete.push(key);
              }
            });
            keysToDelete.forEach(key => interpolatedCandlesRef.current.delete(key));
            
            // Forçar renderização sem cache no primeiro frame do novo live candle
            forceNoCacheForLiveCandle = true;
            lastRenderedLiveCandleTimeRef.current = liveCandleTime;
          }
        }
        
        // CRÍTICO: Para o live candle, nunca usar cache no primeiro frame após criação
        // Isso garante que o live candle seja renderizado com valores corretos desde o primeiro frame
        let shouldUseCache = interpolatedCandlesRef.current.has(candleKey) && !forceNoCacheForLiveCandle;
        if (shouldUseCache) {
          const cached = interpolatedCandlesRef.current.get(candleKey)!;
          
          // Evitar usar cache stale quando o tempo do live candle mudou
          if (isLiveCandle && cached.time !== actualCandle.time) {
            interpolatedCandlesRef.current.delete(candleKey);
            shouldUseCache = false;
          }
        }
        
        if (shouldUseCache) {
          const cached = interpolatedCandlesRef.current.get(candleKey)!;
          // Interpolar suavemente do valor cacheado para o valor atual
          const interpolatedOpen = smoothInterpolate(cached.open, actualCandle.open, interpolationFactor);
          const interpolatedHigh = smoothInterpolate(cached.high, actualCandle.high, interpolationFactor);
          const interpolatedLow = smoothInterpolate(cached.low, actualCandle.low, interpolationFactor);
          const interpolatedClose = smoothInterpolate(cached.close, actualCandle.close, interpolationFactor);
          
          // CRÍTICO: Garantir consistência após interpolação para evitar bug de cores misturadas
          // O close deve estar sempre entre low e high, e high >= low
          const consistentHigh = Math.max(interpolatedHigh, interpolatedLow, interpolatedClose);
          const consistentLow = Math.min(interpolatedHigh, interpolatedLow, interpolatedClose);
          const consistentClose = Math.max(consistentLow, Math.min(consistentHigh, interpolatedClose));
          
          interpolatedCandle = {
            time: actualCandle.time,
            open: interpolatedOpen,
            high: consistentHigh,
            low: consistentLow,
            close: consistentClose,
          };
        } else {
          // Primeira vez vendo este candle, usar valores atuais
          // CRÍTICO: Para o live candle, usar actualCandle (que é liveCandleRef.current) diretamente
          // CRÍTICO: Garantir consistência mesmo na primeira vez para evitar bug de cores misturadas
          const consistentHigh = Math.max(actualCandle.high, actualCandle.low, actualCandle.close);
          const consistentLow = Math.min(actualCandle.high, actualCandle.low, actualCandle.close);
          const consistentClose = Math.max(consistentLow, Math.min(consistentHigh, actualCandle.close));
          
          interpolatedCandle = {
            time: actualCandle.time,
            open: actualCandle.open,
            high: consistentHigh,
            low: consistentLow,
            close: consistentClose,
          };
        }
        
        // CRÍTICO: Para o live candle, só atualizar cache APÓS o primeiro frame
        // No primeiro frame, forceNoCacheForLiveCandle é true, então não devemos criar cache ainda
        // Isso garante que o live candle seja renderizado corretamente desde o primeiro frame
        // e que o cache só seja criado com valores corretos após o primeiro frame
        if (!(isLiveCandle && forceNoCacheForLiveCandle)) {
          // Atualizar cache com valores interpolados
          interpolatedCandlesRef.current.set(candleKey, interpolatedCandle);
        } else {
          // No primeiro frame do live candle, não criar cache ainda
          // O cache será criado no próximo frame quando forceNoCacheForLiveCandle for false
        }
        
        // Calcular posição X usando o EIXO DE TEMPO (mesma lógica do eixo horizontal)
        // Isso garante que os candles fiquem alinhados com os labels de tempo
        // Para o live candle, usar o tempo atual real em vez do tempo do período
        let candleTimeForPosition = interpolatedCandle.time;
        
        if (isLiveCandle) {
          // Se é o live candle, posicionar logo após o último candle histórico seguindo o padrão de espaçamento
          // Usar o tempo do período do live candle + metade do período do timeframe para centralizar
          // Isso garante que o live candle fique no lugar correto, seguindo o mesmo padrão dos outros candles
          // CRÍTICO: Usar o mesmo tempo que foi usado para calcular lastTimeForCandles
          // Isso garante sincronização perfeita desde o primeiro frame, evitando problemas de timing
          if (liveCandleTimeForPosition !== null) {
            // Usar o tempo que foi armazenado durante o cálculo de lastTimeForCandles
            // Isso garante que o cálculo de posição use exatamente o mesmo valor usado para calcular lastTimeForCandles
            candleTimeForPosition = liveCandleTimeForPosition;
          } else if (liveCandleRef.current) {
            // Fallback: se por algum motivo liveCandleTimeForPosition não foi definido
            const timeframeMsMap: Record<Timeframe, number> = {
              '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
              '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
              '4h': 14400000, '8h': 28800000, '12h': 43200000,
              '1d': 86400000, '1w': 604800000, '1M': 2592000000,
            };
            const periodMs = timeframeMsMap[timeframe] || 60000;
            candleTimeForPosition = liveCandleRef.current.time;
          }
        }
        
        const x = getCandleXFromTime(candleTimeForPosition, firstTimeForCandles, lastTimeForCandles);

        // Calcular posições Y usando valores interpolados para movimento suave
        const openY = chartY + chartHeight - ((interpolatedCandle.open - actualMinPrice) / actualPriceRange) * chartHeight;
        const closeY = chartY + chartHeight - ((interpolatedCandle.close - actualMinPrice) / actualPriceRange) * chartHeight;
        const highY = chartY + chartHeight - ((interpolatedCandle.high - actualMinPrice) / actualPriceRange) * chartHeight;
        const lowY = chartY + chartHeight - ((interpolatedCandle.low - actualMinPrice) / actualPriceRange) * chartHeight;

        const isGreen = interpolatedCandle.close >= interpolatedCandle.open;
        const color = isGreen ? candleUpColor : candleDownColor;
        const bodyColor = isGreen ? candleUpColor : candleDownColor;

        // Renderizar baseado no tipo de gráfico (pular linha, já foi desenhada acima)
        if (chartType === 'line') {
          // Linha já foi desenhada acima, apenas continuar atualizando cache
          continue;
        } else if (chartType === 'bar') {
          // Gráfico de barras (OHLC)
          const barWidth = candleWidth * 0.6;
          const barLeft = x - barWidth / 2;
          
          // Linha vertical (high-low)
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, highY);
          ctx.lineTo(x, lowY);
          ctx.stroke();
          
          // Marcadores de open e close
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          // Open (esquerda)
          ctx.beginPath();
          ctx.moveTo(x - barWidth / 2, openY);
          ctx.lineTo(x, openY);
          ctx.stroke();
          // Close (direita)
          ctx.beginPath();
          ctx.moveTo(x, closeY);
          ctx.lineTo(x + barWidth / 2, closeY);
          ctx.stroke();
        } else if (chartType === 'heikin-ashi') {
          // Heikin-Ashi - similar a candlestick mas com cores diferentes
          // Calcular valores Heikin-Ashi (simplificado)
          const haClose = (interpolatedCandle.open + interpolatedCandle.high + interpolatedCandle.low + interpolatedCandle.close) / 4;
          const haOpen = i > 0 ? (visibleCandles[i - 1].open + visibleCandles[i - 1].close) / 2 : interpolatedCandle.open;
          const haHigh = Math.max(interpolatedCandle.high, haOpen, haClose);
          const haLow = Math.min(interpolatedCandle.low, haOpen, haClose);
          
          const haOpenY = chartY + chartHeight - ((haOpen - actualMinPrice) / actualPriceRange) * chartHeight;
          const haCloseY = chartY + chartHeight - ((haClose - actualMinPrice) / actualPriceRange) * chartHeight;
          const haHighY = chartY + chartHeight - ((haHigh - actualMinPrice) / actualPriceRange) * chartHeight;
          const haLowY = chartY + chartHeight - ((haLow - actualMinPrice) / actualPriceRange) * chartHeight;
          
          const haIsGreen = haClose >= haOpen;
          const haColor = haIsGreen ? candleUpColor : candleDownColor;
          
          // Wick
          ctx.strokeStyle = haColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, haHighY);
          ctx.lineTo(x, haLowY);
          ctx.stroke();
          
          // Corpo
          const haBodyTop = Math.min(haOpenY, haCloseY);
          const haBodyHeight = Math.max(1, Math.abs(haCloseY - haOpenY));
          const haBodyLeft = x - candleWidth / 2;
          
          ctx.fillStyle = haColor;
          ctx.fillRect(haBodyLeft, haBodyTop, candleWidth, haBodyHeight);
          
          ctx.strokeStyle = haColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(haBodyLeft, haBodyTop, candleWidth, haBodyHeight);
        } else {
          // Candlestick padrão
        // Desenhar wick (linha alta-baixa) com linha mais suave
        // CRÍTICO: Sub-pixel rendering para linhas ultra-suaves
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5; // Linha fixa (sem pulso)
        ctx.lineCap = 'round'; // Pontas arredondadas para visual mais suave
        ctx.beginPath();
        // Usar valores decimais (sub-pixel) para renderização mais suave
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Desenhar corpo da vela (estático, sem pulso)
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        const bodyLeft = x - candleWidth / 2;
        
        // Corpo com cor mais vibrante
        ctx.fillStyle = bodyColor;
        // Usar sub-pixel rendering para bordas mais suaves
        ctx.fillRect(bodyLeft, bodyTop, candleWidth, bodyHeight);
        
        // Borda sutil no corpo para definição
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bodyLeft, bodyTop, candleWidth, bodyHeight);
        }
      }
      
      // Função auxiliar para desenhar trades (será chamada DEPOIS das linhas para que snapshots fiquem por cima)
      const drawTrades = () => {
        // Limpar snapshots que não serão mais renderizados
        const currentActiveTrades = activeTradesRef.current;
        const currentTradeIds = new Set((currentActiveTrades || []).map(t => t.id));
        for (const tradeId of snapshotPositionsRef.current.keys()) {
          if (!currentTradeIds.has(tradeId)) {
            snapshotPositionsRef.current.delete(tradeId);
            snapshotCloseButtonsRef.current.delete(tradeId);
          }
        }
        
        // Desenhar feedback visual de P&L para trades ativos (área sombreada entre entryPrice e visualPrice)
        // Usar ref para garantir que sempre temos a versão mais recente
        
        if (currentActiveTrades && currentActiveTrades.length > 0 && visibleCandles.length > 0) {
          const engine = candleEngineRef.current;
          const currentVisualPrice = engine.visualPrice > 0 ? engine.visualPrice : actualMaxPrice;
          
          // Filtrar trades apenas do símbolo atual
          const tradesForCurrentSymbol = currentActiveTrades.filter(t => !t.symbol || t.symbol === symbol);
          
          tradesForCurrentSymbol.forEach(trade => {
          // Verificar se o trade está no período visível ou se já expirou (para mostrar resultado)
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const currentTime = validCurrentTime.getTime();
          const isTradeActive = trade.expiration > currentTime;
          const isTradeExpired = !isTradeActive && trade.result; // Trade expirado com resultado
          
          // Se o trade expirou mas ainda não tem resultado, não mostrar (está sendo processado)
          if (!isTradeActive && !isTradeExpired) {
            return;
          }
          
          // Calcular posições Y do entryPrice e visualPrice
          const entryY = chartY + chartHeight - ((trade.entryPrice - actualMinPrice) / actualPriceRange) * chartHeight;
          const currentY = chartY + chartHeight - ((currentVisualPrice - actualMinPrice) / actualPriceRange) * chartHeight;
          
          // Determinar cor baseado no tipo de operação
          // CALL (compra): verde, PUT (venda): vermelho
          const entryLineColor = trade.type === 'call' ? '#22c55e' : '#ef4444'; // Verde para CALL, vermelho para PUT
          
          // Desenhar linha horizontal no entryPrice (linha de entrada) - tracejada fina de ponta a ponta
          // Linha mais suave (menos opaca) que a linha do preço atual
          ctx.strokeStyle = trade.type === 'call' 
            ? 'rgba(34, 197, 94, 0.6)' // Verde com 60% opacidade para CALL
            : 'rgba(239, 68, 68, 0.6)'; // Vermelho com 60% opacidade para PUT
          ctx.lineWidth = 1; // Linha fina
          ctx.setLineDash([4, 4]); // Linha tracejada
          ctx.beginPath();
          ctx.moveTo(chartX, entryY); // De uma ponta (início do gráfico)
          ctx.lineTo(chartX + chartWidth, entryY); // Até a outra ponta (fim do gráfico)
          ctx.stroke();
          ctx.setLineDash([]); // Resetar
          
          // Desenhar seta pequena na linha de entrada com círculo em volta
          // Posicionar próximo ao círculo pulsante (último candle)
          const arrowSize = 5; // Tamanho menor da seta
          const circleY = entryY;
          const circleRadius = 6; // Círculo menor
          
          // Calcular posição X próxima ao círculo pulsante
          // IMPORTANTE: Usar a posição EXATA do círculo pulsante (armazenada na ref)
          // Isso garante posicionamento fixo e sincronizado, sem recalcular
          const arrowCircleX = pulseCandleCenterXRef.current - 20;
          
          // Contorno branco externo do círculo (mais fino)
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(arrowCircleX, circleY, circleRadius + 1, 0, Math.PI * 2);
          ctx.stroke();
          
          // Desenhar círculo preenchido (cor baseada no tipo)
          ctx.fillStyle = trade.type === 'call' 
            ? '#22c55e' // Verde sólido para CALL
            : '#ef4444'; // Vermelho sólido para PUT
          ctx.beginPath();
          ctx.arc(arrowCircleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Desenhar seta branca dentro do círculo
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          
          if (trade.type === 'call') {
            // CALL: seta apontando para cima
            const arrowTipY = circleY - arrowSize / 2;
            const arrowBaseY = circleY + arrowSize / 2;
            ctx.moveTo(arrowCircleX, arrowTipY);
            ctx.lineTo(arrowCircleX - arrowSize / 2, arrowBaseY);
            ctx.lineTo(arrowCircleX + arrowSize / 2, arrowBaseY);
            ctx.closePath();
          } else {
            // PUT: seta apontando para baixo
            const arrowTipY = circleY + arrowSize / 2;
            const arrowBaseY = circleY - arrowSize / 2;
            ctx.moveTo(arrowCircleX, arrowTipY);
            ctx.lineTo(arrowCircleX - arrowSize / 2, arrowBaseY);
            ctx.lineTo(arrowCircleX + arrowSize / 2, arrowBaseY);
            ctx.closePath();
          }
          ctx.fill();
          
          // Texto do preço de entrada já foi desenhado junto com a caixa (antes da caixa do preço atual)
          // Não desenhar novamente aqui para garantir que a caixa do preço atual sempre fique por cima
          
          // Desenhar balãozinho (snapshot) surgindo do círculo pulsante
          // IMPORTANTE: Usar a posição EXATA do círculo pulsante (armazenada na ref)
          // Isso garante que o balão fique fixo e sincronizado, sem recalcular
          const lastCandleX = pulseCandleCenterXRef.current;
          
          // Calcular posição Y do preço atual (círculo pulsante)
          const lastPriceY = chartY + chartHeight - ((currentVisualPrice - actualMinPrice) / actualPriceRange) * chartHeight;
          
          // Determinar cor e texto do balão baseado no estado do trade
          let balloonText: string;
          let balloonTitle: string | null = null;
          let isBaloonGreen: boolean;
          let showCloseButton = false;
          
          if (trade.result) {
            // Trade expirado: mostrar resultado com título
            showCloseButton = true;
            balloonTitle = 'RESULTADO';
            if (trade.result === 'win') {
              isBaloonGreen = true;
              const profit = trade.profit || trade.amount * 0.9;
              balloonText = `+R$ ${profit.toFixed(2)}`;
            } else {
              isBaloonGreen = false;
              balloonText = `-R$ ${trade.amount.toFixed(2)}`;
            }
          } else {
            // Trade ativo: cor muda conforme posição
            const isAboveEntry = currentVisualPrice > trade.entryPrice;
            const isBelowEntry = currentVisualPrice < trade.entryPrice;
            const isInProfitZone = trade.type === 'call' ? isAboveEntry : isBelowEntry;
            isBaloonGreen = isInProfitZone;
            balloonText = `R$ ${trade.amount.toFixed(0)}`;
          }
          
          // Medir texto
          ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const textWidth = ctx.measureText(balloonText).width;
          const titleWidth = balloonTitle ? ctx.measureText(balloonTitle).width : 0;
          const maxWidth = Math.max(textWidth, titleWidth);
          
          // Dimensões do balão (aumentadas)
          const balloonPadding = 12;
          const pointerSize = 9;
          const pointerOffset = 14;
          const closeBtnSize = showCloseButton ? 16 : 0;
          const closeBtnMargin = showCloseButton ? 8 : 0;
          const balloonWidth = maxWidth + balloonPadding * 2 + closeBtnSize + closeBtnMargin;
          const balloonHeight = balloonTitle ? 44 : 30;
          const borderRadius = 6;
          
          // Posicionar balão - ponteiro no lado esquerdo, balão à direita do círculo
          const balloonX = lastCandleX - pointerOffset;
          
          // Calcular posição padrão (acima do preço)
          const defaultBalloonY = lastPriceY - balloonHeight - pointerSize - 5;
          // IMPORTANTE: Usar canvasWidth (não chartWidth) como limite direito
          // Porque availableWidth > chartWidth (~1.01x), os candles podem estar além da borda do chartWidth.
          // Permitir que o balão sobreponha a área da escala de preço para não ser empurrado.
          const constrainedX = Math.max(chartX + 5, Math.min(balloonX, canvasWidth - balloonWidth - 5));
          const defaultConstrainedY = Math.max(chartY + 10, defaultBalloonY);
          
          // Verificar colisão com a caixa de info/estatísticas (canto superior direito)
          // Se houver colisão, posicionar o balão ABAIXO do preço
          let balloonAbove = true;
          const activeTradesForInfoCheck = currentActiveTrades?.filter(t => !t.result) || [];
          if (activeTradesForInfoCheck.length > 0) {
            const isSmallChk = chartWidth < 500;
            const isMediumChk = chartWidth < 800;
            const ibPad = isSmallChk ? 8 : 10;
            const ibLH = isSmallChk ? 16 : 18;
            const ibW = isSmallChk ? 160 : (isMediumChk ? 185 : 200);
            const ibH = ibLH * 4 + ibPad * 2;
            const ibX = chartX + chartWidth - ibW - 10;
            const ibY = chartY + 8;
            
            // Verificar sobreposição entre balão e caixa de info (com margem)
            const margin = 8;
            if (constrainedX + balloonWidth > ibX - margin &&
                constrainedX < ibX + ibW + margin &&
                defaultConstrainedY < ibY + ibH + margin &&
                defaultConstrainedY + balloonHeight > ibY - margin) {
              balloonAbove = false;
            }
          }
          
          // Posição Y final do balão
          let constrainedY: number;
          if (balloonAbove) {
            constrainedY = defaultConstrainedY;
          } else {
            // Posicionar abaixo do preço
            const belowY = lastPriceY + pointerSize + 5;
            constrainedY = Math.min(chartY + chartHeight - balloonHeight - 10, Math.max(chartY + 10, belowY));
          }
          
          // Posição do ponteiro (muda conforme direção)
          const pointerX = constrainedX + pointerOffset;
          const pointerY = balloonAbove ? constrainedY + balloonHeight : constrainedY;
          
          // Cor do balão
          const balloonColor = isBaloonGreen ? '#22c55e' : '#ef4444';
          const balloonColorDark = isBaloonGreen ? '#16a34a' : '#dc2626';
          
          // Desenhar fundo do balão com bordas arredondadas
          ctx.fillStyle = balloonColor;
          ctx.beginPath();
          ctx.moveTo(constrainedX + borderRadius, constrainedY);
          ctx.lineTo(constrainedX + balloonWidth - borderRadius, constrainedY);
          ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY, constrainedX + balloonWidth, constrainedY + borderRadius);
          ctx.lineTo(constrainedX + balloonWidth, constrainedY + balloonHeight - borderRadius);
          ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY + balloonHeight, constrainedX + balloonWidth - borderRadius, constrainedY + balloonHeight);
          ctx.lineTo(constrainedX + borderRadius, constrainedY + balloonHeight);
          ctx.quadraticCurveTo(constrainedX, constrainedY + balloonHeight, constrainedX, constrainedY + balloonHeight - borderRadius);
          ctx.lineTo(constrainedX, constrainedY + borderRadius);
          ctx.quadraticCurveTo(constrainedX, constrainedY, constrainedX + borderRadius, constrainedY);
          ctx.closePath();
          ctx.fill();
          
          // Desenhar setinha/ponteiro
          ctx.beginPath();
          if (balloonAbove) {
            // Ponteiro embaixo apontando para baixo (padrão)
            ctx.moveTo(pointerX - pointerSize / 2, pointerY);
            ctx.lineTo(pointerX, pointerY + pointerSize);
            ctx.lineTo(pointerX + pointerSize / 2, pointerY);
          } else {
            // Ponteiro em cima apontando para cima (flipped)
            ctx.moveTo(pointerX - pointerSize / 2, pointerY);
            ctx.lineTo(pointerX, pointerY - pointerSize);
            ctx.lineTo(pointerX + pointerSize / 2, pointerY);
          }
          ctx.closePath();
          ctx.fill();
          
          // Borda do balão com ponteiro integrado
          ctx.strokeStyle = balloonColorDark;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (balloonAbove) {
            // Ponteiro integrado na borda inferior
            ctx.moveTo(constrainedX + borderRadius, constrainedY);
            ctx.lineTo(constrainedX + balloonWidth - borderRadius, constrainedY);
            ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY, constrainedX + balloonWidth, constrainedY + borderRadius);
            ctx.lineTo(constrainedX + balloonWidth, constrainedY + balloonHeight - borderRadius);
            ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY + balloonHeight, constrainedX + balloonWidth - borderRadius, constrainedY + balloonHeight);
            ctx.lineTo(pointerX + pointerSize / 2, constrainedY + balloonHeight);
            ctx.lineTo(pointerX, pointerY + pointerSize);
            ctx.lineTo(pointerX - pointerSize / 2, constrainedY + balloonHeight);
            ctx.lineTo(constrainedX + borderRadius, constrainedY + balloonHeight);
            ctx.quadraticCurveTo(constrainedX, constrainedY + balloonHeight, constrainedX, constrainedY + balloonHeight - borderRadius);
            ctx.lineTo(constrainedX, constrainedY + borderRadius);
            ctx.quadraticCurveTo(constrainedX, constrainedY, constrainedX + borderRadius, constrainedY);
          } else {
            // Ponteiro integrado na borda superior
            ctx.moveTo(constrainedX + borderRadius, constrainedY);
            ctx.lineTo(pointerX - pointerSize / 2, constrainedY);
            ctx.lineTo(pointerX, constrainedY - pointerSize);
            ctx.lineTo(pointerX + pointerSize / 2, constrainedY);
            ctx.lineTo(constrainedX + balloonWidth - borderRadius, constrainedY);
            ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY, constrainedX + balloonWidth, constrainedY + borderRadius);
            ctx.lineTo(constrainedX + balloonWidth, constrainedY + balloonHeight - borderRadius);
            ctx.quadraticCurveTo(constrainedX + balloonWidth, constrainedY + balloonHeight, constrainedX + balloonWidth - borderRadius, constrainedY + balloonHeight);
            ctx.lineTo(constrainedX + borderRadius, constrainedY + balloonHeight);
            ctx.quadraticCurveTo(constrainedX, constrainedY + balloonHeight, constrainedX, constrainedY + balloonHeight - borderRadius);
            ctx.lineTo(constrainedX, constrainedY + borderRadius);
            ctx.quadraticCurveTo(constrainedX, constrainedY, constrainedX + borderRadius, constrainedY);
          }
          ctx.closePath();
          ctx.stroke();
          
          // Armazenar posição do snapshot para desabilitar pan e detectar cliques
          const totalBalloonHeight = balloonHeight + pointerSize;
          snapshotPositionsRef.current.set(trade.id, {
            x: constrainedX,
            y: balloonAbove ? constrainedY : constrainedY - pointerSize,
            width: balloonWidth,
            height: totalBalloonHeight,
            tradeId: trade.id
          });
          
          // Botão de fechar (apenas quando o trade tem resultado - expirado)
          if (showCloseButton) {
            const btnSize = 20; // Botão maior para facilitar clique
            const closeButtonX = constrainedX + balloonWidth - btnSize - 5;
            const closeButtonY = constrainedY + (balloonHeight - btnSize) / 2;
            
            const isHovered = hoveredCloseButton === trade.id;
            
            // Círculo de fundo para o botão (sempre visível, mais destacado quando hover)
            ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.arc(closeButtonX + btnSize / 2, closeButtonY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // X do botão
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = isHovered ? 2.5 : 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const xPad = 5;
            ctx.moveTo(closeButtonX + xPad, closeButtonY + xPad);
            ctx.lineTo(closeButtonX + btnSize - xPad, closeButtonY + btnSize - xPad);
            ctx.moveTo(closeButtonX + btnSize - xPad, closeButtonY + xPad);
            ctx.lineTo(closeButtonX + xPad, closeButtonY + btnSize - xPad);
            ctx.stroke();
            
            // Armazenar posição do botão com área MUITO expandida para facilitar clique
            // Usando coordenadas do centro do botão e tamanho maior
            const hitAreaExpand = 10;
            snapshotCloseButtonsRef.current.set(trade.id, {
              x: closeButtonX - hitAreaExpand,
              y: closeButtonY - hitAreaExpand,
              size: btnSize + hitAreaExpand * 2,
              tradeId: trade.id
            });
          } else {
            snapshotCloseButtonsRef.current.delete(trade.id);
          }
          
          // Texto do balão
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          
          if (balloonTitle) {
            // Com título (resultado): título em cima, valor embaixo
            const textAreaWidth = balloonWidth - closeBtnSize - closeBtnMargin - balloonPadding;
            const textCenterX = constrainedX + balloonPadding + textAreaWidth / 2;
            
            // Título
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText(balloonTitle, textCenterX, constrainedY + 7);
            
            // Valor
            ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'bottom';
            ctx.fillText(balloonText, textCenterX, constrainedY + balloonHeight - 7);
          } else {
            // Sem título (ativo): apenas valor centralizado
            ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(balloonText, constrainedX + balloonWidth / 2, constrainedY + balloonHeight / 2);
          }
          });
        }
        
        // ====== INFORMAÇÕES DE TRADING NO CANTO SUPERIOR DIREITO ======
        // Mostrar informações consolidadas quando há trades ativos
        const activeTradesForInfo = currentActiveTrades?.filter(t => !t.result) || [];
        if (activeTradesForInfo.length > 0) {
          // Calcular totais
          const totalInvestment = activeTradesForInfo.reduce((sum, t) => sum + t.amount, 0);
          const currentPrice = currentVisualPrice ?? 0;
          const expectedProfit = activeTradesForInfo.reduce((sum, t) => {
            const payout = t.amount * 0.9; // 90% payout
            const isAbove = currentPrice > t.entryPrice;
            const isBelow = currentPrice < t.entryPrice;
            const isWinning = t.type === 'call' ? isAbove : isBelow;
            return sum + (isWinning ? payout : -t.amount);
          }, 0);
          
          // Calcular tempo até expiração
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const serverTimeForInfo = validCurrentTime.getTime();
          const nearestExpiration = Math.min(...activeTradesForInfo.map(t => t.expiration));
          const timeToExpiration = Math.max(0, nearestExpiration - serverTimeForInfo);
          const expirationMinutes = Math.floor(timeToExpiration / 60000);
          const expirationSeconds = Math.floor((timeToExpiration % 60000) / 1000);
          const expirationTimeStr = `${expirationMinutes.toString().padStart(2, '0')}:${expirationSeconds.toString().padStart(2, '0')}`;
          
          // Dimensões responsivas baseadas no tamanho do gráfico
          const isSmallChart = chartWidth < 500;
          const isMediumChart = chartWidth < 800;
          
          const infoBoxPadding = isSmallChart ? 8 : 10;
          const lineHeight = isSmallChart ? 16 : 18;
          const fontSize = isSmallChart ? 9 : 10;
          const valueFontSize = isSmallChart ? 11 : 12;
          const timeFontSize = isSmallChart ? 12 : 14;
          const infoBoxWidth = isSmallChart ? 160 : (isMediumChart ? 185 : 200);
          const infoBoxHeight = lineHeight * 4 + infoBoxPadding * 2;
          const infoBoxX = chartX + chartWidth - infoBoxWidth - 10;
          const infoBoxY = chartY + 8;
          
          // Fundo semi-transparente com bordas arredondadas
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          const ibRadius = 4;
          ctx.moveTo(infoBoxX + ibRadius, infoBoxY);
          ctx.lineTo(infoBoxX + infoBoxWidth - ibRadius, infoBoxY);
          ctx.quadraticCurveTo(infoBoxX + infoBoxWidth, infoBoxY, infoBoxX + infoBoxWidth, infoBoxY + ibRadius);
          ctx.lineTo(infoBoxX + infoBoxWidth, infoBoxY + infoBoxHeight - ibRadius);
          ctx.quadraticCurveTo(infoBoxX + infoBoxWidth, infoBoxY + infoBoxHeight, infoBoxX + infoBoxWidth - ibRadius, infoBoxY + infoBoxHeight);
          ctx.lineTo(infoBoxX + ibRadius, infoBoxY + infoBoxHeight);
          ctx.quadraticCurveTo(infoBoxX, infoBoxY + infoBoxHeight, infoBoxX, infoBoxY + infoBoxHeight - ibRadius);
          ctx.lineTo(infoBoxX, infoBoxY + ibRadius);
          ctx.quadraticCurveTo(infoBoxX, infoBoxY, infoBoxX + ibRadius, infoBoxY);
          ctx.closePath();
          ctx.fill();
          
          // Borda sutil
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          let currentInfoY = infoBoxY + infoBoxPadding;
          
          // Linha 1: Ícone de relógio + tempo de expiração
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          
          // Desenhar ícone de relógio simplificado
          const clockX = infoBoxX + infoBoxPadding;
          const clockY = currentInfoY + lineHeight / 2;
          const clockRadius = isSmallChart ? 5 : 6;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(clockX + clockRadius, clockY, clockRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(clockX + clockRadius, clockY);
          ctx.lineTo(clockX + clockRadius, clockY - 3);
          ctx.moveTo(clockX + clockRadius, clockY);
          ctx.lineTo(clockX + clockRadius + 2, clockY);
          ctx.stroke();
          
          // Texto do tempo
          ctx.font = `bold ${timeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(expirationTimeStr, clockX + clockRadius * 2 + 6, clockY);
          currentInfoY += lineHeight;
          
          // Linha 2: INVESTIMENTO TOTAL
          ctx.textAlign = 'left';
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          const investLabel = isSmallChart ? 'INVESTIMENTO' : 'INVESTIMENTO TOTAL';
          ctx.fillText(investLabel, infoBoxX + infoBoxPadding, currentInfoY + lineHeight / 2);
          ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'right';
          ctx.fillText(`R$ ${totalInvestment.toFixed(2)}`, infoBoxX + infoBoxWidth - infoBoxPadding, currentInfoY + lineHeight / 2);
          currentInfoY += lineHeight;
          
          // Linha 3: LUCRO ESPERADO
          ctx.textAlign = 'left';
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText('LUCRO ESPERADO', infoBoxX + infoBoxPadding, currentInfoY + lineHeight / 2);
          ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const expectedProfitColor = expectedProfit >= 0 ? '#22c55e' : '#ef4444';
          ctx.fillStyle = expectedProfitColor;
          ctx.textAlign = 'right';
          const profitSign = expectedProfit >= 0 ? '+' : '';
          ctx.fillText(`${profitSign}R$ ${expectedProfit.toFixed(2)}`, infoBoxX + infoBoxWidth - infoBoxPadding, currentInfoY + lineHeight / 2);
          currentInfoY += lineHeight;
          
          // Linha 4: LUCRO APÓS VENDA (L/P)
          ctx.textAlign = 'left';
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          const sellLabel = isSmallChart ? 'APÓS VENDA' : 'LUCRO APÓS VENDA';
          ctx.fillText(sellLabel, infoBoxX + infoBoxPadding, currentInfoY + lineHeight / 2);
          // Calcular lucro após venda (com desconto de venda antecipada, ex: 30%)
          const sellPenalty = 0.30;
          const profitAfterSell = expectedProfit * (1 - sellPenalty);
          ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const afterSellColor = profitAfterSell >= 0 ? '#22c55e' : '#ef4444';
          ctx.fillStyle = afterSellColor;
          ctx.textAlign = 'right';
          const afterSellSign = profitAfterSell >= 0 ? '+' : '';
          ctx.fillText(`${afterSellSign}R$ ${profitAfterSell.toFixed(2)}`, infoBoxX + infoBoxWidth - infoBoxPadding, currentInfoY + lineHeight / 2);
        }
      };
      
      // NÃO desenhar trades aqui ainda - serão desenhados DEPOIS das linhas
      // drawTrades(); // Chamado mais abaixo
      
      // O círculo pulsante agora é desenhado dentro do bloco da linha horizontal branca (linhas 2188-2230)
      // para garantir que use exatamente o mesmo lastCandleX


      // Desenhar indicadores técnicos
      const activeIndicators = indicatorEngineRef.current.getActiveIndicators();
      const visualPrice = candles.length > 0 ? candles[candles.length - 1].close : (visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].close : 0);
      
      // Renderizar indicadores overlay (SMA, EMA, Bollinger) sobre os candles
      activeIndicators.forEach(indicatorId => {
        const config = indicatorEngineRef.current.getConfig(indicatorId);
        if (!config) return;
        
        const values = indicatorEngineRef.current.getValues(indicatorId);
        if (values.length === 0) return;
        
        // Obter último valor (incluindo visualPrice)
        const currentValue = indicatorValuesRef.current.get(indicatorId);
        if (currentValue === undefined) return;
        
        const color = config.color || '#3b82f6';
        const lineWidth = config.lineWidth || 1.0; // Linha mais fina por padrão
        const style = config.style || 'solid';
        
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(style === 'dashed' ? [6, 4] : style === 'dotted' ? [2, 3] : []);
        
        if (config.type === 'sma' || config.type === 'ema') {
          // Desenhar linha de média móvel
          ctx.beginPath();
          let firstPoint = true;
          
          for (let i = 0; i < visibleCandles.length; i++) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            // Obter valor do indicador para este candle
            let value: number;
            if (candleIndex === candles.length - 1) {
              // Último candle: usar valor atual (com visualPrice)
              value = currentValue;
            } else if (candleIndex < values.length) {
              value = values[candleIndex];
            } else {
              continue; // Não há valor para este candle
            }
            
            const y = chartY + chartHeight - ((value - actualMinPrice) / actualPriceRange) * chartHeight;
            
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          
          ctx.stroke();
        } else if (config.type === 'bollinger') {
          // Desenhar Bandas de Bollinger usando valores históricos
          const bandsValues = values as Array<{ middle: number; upper: number; lower: number }>;
          const currentBands = currentValue as { middle: number; upper: number; lower: number };
          
          if (bandsValues.length === 0 && !currentBands) return;
          
          // Preencher área entre as bandas (nuvem)
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.1;
          ctx.beginPath();
          let firstPoint = true;
          for (let i = 0; i < visibleCandles.length; i++) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            let bands: { upper: number; lower: number; middle: number };
            if (candleIndex === candles.length - 1) {
              bands = currentBands;
            } else if (candleIndex < bandsValues.length) {
              bands = bandsValues[candleIndex];
            } else {
              continue;
            }
            
            const upperY = chartY + chartHeight - ((bands.upper - actualMinPrice) / actualPriceRange) * chartHeight;
            
            if (firstPoint) {
              ctx.moveTo(x, upperY);
              firstPoint = false;
            } else {
              ctx.lineTo(x, upperY);
            }
          }
          // Voltar pela banda inferior
          for (let i = visibleCandles.length - 1; i >= 0; i--) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            let bands: { upper: number; lower: number; middle: number };
            if (candleIndex === candles.length - 1) {
              bands = currentBands;
            } else if (candleIndex < bandsValues.length) {
              bands = bandsValues[candleIndex];
            } else {
              continue;
            }
            
            const lowerY = chartY + chartHeight - ((bands.lower - actualMinPrice) / actualPriceRange) * chartHeight;
            ctx.lineTo(x, lowerY);
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1.0;
          
          // Desenhar banda superior
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          firstPoint = true;
          for (let i = 0; i < visibleCandles.length; i++) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            let bands: { upper: number; lower: number; middle: number };
            if (candleIndex === candles.length - 1) {
              bands = currentBands;
            } else if (candleIndex < bandsValues.length) {
              bands = bandsValues[candleIndex];
            } else {
              continue;
            }
            
            const y = chartY + chartHeight - ((bands.upper - actualMinPrice) / actualPriceRange) * chartHeight;
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          
          // Desenhar banda inferior
          ctx.beginPath();
          firstPoint = true;
          for (let i = 0; i < visibleCandles.length; i++) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            let bands: { upper: number; lower: number; middle: number };
            if (candleIndex === candles.length - 1) {
              bands = currentBands;
            } else if (candleIndex < bandsValues.length) {
              bands = bandsValues[candleIndex];
            } else {
              continue;
            }
            
            const y = chartY + chartHeight - ((bands.lower - actualMinPrice) / actualPriceRange) * chartHeight;
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          
          // Desenhar linha média
          ctx.beginPath();
          firstPoint = true;
          for (let i = 0; i < visibleCandles.length; i++) {
            const candleIndex = viewport.visibleStartIndex + i;
            const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
            
            let bands: { upper: number; lower: number; middle: number };
            if (candleIndex === candles.length - 1) {
              bands = currentBands;
            } else if (candleIndex < bandsValues.length) {
              bands = bandsValues[candleIndex];
            } else {
              continue;
            }
            
            const y = chartY + chartHeight - ((bands.middle - actualMinPrice) / actualPriceRange) * chartHeight;
            if (firstPoint) {
              ctx.moveTo(x, y);
              firstPoint = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      });
      
      // Renderizar Volume na base do gráfico (se ativo)
      const volumeIndicatorId = activeIndicators.find(id => {
        const config = indicatorEngineRef.current.getConfig(id);
        return config && config.type === 'volume';
      });
      
      if (volumeIndicatorId && hasVolume) {
        // Usar volume dos próprios candles
        const volumeValues: number[] = [];
        for (let i = 0; i < visibleCandles.length; i++) {
          const candleIndex = viewport.visibleStartIndex + i;
          const candle = candles[candleIndex];
          if (!candle) {
            volumeValues.push(0);
          } else if ((candle as any).volume !== undefined) {
            volumeValues.push((candle as any).volume);
          } else {
            // Se não há volume, usar um valor padrão baseado na amplitude do candle
            const amplitude = candle.high - candle.low;
            volumeValues.push(amplitude * 1000); // Valor simulado
          }
        }
        
        if (volumeValues.length > 0) {
          const maxVolume = Math.max(...volumeValues.filter(v => v > 0));
          if (maxVolume > 0) {
            // Posicionar abaixo da região dos horários (descer mais)
            const volumeY = chartY + chartHeight + timeLabelsHeight + 20; // Adicionar 20px para descer mais
            // Aumentar o comprimento da subjanela de volume para preencher o espaço
            const volumeHeightPx = volumeHeight * 1.2; // Aumentar 20% do comprimento (antes era 15%)
            
            // Fundo do volume com efeito 3D (gradiente)
            const volumeGradient = ctx.createLinearGradient(
              chartX, volumeY,
              chartX, volumeY + volumeHeightPx
            );
            volumeGradient.addColorStop(0, '#0f172a'); // Mais escuro no topo
            volumeGradient.addColorStop(0.5, '#111827'); // Meio
            volumeGradient.addColorStop(1, '#1e293b'); // Mais claro na base (efeito 3D)
            ctx.fillStyle = volumeGradient;
            // Aumentar largura para chegar até onde termina a régua de preços
            // A largura vai de chartX até priceScaleX + priceScaleWidth (onde termina a régua de preços)
            const volumeWidthExtended = (priceScaleX + priceScaleWidth) - chartX; // Largura até o final da régua de preços
            ctx.fillRect(chartX, volumeY, volumeWidthExtended, volumeHeightPx);
            
            // Remover linha superior (não desenhar mais)
            
            // Desenhar barras de volume
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = chartX + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              const candleWidth = (candlesAreaWidth / viewport.visibleCandleCount) * 0.8;
              
              const volumeValue = volumeValues[i] || 0;
              
              if (volumeValue > 0) {
                const barHeight = (volumeValue / maxVolume) * volumeHeightPx;
                const candle = visibleCandles[i];
                const isGreen = candle.close >= candle.open;
                
                ctx.fillStyle = isGreen ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                ctx.fillRect(x - candleWidth / 2, volumeY + volumeHeightPx - barHeight, candleWidth, barHeight);
              }
            }
          }
        }
      }
      
      // Renderizar sub-janelas para osciladores (RSI, MACD)
      // Posicionar abaixo da região dos horários e do volume (se houver)
      const volumeHeightAdjusted = hasVolume ? volumeHeight * 1.2 : 0; // Usar altura ajustada do volume (20% em vez de 15%)
      let subWindowY = chartY + chartHeight + timeLabelsHeight + 20 + volumeHeightAdjusted; // Adicionar 20px para descer mais
      oscillatorIndicators.forEach((indicatorId, index) => {
        const config = indicatorEngineRef.current.getConfig(indicatorId);
        if (!config) return;
        
        // Aumentar o comprimento da subjanela para preencher o espaço
        const subWindowHeightPx = subWindowHeight * 1.2; // Aumentar 20% do comprimento (antes era 15%)
        const subWindowRect = {
          x: chartX,
          y: subWindowY, // Já desceu 20px no cálculo anterior
          width: (priceScaleX + priceScaleWidth) - chartX, // Largura até onde termina a régua de preços
          height: subWindowHeightPx
        };
        
        // Fundo da sub-janela com efeito 3D (gradiente)
        const gradient = ctx.createLinearGradient(
          subWindowRect.x, subWindowRect.y,
          subWindowRect.x, subWindowRect.y + subWindowRect.height
        );
        gradient.addColorStop(0, '#0f172a'); // Mais escuro no topo
        gradient.addColorStop(0.5, '#111827'); // Meio
        gradient.addColorStop(1, '#1e293b'); // Mais claro na base (efeito 3D)
        ctx.fillStyle = gradient;
        ctx.fillRect(subWindowRect.x, subWindowRect.y, subWindowRect.width, subWindowRect.height);
        
        // Remover linha superior (não desenhar mais)
        
        if (config.type === 'rsi') {
          // Renderizar RSI (escala 0-100)
          const rsiValues = indicatorEngineRef.current.getValues(indicatorId);
          const currentRSI = indicatorValuesRef.current.get(indicatorId);
          
          if (rsiValues.length > 0 || currentRSI !== undefined) {
            const rsiMin = 0;
            const rsiMax = 100;
            const rsiRange = rsiMax - rsiMin;
            
            // Linhas de referência (30, 50, 70)
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 2]);
            [30, 50, 70].forEach(level => {
              const y = subWindowRect.y + subWindowRect.height - ((level - rsiMin) / rsiRange) * subWindowRect.height;
              ctx.beginPath();
              ctx.moveTo(subWindowRect.x, y);
              ctx.lineTo(subWindowRect.x + subWindowRect.width, y);
              ctx.stroke();
            });
            ctx.setLineDash([]);
            
            // Desenhar linha RSI
            const color = config.color || '#ef4444';
            ctx.strokeStyle = color;
            ctx.lineWidth = config.lineWidth || 1.5;
            ctx.beginPath();
            let firstPoint = true;
            
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = subWindowRect.x + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              
              let rsiValue: number;
              if (candleIndex === candles.length - 1) {
                rsiValue = typeof currentRSI === 'number' ? currentRSI : 50;
              } else if (candleIndex < rsiValues.length) {
                rsiValue = typeof rsiValues[candleIndex] === 'number' ? rsiValues[candleIndex] : 50;
              } else {
                continue;
              }
              
              const y = subWindowRect.y + subWindowRect.height - ((rsiValue - rsiMin) / rsiRange) * subWindowRect.height;
              
              if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            
            // Área preenchida acima/abaixo de 50
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            firstPoint = true;
            const midY = subWindowRect.y + subWindowRect.height / 2;
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = subWindowRect.x + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              
              let rsiValue: number;
              if (candleIndex === candles.length - 1) {
                rsiValue = typeof currentRSI === 'number' ? currentRSI : 50;
              } else if (candleIndex < rsiValues.length) {
                rsiValue = typeof rsiValues[candleIndex] === 'number' ? rsiValues[candleIndex] : 50;
              } else {
                continue;
              }
              
              const y = subWindowRect.y + subWindowRect.height - ((rsiValue - rsiMin) / rsiRange) * subWindowRect.height;
              
              if (firstPoint) {
                ctx.moveTo(x, midY);
                ctx.lineTo(x, y);
                firstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            // Fechar o caminho
            const lastX = subWindowRect.x + candlesAreaOffset + ((visibleCandles.length - 1) / viewport.visibleCandleCount) * candlesAreaWidth;
            ctx.lineTo(lastX, midY);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Labels no eixo Y (0, 30, 50, 70, 100) - lado direito dentro da janela
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            [0, 30, 50, 70, 100].forEach(level => {
              const y = subWindowRect.y + subWindowRect.height - ((level - rsiMin) / rsiRange) * subWindowRect.height;
              // Posicionar no lado direito dentro da janela (subWindowRect.x + subWindowRect.width - 5)
              ctx.fillText(level.toString(), subWindowRect.x + subWindowRect.width - 5, y + 3);
            });
          }
        } else if (config.type === 'macd') {
          // Renderizar MACD
          const macdData = indicatorValuesRef.current.get(indicatorId) as { macdLine: number; signalLine: number; histogram: number } | undefined;
          const macdValues = indicatorEngineRef.current.getValues(indicatorId);
          
          if (macdData) {
            // Calcular range dinâmico do MACD
            let minMACD = 0;
            let maxMACD = 0;
            
            if (macdValues.length > 0) {
              const allValues = macdValues.map((v: any) => {
                if (typeof v === 'object' && v !== null) {
                  return [v.macdLine || 0, v.signalLine || 0, (v.histogram || 0) + (v.macdLine || 0)];
                }
                return 0;
              }).flat();
              minMACD = Math.min(...allValues, macdData.macdLine, macdData.signalLine, macdData.histogram + macdData.macdLine);
              maxMACD = Math.max(...allValues, macdData.macdLine, macdData.signalLine, macdData.histogram + macdData.macdLine);
            } else {
              minMACD = Math.min(macdData.macdLine, macdData.signalLine, macdData.histogram + macdData.macdLine);
              maxMACD = Math.max(macdData.macdLine, macdData.signalLine, macdData.histogram + macdData.macdLine);
            }
            
            const macdRange = maxMACD - minMACD || 1;
            const macdPadding = macdRange * 0.1;
            const macdMin = minMACD - macdPadding;
            const macdMax = maxMACD + macdPadding;
            const macdActualRange = macdMax - macdMin;
            
            // Linha zero
            const zeroY = subWindowRect.y + subWindowRect.height - ((0 - macdMin) / macdActualRange) * subWindowRect.height;
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(subWindowRect.x, zeroY);
            ctx.lineTo(subWindowRect.x + subWindowRect.width, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Desenhar histograma
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = subWindowRect.x + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              const candleWidth = (candlesAreaWidth / viewport.visibleCandleCount) * 0.6;
              
              let histogramValue = 0;
              if (candleIndex === candles.length - 1) {
                histogramValue = macdData.histogram;
              } else if (candleIndex < macdValues.length) {
                const macdValue = macdValues[candleIndex];
                if (typeof macdValue === 'object' && macdValue !== null) {
                  histogramValue = (macdValue as any).histogram || 0;
                }
              }
              
              const histogramY = subWindowRect.y + subWindowRect.height - ((histogramValue - macdMin) / macdActualRange) * subWindowRect.height;
              const barHeight = Math.abs(histogramValue - 0) / macdActualRange * subWindowRect.height;
              
              ctx.fillStyle = histogramValue >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
              ctx.fillRect(x - candleWidth / 2, Math.min(zeroY, histogramY), candleWidth, barHeight);
            }
            
            // Desenhar linha MACD
            const macdColor = config.color || '#3b82f6';
            ctx.strokeStyle = macdColor;
            ctx.lineWidth = config.lineWidth || 1.5;
            ctx.beginPath();
            let firstPoint = true;
            
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = subWindowRect.x + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              
              let macdLineValue: number;
              if (candleIndex === candles.length - 1) {
                macdLineValue = macdData.macdLine;
              } else if (candleIndex < macdValues.length) {
                const macdValue = macdValues[candleIndex];
                if (typeof macdValue === 'object' && macdValue !== null) {
                  macdLineValue = (macdValue as any).macdLine || 0;
                } else {
                  continue;
                }
              } else {
                continue;
              }
              
              const y = subWindowRect.y + subWindowRect.height - ((macdLineValue - macdMin) / macdActualRange) * subWindowRect.height;
              
              if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            
            // Desenhar linha de sinal
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            firstPoint = true;
            
            for (let i = 0; i < visibleCandles.length; i++) {
              const candleIndex = viewport.visibleStartIndex + i;
              const x = subWindowRect.x + candlesAreaOffset + (i / viewport.visibleCandleCount) * candlesAreaWidth;
              
              let signalValue: number;
              if (candleIndex === candles.length - 1) {
                signalValue = macdData.signalLine;
              } else if (candleIndex < macdValues.length) {
                const macdValue = macdValues[candleIndex];
                if (typeof macdValue === 'object' && macdValue !== null) {
                  signalValue = (macdValue as any).signalLine || 0;
                } else {
                  continue;
                }
              } else {
                continue;
              }
              
              const y = subWindowRect.y + subWindowRect.height - ((signalValue - macdMin) / macdActualRange) * subWindowRect.height;
              
              if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
          }
        }
        
        subWindowY += subWindowHeightPx;
      });
      
      // Desenhar ferramentas gráficas
      const currentGraphicTools = graphicToolsRef.current;
      if (currentGraphicTools && currentGraphicTools.length > 0) {
        currentGraphicTools.forEach((tool) => {
          if (!tool.visible || !tool.points || tool.points.length === 0) return;
          
          const isSelected = selectedToolIdRef.current === tool.id;
          ctx.strokeStyle = tool.color;
          // Linha mais grossa quando selecionada para facilitar visualização
          ctx.lineWidth = isSelected ? 2.0 : (tool.type === 'trendline' ? 1.5 : 1.0);
          
          // Aplicar estilo da linha
          if (tool.style === 'dashed' || tool.type === 'trendline') {
            // Trendline sempre tracejada, ou usar estilo definido
            ctx.setLineDash([6, 4]);
          } else if (tool.style === 'dotted') {
            ctx.setLineDash([2, 3]);
          } else {
            ctx.setLineDash([]);
          }
          
          ctx.beginPath();
          
          if (tool.type === 'horizontal' && tool.points.length > 0) {
            // Linha horizontal - recalcular Y baseado no preço atual do viewport
            const point = tool.points[0];
            let y: number;
            if (point.price !== undefined) {
              // Usar preço para calcular Y relativo ao viewport atual
              y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
            } else {
              // Usar Y direto se não houver preço
              y = point.y;
            }
            ctx.moveTo(chartX, y);
            ctx.lineTo(chartX + chartWidth, y);
            ctx.stroke();
            
            // Desenhar indicadores visuais quando a linha horizontal estiver selecionada
            if (selectedToolIdRef.current && selectedToolIdRef.current === tool.id) {
              const centerX = (chartX + chartX + chartWidth) / 2;
              const centerY = y;
              
              // Círculo central de arraste
              ctx.fillStyle = '#3b82f6';
              ctx.beginPath();
              ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              
              // Quadrados nas extremidades para indicar que é arrastável
              const sqSize = 5;
              ctx.fillStyle = '#3b82f6';
              ctx.fillRect(chartX - sqSize, y - sqSize, sqSize * 2, sqSize * 2);
              ctx.fillRect(chartX + chartWidth - sqSize, y - sqSize, sqSize * 2, sqSize * 2);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.strokeRect(chartX - sqSize, y - sqSize, sqSize * 2, sqSize * 2);
              ctx.strokeRect(chartX + chartWidth - sqSize, y - sqSize, sqSize * 2, sqSize * 2);
            }
          } else if (tool.type === 'vertical' && tool.points.length > 0) {
            // Linha vertical - recalcular X baseado no tempo atual do viewport
            const point = tool.points[0];
            let x: number;
            if (point.time !== undefined && visibleCandles.length > 0) {
              // Encontrar o índice do candle mais próximo do tempo
              let closestIndex = 0;
              let minDiff = Math.abs(visibleCandles[0].time - point.time);
              for (let i = 1; i < visibleCandles.length; i++) {
                const diff = Math.abs(visibleCandles[i].time - point.time);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestIndex = i;
                }
              }
              x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
            } else {
              // Usar X direto se não houver tempo
              x = point.x;
            }
            ctx.moveTo(x, chartY);
            ctx.lineTo(x, chartY + chartHeight);
            ctx.stroke();
            
            // Desenhar círculo no centro se a linha vertical estiver selecionada
            if (selectedToolIdRef.current && selectedToolIdRef.current === tool.id) {
              const centerX = x;
              const centerY = (chartY + chartY + chartHeight) / 2;
              ctx.fillStyle = '#3b82f6';
              ctx.beginPath();
              ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          } else if (tool.type === 'fibonacci' && tool.points && tool.points.length >= 2) {
            // Linhas Fibonacci - desenhar múltiplas linhas horizontais com regiões coloridas
            const startPrice = tool.points[0]?.price;
            const endPrice = tool.points[1]?.price;
            
            // Verificar se ambos os pontos têm price (obrigatório para Fibonacci)
            if (startPrice === undefined || endPrice === undefined) {
              // Tentar calcular price a partir de Y se não tiver price
              if (tool.points[0]?.y !== undefined && tool.points[1]?.y !== undefined) {
                // Calcular price a partir de Y
                const startY = tool.points[0].y;
                const endY = tool.points[1].y;
                const calculatedStartPrice = actualMaxPrice - ((startY - chartY) / chartHeight) * actualPriceRange;
                const calculatedEndPrice = actualMaxPrice - ((endY - chartY) / chartHeight) * actualPriceRange;
                // Usar preços calculados
                const priceRange = Math.abs(calculatedEndPrice - calculatedStartPrice);
                const delta = calculatedEndPrice - calculatedStartPrice;
                const levels = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
                const levelLabels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];
                
                // Converter cor da ferramenta para RGB
                const hexToRgb = (hex: string) => {
                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                  return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                  } : { r: 59, g: 130, b: 246 };
                };
                
                const toolColorRgb = hexToRgb(tool.color);
                
                // Calcular Y para cada nível
                const fibLevels: Array<{ price: number; y: number; level: number; label: string; opacity: number }> = [];
                levels.forEach((ratio, idx) => {
                  const fibPrice = calculatedStartPrice + (delta * ratio);
                  const fibY = chartY + chartHeight - ((fibPrice - actualMinPrice) / actualPriceRange) * chartHeight;
                  const isImportant = ratio === 0.618 || ratio === 0.0 || ratio === 1.0;
                  const opacity = isImportant ? 0.8 : 0.4;
                  
                  fibLevels.push({
                    price: fibPrice,
                    y: fibY,
                    level: ratio,
                    label: levelLabels[idx],
                    opacity: opacity
                  });
                });
                
                // Calcular xStart e xEnd
                let xStart = chartX;
                let xEnd = chartX + chartWidth;
                if (tool.points[0]?.x !== undefined && tool.points[1]?.x !== undefined) {
                  xStart = tool.points[0].x;
                  xEnd = tool.points[1].x;
                }
                
                // Desenhar regiões coloridas entre os níveis
                for (let i = 0; i < fibLevels.length - 1; i++) {
                  const currentLevel = fibLevels[i];
                  const nextLevel = fibLevels[i + 1];
                  
                  // Desenhar região preenchida usando cor da ferramenta
                  ctx.fillStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, 0.05)`;
                  ctx.fillRect(xStart, Math.min(currentLevel.y, nextLevel.y), xEnd - xStart, Math.abs(nextLevel.y - currentLevel.y));
                }
                
                // Desenhar linhas horizontais para cada nível
                ctx.lineWidth = 1.5;
                fibLevels.forEach((level, idx) => {
                  const isImportant = level.level === 0.618 || level.level === 0.0 || level.level === 1.0;
                  const opacity = isImportant ? level.opacity : level.opacity * 0.8;
                  
                  ctx.strokeStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, ${opacity})`;
                  ctx.beginPath();
                  ctx.moveTo(xStart, level.y);
                  ctx.lineTo(xEnd, level.y);
                  ctx.stroke();
                  
                  // Desenhar label do nível
                  const labelText = `${level.label} ${level.price.toFixed(2)}`;
                  ctx.font = 'bold 12px "Fira Code", "Courier New", monospace';
                  ctx.textAlign = 'right';
                  
                  const textMetrics = ctx.measureText(labelText);
                  const textWidth = textMetrics.width;
                  const textHeight = 14;
                  const padding = 4;
                  
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                  ctx.fillRect(xEnd - textWidth - padding * 2, level.y - textHeight - padding, textWidth + padding * 2, textHeight + padding);
                  
                  ctx.fillStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, ${isImportant ? 0.95 : 0.85})`;
                  ctx.fillText(labelText, xEnd - padding, level.y - padding);
                });
                
                ctx.strokeStyle = tool.color; // Resetar cor
                return; // Sair após renderizar com preços calculados
              } else {
                return; // Não renderizar se não tiver price nem Y
              }
            }
            
            // Fibonacci: usar coordenadas de mundo (time/price) para renderização fluida
            const p1Time = tool.points[0]?.time;
            const p2Time = tool.points[1]?.time;
            
            // Calcular xStart e xEnd usando as mesmas funções de conversão dos candles
            let xStart = chartX;
            let xEnd = chartX + chartWidth;
            
            if (p1Time !== undefined && p2Time !== undefined && visibleCandles.length > 0) {
              // Encontrar índices dos candles mais próximos
              let closestIndex1 = 0;
              let closestIndex2 = 0;
              let minDiff1 = Math.abs(visibleCandles[0].time - p1Time);
              let minDiff2 = Math.abs(visibleCandles[0].time - p2Time);
              
              for (let i = 1; i < visibleCandles.length; i++) {
                const diff1 = Math.abs(visibleCandles[i].time - p1Time);
                const diff2 = Math.abs(visibleCandles[i].time - p2Time);
                if (diff1 < minDiff1) {
                  minDiff1 = diff1;
                  closestIndex1 = i;
                }
                if (diff2 < minDiff2) {
                  minDiff2 = diff2;
                  closestIndex2 = i;
                }
              }
              
              xStart = chartX + (closestIndex1 / visibleCandles.length) * chartWidth;
              xEnd = chartX + (closestIndex2 / visibleCandles.length) * chartWidth;
            } else if (tool.points[0]?.x !== undefined && tool.points[1]?.x !== undefined) {
              // Fallback: usar x direto se não tiver time
              xStart = tool.points[0].x;
              xEnd = tool.points[1].x;
            }
            
            const priceRange = Math.abs(endPrice - startPrice);
            // Níveis padrão de Fibonacci com precisão dupla
            const levels = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
            const levelLabels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];
            
            // Calcular preço para cada nível usando a fórmula: Preço_Nível = Preço_Inicial + (Delta * Ratio)
            const delta = endPrice - startPrice;
            const fibLevels: Array<{ price: number; y: number; level: number; label: string; opacity: number }> = [];
            
            levels.forEach((ratio, idx) => {
              const priceAtLevel = startPrice + (delta * ratio);
              const y = chartY + chartHeight - ((priceAtLevel - actualMinPrice) / actualPriceRange) * chartHeight;
              
              // Opacidade: 80% para 61.8% (nível importante), 40-50% para outros
              const opacity = ratio === 0.618 ? 0.8 : (ratio === 0.0 || ratio === 1.0 ? 0.6 : 0.4);
              
              fibLevels.push({
                price: priceAtLevel,
                y: y,
                level: ratio,
                label: levelLabels[idx],
                opacity: opacity
              });
            });
            
            // Converter cor da ferramenta para RGB para aplicar opacidade
            const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
              } : { r: 59, g: 130, b: 246 }; // Fallback para azul padrão
            };
            
            const toolColorRgb = hexToRgb(tool.color);
            
            // Desenhar regiões coloridas entre os níveis (preenchimento profissional)
            for (let i = 0; i < fibLevels.length - 1; i++) {
              const currentLevel = fibLevels[i];
              const nextLevel = fibLevels[i + 1];
              
              // Preenchimento usando a cor da ferramenta com baixa opacidade
              ctx.fillStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, 0.05)`;
              ctx.fillRect(xStart, Math.min(currentLevel.y, nextLevel.y), xEnd - xStart, Math.abs(nextLevel.y - currentLevel.y));
            }
            
            // Desenhar linhas horizontais para cada nível
            ctx.lineWidth = 1.5;
            fibLevels.forEach((level, idx) => {
              // Cor baseada na cor da ferramenta com opacidade variável
              const isImportant = level.level === 0.618 || level.level === 0.0 || level.level === 1.0;
              const opacity = isImportant ? level.opacity : level.opacity * 0.8; // Níveis importantes mais opacos
              
              ctx.strokeStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, ${opacity})`;
              
              ctx.beginPath();
              ctx.moveTo(xStart, level.y);
              ctx.lineTo(xEnd, level.y);
              ctx.stroke();
              
              // Desenhar label com preço e porcentagem (visualização melhorada)
              // Fundo semi-transparente para melhor legibilidade
              const labelText = `${level.label} ${level.price.toFixed(2)}`;
              ctx.font = 'bold 12px "Fira Code", "Courier New", monospace';
              ctx.textAlign = 'right';
              
              // Medir texto para criar fundo
              const textMetrics = ctx.measureText(labelText);
              const textWidth = textMetrics.width;
              const textHeight = 14;
              const padding = 4;
              
              // Desenhar fundo do label
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(xEnd - textWidth - padding * 2, level.y - textHeight - padding, textWidth + padding * 2, textHeight + padding);
              
              // Desenhar texto do label usando a cor da ferramenta
              ctx.fillStyle = `rgba(${toolColorRgb.r}, ${toolColorRgb.g}, ${toolColorRgb.b}, ${isImportant ? 0.95 : 0.85})`;
              ctx.fillText(labelText, xEnd - padding, level.y - padding);
            });
            
            ctx.strokeStyle = tool.color; // Resetar cor
          } else if ((tool.type === 'line' || tool.type === 'trendline') && tool.points.length >= 2) {
            // Linha ou trendline - recalcular coordenadas baseadas em preço/tempo
            
            // Calcular coordenadas para ambos os pontos
            const calculatedPoints: Array<{ x: number; y: number; valid: boolean }> = [];
            
            for (let idx = 0; idx < tool.points.length; idx++) {
              const point = tool.points[idx];
              let x: number | null = null;
              let y: number | null = null;
              let valid = true;
              
              // Priorizar usar x/y direto se disponível (mais confiável para renderização imediata)
              if (point.x !== undefined && point.y !== undefined) {
                // Usar coordenadas diretas (mais confiável)
                x = point.x;
                y = point.y;
              } else if (point.time !== undefined && point.price !== undefined && visibleCandles.length > 0) {
                // Recalcular X baseado no tempo
                let closestIndex = 0;
                let minDiff = Math.abs(visibleCandles[0].time - point.time);
                for (let i = 1; i < visibleCandles.length; i++) {
                  const diff = Math.abs(visibleCandles[i].time - point.time);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                  }
                }
                x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                
                // Recalcular Y baseado no preço
                y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
              } else if (point.time !== undefined && visibleCandles.length > 0) {
                // Apenas tempo disponível
                let closestIndex = 0;
                let minDiff = Math.abs(visibleCandles[0].time - point.time);
                for (let i = 1; i < visibleCandles.length; i++) {
                  const diff = Math.abs(visibleCandles[i].time - point.time);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                  }
                }
                x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                y = point.y !== undefined ? point.y : (chartY + chartHeight / 2); // Fallback para centro se não tiver Y
              } else if (point.price !== undefined) {
                // Apenas preço disponível
                y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
                x = point.x !== undefined ? point.x : (chartX + chartWidth / 2); // Fallback para centro se não tiver X
              } else {
                valid = false;
              }
              
              if (x !== null && y !== null && valid) {
                calculatedPoints.push({ x, y, valid: true });
              } else {
                calculatedPoints.push({ x: x || 0, y: y || 0, valid: false });
              }
            }
            
            // Desenhar linha conectando os pontos válidos
            if (calculatedPoints.length >= 2 && calculatedPoints[0].valid && calculatedPoints[1].valid) {
              const p1 = calculatedPoints[0];
              const p2 = calculatedPoints[1];
              
              // Desenhar linha diretamente (o canvas vai clipar automaticamente se necessário)
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
            
            // Desenhar círculo no centro se a ferramenta estiver selecionada
            if (selectedToolIdRef.current && selectedToolIdRef.current === tool.id && calculatedPoints.length >= 2 && calculatedPoints[0].valid && calculatedPoints[1].valid) {
              const p1 = calculatedPoints[0];
              const p2 = calculatedPoints[1];
              const centerX = (p1.x + p2.x) / 2;
              const centerY = (p1.y + p2.y) / 2;
              
              // Verificar se o centro está dentro do viewport
              if (centerX >= chartX && centerX <= chartX + chartWidth && centerY >= chartY && centerY <= chartY + chartHeight) {
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
            }
          }
          
          ctx.setLineDash([]); // Resetar estilo
        });
      }
      
      // Desenhar ferramenta sendo desenhada no momento
      if (toolDrawingRef.current.isDrawing && toolDrawingRef.current.startPoint && viewport.mouseX >= chartX && viewport.mouseX <= chartX + chartWidth &&
          viewport.mouseY >= chartY && viewport.mouseY <= chartY + chartHeight) {
        const toolType = toolDrawingRef.current.toolType;
        const start = toolDrawingRef.current.startPoint;
        const currentX = viewport.mouseX;
        const currentY = viewport.mouseY;
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); // Linha tracejada durante o desenho
        
        ctx.beginPath();
        
        if (toolType === 'horizontal-line') {
          ctx.moveTo(chartX, currentY);
          ctx.lineTo(chartX + chartWidth, currentY);
        } else if (toolType === 'vertical-line') {
          ctx.moveTo(currentX, chartY);
          ctx.lineTo(currentX, chartY + chartHeight);
        } else if (toolType === 'line' || toolType === 'trendline' || toolType === 'fibonacci') {
          // Preview para linha, trendline e fibonacci - linha diagonal do ponto inicial ao mouse
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(currentX, currentY);
          
          // Para trendline, usar estilo tracejado no preview
          if (toolType === 'trendline') {
            ctx.setLineDash([6, 4]); // Tracejado mais visível
          }
        } else {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(currentX, currentY);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // PRIMEIRO: Desenhar linha de expiração e linha de chegada (ANTES dos snapshots para que snapshots fiquem por cima)
      // Lógica Simplificada: Timer de 1 minuto que move as linhas quando chega a zero
      const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
      const serverTime = validCurrentTime.getTime(); // Tempo do servidor (ou cliente sincronizado)
      
      // Verificar se há operação ativa (para congelar linhas)
      // IMPORTANTE: usar serverTime (tempo sincronizado) em vez de Date.now() (tempo do sistema local)
      // CRÍTICO: Usar activeTradesRef.current para garantir valor atualizado no loop de animação (closure)
      const currentActiveTrades = activeTradesRef.current;
      const hasActiveTrade = currentActiveTrades && currentActiveTrades.length > 0 && currentActiveTrades.some(t => !t.result && t.expiration > serverTime);
      
      // Calcular quando o último candle fecha (baseado no timeframe)
      const timeframeMsMap: Record<Timeframe, number> = {
        '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
        '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
        '4h': 14400000, '8h': 28800000, '12h': 43200000,
        '1d': 86400000, '1w': 604800000, '1M': 2592000000,
      };
      const periodMs = timeframeMsMap[timeframe] || 60000;
      
      // Calcular tempo de fechamento do último candle visível (incluindo live candle se existir)
      let lastCandleCloseTime = serverTime;
      if (visibleCandles.length > 0) {
        const lastCandle = visibleCandles[visibleCandles.length - 1];
        lastCandleCloseTime = lastCandle.time + periodMs;
      }
      // Se há live candle e está visível, usar seu tempo de fechamento
      if (liveCandleRef.current && viewport.isAtEnd) {
        const liveCandleCloseTime = liveCandleRef.current.time + periodMs;
        if (liveCandleCloseTime > lastCandleCloseTime) {
          lastCandleCloseTime = liveCandleCloseTime;
        }
      }
      
      // Offset para posicionar a linha branca (expiração) 30 segundos ANTES da linha vermelha (chegada)
      const deadlineOffset = 30; // 30 segundos
      
      // 1. Determinar targetExpiration (linha de chegada - vermelha)
      // CRÍTICO: Usar expirationTimeRef.current para garantir valor atualizado no loop de animação
      const currentExpirationTime = expirationTimeRef.current;
      let targetExpiration: number;
      if (hasActiveTrade) {
        // Se há operação ativa, usar o tempo de expiração do trade (congelar linhas)
        // IMPORTANTE: usar serverTime em vez de Date.now()
        const activeTrade = currentActiveTrades.find(t => !t.result && t.expiration > serverTime);
        targetExpiration = activeTrade ? activeTrade.expiration : (currentExpirationTime?.getTime() || Math.ceil(serverTime / 60000) * 60000);
      } else if (currentExpirationTime && currentExpirationTime instanceof Date) {
        // Usar o tempo escolhido pelo usuário na caixa de expiração
        targetExpiration = currentExpirationTime.getTime();
      } else {
        // Fallback: próximo minuto cheio
        targetExpiration = Math.ceil(serverTime / 60000) * 60000;
      }
      
      // 2. Calcular deadline (linha de expiração branca) = 30 segundos ANTES da linha de chegada (vermelha)
      // A linha branca fica 30 segundos ANTES da linha vermelha
      let targetDeadline = targetExpiration - (deadlineOffset * 1000);
      
      // Se expirationTime mudou manualmente, forçar atualização imediata das linhas
      if (expirationTimeChangedRef.current) {
        timelineEngineRef.current.visualDeadlineX = null;
        viewportRef.current.visualFinishLineX = 0;
        timelineEngineRef.current.shouldMoveImmediately = true;
      }
      
      // 3. Calcular timer: contagem regressiva de 1 minuto (60 segundos)
      // O timer mostra o tempo restante até a linha branca (targetDeadline)
      // Timer sempre mostra de 0 a 60 segundos
      let timeLeft = Math.max(0, Math.ceil((targetDeadline - serverTime) / 1000));
      
      // Limitar timer a máximo de 60 segundos (1 minuto)
      timeLeft = Math.min(timeLeft, 60);
      
      // Se timer chegou a zero e não há operação ativa, mover ambas as linhas automaticamente
      // O timer zera quando a linha branca é alcançada
      if (timeLeft === 0 && !hasActiveTrade) {
        // Sempre avançar para o próximo minuto quando o timer zera
        // Calcular próximo minuto cheio a partir do tempo atual
        const nextMinuteBase = Math.ceil(serverTime / 60000) * 60000;
        // Garantir que o novo targetExpiration está pelo menos 30s no futuro
        let newTargetExpiration = nextMinuteBase;
        while (newTargetExpiration - serverTime <= deadlineOffset * 1000) {
          newTargetExpiration += 60000;
        }
        targetExpiration = newTargetExpiration;
        targetDeadline = targetExpiration - (deadlineOffset * 1000);
        
        // Recalcular timer para o novo ciclo
        timeLeft = Math.max(0, Math.min(60, Math.ceil((targetDeadline - serverTime) / 1000)));
        
        // Notificar componente pai sobre a mudança de expirationTime
        if (onExpirationTimeChange) {
          onExpirationTimeChange(new Date(targetExpiration));
        }
        
        // Resetar posições visuais para forçar movimento imediato de AMBAS as linhas
        timelineEngineRef.current.visualDeadlineX = null;
        viewportRef.current.visualFinishLineX = 0;
        timelineEngineRef.current.shouldMoveImmediately = true;
      }
      
      // Garantir que a linha branca está sempre ANTES da vermelha (validação final)
      if (targetDeadline >= targetExpiration) {
        targetDeadline = targetExpiration - (deadlineOffset * 1000);
      }
      
      // Atualizar timeline engine
      timelineEngineRef.current.currentExpiration = targetExpiration;
      timelineEngineRef.current.currentDeadline = targetDeadline;
      
      // 3. Calcular posição X das linhas usando o EIXO DE TEMPO (mesma lógica do eixo horizontal)
      // Isso garante que as linhas fiquem alinhadas com os labels de tempo
      let expirationX: number = 0;
      let finishLineX: number = 0;
      
      // Usar a mesma lógica do eixo de tempo para calcular posições
      if (visibleCandles.length > 0) {
        const firstTime = visibleCandles[0].time;
        // Calcular lastTime da mesma forma que o eixo de tempo
        let lastTime: number;
        const isLastCandleCurrent = (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
        const hasLiveCandle = liveCandleRef.current && viewport.isAtEnd;
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const currentTimeValue = validCurrentTime.getTime();
        
        if (hasLiveCandle && isLastCandleCurrent) {
          lastTime = currentTimeValue;
        } else {
          const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
          lastTime = Math.max(lastCandleTime, currentTimeValue);
        }
        
        // Estender o lastTime para o futuro (MESMA LÓGICA DO EIXO DE TEMPO)
        // Reduzir extensão do futuro quando há zoom in extremo (< 10 candles) para evitar sobreposição
        // CRÍTICO: Usar periodMs para calcular futureExtension proporcionalmente ao timeframe
        const timeframeMsMap: Record<Timeframe, number> = {
          '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
          '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
          '4h': 14400000, '8h': 28800000, '12h': 43200000,
          '1d': 86400000, '1w': 604800000, '1M': 2592000000,
        };
        const periodMs = timeframeMsMap[timeframe] || 60000;
        
        const totalCandlesForFutureLines = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
        const expirationTimeValue = currentExpirationTime && currentExpirationTime instanceof Date ? currentExpirationTime.getTime() : null;
        
        // Calcular futureExtension baseado no número de candles e no timeframe (proporcional a periodMs)
        const futureExtensionPeriods = totalCandlesForFutureLines < 5 ? 2 : (totalCandlesForFutureLines < 10 ? 5 : (totalCandlesForFutureLines < 20 ? 15 : 25));
        const futureExtension = periodMs * futureExtensionPeriods;
        
        if (expirationTimeValue && expirationTimeValue > lastTime) {
          lastTime = expirationTimeValue + futureExtension;
        } else {
          lastTime = Math.max(lastTime, currentTimeValue + futureExtension);
        }
        
        const timeRange = lastTime - firstTime;
        
        // Offset para aproximar as linhas dos candles
        // Os candles são posicionados no início do período, então subtraímos metade do período
        // para que a linha fique alinhada com o centro do candle quando o tempo coincidir
        const lineOffset = periodMs / 2; // 30 segundos para timeframe 1m
        
        // Offset para a linha vermelha ficar mais à direita, criando espaço para o candle cruzar
        const finishLineExtraOffset = periodMs / 4; // 15 segundos a menos de subtração
        
        // Função para converter timestamp para posição X - MESMA FÓRMULA do eixo de tempo e candles
        // Isso garante que as linhas fiquem na posição correta INDEPENDENTE do zoom
        const timeToPixel = (timestamp: number): number => {
          if (timeRange === 0) {
            return chartX + candlesAreaOffset + candlesAreaWidth / 2;
          }
          const timePosition = (timestamp - firstTime) / timeRange;
          // Usar availableWidth para manter alinhamento com o eixo de tempo
          return chartX + candlesAreaOffset + timePosition * availableWidth;
        };
        
        // A linha de deadline (branca) - subtrair offset para aproximar do candle
        let targetDeadlineX = timeToPixel(targetDeadline - lineOffset);
        
        // A linha de expiração (vermelha) - offset menor para ficar mais à direita
        let targetExpirationX = timeToPixel(targetExpiration - lineOffset + finishLineExtraOffset);
        
        // Validação: garantir que a linha branca está sempre à esquerda da vermelha
        if (targetDeadlineX >= targetExpirationX) {
          const timeDiff = targetExpiration - targetDeadline;
          const pixelDiff = (timeDiff / timeRange) * availableWidth;
          targetDeadlineX = targetExpirationX - Math.max(pixelDiff, 10);
        }
        
        // 4. Atualização das linhas (sem interpolação quando expirationTime é manual)
        // Inicializar visualDeadlineX se necessário
        if (timelineEngineRef.current.visualDeadlineX === null) {
          timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
        }
        
        // Atualização das linhas: se há operação ativa, congelar; caso contrário, atualizar normalmente
        const isManualExpiration = currentExpirationTime && currentExpirationTime instanceof Date;
        
        if (hasActiveTrade) {
          // Detectar quando uma operação é ABERTA (transição de false para true)
          if (!timelineEngineRef.current.wasTradeActive) {
            // Salvar TIMESTAMPS para congelar (não pixels, pois pixels mudam com zoom)
            timelineEngineRef.current.frozenTargetExpiration = targetExpiration;
            timelineEngineRef.current.frozenTargetDeadline = targetDeadline;
            timelineEngineRef.current.wasTradeActive = true;
          }
          
          // CRÍTICO: Recalcular posições em pixels a partir dos timestamps congelados
          // Isso garante que as linhas permaneçam corretas mesmo durante zoom in/out
          const frozenDeadline = timelineEngineRef.current.frozenTargetDeadline || targetDeadline;
          const frozenExpiration = timelineEngineRef.current.frozenTargetExpiration || targetExpiration;
          expirationX = timeToPixel(frozenDeadline - lineOffset);
          finishLineX = timeToPixel(frozenExpiration - lineOffset + finishLineExtraOffset);
        } else {
          // Limpar posições congeladas quando não há operação ativa
          if (timelineEngineRef.current.wasTradeActive) {
            timelineEngineRef.current.frozenDeadlineX = null;
            timelineEngineRef.current.frozenFinishLineX = null;
            timelineEngineRef.current.frozenTargetExpiration = null;
            timelineEngineRef.current.frozenTargetDeadline = null;
            timelineEngineRef.current.wasTradeActive = false;
          }
          
          if (isManualExpiration || expirationTimeChangedRef.current) {
            // Atualização imediata para mudanças manuais no expirationTime
            expirationX = targetDeadlineX;
            finishLineX = targetExpirationX;
            timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
            viewportRef.current.visualFinishLineX = targetExpirationX;
            timelineEngineRef.current.isTransitioning = false;
            
            // Resetar flag APENAS se realmente atualizou as linhas
            if (expirationTimeChangedRef.current) {
              expirationTimeChangedRef.current = false;
            }
          } else {
            // Interpolação suave para mudanças automáticas (quando timer zera)
            if (timelineEngineRef.current.visualDeadlineX === null) {
              timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
            }
            if (viewportRef.current.visualFinishLineX === null || viewportRef.current.visualFinishLineX === 0) {
              viewportRef.current.visualFinishLineX = targetExpirationX;
            }
            
            // Se deve mover imediatamente (timer zerou ou expirationTime mudou manualmente), pular interpolação
            if (timelineEngineRef.current.shouldMoveImmediately) {
              expirationX = targetDeadlineX;
              finishLineX = targetExpirationX;
              timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
              viewportRef.current.visualFinishLineX = targetExpirationX;
              timelineEngineRef.current.isTransitioning = false;
              timelineEngineRef.current.shouldMoveImmediately = false;
            } else {
              const deadlineDistance = Math.abs(targetDeadlineX - timelineEngineRef.current.visualDeadlineX);
              const finishDistance = Math.abs(targetExpirationX - viewportRef.current.visualFinishLineX);
              
              if (deadlineDistance > 50 || finishDistance > 50) {
                // Transição suave quando linhas se movem
                expirationX = timelineEngineRef.current.visualDeadlineX + (targetDeadlineX - timelineEngineRef.current.visualDeadlineX) * 0.15;
                finishLineX = viewportRef.current.visualFinishLineX + (targetExpirationX - viewportRef.current.visualFinishLineX) * 0.15;
                timelineEngineRef.current.isTransitioning = true;
              } else {
                expirationX = targetDeadlineX;
                finishLineX = targetExpirationX;
                timelineEngineRef.current.isTransitioning = false;
              }
              
              timelineEngineRef.current.visualDeadlineX = expirationX;
              viewportRef.current.visualFinishLineX = finishLineX;
            }
          }
        }
      } else {
        // CASO SEM CANDLES: Usar lógica simplificada baseada em tempo
        // Calcular posições usando estimativa baseada no tempo atual
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const currentTimeValue = validCurrentTime.getTime();
        
        // Estimar firstTime e lastTime para calcular posições
        // Assumir que o último candle visível está no tempo atual
        const estimatedFirstTime = currentTimeValue - (periodMs * (viewport.visibleCandleCount || 10));
        const estimatedLastTime = currentTimeValue;
        const estimatedTimeRange = estimatedLastTime - estimatedFirstTime;
        
        // Função para converter timestamp para posição X - consistente com o eixo de tempo
        const timeToPixelNoCandles = (timestamp: number): number => {
          if (estimatedTimeRange === 0) {
            return chartX + candlesAreaOffset + candlesAreaWidth / 2;
          }
          const timePosition = (timestamp - estimatedFirstTime) / estimatedTimeRange;
          return chartX + candlesAreaOffset + timePosition * availableWidth;
        };
        
        // Offset para aproximar as linhas dos candles
        const lineOffsetNoCandles = periodMs / 2;
        
        // Offset para a linha vermelha ficar mais à direita
        const finishLineExtraOffsetNoCandles = periodMs / 4;
        
        // Linha de deadline (branca) - subtrair offset para aproximar do candle
        let targetDeadlineX = timeToPixelNoCandles(targetDeadline - lineOffsetNoCandles);
        
        // Linha de expiração (vermelha) - offset menor para ficar mais à direita
        let targetExpirationX = timeToPixelNoCandles(targetExpiration - lineOffsetNoCandles + finishLineExtraOffsetNoCandles);
        
        // Validação: garantir que a linha branca está sempre à esquerda da vermelha
        if (targetDeadlineX >= targetExpirationX) {
          const timeDiff = targetExpiration - targetDeadline;
          const pixelDiff = (timeDiff / estimatedTimeRange) * availableWidth;
          targetDeadlineX = targetExpirationX - Math.max(pixelDiff, 10);
        }
        
        // Atualização das linhas
        const isManualExpirationNoCandles = currentExpirationTime && currentExpirationTime instanceof Date;
        
        if (hasActiveTrade) {
          // Detectar quando uma operação é ABERTA (transição de false para true)
          if (!timelineEngineRef.current.wasTradeActive) {
            // Salvar TIMESTAMPS para congelar (não pixels, pois pixels mudam com zoom)
            timelineEngineRef.current.frozenTargetExpiration = targetExpiration;
            timelineEngineRef.current.frozenTargetDeadline = targetDeadline;
            timelineEngineRef.current.wasTradeActive = true;
          }
          
          // CRÍTICO: Recalcular posições em pixels a partir dos timestamps congelados
          // Isso garante que as linhas permaneçam corretas mesmo durante zoom in/out
          const frozenDeadlineNoCandles = timelineEngineRef.current.frozenTargetDeadline || targetDeadline;
          const frozenExpirationNoCandles = timelineEngineRef.current.frozenTargetExpiration || targetExpiration;
          expirationX = timeToPixelNoCandles(frozenDeadlineNoCandles - lineOffsetNoCandles);
          finishLineX = timeToPixelNoCandles(frozenExpirationNoCandles - lineOffsetNoCandles + finishLineExtraOffsetNoCandles);
        } else {
          // Limpar posições congeladas quando não há operação ativa
          if (timelineEngineRef.current.wasTradeActive) {
            timelineEngineRef.current.frozenTargetExpiration = null;
            timelineEngineRef.current.frozenTargetDeadline = null;
            timelineEngineRef.current.wasTradeActive = false;
          }
          
          if (isManualExpirationNoCandles || expirationTimeChangedRef.current) {
            // Atualização imediata para mudanças manuais no expirationTime
            expirationX = targetDeadlineX;
            finishLineX = targetExpirationX;
            timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
            viewportRef.current.visualFinishLineX = targetExpirationX;
            timelineEngineRef.current.isTransitioning = false;
            
            if (expirationTimeChangedRef.current) {
              expirationTimeChangedRef.current = false;
            }
          } else {
            // Interpolação suave para mudanças automáticas
            if (timelineEngineRef.current.visualDeadlineX === null) {
              timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
            }
            if (viewportRef.current.visualFinishLineX === null || viewportRef.current.visualFinishLineX === 0) {
              viewportRef.current.visualFinishLineX = targetExpirationX;
            }
            
            if (timelineEngineRef.current.shouldMoveImmediately) {
              expirationX = targetDeadlineX;
              finishLineX = targetExpirationX;
              timelineEngineRef.current.visualDeadlineX = targetDeadlineX;
              viewportRef.current.visualFinishLineX = targetExpirationX;
              timelineEngineRef.current.isTransitioning = false;
              timelineEngineRef.current.shouldMoveImmediately = false;
            } else {
              const deadlineDistance = Math.abs(targetDeadlineX - (timelineEngineRef.current.visualDeadlineX || targetDeadlineX));
              const finishDistance = Math.abs(targetExpirationX - (viewportRef.current.visualFinishLineX || targetExpirationX));
              
              if (deadlineDistance > 50 || finishDistance > 50) {
                expirationX = (timelineEngineRef.current.visualDeadlineX || targetDeadlineX) + (targetDeadlineX - (timelineEngineRef.current.visualDeadlineX || targetDeadlineX)) * 0.15;
                finishLineX = (viewportRef.current.visualFinishLineX || targetExpirationX) + (targetExpirationX - (viewportRef.current.visualFinishLineX || targetExpirationX)) * 0.15;
                timelineEngineRef.current.isTransitioning = true;
              } else {
                expirationX = targetDeadlineX;
                finishLineX = targetExpirationX;
                timelineEngineRef.current.isTransitioning = false;
              }
              
              timelineEngineRef.current.visualDeadlineX = expirationX;
              viewportRef.current.visualFinishLineX = finishLineX;
            }
          }
        }
      }
      
      // Desenhar linhas - SEMPRE, independente de ter candles ou não
      // Desenhar linha de expiração (branca) - 30 segundos ANTES da linha de chegada (vermelha)
      if (expirationX >= chartX + candlesAreaOffset - 200 && expirationX <= chartX + candlesAreaOffset + candlesAreaWidth + 200) {
          
          // Desenhar linha vertical pontilhada BRANCA (revertido)
          ctx.strokeStyle = '#ffffff'; // Branco nítido
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]); // Pontilhado mais espaçado
          ctx.beginPath();
          ctx.moveTo(expirationX, chartY);
          ctx.lineTo(expirationX, chartY + chartHeight);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Calcular timer: contagem regressiva de 1 minuto (já calculado acima)
          const countdownMinutes = Math.floor(timeLeft / 60);
          const countdownSecs = timeLeft % 60;
          const countdownStr = `${countdownMinutes.toString().padStart(2, '0')}:${countdownSecs.toString().padStart(2, '0')}`;
          
          // Alerta visual: mudar cor para vermelho nos últimos 10 segundos
          const isLowTime = timeLeft <= 10;
          
          // Calcular distância entre a linha de deadline (branca) e a linha de chegada (vermelha)
          const distanceBetweenLines = Math.abs(finishLineX - expirationX);
          const showExpirationTime = distanceBetweenLines >= 70; // Mostrar horário apenas no zoom in
          
          // OCULTAR timer do deadline quando há operação ativa (pois já temos a caixa de info)
          if (!hasActiveTrade) {
            // Desenhar timer numérico acima da linha (muda de cor para vermelho se <= 10s)
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const countdownX = expirationX;
            const countdownY = chartY - 12;
            
            // Fundo arredondado para o cronômetro
            const countdownWidth = ctx.measureText(countdownStr).width;
            const countdownPadding = 6;
            const countdownHeight = 20;
            const cornerRadius = 4;
            
            // Fundo com bordas arredondadas (vermelho se <= 10s)
            ctx.fillStyle = isLowTime ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.moveTo(countdownX - countdownWidth / 2 - countdownPadding + cornerRadius, countdownY - countdownHeight / 2);
            ctx.lineTo(countdownX + countdownWidth / 2 + countdownPadding - cornerRadius, countdownY - countdownHeight / 2);
            ctx.quadraticCurveTo(countdownX + countdownWidth / 2 + countdownPadding, countdownY - countdownHeight / 2, countdownX + countdownWidth / 2 + countdownPadding, countdownY - countdownHeight / 2 + cornerRadius);
            ctx.lineTo(countdownX + countdownWidth / 2 + countdownPadding, countdownY + countdownHeight / 2 - cornerRadius);
            ctx.quadraticCurveTo(countdownX + countdownWidth / 2 + countdownPadding, countdownY + countdownHeight / 2, countdownX + countdownWidth / 2 + countdownPadding - cornerRadius, countdownY + countdownHeight / 2);
            ctx.lineTo(countdownX - countdownWidth / 2 - countdownPadding + cornerRadius, countdownY + countdownHeight / 2);
            ctx.quadraticCurveTo(countdownX - countdownWidth / 2 - countdownPadding, countdownY + countdownHeight / 2, countdownX - countdownWidth / 2 - countdownPadding, countdownY + countdownHeight / 2 - cornerRadius);
            ctx.lineTo(countdownX - countdownWidth / 2 - countdownPadding, countdownY - countdownHeight / 2 + cornerRadius);
            ctx.quadraticCurveTo(countdownX - countdownWidth / 2 - countdownPadding, countdownY - countdownHeight / 2, countdownX - countdownWidth / 2 - countdownPadding + cornerRadius, countdownY - countdownHeight / 2);
            ctx.closePath();
            ctx.fill();
            
            // Borda (branca ou vermelha)
            ctx.strokeStyle = isLowTime ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Texto do cronômetro (branco ou vermelho)
            ctx.fillStyle = isLowTime ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(countdownStr, countdownX, countdownY);
          }
          
          // Desenhar ícone de cronômetro embaixo da linha de expiração (círculo branco com ícone preto)
          const stopwatchY = chartY + chartHeight + 18;
          const stopwatchSize = 11; // Tamanho reduzido do cronômetro para caber melhor no círculo
          const circleRadius = stopwatchSize / 2 + 5; // Raio aumentado do círculo branco
          
          ctx.save();
          ctx.translate(expirationX, stopwatchY);
          
          // 1. Desenhar círculo branco de fundo
          ctx.fillStyle = '#ffffff'; // Branco sólido
          ctx.beginPath();
          ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // 2. Desenhar ícone de cronômetro PRETO dentro do círculo branco (contorno mais grosso)
          ctx.strokeStyle = '#000000'; // Preto para o ícone
          ctx.fillStyle = '#000000'; // Preto para o ícone
          ctx.lineWidth = stopwatchSize * 0.12; // Contorno mais grosso (aumentado de 0.08 para 0.12)
          ctx.lineCap = 'round';
          
          // Corpo do Relógio (círculo preto)
          ctx.beginPath();
          ctx.arc(0, 0, stopwatchSize / 2, 0, Math.PI * 2);
          ctx.stroke();
          
          // Botão Superior (retângulo no topo)
          ctx.fillRect(-stopwatchSize * 0.15, -stopwatchSize * 0.65, stopwatchSize * 0.3, stopwatchSize * 0.15);
          
          // Ponteiro Animado (Gira conforme o tempo)
          const bottomCurrentSeconds = validCurrentTime.getSeconds();
          const bottomCurrentMilliseconds = validCurrentTime.getMilliseconds();
          const bottomTotalSeconds = bottomCurrentSeconds + bottomCurrentMilliseconds / 1000;
          const bottomAngle = (bottomTotalSeconds / 60) * Math.PI * 2 - Math.PI / 2;
          
          ctx.lineWidth = stopwatchSize * 0.08;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(bottomAngle) * (stopwatchSize * 0.3), Math.sin(bottomAngle) * (stopwatchSize * 0.3));
          ctx.stroke();
          
          // Ponto Central
          ctx.beginPath();
          ctx.arc(0, 0, stopwatchSize * 0.05, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        }
        
        // Desenhar linha de chegada (vermelha sólida) - no tempo exato do fechamento
        if (finishLineX >= chartX + candlesAreaOffset - 200 && finishLineX <= chartX + candlesAreaOffset + candlesAreaWidth + 200) {
          // Linha vertical vermelha sólida
          ctx.strokeStyle = '#ef4444'; // Vermelho sólido
          ctx.lineWidth = 2;
          ctx.setLineDash([]); // Sólida
          ctx.beginPath();
          ctx.moveTo(finishLineX, chartY);
          ctx.lineTo(finishLineX, chartY + chartHeight);
          ctx.stroke();
          
          // Desenhar horário de expiração acima da linha vermelha (HH:MM) - apenas no zoom in
          const distanceBetweenLinesForTime = Math.abs(finishLineX - expirationX);
          const showExpirationTimeLabel = distanceBetweenLinesForTime >= 70;
          
          if (showExpirationTimeLabel) {
            const expirationDate = new Date(targetExpiration);
            const hours = expirationDate.getHours().toString().padStart(2, '0');
            const minutes = expirationDate.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;
            
            ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            const timeX = finishLineX;
            const timeY = chartY - 8;
            
            // Fundo vermelho arredondado para o texto do tempo
            const timeWidth = ctx.measureText(timeStr).width;
            const timePadding = 6;
            const timeHeight = 16;
            const cornerRadius = 3;
            
            ctx.fillStyle = '#ef4444'; // Vermelho sólido
            ctx.beginPath();
            ctx.moveTo(timeX - timeWidth / 2 - timePadding + cornerRadius, timeY - timeHeight);
            ctx.lineTo(timeX + timeWidth / 2 + timePadding - cornerRadius, timeY - timeHeight);
            ctx.quadraticCurveTo(timeX + timeWidth / 2 + timePadding, timeY - timeHeight, timeX + timeWidth / 2 + timePadding, timeY - timeHeight + cornerRadius);
            ctx.lineTo(timeX + timeWidth / 2 + timePadding, timeY - cornerRadius);
            ctx.quadraticCurveTo(timeX + timeWidth / 2 + timePadding, timeY, timeX + timeWidth / 2 + timePadding - cornerRadius, timeY);
            ctx.lineTo(timeX - timeWidth / 2 - timePadding + cornerRadius, timeY);
            ctx.quadraticCurveTo(timeX - timeWidth / 2 - timePadding, timeY, timeX - timeWidth / 2 - timePadding, timeY - cornerRadius);
            ctx.lineTo(timeX - timeWidth / 2 - timePadding, timeY - timeHeight + cornerRadius);
            ctx.quadraticCurveTo(timeX - timeWidth / 2 - timePadding, timeY - timeHeight, timeX - timeWidth / 2 - timePadding + cornerRadius, timeY - timeHeight);
            ctx.closePath();
            ctx.fill();
            
            // Texto do tempo em branco
            ctx.fillStyle = '#ffffff';
            ctx.fillText(timeStr, timeX, timeY - 3);
          }
          
          // Desenhar símbolo embaixo da linha vermelha
          const finishLineY = chartY + chartHeight + 18; // Mesma posição Y do stopwatch
          const iconCircleRadius = 11;
          
          if (hasActiveTrade) {
            // OPERAÇÃO ATIVA: Desenhar cronômetro circular com tempo restante até expiração
            const frozenExpiration = timelineEngineRef.current.frozenTargetExpiration || targetExpiration;
            const timeRemainingMs = Math.max(0, frozenExpiration - serverTime);
            const timeRemainingSeconds = Math.ceil(timeRemainingMs / 1000);
            const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60);
            const remainingSecondsDisplay = timeRemainingSeconds % 60;
            
            // Calcular progresso para o arco (0 a 1, onde 1 é completo)
            // Assumindo que a operação dura até 5 minutos máximo para o progresso visual
            const totalDuration = 60000; // 1 minuto de referência para o progresso
            const elapsed = totalDuration - Math.min(timeRemainingMs, totalDuration);
            const progress = elapsed / totalDuration;
            
            // Círculo de fundo (vermelho escuro)
            ctx.fillStyle = '#7f1d1d'; // Vermelho escuro
            ctx.beginPath();
            ctx.arc(finishLineX, finishLineY, iconCircleRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Arco de progresso (vermelho claro) - mostra quanto tempo já passou
            ctx.strokeStyle = '#ef4444'; // Vermelho
            ctx.lineWidth = 3;
            ctx.beginPath();
            const startAngle = -Math.PI / 2; // Começa no topo
            const endAngle = startAngle + (progress * Math.PI * 2);
            ctx.arc(finishLineX, finishLineY, iconCircleRadius - 1.5, startAngle, endAngle);
            ctx.stroke();
            
            // Texto do tempo restante (MM:SS ou SS)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let timeText: string;
            if (timeRemainingMinutes > 0) {
              timeText = `${timeRemainingMinutes}:${remainingSecondsDisplay.toString().padStart(2, '0')}`;
            } else {
              timeText = `${remainingSecondsDisplay}`;
            }
            ctx.fillText(timeText, finishLineX, finishLineY);
            
          } else {
            // SEM OPERAÇÃO ATIVA: Desenhar bandeira de chegada
            ctx.fillStyle = '#ef4444'; // Vermelho
            ctx.beginPath();
            ctx.arc(finishLineX, finishLineY, iconCircleRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Bandeira simples (apenas o shape) - centralizada e responsiva dentro do círculo
            const flagWidth = 10;
            const flagHeight = 8;
            const mastroWidth = 2;
            const totalWidth = flagWidth + mastroWidth;
            
            const flagX = finishLineX - totalWidth / 2 + mastroWidth;
            const flagY = finishLineY - flagHeight / 2;
            
            // Mastro da bandeira
            const poleX = finishLineX - totalWidth / 2;
            const poleHeight = flagHeight + 2;
            const poleTop = finishLineY - poleHeight / 2;
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.round(poleX), Math.round(poleTop));
            ctx.lineTo(Math.round(poleX), Math.round(poleTop + poleHeight));
            ctx.stroke();
            
            // Contorno ondulado da bandeira
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= 4; i++) {
              const x = flagX + (i * flagWidth / 4);
              const y = flagY + Math.sin(i * 1.2) * 0.5;
              if (i === 0) {
                ctx.moveTo(Math.round(x), Math.round(y));
              } else {
                ctx.lineTo(Math.round(x), Math.round(y));
              }
            }
            for (let i = 0; i <= 3; i++) {
              const x = flagX + flagWidth + Math.sin(i * 1.0) * 0.3;
              const y = flagY + (i * flagHeight / 3);
              ctx.lineTo(Math.round(x), Math.round(y));
            }
            for (let i = 4; i >= 0; i--) {
              const x = flagX + (i * flagWidth / 4);
              const y = flagY + flagHeight - Math.sin(i * 1.2) * 0.5;
              ctx.lineTo(Math.round(x), Math.round(y));
            }
            ctx.lineTo(Math.round(flagX), Math.round(flagY));
            ctx.closePath();
            ctx.stroke();
          }
        }
      
      // DESENHAR TRADES (SNAPSHOTS) AQUI - DEPOIS DAS LINHAS PARA QUE SNAPshots SOBREPONHAM AS LINHAS
      drawTrades();
      
      // Desenhar crosshair (linha vertical e horizontal no mouse) - apenas se não estiver desenhando
      if (!toolDrawingRef.current.isDrawing && viewport.mouseX >= chartX && viewport.mouseX <= chartX + chartWidth &&
          viewport.mouseY >= chartY && viewport.mouseY <= chartY + chartHeight) {
        // Linha vertical - sólida suave
        ctx.strokeStyle = 'rgba(107, 114, 128, 0.6)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(viewport.mouseX, chartY);
        ctx.lineTo(viewport.mouseX, chartY + chartHeight);
        ctx.stroke();
        
        // Linha horizontal - sólida suave
        ctx.beginPath();
        ctx.moveTo(chartX, viewport.mouseY);
        ctx.lineTo(chartX + chartWidth, viewport.mouseY);
        ctx.stroke();
        
        // Mostrar preço no hover na régua de preços (lado direito) com caixa arredondada
        const hoverPrice = actualMaxPrice - ((viewport.mouseY - chartY) / chartHeight) * actualPriceRange;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hoverPriceStr = formatPrice(hoverPrice, actualPriceRange);
        const priceTextWidth = ctx.measureText(hoverPriceStr).width;
        const pricePadX = 8;
        const priceBoxW = priceTextWidth + pricePadX * 2;
        const priceBoxH = 22;
        const priceBoxX = priceScaleX + 4;
        const priceBoxY = viewport.mouseY - priceBoxH / 2;
        const priceRadius = 4;
        
        ctx.fillStyle = 'rgba(31, 41, 55, 0.95)';
        ctx.beginPath();
        ctx.moveTo(priceBoxX + priceRadius, priceBoxY);
        ctx.lineTo(priceBoxX + priceBoxW - priceRadius, priceBoxY);
        ctx.quadraticCurveTo(priceBoxX + priceBoxW, priceBoxY, priceBoxX + priceBoxW, priceBoxY + priceRadius);
        ctx.lineTo(priceBoxX + priceBoxW, priceBoxY + priceBoxH - priceRadius);
        ctx.quadraticCurveTo(priceBoxX + priceBoxW, priceBoxY + priceBoxH, priceBoxX + priceBoxW - priceRadius, priceBoxY + priceBoxH);
        ctx.lineTo(priceBoxX + priceRadius, priceBoxY + priceBoxH);
        ctx.quadraticCurveTo(priceBoxX, priceBoxY + priceBoxH, priceBoxX, priceBoxY + priceBoxH - priceRadius);
        ctx.lineTo(priceBoxX, priceBoxY + priceRadius);
        ctx.quadraticCurveTo(priceBoxX, priceBoxY, priceBoxX + priceRadius, priceBoxY);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#d1d5db';
        ctx.fillText(hoverPriceStr, priceBoxX + priceBoxW / 2, viewport.mouseY);
        
        // Calcular tempo baseado no candle onde o crosshair está (centralizado)
        // Incluir Live Candle se necessário
        let allCandlesForTime = [...visibleCandles];
        if (liveCandleRef.current && viewport.isAtEnd) {
          const lastHistoricalCandle = visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1] : null;
          if (!lastHistoricalCandle || lastHistoricalCandle.time !== liveCandleRef.current.time) {
            allCandlesForTime.push({...liveCandleRef.current});
          }
        }
        
        // Calcular tempo usando o EIXO DE TEMPO (mesma lógica do eixo horizontal)
        // Isso garante que o tooltip fique alinhado com os labels de tempo
        let displayTime: number;
        
        if (visibleCandles.length > 0) {
          const firstTime = visibleCandles[0].time;
          let lastTime: number;
          const isLastCandleCurrent = (viewport.visibleStartIndex + visibleCandles.length - 1) === candles.length - 1;
          const hasLiveCandle = liveCandleRef.current && viewport.isAtEnd;
          const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
          const currentTimeValue = validCurrentTime.getTime();
          
          if (hasLiveCandle && isLastCandleCurrent) {
            lastTime = currentTimeValue;
          } else {
            const lastCandleTime = visibleCandles[visibleCandles.length - 1].time;
            lastTime = Math.max(lastCandleTime, currentTimeValue);
          }
          
          // Estender o lastTime para o futuro (MESMA LÓGICA DO EIXO DE TEMPO)
          // Reduzir extensão do futuro quando há zoom in extremo (< 10 candles) para evitar sobreposição
          // CRÍTICO: Usar periodMs para calcular futureExtension proporcionalmente ao timeframe
          const timeframeMsMap: Record<Timeframe, number> = {
            '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
            '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
            '4h': 14400000, '8h': 28800000, '12h': 43200000,
            '1d': 86400000, '1w': 604800000, '1M': 2592000000,
          };
          const periodMs = timeframeMsMap[timeframe] || 60000;
          
          const totalCandlesForFutureTooltip = hasLiveCandle ? viewport.visibleCandleCount + 1 : viewport.visibleCandleCount;
          const expirationTimeValue = expirationTime && expirationTime instanceof Date ? expirationTime.getTime() : null;
          
          // Calcular futureExtension baseado no número de candles e no timeframe (proporcional a periodMs)
          const futureExtensionPeriods = totalCandlesForFutureTooltip < 5 ? 2 : (totalCandlesForFutureTooltip < 10 ? 5 : (totalCandlesForFutureTooltip < 20 ? 15 : 25));
          const futureExtension = periodMs * futureExtensionPeriods;
          
          if (expirationTimeValue && expirationTimeValue > lastTime) {
            lastTime = expirationTimeValue + futureExtension;
          } else {
            lastTime = Math.max(lastTime, currentTimeValue + futureExtension);
          }
          
          const timeRange = lastTime - firstTime;
          
          if (timeRange > 0) {
            // Calcular tempo baseado na posição X do mouse usando o eixo de tempo
            // IMPORTANTE: Usar availableWidth (não candlesAreaWidth) para alinhar com o eixo de tempo
            const relativeX = (viewport.mouseX - chartX - candlesAreaOffset) / availableWidth;
            const mouseTime = firstTime + (relativeX * timeRange);
            
            // Verificar se está no live candle
            if (hasLiveCandle && liveCandleRef.current && mouseTime >= liveCandleRef.current.time) {
              // Para Live Candle, usar tempo atual real
              const timeframeMs: Record<Timeframe, number> = {
                '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
                '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
                '4h': 14400000, '8h': 28800000, '12h': 43200000,
                '1d': 86400000, '1w': 604800000, '1M': 2592000000,
              };
              const periodMs = timeframeMs[timeframe];
              const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
              const currentTime = validCurrentTime.getTime();
              const timeElapsed = currentTime - liveCandleRef.current.time;
              const periodProgress = Math.min(1, timeElapsed / periodMs);
              displayTime = liveCandleRef.current.time + (periodMs * periodProgress);
            } else {
              // Para outros tempos, usar o tempo calculado do mouse
              displayTime = mouseTime;
            }
          } else {
            // Fallback
            displayTime = visibleCandles[0]?.time || Date.now();
          }
        } else {
          displayTime = Date.now();
        }
        
        // Formatar data e hora no formato YYYY.MM.DD HH:MM
        const date = new Date(displayTime);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const dateTimeStr = `${year}.${month}.${day} ${hours}:${minutes}`;
        
        // Desenhar caixa de data e hora melhorada (cantos quadrados)
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Centralizar verticalmente
        const textWidth = ctx.measureText(dateTimeStr).width;
        const boxPadding = 12; // Padding aumentado para melhor visual
        const boxHeight = 28; // Altura aumentada
        
        // Posicionar a caixa centralizada na linha vertical do mouse
        const boxX = viewport.mouseX;
        const boxY = chartY + chartHeight + 18; // Posição abaixo do gráfico
        
        // Garantir que a caixa não saia dos limites do canvas horizontalmente
        const minX = chartX + (textWidth / 2 + boxPadding);
        const maxX = chartX + chartWidth - (textWidth / 2 + boxPadding);
        const constrainedBoxX = Math.max(minX, Math.min(maxX, boxX));
        
        // Verificar se a caixa está dentro dos limites do canvas verticalmente
        const maxBoxY = canvasHeight - boxHeight - 5;
        const finalBoxY = Math.min(boxY, maxBoxY);
        
        const boxRectX = constrainedBoxX - (textWidth / 2 + boxPadding);
        const boxRectY = finalBoxY;
        const boxRectWidth = textWidth + boxPadding * 2;
        const boxRectHeight = boxHeight;
        
        // Fundo da caixa com cantos arredondados e sem contorno
        ctx.fillStyle = 'rgba(31, 41, 55, 0.95)';
        const borderRadius = 4;
        ctx.beginPath();
        ctx.moveTo(boxRectX + borderRadius, boxRectY);
        ctx.lineTo(boxRectX + boxRectWidth - borderRadius, boxRectY);
        ctx.quadraticCurveTo(boxRectX + boxRectWidth, boxRectY, boxRectX + boxRectWidth, boxRectY + borderRadius);
        ctx.lineTo(boxRectX + boxRectWidth, boxRectY + boxRectHeight - borderRadius);
        ctx.quadraticCurveTo(boxRectX + boxRectWidth, boxRectY + boxRectHeight, boxRectX + boxRectWidth - borderRadius, boxRectY + boxRectHeight);
        ctx.lineTo(boxRectX + borderRadius, boxRectY + boxRectHeight);
        ctx.quadraticCurveTo(boxRectX, boxRectY + boxRectHeight, boxRectX, boxRectY + boxRectHeight - borderRadius);
        ctx.lineTo(boxRectX, boxRectY + borderRadius);
        ctx.quadraticCurveTo(boxRectX, boxRectY, boxRectX + borderRadius, boxRectY);
        ctx.closePath();
        ctx.fill();
        
        // Texto da data e hora (centralizado horizontalmente e verticalmente)
        ctx.fillStyle = '#d1d5db';
        const textCenterY = boxRectY + boxRectHeight / 2;
        ctx.fillText(dateTimeStr, constrainedBoxX, textCenterY);
      }
    };

    /**
     * Loop de animação que força re-render contínuo
     */
    const animate = () => {
      if (!canvasRef.current) {
        // Se o canvas não existe mais, parar animação
        animationFrameRef.current = null;
        return;
      }
      
      try {
        updateViewportAnimation();
        drawChart(); // drawChart já chama updateCandlePhysics internamente
      } catch (error) {
        console.error('Chart render error:', error instanceof Error ? error.message : error, error instanceof Error ? error.stack : '');
      }
      
      // CRÍTICO: Sempre agendar próximo frame para animação contínua
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Inicializar gráfico
    useEffect(() => {
      if (!canvasRef.current) return;

      // CRÍTICO: Resetar estado de carregamento quando símbolo ou timeframe mudar
      isLoadingRef.current = true;
      historicalDataLoadedRef.current = false;
      candlesRef.current = []; // Limpar candles anteriores
      
      // Resetar estado de warm-up
      isDataReadyRef.current = false;
      firstTickAfterHistoryRef.current = true;
      
      // Resetar motor de física
      const engine = candleEngineRef.current;
      engine.realPrice = 0;
      engine.visualPrice = 0;
      engine.velocity = 0;
      engine.inertia = 0;
      engine.lastTickTime = Date.now();
      engine.lastFrameTime = performance.now();
      
      // Ajustar aceleração e jitter baseado no timeframe atual
      const timeFrameSeconds = getTimeFrameInSeconds(timeframe);
      engine.acceleration = getAdjustedAcceleration(timeFrameSeconds);
      engine.jitter = getAdjustedJitter(timeFrameSeconds);
      
      displayedPriceRef.current = 0; // Resetar preço exibido
      lastProcessedTickRef.current = null; // Resetar último tick processado

      // CRÍTICO: Cancelar animação anterior se existir
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Iniciar loop de animação imediatamente (para mostrar animação de carregamento)
      animate();

      // Carregar dados históricos
      loadHistoricalData().then(() => {
        // Dados carregados, animação continuará normalmente
      });

      return () => {
        // CRÍTICO: Sempre cancelar animação no cleanup
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }, [symbol, timeframe, chartType, candleUpColor, candleDownColor, lineColor, lineStyle, lineWithShadow]);


    // Handlers de interação (zoom, pan, crosshair)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = viewportRef.current;

      // Handler de scroll (zoom) - menos agressivo e focado no último candle
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        // Zoom mais lento e suave - delta menor para movimento mais controlado
        const zoomFactor = 1.0001; // Apenas 0.01% de mudança por scroll (velocidade extremamente reduzida)
        const isZoomOut = e.deltaY > 0; // Scroll para baixo = zoom out
        const delta = isZoomOut ? zoomFactor : 1 / zoomFactor;
        
        // CRÍTICO: Permitir zoom out mesmo quando está no máximo
        // Calcular novo valor
        const calculatedCount = viewport.visibleCandleCount * delta;
        
        // CRÍTICO: Sempre permitir zoom out, mesmo quando está no máximo
        // Sem limites rígidos - apenas garantir valores válidos
        let newCandleCount: number;
        if (isZoomOut) {
          // Zoom out: sempre aumentar o número de candles
          // Se o cálculo resultar em um valor menor ou igual ao atual, forçar aumento
          if (calculatedCount <= viewport.visibleCandleCount) {
            // Forçar aumento mínimo de 2 candles ou 10%, o que for maior
            const minIncrease = Math.max(2, Math.ceil(viewport.visibleCandleCount * 0.1));
            newCandleCount = viewport.visibleCandleCount + minIncrease;
          } else {
            newCandleCount = Math.floor(calculatedCount);
          }
          // Limitar apenas ao máximo absoluto (1000), mas nunca bloquear o zoom out
          newCandleCount = Math.min(1000, newCandleCount);
          // Garantir que sempre aumentou
          if (newCandleCount <= viewport.visibleCandleCount) {
            newCandleCount = viewport.visibleCandleCount + 1;
          }
        } else {
          // Zoom in: permitir até 1 candle, sem limite superior rígido
          newCandleCount = Math.max(1, Math.floor(calculatedCount));
        }
        
        // Verificar se estava no final antes do zoom
        const wasAtEnd = viewport.isAtEnd || viewport.visibleStartIndex >= candlesRef.current.length - viewport.visibleCandleCount - 1;
        
        // Se estava no final, sempre focar no último candle após zoom
        if (wasAtEnd && candlesRef.current.length > 0) {
          viewport.visibleCandleCount = newCandleCount;
          const newMaxStartIndex = Math.max(0, candlesRef.current.length - newCandleCount);
          viewport.visibleStartIndex = newMaxStartIndex;
          viewport.isAtEnd = true;
          return;
        }
        
        // Se não estava no final, fazer zoom no ponto do mouse
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const padding = { left: 60, right: 90 };
        const chartWidth = rect.width - padding.left - padding.right;
        
        // Verificar se o mouse está sobre o gráfico
        if (mouseX >= padding.left && mouseX <= rect.width - padding.right) {
          const relativeX = (mouseX - padding.left) / chartWidth;
          
          const oldStartIndex = viewport.visibleStartIndex;
          const oldCandleCount = viewport.visibleCandleCount;
          const oldMouseIndex = oldStartIndex + relativeX * oldCandleCount;
          
          viewport.visibleCandleCount = newCandleCount;
          const newMaxStartIndex = Math.max(0, candlesRef.current.length - newCandleCount);
          
          // Manter o ponto sob o mouse fixo
          viewport.visibleStartIndex = Math.max(0, Math.min(
            newMaxStartIndex,
            Math.floor(oldMouseIndex - relativeX * newCandleCount)
          ));
          viewport.isAtEnd = viewport.visibleStartIndex >= newMaxStartIndex - 1;
        } else {
          // Se o mouse não está sobre o gráfico, apenas ajustar o zoom mantendo posição relativa
          viewport.visibleCandleCount = newCandleCount;
          const newMaxStartIndex = Math.max(0, candlesRef.current.length - newCandleCount);
          viewport.visibleStartIndex = Math.max(0, Math.min(viewport.visibleStartIndex, newMaxStartIndex));
          viewport.isAtEnd = viewport.visibleStartIndex >= newMaxStartIndex - 1;
        }
      };

      // Converter coordenadas do mouse para preço e tempo
      const getPriceFromY = (y: number, chartY: number, chartHeight: number, minPrice: number, maxPrice: number): number => {
        const relativeY = (y - chartY) / chartHeight;
        return maxPrice - (relativeY * (maxPrice - minPrice));
      };
      
      const getTimeFromX = (x: number, chartX: number, chartWidth: number, visibleCandles: CandleData[]): number | null => {
        if (visibleCandles.length === 0) return null;
        const relativeX = (x - chartX) / chartWidth;
        const candleIndex = Math.floor(relativeX * visibleCandles.length);
        if (candleIndex >= 0 && candleIndex < visibleCandles.length) {
          return visibleCandles[candleIndex].time;
        }
        return null;
      };
      
      // Handler de mouse down (iniciar pan ou desenho de ferramenta)
      const handleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return; // Apenas botão esquerdo
        
        // Verificar se o clique está em um elemento de UI (não no canvas)
        const target = e.target as HTMLElement;
        
        // Se o clique não foi diretamente no canvas, verificar se é elemento de UI
        if (target !== canvas) {
          // Verificar se é um elemento interativo ou está dentro de um elemento de UI
          const isInteractiveElement = 
            target.tagName === 'BUTTON' || 
            target.tagName === 'INPUT' || 
            target.closest('button') !== null ||
            target.closest('[data-tool-color-picker]') !== null ||
            target.closest('[data-tool-style-dropdown]') !== null ||
            target.closest('.absolute') !== null || // Elementos absolutos (menus, etc)
            target.getAttribute('data-tool-color-picker') !== null ||
            target.getAttribute('data-tool-style-dropdown') !== null;
          
          if (isInteractiveElement) {
            // Limpar qualquer estado de arraste pendente
            toolDraggingRef.current = {
              isDragging: false,
              toolId: null,
              toolType: null,
              startMouseX: 0,
              startMouseY: 0,
              startPrice: null,
              startTime: null,
              initialDeltaPrice: null,
              initialDeltaTime: null,
              originalPoints: null
            };
            return;
          }
          
          // Se não contém o canvas, também ignorar
          if (!canvas.contains(target)) {
            return;
          }
        }
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Usar layout real do gráfico (atualizado pelo drawChart a cada frame)
        const { chartX, chartY, chartWidth, chartHeight } = chartLayoutRef.current;
        
        // Se o clique está fora da área do gráfico, não processar
        if (mouseX < chartX || mouseX > chartX + chartWidth || mouseY < chartY || mouseY > chartY + chartHeight) {
          return;
        }
        
        const currentSelectedTool = selectedToolTypeRef.current;
        
        // Verificar se está dentro da área do gráfico
        if (mouseX >= chartX && mouseX <= chartX + chartWidth &&
            mouseY >= chartY && mouseY <= chartY + chartHeight) {
          
          // PRIMEIRO: Se não há ferramenta selecionada para desenhar, verificar se clicou em uma ferramenta existente
          // Isso deve vir ANTES de iniciar um novo desenho
          if (!currentSelectedTool && onToolClick && graphicToolsRef.current && graphicToolsRef.current.length > 0) {
            const visibleCandles = candlesRef.current.slice(
              viewport.visibleStartIndex,
              viewport.visibleStartIndex + viewport.visibleCandleCount
            );
            
            if (visibleCandles.length > 0) {
              const { actualMinPrice, actualMaxPrice } = chartLayoutRef.current;
              
              const clickedPrice = getPriceFromY(mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
              const clickedTime = getTimeFromX(mouseX, chartX, chartWidth, visibleCandles);
              
              // Verificar se clicou em alguma ferramenta (linha, trendline, horizontal, vertical, etc.)
              for (const tool of graphicToolsRef.current) {
                if (!tool.visible || !tool.points || tool.points.length === 0) continue;
                
                // Detectar clique em linha horizontal
                if (tool.type === 'horizontal' && tool.points.length > 0) {
                  const point = tool.points[0];
                  let y: number;
                  if (point.price !== undefined) {
                    const actualPriceRange = actualMaxPrice - actualMinPrice;
                    y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
                  } else if (point.y !== undefined) {
                    y = point.y;
                  } else {
                    continue;
                  }
                  const distance = Math.abs(mouseY - y);
                  // Área clicável muito generosa de 20 pixels para facilitar toque mobile
                  if (distance < 20 && mouseX >= chartX && mouseX <= chartX + chartWidth) {
                    // Selecionar a ferramenta
                    if (onToolClick) {
                      onToolClick(tool.id, tool.type, { x: mouseX, y: mouseY });
                    }
                    // Preparar para arraste imediatamente (selecionar + preparar drag em um único clique)
                    if (onToolMove) {
                      toolDraggingRef.current = {
                        isDragging: false,
                        toolId: tool.id,
                        toolType: tool.type,
                        startMouseX: mouseX,
                        startMouseY: mouseY,
                        startPrice: point.price || null,
                        startTime: null,
                        initialDeltaPrice: null,
                        initialDeltaTime: null,
                        originalPoints: null
                      };
                    }
                    return;
                  }
                  continue;
                }
                
                // Detectar clique em linha vertical
                if (tool.type === 'vertical' && tool.points.length > 0) {
                  const point = tool.points[0];
                  let x: number;
                  if (point.time !== undefined && visibleCandles.length > 0) {
                    let closestIndex = 0;
                    let minDiff = Math.abs(visibleCandles[0].time - point.time);
                    for (let i = 1; i < visibleCandles.length; i++) {
                      const diff = Math.abs(visibleCandles[i].time - point.time);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closestIndex = i;
                      }
                    }
                    x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                  } else if (point.x !== undefined) {
                    x = point.x;
                  } else {
                    continue; // Sem coordenadas válidas
                  }
                  const distance = Math.abs(mouseX - x);
                  // Área clicável generosa de 15 pixels
                  if (distance < 15 && mouseY >= chartY && mouseY <= chartY + chartHeight) {
                    // Selecionar a ferramenta
                    if (onToolClick) {
                      onToolClick(tool.id, tool.type, { x: mouseX, y: mouseY });
                    }
                    // Preparar para arraste imediatamente
                    if (onToolMove) {
                      toolDraggingRef.current = {
                        isDragging: false,
                        toolId: tool.id,
                        toolType: tool.type,
                        startMouseX: mouseX,
                        startMouseY: mouseY,
                        startPrice: null,
                        startTime: point.time || null,
                        initialDeltaPrice: null,
                        initialDeltaTime: null,
                        originalPoints: null
                      };
                    }
                    return;
                  }
                  continue;
                }
                
                // Detectar clique em Fibonacci (múltiplas linhas horizontais)
                if (tool.type === 'fibonacci' && tool.points.length >= 2) {
                  const p1 = tool.points[0];
                  const p2 = tool.points[1];
                  const startPrice = p1.price;
                  const endPrice = p2.price;
                  
                  if (startPrice !== undefined && endPrice !== undefined) {
                    // Calcular níveis de Fibonacci
                    const priceRange = Math.abs(endPrice - startPrice);
                    const delta = endPrice - startPrice;
                    const levels = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
                    
                    // Verificar se o clique está próximo de alguma linha horizontal do Fibonacci
                    let clickedOnFibonacci = false;
                    let minDistance = Infinity;
                    
                    levels.forEach((ratio) => {
                      const priceAtLevel = startPrice + (delta * ratio);
                      const y = chartY + chartHeight - ((priceAtLevel - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight;
                      const distance = Math.abs(mouseY - y);
                      
                      if (distance < 25 && distance < minDistance) {
                        minDistance = distance;
                        clickedOnFibonacci = true;
                      }
                    });
                    
                    // Verificar também se está dentro da área entre xStart e xEnd
                    let xStart = chartX;
                    let xEnd = chartX + chartWidth;
                    
                    if (p1.time !== undefined && p2.time !== undefined && visibleCandles.length > 0) {
                      let closestIndex1 = 0;
                      let closestIndex2 = 0;
                      let minDiff1 = Math.abs(visibleCandles[0].time - p1.time);
                      let minDiff2 = Math.abs(visibleCandles[0].time - p2.time);
                      
                      for (let i = 1; i < visibleCandles.length; i++) {
                        const diff1 = Math.abs(visibleCandles[i].time - p1.time);
                        const diff2 = Math.abs(visibleCandles[i].time - p2.time);
                        if (diff1 < minDiff1) {
                          minDiff1 = diff1;
                          closestIndex1 = i;
                        }
                        if (diff2 < minDiff2) {
                          minDiff2 = diff2;
                          closestIndex2 = i;
                        }
                      }
                      
                      xStart = chartX + (closestIndex1 / visibleCandles.length) * chartWidth;
                      xEnd = chartX + (closestIndex2 / visibleCandles.length) * chartWidth;
                    } else if (p1.x !== undefined && p2.x !== undefined) {
                      xStart = p1.x;
                      xEnd = p2.x;
                    }
                    
                    const isWithinXRange = mouseX >= Math.min(xStart, xEnd) && mouseX <= Math.max(xStart, xEnd);
                    
                    if (clickedOnFibonacci && isWithinXRange) {
                      // Sempre chamar onToolClick para selecionar a ferramenta
                      if (onToolClick) {
                        onToolClick(tool.id, tool.type, { x: mouseX, y: mouseY });
                      }
                      
                      // Preparar para arraste APENAS se a ferramenta já estiver selecionada
                      // Isso evita que o movimento seja iniciado quando apenas clica para selecionar
                      // O arraste será iniciado no mouse move se a ferramenta estiver selecionada
                      if (selectedToolIdRef.current === tool.id && onToolMove) {
                        // DELTA DRAGGING: Calcular offset inicial
                        const mousePrice = getPriceFromY(mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
                        const mouseTime = getTimeFromX(mouseX, chartX, chartWidth, visibleCandles);
                        
                        // Para Fibonacci, usar o ponto médio como referência
                        const avgPrice = (startPrice + endPrice) / 2;
                        const avgTime = p1.time !== undefined && p2.time !== undefined
                          ? (p1.time + p2.time) / 2
                          : (p1.time || p2.time || null);
                        
                        const initialDeltaPrice = mousePrice - avgPrice;
                        const initialDeltaTime = avgTime !== null ? ((mouseTime || 0) - avgTime) : 0;
                        
                        const originalPoints = tool.points.map(p => ({ price: p.price, time: p.time }));
                        
                        toolDraggingRef.current = {
                          isDragging: false,
                          toolId: tool.id,
                          toolType: tool.type,
                          startMouseX: mouseX,
                          startMouseY: mouseY,
                          startPrice: mousePrice,
                          startTime: mouseTime || 0,
                          initialDeltaPrice: initialDeltaPrice,
                          initialDeltaTime: initialDeltaTime,
                          originalPoints: originalPoints
                        };
                      }
                      return; // Não fazer pan quando clicou no Fibonacci
                    }
                  }
                  continue; // Se não clicou no Fibonacci, continuar para outras ferramentas
                }
                
                // Para outras ferramentas (linha, trendline), precisa de 2 pontos
                if (tool.points.length < 2) continue;
                
                // Calcular distância do ponto de clique até a linha
                const p1 = tool.points[0];
                const p2 = tool.points[1];
                
                // Recalcular coordenadas dos pontos
                let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
                
                if (p1.time !== undefined && p2.time !== undefined && visibleCandles.length > 0) {
                  let closestIndex1 = 0, closestIndex2 = 0;
                  let minDiff1 = Math.abs(visibleCandles[0].time - p1.time);
                  let minDiff2 = Math.abs(visibleCandles[0].time - p2.time);
                  for (let i = 1; i < visibleCandles.length; i++) {
                    const diff1 = Math.abs(visibleCandles[i].time - p1.time);
                    const diff2 = Math.abs(visibleCandles[i].time - p2.time);
                    if (diff1 < minDiff1) {
                      minDiff1 = diff1;
                      closestIndex1 = i;
                    }
                    if (diff2 < minDiff2) {
                      minDiff2 = diff2;
                      closestIndex2 = i;
                    }
                  }
                  x1 = chartX + (closestIndex1 / visibleCandles.length) * chartWidth;
                  x2 = chartX + (closestIndex2 / visibleCandles.length) * chartWidth;
                }
                
                if (p1.price !== undefined && p2.price !== undefined) {
                  y1 = chartY + chartHeight - ((p1.price - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight;
                  y2 = chartY + chartHeight - ((p2.price - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight;
                }
                
                // Calcular distância do ponto até a linha
                const A = mouseX - x1;
                const B = mouseY - y1;
                const C = x2 - x1;
                const D = y2 - y1;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                let param = -1;
                if (lenSq !== 0) param = dot / lenSq;
                
                let xx, yy;
                if (param < 0) {
                  xx = x1;
                  yy = y1;
                } else if (param > 1) {
                  xx = x2;
                  yy = y2;
                } else {
                  xx = x1 + param * C;
                  yy = y1 + param * D;
                }
                
                const dx = mouseX - xx;
                const dy = mouseY - yy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Aumentar área clicável para 25 pixels (incluindo os quadrados de 6px)
                if (distance < 25) {
                  // Sempre chamar onToolClick para selecionar a ferramenta
                  if (onToolClick) {
                    onToolClick(tool.id, tool.type, { x: mouseX, y: mouseY });
                  }
                  // Se a ferramenta já está selecionada, preparar para arraste (será iniciado no mouse move)
                  if (selectedToolIdRef.current === tool.id && onToolMove) {
                    const { actualMinPrice, actualMaxPrice } = chartLayoutRef.current;
                    const mousePrice = getPriceFromY(mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
                    const mouseTime = getTimeFromX(mouseX, chartX, chartWidth, visibleCandles);
                    
                    // Para linha/trendline, calcular delta baseado no ponto médio
                    const avgPrice = p1.price !== undefined && p2.price !== undefined 
                      ? (p1.price + p2.price) / 2 
                      : (p1.price || p2.price || null);
                    const avgTime = p1.time !== undefined && p2.time !== undefined
                      ? (p1.time + p2.time) / 2
                      : (p1.time || p2.time || null);
                    
                    // Calcular delta inicial (offset entre mouse e ponto médio da ferramenta)
                    const initialDeltaPrice = avgPrice !== null ? (mousePrice - avgPrice) : 0;
                    const initialDeltaTime = avgTime !== null ? ((mouseTime || 0) - avgTime) : 0;
                    
                    // Salvar pontos originais para referência
                    const originalPoints = tool.points.map(p => ({ price: p.price, time: p.time }));
                    
                    toolDraggingRef.current = {
                      isDragging: false, // Ainda não está arrastando, apenas preparado
                      toolId: tool.id,
                      toolType: tool.type,
                      startMouseX: mouseX,
                      startMouseY: mouseY,
                      startPrice: mousePrice,
                      startTime: mouseTime || 0,
                      initialDeltaPrice: initialDeltaPrice,
                      initialDeltaTime: initialDeltaTime,
                      originalPoints: originalPoints
                    };
                  }
                  return; // Não fazer pan quando clicou em uma ferramenta
                }
              }
            }
          }
          
          // SEGUNDO: Se há uma ferramenta selecionada, iniciar ou continuar desenho
          if (currentSelectedTool) {
            const visibleCandles = candlesRef.current.slice(
              viewport.visibleStartIndex,
              viewport.visibleStartIndex + viewport.visibleCandleCount
            );
            
            if (visibleCandles.length > 0) {
              const { actualMinPrice, actualMaxPrice } = chartLayoutRef.current;
              
              const price = getPriceFromY(mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
              const time = getTimeFromX(mouseX, chartX, chartWidth, visibleCandles);
              
              // PRIMEIRO: Verificar se já está desenhando e precisa adicionar segundo ponto
              // Esta verificação deve vir ANTES de iniciar novo desenho
              const isMultiPointTool = currentSelectedTool === 'line' || currentSelectedTool === 'trendline' || currentSelectedTool === 'fibonacci';
              const isCurrentlyDrawing = toolDrawingRef.current.isDrawing;
              const isSameTool = toolDrawingRef.current.toolType === currentSelectedTool;
              const hasOnePoint = toolDrawingRef.current.points.length === 1;
              
              if (isCurrentlyDrawing && isSameTool && isMultiPointTool && hasOnePoint) {
                // Segundo clique - adicionar ponto 2 diretamente
                const secondPoint = { 
                  x: mouseX, 
                  y: mouseY, 
                  price: price !== undefined ? price : (toolDrawingRef.current.points[0]?.price), 
                  time: time !== undefined ? time : (toolDrawingRef.current.points[0]?.time) 
                };
                
                // Garantir que price e time estejam definidos
                if (secondPoint.price === undefined) {
                  const { actualMinPrice: aMin, actualMaxPrice: aMax } = chartLayoutRef.current;
                  secondPoint.price = aMax - ((mouseY - chartY) / chartHeight) * (aMax - aMin);
                }
                
                if (secondPoint.time === undefined && visibleCandles.length > 0) {
                  const candleIndex = Math.max(0, Math.min(visibleCandles.length - 1, Math.floor(((mouseX - chartX) / chartWidth) * visibleCandles.length)));
                  secondPoint.time = visibleCandles[candleIndex]?.time || Date.now();
                }
                
                // Adicionar segundo ponto
                toolDrawingRef.current.points.push(secondPoint);
                // Não completar aqui - aguardar mouseUp para completar
                // IMPORTANTE: Não resetar estado, apenas adicionar o ponto
                return;
              }
              
              // Primeiro clique - iniciar desenho (só se não estiver desenhando ou for ferramenta diferente)
              if (!isCurrentlyDrawing || !isSameTool) {
                toolDrawingRef.current.isDrawing = true;
                toolDrawingRef.current.toolType = currentSelectedTool;
                toolDrawingRef.current.startPoint = { x: mouseX, y: mouseY, price, time: time || undefined };
                toolDrawingRef.current.points = [{ x: mouseX, y: mouseY, price, time: time || undefined }];
                
                if (onToolDrawing) {
                  onToolDrawing(toolDrawingRef.current.points);
                }
                
                // Para linhas horizontais e verticais, completar imediatamente no primeiro clique
                if (currentSelectedTool === 'horizontal-line' || currentSelectedTool === 'vertical-line') {
                  // Aguardar um frame para garantir que o estado foi atualizado
                  setTimeout(() => {
                    handleMouseUp();
                  }, 10);
                }
                // Para linha e trendline, aguardar segundo clique (não completar imediatamente)
              }
              
              return; // Não fazer pan quando desenhando
            }
          }
        }
        
        // Verificar se o mouse está sobre um snapshot antes de iniciar pan
        // IMPORTANTE: NÃO multiplicar por scale porque as coordenadas do snapshot/botão
        // são armazenadas em coordenadas "lógicas" (antes da escala DPR)
        const canvasRect = canvas.getBoundingClientRect();
        const snapshotMouseX = e.clientX - canvasRect.left;
        const snapshotMouseY = e.clientY - canvasRect.top;
        
        // Verificar se está sobre algum snapshot OU sobre algum botão de fechar
        let isOverAnySnapshot = false;
        for (const [tradeId, snapshot] of snapshotPositionsRef.current.entries()) {
          if (snapshotMouseX >= snapshot.x && snapshotMouseX <= snapshot.x + snapshot.width &&
              snapshotMouseY >= snapshot.y && snapshotMouseY <= snapshot.y + snapshot.height) {
            isOverAnySnapshot = true;
            break;
          }
        }
        
        // Verificar também se está sobre algum botão de fechar
        if (!isOverAnySnapshot) {
          for (const [tradeId, button] of snapshotCloseButtonsRef.current.entries()) {
            if (snapshotMouseX >= button.x && snapshotMouseX <= button.x + button.size &&
                snapshotMouseY >= button.y && snapshotMouseY <= button.y + button.size) {
              isOverAnySnapshot = true;
              break;
            }
          }
        }
        
        // Se não está desenhando e não está sobre snapshot/botão, fazer pan normal
        if (!isOverAnySnapshot) {
          viewportRef.current.isDragging = true;
          viewportRef.current.dragStartX = e.clientX;
          viewportRef.current.dragStartIndex = viewportRef.current.visibleStartIndex;
        } else {
          // Garantir que o pan não seja iniciado se estiver sobre snapshot
          viewportRef.current.isDragging = false;
        }
      };

      // Handler de mouse move (pan, crosshair e desenho de ferramenta)
      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        let rawMouseX = e.clientX - rect.left;
        viewportRef.current.mouseY = e.clientY - rect.top;
        
        // Usar layout real do gráfico
        const { chartX, chartY, chartWidth, chartHeight } = chartLayoutRef.current;
        
        // Crosshair livre - seguir o mouse normalmente
        viewportRef.current.mouseX = rawMouseX;

        // Verificar se deve iniciar arraste (se o mouse se moveu significativamente)
        if (toolDraggingRef.current.toolId && !toolDraggingRef.current.isDragging) {
          const deltaX = Math.abs(viewportRef.current.mouseX - toolDraggingRef.current.startMouseX);
          const deltaY = Math.abs(viewportRef.current.mouseY - toolDraggingRef.current.startMouseY);
          
          // Threshold baixo de 3px para iniciar arraste — drag já foi preparado no mouseDown
          if (deltaX > 3 || deltaY > 3) {
            toolDraggingRef.current.isDragging = true;
          }
        }
        
        // Se está arrastando uma ferramenta selecionada
        if (toolDraggingRef.current.isDragging && toolDraggingRef.current.toolId && onToolMove) {
          const visibleCandles = candlesRef.current.slice(
            viewportRef.current.visibleStartIndex,
            viewportRef.current.visibleStartIndex + viewportRef.current.visibleCandleCount
          );
          
          if (visibleCandles.length > 0 && viewportRef.current.mouseX >= chartX && viewportRef.current.mouseX <= chartX + chartWidth &&
              viewportRef.current.mouseY >= chartY && viewportRef.current.mouseY <= chartY + chartHeight) {
            const { actualMinPrice, actualMaxPrice } = chartLayoutRef.current;
            
            const currentPrice = getPriceFromY(viewportRef.current.mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
            const currentTime = getTimeFromX(viewportRef.current.mouseX, chartX, chartWidth, visibleCandles);
            
            // Encontrar a ferramenta sendo arrastada
            const tool = graphicToolsRef.current.find(t => t.id === toolDraggingRef.current.toolId);
            if (tool && tool.points && tool.points.length > 0) {
              let newPoints: Array<{ x: number; y: number; price?: number; time?: number }>;
              
              if (tool.type === 'horizontal' && tool.points[0].price !== undefined) {
                // Linha horizontal: atualizar apenas o preço baseado na posição Y do mouse
                const originalPrice = tool.points[0].price;
                const priceDelta = currentPrice - originalPrice;
                newPoints = tool.points.map(p => ({
                  ...p,
                  price: (p.price || originalPrice) + priceDelta,
                  y: chartY + chartHeight - (((p.price || originalPrice) + priceDelta - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight
                }));
              } else if (tool.type === 'vertical' && tool.points[0].time !== undefined) {
                // Linha vertical: atualizar apenas o tempo baseado na posição X do mouse
                const originalTime = tool.points[0].time;
                const timeDelta = (currentTime || 0) - originalTime;
                // Encontrar o índice do candle mais próximo do novo tempo
                let closestIndex = 0;
                let minDiff = Math.abs(visibleCandles[0].time - ((originalTime + timeDelta) || 0));
                for (let i = 1; i < visibleCandles.length; i++) {
                  const diff = Math.abs(visibleCandles[i].time - ((originalTime + timeDelta) || 0));
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                  }
                }
                const newX = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                newPoints = tool.points.map(p => ({
                  ...p,
                  time: (p.time || originalTime) + timeDelta,
                  x: newX
                }));
              } else if (tool.type === 'line' || tool.type === 'trendline') {
                // DELTA DRAGGING: Usar offset inicial para movimento preciso
                const initialDeltaPrice = toolDraggingRef.current.initialDeltaPrice;
                const initialDeltaTime = toolDraggingRef.current.initialDeltaTime;
                
                if (initialDeltaPrice !== null && initialDeltaTime !== null) {
                  // Converter posição atual do mouse para coordenadas de mundo
                  const currentMousePrice = getPriceFromY(viewportRef.current.mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
                  const currentMouseTime = getTimeFromX(viewportRef.current.mouseX, chartX, chartWidth, visibleCandles);
                  
                  // Calcular nova posição dos pontos: mouse atual - delta inicial
                  // Isso garante que a ferramenta siga o mouse perfeitamente
                  const targetPrice = currentMousePrice - initialDeltaPrice;
                  const targetTime = (currentMouseTime || 0) - initialDeltaTime;
                  
                  // Calcular delta a aplicar aos pontos originais
                  const originalPoints = toolDraggingRef.current.originalPoints || tool.points;
                  const originalAvgPrice = originalPoints[0]?.price !== undefined && originalPoints[1]?.price !== undefined
                    ? (originalPoints[0].price + originalPoints[1].price) / 2
                    : (originalPoints[0]?.price || originalPoints[1]?.price || 0);
                  const originalAvgTime = originalPoints[0]?.time !== undefined && originalPoints[1]?.time !== undefined
                    ? (originalPoints[0].time + originalPoints[1].time) / 2
                    : (originalPoints[0]?.time || originalPoints[1]?.time || 0);
                  
                  const priceDelta = targetPrice - originalAvgPrice;
                  const timeDelta = targetTime - originalAvgTime;
                  
                  // Aplicar delta a todos os pontos mantendo coordenadas de mundo
                  newPoints = tool.points.map((p, idx) => {
                    const originalPoint = originalPoints[idx] || p;
                    const newPrice = (originalPoint.price || 0) + priceDelta;
                    const newTime = (originalPoint.time || 0) + timeDelta;
                    
                    // Recalcular x/y baseado nas novas coordenadas de mundo
                    let newX = p.x;
                    let newY = p.y;
                    
                    if (newTime !== undefined && visibleCandles.length > 0) {
                      let closestIndex = 0;
                      let minDiff = Math.abs(visibleCandles[0].time - newTime);
                      for (let i = 1; i < visibleCandles.length; i++) {
                        const diff = Math.abs(visibleCandles[i].time - newTime);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestIndex = i;
                        }
                      }
                      newX = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                    }
                    
                    if (newPrice !== undefined) {
                      newY = chartY + chartHeight - ((newPrice - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight;
                    }
                    
                    return {
                      ...p,
                      price: newPrice,
                      time: newTime,
                      x: newX,
                      y: newY
                    };
                  });
                } else {
                  // Fallback: usar delta do mouse se não tiver coordenadas de mundo
                  const deltaX = viewportRef.current.mouseX - toolDraggingRef.current.startMouseX;
                  const deltaY = viewportRef.current.mouseY - toolDraggingRef.current.startMouseY;
                  newPoints = tool.points.map(p => ({
                    ...p,
                    x: (p.x || 0) + deltaX,
                    y: (p.y || 0) + deltaY,
                    price: p.price !== undefined ? getPriceFromY((p.y || 0) + deltaY, chartY, chartHeight, actualMinPrice, actualMaxPrice) : p.price,
                    time: p.time !== undefined ? getTimeFromX((p.x || 0) + deltaX, chartX, chartWidth, visibleCandles) : p.time
                  }));
                }
              } else if (tool.type === 'fibonacci') {
                // DELTA DRAGGING para Fibonacci: usar offset inicial para movimento preciso
                const initialDeltaPrice = toolDraggingRef.current.initialDeltaPrice;
                const initialDeltaTime = toolDraggingRef.current.initialDeltaTime;
                
                if (initialDeltaPrice !== null && initialDeltaTime !== null) {
                  // Converter posição atual do mouse para coordenadas de mundo
                  const currentMousePrice = getPriceFromY(viewportRef.current.mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
                  const currentMouseTime = getTimeFromX(viewportRef.current.mouseX, chartX, chartWidth, visibleCandles);
                  
                  // Calcular nova posição dos pontos: mouse atual - delta inicial
                  const targetPrice = currentMousePrice - initialDeltaPrice;
                  const targetTime = (currentMouseTime || 0) - initialDeltaTime;
                  
                  // Calcular delta a aplicar aos pontos originais
                  const originalPoints = toolDraggingRef.current.originalPoints || tool.points;
                  const originalAvgPrice = originalPoints[0]?.price !== undefined && originalPoints[1]?.price !== undefined
                    ? (originalPoints[0].price + originalPoints[1].price) / 2
                    : (originalPoints[0]?.price || originalPoints[1]?.price || 0);
                  const originalAvgTime = originalPoints[0]?.time !== undefined && originalPoints[1]?.time !== undefined
                    ? (originalPoints[0].time + originalPoints[1].time) / 2
                    : (originalPoints[0]?.time || originalPoints[1]?.time || 0);
                  
                  const priceDelta = targetPrice - originalAvgPrice;
                  const timeDelta = targetTime - originalAvgTime;
                  
                  // Aplicar delta a todos os pontos mantendo coordenadas de mundo
                  newPoints = tool.points.map((p, idx) => {
                    const originalPoint = originalPoints[idx] || p;
                    const newPrice = (originalPoint.price || 0) + priceDelta;
                    const newTime = (originalPoint.time || 0) + timeDelta;
                    
                    // Recalcular x/y baseado nas novas coordenadas de mundo
                    let newX = p.x;
                    let newY = p.y;
                    
                    if (newTime !== undefined && visibleCandles.length > 0) {
                      let closestIndex = 0;
                      let minDiff = Math.abs(visibleCandles[0].time - newTime);
                      for (let i = 1; i < visibleCandles.length; i++) {
                        const diff = Math.abs(visibleCandles[i].time - newTime);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestIndex = i;
                        }
                      }
                      newX = chartX + (closestIndex / visibleCandles.length) * chartWidth;
                    }
                    
                    if (newPrice !== undefined) {
                      newY = chartY + chartHeight - ((newPrice - actualMinPrice) / (actualMaxPrice - actualMinPrice)) * chartHeight;
                    }
                    
                    return {
                      ...p,
                      price: newPrice,
                      time: newTime,
                      x: newX,
                      y: newY
                    };
                  });
                } else {
                  // Fallback: usar delta do mouse se não tiver coordenadas de mundo
                  const deltaX = viewportRef.current.mouseX - toolDraggingRef.current.startMouseX;
                  const deltaY = viewportRef.current.mouseY - toolDraggingRef.current.startMouseY;
                  newPoints = tool.points.map(p => ({
                    ...p,
                    x: (p.x || 0) + deltaX,
                    y: (p.y || 0) + deltaY,
                    price: p.price !== undefined ? getPriceFromY((p.y || 0) + deltaY, chartY, chartHeight, actualMinPrice, actualMaxPrice) : p.price,
                    time: p.time !== undefined ? getTimeFromX((p.x || 0) + deltaX, chartX, chartWidth, visibleCandles) : p.time
                  }));
                }
              } else {
                // Para outras ferramentas, usar delta do mouse
                const deltaX = viewportRef.current.mouseX - toolDraggingRef.current.startMouseX;
                const deltaY = viewportRef.current.mouseY - toolDraggingRef.current.startMouseY;
                newPoints = tool.points.map(p => ({
                  ...p,
                  x: (p.x || 0) + deltaX,
                  y: (p.y || 0) + deltaY,
                  price: p.price !== undefined ? getPriceFromY((p.y || 0) + deltaY, chartY, chartHeight, actualMinPrice, actualMaxPrice) : p.price,
                  time: p.time !== undefined ? getTimeFromX((p.x || 0) + deltaX, chartX, chartWidth, visibleCandles) : p.time
                }));
              }
              
              onToolMove(toolDraggingRef.current.toolId, newPoints);
              return; // Não fazer pan quando arrastando
            }
          }
        }

        // Se está desenhando uma ferramenta
        if (toolDrawingRef.current.isDrawing && toolDrawingRef.current.startPoint) {
          const visibleCandles = candlesRef.current.slice(
            viewportRef.current.visibleStartIndex,
            viewportRef.current.visibleStartIndex + viewportRef.current.visibleCandleCount
          );
          
          if (visibleCandles.length > 0 && viewportRef.current.mouseX >= chartX && viewportRef.current.mouseX <= chartX + chartWidth &&
              viewportRef.current.mouseY >= chartY && viewportRef.current.mouseY <= chartY + chartHeight) {
            const { actualMinPrice, actualMaxPrice } = chartLayoutRef.current;
            
            const price = getPriceFromY(viewportRef.current.mouseY, chartY, chartHeight, actualMinPrice, actualMaxPrice);
            const time = getTimeFromX(viewportRef.current.mouseX, chartX, chartWidth, visibleCandles);
            
            // Atualizar pontos de desenho
            if (toolDrawingRef.current.toolType === 'line' || toolDrawingRef.current.toolType === 'trendline') {
              // Para linha e trendline, adicionar ponto atual
              toolDrawingRef.current.points = [
                toolDrawingRef.current.startPoint,
                { x: viewportRef.current.mouseX, y: viewportRef.current.mouseY, price, time: time || undefined }
              ];
            } else if (toolDrawingRef.current.toolType === 'fibonacci') {
              // Para Fibonacci, precisa de 2 pontos
              if (toolDrawingRef.current.points.length === 1) {
                toolDrawingRef.current.points.push({ x: viewportRef.current.mouseX, y: viewportRef.current.mouseY, price, time: time || undefined });
              } else {
                toolDrawingRef.current.points[1] = { x: viewportRef.current.mouseX, y: viewportRef.current.mouseY, price, time: time || undefined };
              }
            }
            
            if (onToolDrawing) {
              onToolDrawing(toolDrawingRef.current.points);
            }
          }
          return; // Não fazer pan quando desenhando
        }

        // Verificar se está sobre snapshot durante o movimento (ANTES de processar o pan)
        // IMPORTANTE: NÃO multiplicar por scale porque as coordenadas do snapshot
        // são armazenadas em coordenadas "lógicas" (antes da escala DPR)
        const moveRect = canvas.getBoundingClientRect();
        const moveX = e.clientX - moveRect.left;
        const moveY = e.clientY - moveRect.top;
        
        let isOverSnapshotDuringMove = false;
        for (const [, snapshot] of snapshotPositionsRef.current.entries()) {
          if (moveX >= snapshot.x && moveX <= snapshot.x + snapshot.width &&
              moveY >= snapshot.y && moveY <= snapshot.y + snapshot.height) {
            isOverSnapshotDuringMove = true;
            break;
          }
        }
        
        // Se estiver sobre snapshot, NUNCA fazer pan
        if (isOverSnapshotDuringMove) {
          viewport.isDragging = false;
          return; // Parar aqui, não processar pan
        }
        
        // Só fazer pan se não estiver sobre snapshot
        if (viewport.isDragging) {
          // Pan normal
          const deltaX = e.clientX - viewport.dragStartX;
          const pixelsPerCandle = chartWidth / viewport.visibleCandleCount;
          const deltaCandles = Math.round(deltaX / pixelsPerCandle);
          
          const newStartIndex = viewport.dragStartIndex - deltaCandles;
          const maxStartIndex = Math.max(0, candlesRef.current.length - viewport.visibleCandleCount);
          viewport.visibleStartIndex = Math.max(0, Math.min(newStartIndex, maxStartIndex));
          // Atualizar flag isAtEnd baseado na posição atual
          viewport.isAtEnd = viewport.visibleStartIndex >= maxStartIndex - 1;
        }
      };

      // Handler de mouse up (finalizar pan ou desenho)
      const handleMouseUp = () => {
        // Parar arraste se estiver arrastando
        if (toolDraggingRef.current.isDragging || toolDraggingRef.current.toolId) {
          toolDraggingRef.current = {
            isDragging: false,
            toolId: null,
            toolType: null,
            startMouseX: 0,
            startMouseY: 0,
            startPrice: null,
            startTime: null,
            initialDeltaPrice: null,
            initialDeltaTime: null,
            originalPoints: null
          };
        }
        
        // Mouse up: verificar se estava desenhando uma ferramenta
        
        // Se estava desenhando uma ferramenta
        if (toolDrawingRef.current.isDrawing && toolDrawingRef.current.startPoint) {
          const toolType = toolDrawingRef.current.toolType;
          
          // Para linha, trendline e fibonacci, verificar se tem 2 pontos para completar
          if ((toolType === 'line' || toolType === 'trendline' || toolType === 'fibonacci') && 
              toolDrawingRef.current.points.length < 2) {
            // Ainda não tem 2 pontos - aguardar segundo clique
            return;
          }
          
          // Para outras ferramentas ou linha/trendline com 2 pontos, completar o desenho
          if (toolDrawingRef.current.points.length > 0) {
            // Marcar como completando para evitar dupla conclusão (se ainda não estiver)
            if (!toolDrawingRef.current.isCompleting) {
              toolDrawingRef.current.isCompleting = true;
            }
            
            if (toolType && onToolComplete) {
              // Determinar cor e estilo baseado no tipo
              let color = '#3b82f6';
              let style: 'solid' | 'dashed' | 'dotted' = 'solid';
              
              // Mapear IDs para tipos corretos
              let mappedType: 'line' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci' = 'line';
              if (toolType === 'line') {
                color = '#ef4444';
                style = 'solid';
                mappedType = 'line';
              } else if (toolType === 'trendline') {
                color = '#eab308';
                style = 'dashed';
                mappedType = 'trendline';
              } else if (toolType === 'horizontal-line') {
                color = '#3b82f6';
                style = 'solid';
                mappedType = 'horizontal';
              } else if (toolType === 'vertical-line') {
                color = '#3b82f6';
                style = 'solid';
                mappedType = 'vertical';
              } else if (toolType === 'fibonacci') {
                color = '#3b82f6';
                style = 'solid';
                mappedType = 'fibonacci';
              }
              
              // Criar uma cópia profunda dos pontos para garantir que não sejam perdidos
              const pointsCopy = toolDrawingRef.current.points.map(p => ({ ...p }));
              
              // Verificar se os pontos são válidos (não são iguais)
              if (pointsCopy.length >= 2) {
                const p1 = pointsCopy[0];
                const p2 = pointsCopy[1];
                // Verificar distância mínima (3 pixels) para evitar pontos muito próximos
                if (p1.x !== undefined && p2.x !== undefined && p1.y !== undefined && p2.y !== undefined) {
                  const dx = Math.abs(p2.x - p1.x);
                  const dy = Math.abs(p2.y - p1.y);
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  // Threshold mínimo de 2 pixels (mais permissivo)
                  if (distance < 2) {
                    toolDrawingRef.current.isDrawing = false;
                    toolDrawingRef.current.toolType = null;
                    toolDrawingRef.current.points = [];
                    toolDrawingRef.current.startPoint = null;
                    toolDrawingRef.current.isCompleting = false;
                    toolDrawingRef.current.pendingSecondPoint = null;
                    return;
                  }
                }
              }
              
              const completedTool: GraphicToolData = {
                id: `${toolType}-${Date.now()}`,
                type: mappedType,
                color,
                style,
                visible: true,
                points: pointsCopy, // Usar cópia profunda dos pontos
              };
              
              // Chamar callback ANTES de resetar estado
              onToolComplete(completedTool);
              
              // Resetar estado de desenho APENAS após completar e chamar callback
              // Não resetar antes para garantir que o callback receba os dados corretos
              toolDrawingRef.current.isDrawing = false;
              toolDrawingRef.current.toolType = null;
              toolDrawingRef.current.points = [];
              toolDrawingRef.current.startPoint = null;
              toolDrawingRef.current.isCompleting = false;
              toolDrawingRef.current.pendingSecondPoint = null;
            } else {
              toolDrawingRef.current.isCompleting = false;
            }
          }
        } else if (toolDrawingRef.current.isCompleting) {
          // Se já está completando, apenas resetar a flag
          toolDrawingRef.current.isCompleting = false;
        }
        
        viewport.isDragging = false;
      };

      // Handler de mouse leave (esconder crosshair)
      const handleMouseLeave = () => {
        viewportRef.current.mouseX = -1;
        viewportRef.current.mouseY = -1;
        viewportRef.current.isDragging = false;
      };

      // Atualizar cursor
      const updateCursor = (e: MouseEvent) => {
        // Verificar se está sobre botão de fechar
        // IMPORTANTE: NÃO multiplicar por scale porque as coordenadas do botão
        // são armazenadas em coordenadas "lógicas" (antes da escala DPR)
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Verificar se está sobre algum botão de fechar
        let isOverCloseButton = false;
        for (const [, button] of snapshotCloseButtonsRef.current.entries()) {
          if (mouseX >= button.x && mouseX <= button.x + button.size &&
              mouseY >= button.y && mouseY <= button.y + button.size) {
            isOverCloseButton = true;
            break;
          }
        }
        
        // Verificar se está sobre algum snapshot
        let isOverAnySnapshot = false;
        for (const [, snapshot] of snapshotPositionsRef.current.entries()) {
          if (mouseX >= snapshot.x && mouseX <= snapshot.x + snapshot.width &&
              mouseY >= snapshot.y && mouseY <= snapshot.y + snapshot.height) {
            isOverAnySnapshot = true;
            break;
          }
        }
        
        // Verificar se o mouse está sobre alguma ferramenta gráfica para mudar cursor
        let isOverGraphicTool = false;
        if (!isOverCloseButton && !isOverAnySnapshot && !toolDrawingRef.current.isDrawing && !viewport.isDragging && !selectedToolTypeRef.current) {
          const mouseX = viewportRef.current.mouseX;
          const mouseY = viewportRef.current.mouseY;
          const toolChartX = chartLayoutRef.current.chartX;
          const toolChartWidth = chartLayoutRef.current.chartWidth;
          const toolChartY = chartLayoutRef.current.chartY;
          const toolChartHeight = chartLayoutRef.current.chartHeight;
          
          if (mouseX >= toolChartX && mouseX <= toolChartX + toolChartWidth && mouseY >= toolChartY && mouseY <= toolChartY + toolChartHeight) {
            const visCandles = candlesRef.current.slice(viewportRef.current.visibleStartIndex, viewportRef.current.visibleStartIndex + viewportRef.current.visibleCandleCount);
            if (visCandles.length > 0) {
              const aMinP = chartLayoutRef.current.actualMinPrice;
              const aMaxP = chartLayoutRef.current.actualMaxPrice;
              
              for (const tool of graphicToolsRef.current) {
                if (!tool.visible || !tool.points || tool.points.length === 0) continue;
                if (tool.type === 'horizontal' && tool.points[0]?.price !== undefined) {
                  const y = toolChartY + toolChartHeight - ((tool.points[0].price - aMinP) / (aMaxP - aMinP)) * toolChartHeight;
                  if (Math.abs(mouseY - y) < 15) {
                    isOverGraphicTool = true;
                    canvas.style.cursor = 'ns-resize';
                    break;
                  }
                } else if (tool.type === 'vertical' && tool.points[0]?.time !== undefined) {
                  let closestIndex = 0;
                  let minDiff = Math.abs(visCandles[0].time - tool.points[0].time);
                  for (let ci = 1; ci < visCandles.length; ci++) {
                    const diff = Math.abs(visCandles[ci].time - tool.points[0].time);
                    if (diff < minDiff) { minDiff = diff; closestIndex = ci; }
                  }
                  const x = toolChartX + (closestIndex / visCandles.length) * toolChartWidth;
                  if (Math.abs(mouseX - x) < 10) {
                    isOverGraphicTool = true;
                    canvas.style.cursor = 'ew-resize';
                    break;
                  }
                } else if ((tool.type === 'line' || tool.type === 'trendline' || tool.type === 'fibonacci') && tool.points.length >= 2) {
                  // Verificar proximidade de linhas/trendlines
                  const p1 = tool.points[0];
                  const p2 = tool.points[1];
                  if (p1.price !== undefined && p2.price !== undefined && p1.time !== undefined && p2.time !== undefined) {
                    const y1 = toolChartY + toolChartHeight - ((p1.price - aMinP) / (aMaxP - aMinP)) * toolChartHeight;
                    const y2 = toolChartY + toolChartHeight - ((p2.price - aMinP) / (aMaxP - aMinP)) * toolChartHeight;
                    let ci1 = 0, ci2 = 0;
                    let md1 = Infinity, md2 = Infinity;
                    for (let ci = 0; ci < visCandles.length; ci++) {
                      const d1 = Math.abs(visCandles[ci].time - p1.time);
                      const d2 = Math.abs(visCandles[ci].time - p2.time);
                      if (d1 < md1) { md1 = d1; ci1 = ci; }
                      if (d2 < md2) { md2 = d2; ci2 = ci; }
                    }
                    const x1 = toolChartX + (ci1 / visCandles.length) * toolChartWidth;
                    const x2 = toolChartX + (ci2 / visCandles.length) * toolChartWidth;
                    // Distância ponto-segmento
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const lenSq = dx * dx + dy * dy;
                    if (lenSq > 0) {
                      const t = Math.max(0, Math.min(1, ((mouseX - x1) * dx + (mouseY - y1) * dy) / lenSq));
                      const projX = x1 + t * dx;
                      const projY = y1 + t * dy;
                      const dist = Math.sqrt((mouseX - projX) ** 2 + (mouseY - projY) ** 2);
                      if (dist < 10) {
                        isOverGraphicTool = true;
                        canvas.style.cursor = 'move';
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (isOverCloseButton) {
          canvas.style.cursor = 'pointer';
        } else if (isOverAnySnapshot) {
          canvas.style.cursor = 'default';
        } else if (toolDraggingRef.current.isDragging) {
          // Manter cursor de resize enquanto arrasta
          const dragTool = graphicToolsRef.current.find(t => t.id === toolDraggingRef.current.toolId);
          if (dragTool?.type === 'horizontal') canvas.style.cursor = 'ns-resize';
          else if (dragTool?.type === 'vertical') canvas.style.cursor = 'ew-resize';
          else canvas.style.cursor = 'move';
        } else if (toolDrawingRef.current.isDrawing) {
          canvas.style.cursor = 'crosshair';
        } else if (viewport.isDragging) {
          canvas.style.cursor = 'grabbing';
        } else if (selectedToolTypeRef.current) {
          canvas.style.cursor = 'crosshair';
        } else if (!isOverGraphicTool) {
          canvas.style.cursor = 'grab';
        }
      };

      // === Touch Support para Mobile ===
      let lastTouchDistance = 0;
      let isTouching = false;
      let touchMoved = false;

      const getTouchPos = (touch: Touch): { offsetX: number; offsetY: number } => {
        const rect = canvas.getBoundingClientRect();
        return {
          offsetX: touch.clientX - rect.left,
          offsetY: touch.clientY - rect.top,
        };
      };

      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        isTouching = true;
        touchMoved = false;

        if (e.touches.length === 2) {
          // Pinch-to-zoom: gravar distância inicial
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
          return;
        }

        if (e.touches.length === 1) {
          const pos = getTouchPos(e.touches[0]);
          const syntheticEvent = new MouseEvent('mousedown', {
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            button: 0,
            bubbles: true,
          });
          Object.defineProperty(syntheticEvent, 'offsetX', { value: pos.offsetX });
          Object.defineProperty(syntheticEvent, 'offsetY', { value: pos.offsetY });
          Object.defineProperty(syntheticEvent, 'target', { value: canvas });
          handleMouseDown(syntheticEvent);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        touchMoved = true;

        if (e.touches.length === 2) {
          // Pinch-to-zoom
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (lastTouchDistance > 0) {
            const scale = distance / lastTouchDistance;
            const deltaY = scale < 1 ? 100 : -100; // pinch in = zoom in, pinch out = zoom out
            if (Math.abs(scale - 1) > 0.02) { // threshold para evitar jitter
              const syntheticWheel = new WheelEvent('wheel', {
                deltaY,
                clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                bubbles: true,
              });
              handleWheel(syntheticWheel);
            }
          }
          lastTouchDistance = distance;
          return;
        }

        if (e.touches.length === 1) {
          const pos = getTouchPos(e.touches[0]);
          const syntheticEvent = new MouseEvent('mousemove', {
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            button: 0,
            bubbles: true,
          });
          Object.defineProperty(syntheticEvent, 'offsetX', { value: pos.offsetX });
          Object.defineProperty(syntheticEvent, 'offsetY', { value: pos.offsetY });
          handleMouseMove(syntheticEvent);
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        lastTouchDistance = 0;
        if (isTouching) {
          handleMouseUp();
          isTouching = false;
        }
      };

      // Adicionar event listeners
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseLeave);
      canvas.addEventListener('mousemove', updateCursor);
      // Touch events
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

      return () => {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        canvas.removeEventListener('mousemove', updateCursor);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
      };
    }, [symbol, timeframe]);

    // Ajustar tamanho do canvas quando container mudar
    useEffect(() => {
      if (!canvasRef.current) return;

      const resizeObserver = new ResizeObserver(() => {
        // O canvas será redimensionado no próximo frame de animação
      });

      if (canvasRef.current.parentElement) {
        resizeObserver.observe(canvasRef.current.parentElement);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    // Resetar viewport quando símbolo ou timeframe mudar
    useEffect(() => {
      viewportRef.current.visibleStartIndex = 0;
      viewportRef.current.visibleCandleCount = 100;
      viewportRef.current.mouseX = -1;
      viewportRef.current.mouseY = -1;
      viewportRef.current.isAtEnd = true; // Sempre começar no final
    }, [symbol, timeframe]);

    // Expor métodos via ref
    useImperativeHandle(ref, () => ({
      exportAsImage: async (format: 'png' | 'jpeg'): Promise<string | null> => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const url = URL.createObjectURL(blob);
            resolve(url);
          }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
        });
      },
      exportAsCSV: (): string => {
        const candles = candlesRef.current;
        const csvHeader = 'Timestamp,Open,High,Low,Close\n';
        const csvRows = candles.map(candle => {
          const time = new Date(candle.time).toISOString();
          return `${time},${candle.open},${candle.high},${candle.low},${candle.close}`;
        });
        return csvHeader + csvRows.join('\n');
      },
      exportAsJSON: (): string => {
        return JSON.stringify(candlesRef.current, null, 2);
      },
      copyToClipboard: async (): Promise<boolean> => {
        const canvas = canvasRef.current;
        if (!canvas) return false;

        try {
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
          });
          
          if (!blob) return false;
          
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          return true;
        } catch (error) {
          console.error('Clipboard copy failed');
          return false;
        }
      },
      print: (): void => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const win = window.open('', '_blank');
        if (!win) return;

        const img = canvas.toDataURL('image/png');
        win.document.write(`
          <html>
            <head><title>Imprimir Gráfico</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
              <img src="${img}" onload="window.print(); window.close();" style="max-width:100%;height:auto;" />
            </body>
          </html>
        `);
        win.document.close();
      },
      getTimelineState: () => {
        const validCurrentTime = currentTimeRef.current instanceof Date ? currentTimeRef.current : new Date();
        const serverTime = validCurrentTime.getTime();
        const timeframeSeconds = 60;
        const deadlineOffset = 30;
        
        // Calcular estado atual do timeline
        let targetExpiration = Math.ceil(serverTime / (timeframeSeconds * 1000)) * (timeframeSeconds * 1000);
        let targetDeadline = targetExpiration - (deadlineOffset * 1000); // Linha branca 30s ANTES da vermelha
        
        if (serverTime > targetDeadline) {
          targetExpiration += (timeframeSeconds * 1000);
          targetDeadline = targetExpiration - (deadlineOffset * 1000);
        }
        
        const timeLeft = Math.max(0, Math.ceil((targetDeadline - serverTime) / 1000));
        const canTrade = serverTime <= targetDeadline;
        
        return {
          currentDeadline: targetDeadline,
          currentExpiration: targetExpiration,
          timeLeft,
          canTrade,
        };
      },
      getCurrentPrice: (): number => {
        // Retornar o preço visual atual do motor de física
        const engine = candleEngineRef.current;
        return engine.visualPrice > 0 ? engine.visualPrice : (engine.realPrice > 0 ? engine.realPrice : 0);
      },
    }));

    return (
      <div 
        className={`animated-canvas-chart-container ${className}`} 
        style={{ 
          width: width || '100%', 
          height: height || '100%',
          position: 'relative',
          minHeight: height || 400,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            willChange: 'contents', // Otimização para animações suaves
            imageRendering: 'crisp-edges', // Melhor renderização de linhas
            cursor: hoveredCloseButton ? 'pointer' : (isOverSnapshot ? 'default' : 'default'),
          }}
          onMouseMove={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            // IMPORTANTE: NÃO multiplicar por scale porque as coordenadas do botão/snapshot
            // são armazenadas em coordenadas "lógicas" (antes da escala DPR)
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Verificar se o mouse está sobre algum botão de fechar
            let foundHovered = false;
            let foundHoveredId: string | null = null;
            for (const [tradeId, button] of snapshotCloseButtonsRef.current.entries()) {
              if (x >= button.x && x <= button.x + button.size &&
                  y >= button.y && y <= button.y + button.size) {
                foundHovered = true;
                foundHoveredId = tradeId;
                break;
              }
            }
            
            // Verificar se o mouse está sobre algum snapshot (verificar DEPOIS do botão)
            let isOverAnySnapshot = false;
            for (const [, snapshot] of snapshotPositionsRef.current.entries()) {
              if (x >= snapshot.x && x <= snapshot.x + snapshot.width &&
                  y >= snapshot.y && y <= snapshot.y + snapshot.height) {
                isOverAnySnapshot = true;
                break;
              }
            }
            setIsOverSnapshot(isOverAnySnapshot);
            
            // Se estiver sobre um snapshot, parar qualquer pan que possa estar ocorrendo
            if (isOverAnySnapshot && viewportRef.current.isDragging) {
              viewportRef.current.isDragging = false;
            }
            
            // Atualizar estado do hover e cursor DIRETAMENTE
            if (foundHovered) {
              if (hoveredCloseButton !== foundHoveredId) {
                setHoveredCloseButton(foundHoveredId);
              }
              // Definir cursor diretamente no canvas
              canvas.style.cursor = 'pointer';
            } else {
              if (hoveredCloseButton !== null) {
                setHoveredCloseButton(null);
              }
              // Se está sobre snapshot mas não sobre botão, usar cursor default
              if (isOverAnySnapshot) {
                canvas.style.cursor = 'default';
              }
              // Se não está sobre nada especial, deixar o updateCursor cuidar
            }
          }}
          onMouseLeave={() => {
            // Limpar hover quando o mouse sair do canvas
            setHoveredCloseButton(null);
            setIsOverSnapshot(false);
          }}
          onClick={(e) => {
            const canvas = canvasRef.current;
            if (!canvas || !onCloseSnapshot) return;
            
            // IMPORTANTE: NÃO multiplicar por scale porque as coordenadas do botão
            // são armazenadas em coordenadas "lógicas" (antes da escala DPR)
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Verificar se o clique foi em algum botão de fechar
            for (const [tradeId, button] of snapshotCloseButtonsRef.current.entries()) {
              // Verificar se o clique está dentro da área do botão
              const isInsideButton = x >= button.x && x <= button.x + button.size &&
                                     y >= button.y && y <= button.y + button.size;
              
              if (isInsideButton) {
                onCloseSnapshot(tradeId);
                break;
              }
            }
          }}
        />
        {error && (
          <div className="absolute top-2 right-2 bg-red-500/20 border border-red-500/40 text-red-200 px-3 py-1.5 rounded-none text-sm backdrop-blur-sm">
            Erro de conexão: {error}
          </div>
        )}
        {!isConnected && (
          <div className="absolute top-2 right-2 bg-orange-500/20 border border-orange-500/40 text-orange-200 px-3 py-1.5 rounded-none text-sm backdrop-blur-sm">
            Conectando...
          </div>
        )}
      </div>
    );
  }
);

AnimatedCanvasChart.displayName = 'AnimatedCanvasChart';


