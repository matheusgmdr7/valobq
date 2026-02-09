'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Bell, 
  Star, 
  Info,
  Search,
  TrendingUp,
  TrendingDown,
  Volume2,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  MessageCircle,
  Briefcase,
  History,
  MessageSquare,
  Trophy,
  Megaphone,
  BarChart3,
  MoreHorizontal,
  LineChart,
  Activity,
  Layers,
  Gauge,
  TrendingUp as TrendingUpIcon2,
  Waves,
  Zap,
  LineChart as LineChartIcon,
  BarChart2,
  ChartCandlestick,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PenTool,
  Minus,
  Square,
  Maximize,
  ChevronDown as ChevronDownIcon,
  Circle,
  Grid3x3,
  User,
  CheckCircle2,
  HelpCircle,
  Eye,
  EyeOff,
  Trash2,
  Settings,
  VolumeX,
  Copy,
  X,
  Lock,
  Unlock,
  Camera,
  Edit,
  DollarSign,
  LogOut,
  Wallet,
  AlertCircle,
  Shield,
  Tag,
  Flame,
  Bitcoin,
  Landmark,
  Droplets,
  Globe,
  LayoutGrid
} from 'lucide-react';
import { AnimatedCanvasChart, AnimatedCanvasChartRef } from '@/components/charts/AnimatedCanvasChart';
import { MarketLoading } from '@/components/ui/MarketLoading';
import { useMarketData } from '@/hooks/useMarketData';
import { useActiveTrades } from '@/hooks/useActiveTrades';
import { marketService } from '@/services/marketService';
import { tradeService } from '@/services/tradeService';
import { getAllTradingConfigs } from '@/services/tradingConfigService';
import { PortfolioTotal } from '@/components/trading/PortfolioTotal';
import { TradeHistory } from '@/components/trading/TradeHistory';
import { ChatSupport } from '@/components/trading/ChatSupport';
import { Leaderboard } from '@/components/trading/Leaderboard';
import { Promotions } from '@/components/trading/Promotions';
import { MarketAnalysis } from '@/components/trading/MarketAnalysis';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trade } from '@/lib/db';
import { useSounds } from '@/hooks/useSounds';

// Calcula o próximo minuto cheio a partir do horário atual
const getNextMinute = (reference: Date) => {
  const next = new Date(reference.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  return next;
};

// Componente seguro para icone de gateway (sem innerHTML)
const GatewayIcon: React.FC<{ gateway: { name: string; type: string }; iconUrl: string }> = ({ gateway, iconUrl }) => {
  const [imgError, setImgError] = React.useState(false);
  const typeColors: Record<string, string> = {
    pix: 'bg-teal-500',
    stripe: 'bg-blue-500',
    crypto: 'bg-orange-500',
    bank_transfer: 'bg-blue-600',
    other: 'bg-gray-700',
  };

  if (imgError) {
    const color = typeColors[gateway.type] || 'bg-gray-700';
    const initial = gateway.name.charAt(0).toUpperCase();
    return (
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">{initial}</span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-gray-800/50">
      <img
        src={iconUrl}
        alt={gateway.name}
        className="w-10 h-10 object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
};

const TradingPage: React.FC = () => {
  const { user, updateBalance, logout, accountType, switchAccount, activeBalance } = useAuth();
  // Ref para evitar stale closure no processTradeResult
  const activeBalanceRef = React.useRef(activeBalance);
  activeBalanceRef.current = activeBalance;
  const { soundEnabled, toggleSound, playClick, playWin, playLoss } = useSounds();

  // Auto-reload quando o usuário volta à página após inatividade (evita candles desordenados)
  useEffect(() => {
    let hiddenAt: number | null = null;
    const INACTIVE_THRESHOLD = 30_000; // 30 segundos

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > INACTIVE_THRESHOLD) {
        hiddenAt = null;
        window.location.reload();
      } else {
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('broker_logo_dark') || localStorage.getItem('broker_logo');
    }
    return null;
  });
  const [brokerName, setBrokerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('broker_name') || 'VALOREN';
    }
    return 'VALOREN';
  });
  const [supportEmail, setSupportEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('broker_support_email') || 'suporte@valorenbroker.com';
    }
    return 'suporte@valorenbroker.com';
  });
  const { activeTrades } = useActiveTrades();
  const router = useRouter();
  // Carregar pares adicionados do localStorage ao inicializar
  const [selectedAsset, setSelectedAsset] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trading_selectedAsset');
      return saved || 'BTC/USD';
    }
    return 'BTC/USD';
  });
  
  const [addedPairs, setAddedPairs] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trading_addedPairs');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['BTC/USD', 'ETH/USD'];
        } catch {
          return ['BTC/USD', 'ETH/USD'];
        }
      }
    }
    return ['BTC/USD', 'ETH/USD'];
  });
  const [showAddPairModal, setShowAddPairModal] = useState(false); // Modal para adicionar pares
  const [tradeValue, setTradeValue] = useState(540);
  const [expiration, setExpiration] = useState(18);
  const [currentTime, setCurrentTime] = useState(new Date());
  // Horário de expiração para a linha vertical no gráfico (inicialmente próximo minuto)
  const [expirationTime, setExpirationTime] = useState<Date>(() => {
    return getNextMinute(new Date());
  });
  
  // Array local de trades ativos para renderização instantânea (alta performance)
  const [localActiveTrades, setLocalActiveTrades] = useState<Trade[]>([]);
  const localActiveTradesRef = useRef<Trade[]>([]);
  // Resultados de trades finalizados por ativo (para mostrar no card)
  const [tradeResults, setTradeResults] = useState<Record<string, { result: 'win' | 'loss'; profit: number; timestamp: number }>>({});
  const [, setCardTimerTick] = useState(0); // Tick para forçar re-render dos timers nos cards
  const processedTradeIdsRef = useRef<Set<string>>(new Set()); // IDs de trades já processados
  const [closedSnapshots, setClosedSnapshots] = useState<Set<string>>(new Set()); // IDs de snapshots fechados pelo usuário
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTimeframes, setShowTimeframes] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '2m' | '5m' | '10m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d' | '1w' | '1M'>('1m');
  const [candleTimer, setCandleTimer] = useState(true);
  const [autoResize, setAutoResize] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string>('all'); // 'all', 'forex', 'crypto', 'stocks', 'indices', 'commodities'
  const [searchQuery, setSearchQuery] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; isOTC: boolean; category: string; message: string } | null>(null);
  const [realTimePrices, setRealTimePrices] = useState<Record<string, number>>({});
  const [marketSentiment, setMarketSentiment] = useState({ buyPercent: 50, sellPercent: 50 });
  const sentimentRef = useRef<{ base: number; trend: number; trendTicks: number }>({ base: 50, trend: 0, trendTicks: 0 });
  // Estado para armazenar configurações de trading
  const [tradingConfigs, setTradingConfigs] = useState<Map<string, { payout_percentage: number }>>(new Map());
  const [showSentimentTooltip, setShowSentimentTooltip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect mobile screen size and orientation
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', () => setTimeout(checkMobile, 100));
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  // === Sentimento dinâmico simulado por ativo ===
  useEffect(() => {
    // Gerar seed determinístico por ativo para cada ativo ter um "perfil" diferente
    const hashSymbol = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    const seed = hashSymbol(selectedAsset);
    // Cada ativo começa com um sentimento base diferente (entre 25-75)
    const assetBase = 25 + (seed % 50);
    sentimentRef.current = { base: assetBase, trend: 0, trendTicks: 0 };
    // Set valor inicial imediatamente ao trocar de ativo
    const initialBuy = Math.round(assetBase);
    setMarketSentiment({ buyPercent: initialBuy, sellPercent: 100 - initialBuy });

    const interval = setInterval(() => {
      const ref = sentimentRef.current;

      // Micro-tendência: a cada N ticks, muda a direção
      if (ref.trendTicks <= 0) {
        ref.trend = (Math.random() - 0.5) * 3; // tendência entre -1.5 e +1.5
        ref.trendTicks = 5 + Math.floor(Math.random() * 15); // dura 5-20 ticks
      }
      ref.trendTicks--;

      // Noise + tendência + mean reversion
      const noise = (Math.random() - 0.5) * 2.5;
      const meanReversion = (assetBase - ref.base) * 0.04;
      const delta = noise + ref.trend * 0.5 + meanReversion;
      
      ref.base = Math.max(10, Math.min(90, ref.base + delta));
      const buyPct = Math.round(ref.base);
      setMarketSentiment({ buyPercent: buyPct, sellPercent: 100 - buyPct });
    }, 3000); // Atualiza a cada 3 segundos

    return () => clearInterval(interval);
  }, [selectedAsset]);

  const [buyButtonHover, setBuyButtonHover] = useState(false);
  const [sellButtonHover, setSellButtonHover] = useState(false);
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'bar' | 'heikin-ashi'>('candlestick');
  const [candleUpColor, setCandleUpColor] = useState('#22c55e'); // Verde padrão
  const [candleDownColor, setCandleDownColor] = useState('#f87171'); // Vermelho padrão
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [lineColor, setLineColor] = useState('#f59e0b'); // Cor padrão da linha
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid'); // Estilo da linha
  const [lineWithShadow, setLineWithShadow] = useState(true); // Linha com sombra
  const [showLineStyleDropdown, setShowLineStyleDropdown] = useState(false); // Controla dropdown de estilo da linha
  const [showLineColorPicker, setShowLineColorPicker] = useState(false); // Controla seletor de cor da linha
  const [showCandleUpColorPicker, setShowCandleUpColorPicker] = useState(false); // Controla seletor de cor alta
  const [showCandleDownColorPicker, setShowCandleDownColorPicker] = useState(false); // Controla seletor de cor baixa
  
  // Mínimo é sempre o próximo minuto cheio
  const minimumExpiration = useMemo(
    () => getNextMinute(currentTime),
    [currentTime]
  );

  // Paleta de cores pré-definidas (28 cores + transparente)
  // Paleta de cores reduzida (12 cores principais)
  const colorPalette = [
    '#FF6B6B', // Vermelho
    '#FFA726', // Laranja
    '#66BB6A', // Verde
    '#42A5F5', // Azul
    '#AB47BC', // Roxo
    '#E0E0E0', // Cinza claro
    '#9E9E9E', // Cinza médio
    '#424242', // Cinza escuro
    '#FFFFFF', // Branco
    '#000000', // Preto
    '#F57C00', // Laranja escuro
    '#26A69A'  // Verde-azulado
  ];
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showBottomTab, setShowBottomTab] = useState(false); // Aba embaixo para Tipo de Gráfico
  const [leftPanelOpen, setLeftPanelOpen] = useState<string | null>(null); // Controla qual painel lateral está aberto
  const [leftPanelWidth, setLeftPanelWidth] = useState(0); // Largura do painel lateral aberto
  const [showUserMenu, setShowUserMenu] = useState(false); // Controla menu lateral do usuário
  const [showAccountDropdown, setShowAccountDropdown] = useState(false); // Controla dropdown conta demo/real
  const [showDepositModal, setShowDepositModal] = useState(false); // Controla janela de depósito
  const [depositSearchQuery, setDepositSearchQuery] = useState(''); // Busca de métodos de pagamento
  const [paymentGateways, setPaymentGateways] = useState<any[]>([]); // Gateways de pagamento configurados
  const [loadingGateways, setLoadingGateways] = useState(false); // Carregando gateways
  const [selectedGateway, setSelectedGateway] = useState<any | null>(null); // Gateway selecionado
  const [depositStep, setDepositStep] = useState<'method' | 'amount' | 'payment'>('method'); // Etapa do depósito
  const [depositAmount, setDepositAmount] = useState(20); // Valor do depósito (mínimo R$20)
  const [promoCode, setPromoCode] = useState(''); // Código promocional
  const [cpf, setCpf] = useState(''); // CPF do usuário
  const [acceptedTerms, setAcceptedTerms] = useState(false); // Aceitar termos
  const [processedDepositIds, setProcessedDepositIds] = useState<Set<string>>(new Set()); // IDs de depósitos já processados
  const [showPixPaymentModal, setShowPixPaymentModal] = useState(false); // Modal com QR code PIX
  const [pixPaymentData, setPixPaymentData] = useState<{
    qrCode: string;
    paymentImage: string;
    amount: number;
    externalId: string;
    depositId?: string; // ID do depósito no banco
  } | null>(null); // Dados do pagamento PIX
  const [depositPaymentStatus, setDepositPaymentStatus] = useState<'pending' | 'completed' | null>(null); // Status do pagamento
  const [userPhoto, setUserPhoto] = useState<string | null>(() => {
    // Carregar foto do usuário do localStorage se existir
    if (typeof window !== 'undefined') {
      const savedPhoto = localStorage.getItem('user_photo');
      return savedPhoto || null;
    }
    return null;
  }); // Foto do usuário (pode ser URL ou base64)
  const [selectedPeriod, setSelectedPeriod] = useState<'30d' | '1d' | '3h' | '30m' | '15m' | '5m' | '2m'>('30m');
  const [activeIndicators, setActiveIndicators] = useState<Array<{ id: string; type: 'sma' | 'ema' | 'bollinger' | 'rsi' | 'macd' | 'volume'; period?: number; color?: string; visible?: boolean }>>([]);
  const [selectedIndicatorForEdit, setSelectedIndicatorForEdit] = useState<string | null>(null); // ID do indicador selecionado para edição
  const [showIndicatorProperties, setShowIndicatorProperties] = useState(false); // Mostrar painel de propriedades do indicador
  const [indicatorPanelPosition, setIndicatorPanelPosition] = useState({ x: 0, y: 0 }); // Posição do painel de indicadores (drag)
  const [isDraggingIndicatorPanel, setIsDraggingIndicatorPanel] = useState(false); // Se está arrastando o painel
  
  // Estrutura para ferramentas gráficas
  interface GraphicTool {
    id: string;
    label: string;
    icon: string;
    color: string;
    style: 'solid' | 'dashed' | 'dotted';
    visible: boolean;
    createdAt: number;
    // Dados de desenho
    points?: Array<{ x: number; y: number; price?: number; time?: number }>; // Coordenadas em pixels e dados do gráfico
    type: 'line' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci';
    isDrawing?: boolean; // Se está sendo desenhada no momento
  }
  
  const [activeTools, setActiveTools] = useState<GraphicTool[]>([]); // Ferramentas ativas/em uso
  const activeToolsRef = useRef<GraphicTool[]>([]); // Ref para manter activeTools atualizado nos handlers
  const chartRef = useRef<AnimatedCanvasChartRef>(null);
  
  // Atualizar ref quando activeTools mudar
  useEffect(() => {
    activeToolsRef.current = activeTools;
  }, [activeTools]);
  const [selectedToolType, setSelectedToolType] = useState<string | null>(null); // Tipo de ferramenta selecionada para desenhar
  const [selectedToolForEdit, setSelectedToolForEdit] = useState<{ id: string; createdAt: number } | null>(null); // Ferramenta selecionada para edição
  const [showToolProperties, setShowToolProperties] = useState(false); // Mostrar painel de propriedades
  const [selectedToolOnChart, setSelectedToolOnChart] = useState<{ id: string; createdAt: number } | null>(null); // Ferramenta selecionada no gráfico
  const [showToolColorPicker, setShowToolColorPicker] = useState(false); // Controla seletor de cor da ferramenta
  const [showToolStyleDropdown, setShowToolStyleDropdown] = useState(false); // Controla dropdown de estilo da ferramenta
  const [toolPanelPosition, setToolPanelPosition] = useState({ x: 0, y: 0 }); // Posição do painel de ferramentas (drag)
  const [isDraggingToolPanel, setIsDraggingToolPanel] = useState(false); // Se está arrastando o painel
  
  // Converter GraphicTool para formato do AnimatedCanvasChart
  const graphicToolsForChart = useMemo(() => {
    const tools = activeTools
      .filter(tool => tool.visible && tool.points && tool.points.length > 0)
      .map(tool => ({
        id: `${tool.id}-${tool.createdAt}`,
        type: tool.type,
        color: tool.color,
        style: tool.style,
        visible: tool.visible,
        points: tool.points || []
      }));
    return tools;
  }, [activeTools]);
  
  // Converter activeIndicators para formato do AnimatedCanvasChart
  const indicatorsForChart = useMemo(() => {
    return activeIndicators
      .filter(ai => ai.visible !== false) // Filtrar indicadores ocultos
      .map(ai => ({
        id: ai.id,
        type: ai.type,
        period: ai.period,
        color: ai.color,
        lineWidth: 1.0, // Linha mais fina
        style: 'solid' as const
      }));
  }, [activeIndicators]);
  
  // Handler quando uma ferramenta é completada
  const handleToolComplete = (tool: { id: string; type: string; color: string; style: 'solid' | 'dashed' | 'dotted'; visible: boolean; points: Array<{ x: number; y: number; price?: number; time?: number }> }) => {
    // Mapear tipo recebido para ID correto
    const typeToIdMap: Record<string, string> = {
      'line': 'line',
      'trendline': 'trendline',
      'horizontal': 'horizontal-line',
      'vertical': 'vertical-line',
      'fibonacci': 'fibonacci'
    };
    
    const toolId = typeToIdMap[tool.type] || selectedToolType;
    
    // Encontrar a ferramenta correspondente e atualizar com os pontos
    const toolConfig = [
      { id: 'line', label: 'Linha', icon: 'line', color: '#ef4444', style: 'solid' as const, type: 'line' as const },
      { id: 'trendline', label: 'Linha de tendência', icon: 'trendline', color: '#eab308', style: 'dashed' as const, type: 'trendline' as const },
      { id: 'horizontal-line', label: 'Linha horizontal', icon: 'horizontal', color: '#3b82f6', style: 'solid' as const, type: 'horizontal' as const },
      { id: 'vertical-line', label: 'Linha vertical', icon: 'vertical', color: '#3b82f6', style: 'solid' as const, type: 'vertical' as const },
      { id: 'fibonacci', label: 'Linhas Fibonacci', icon: 'fibonacci', color: '#3b82f6', style: 'solid' as const, type: 'fibonacci' as const }
    ].find(t => t.id === toolId || t.id === selectedToolType);
    
    if (toolConfig && tool.points && tool.points.length > 0) {
      const newTool: GraphicTool = {
        id: toolConfig.id,
        label: toolConfig.label,
        icon: toolConfig.icon,
        color: tool.color,
        style: tool.style,
        visible: true,
        createdAt: Date.now(),
        type: toolConfig.type,
        points: tool.points,
        isDrawing: false
      };
      setActiveTools(prev => [...prev, newTool]);
    }
    
    // Limpar seleção
    setSelectedToolType(null);
  };
  
  // Handler quando clica em uma ferramenta no gráfico
  const handleToolClick = (toolId: string, toolType: string, position: { x: number; y: number }) => {
    // Usar ref para garantir que sempre temos o valor mais recente
    const currentActiveTools = activeToolsRef.current;
    
    // O toolId vem como "horizontal-line-1767658924537" (id-createdAt)
    // Encontrar a ferramenta pelo ID completo
    let tool = currentActiveTools.find(t => `${t.id}-${t.createdAt}` === toolId);
    
    if (!tool) {
      // Tentar encontrar por ID parcial - pode ser que o toolId venha sem o createdAt
      // O toolId pode vir como "horizontal-line-1767658924537" mas o id da ferramenta é "horizontal-line"
      const parts = toolId.split('-');
      if (parts.length >= 3) {
        // Tentar encontrar pelo ID base (sem o timestamp)
        const baseId = parts.slice(0, -1).join('-'); // "horizontal-line" sem o timestamp
        const timestamp = parts[parts.length - 1];
        tool = currentActiveTools.find(t => t.id === baseId && t.createdAt.toString() === timestamp);
      }
    }
    
    if (tool) {
      setSelectedToolOnChart({ id: tool.id, createdAt: tool.createdAt });
      setShowToolProperties(true);
      // Resetar posição do painel se necessário
      if (toolPanelPosition.x === 0 && toolPanelPosition.y === 0) {
        // Manter posição padrão (top-right)
      }
    }
  };
  
  // Handler durante o desenho (atualização em tempo real)
  const handleToolDrawing = (points: Array<{ x: number; y: number; price?: number; time?: number }>) => {
    // Pode ser usado para preview em tempo real se necessário
  };
  
  // Handler quando move uma ferramenta (arraste)
  const handleToolMove = (toolId: string, newPoints: Array<{ x: number; y: number; price?: number; time?: number }>) => {
    // Atualizar os pontos da ferramenta
    setActiveTools(prev => prev.map(tool => {
      const fullId = `${tool.id}-${tool.createdAt}`;
      if (fullId === toolId) {
        return { ...tool, points: newPoints };
      }
      return tool;
    }));
  };

  // Buscar dados de mercado reais (apenas para referência)
  // Nota: O AnimatedCanvasChart usa seu próprio sistema de agrupamento por timeframe
  // Este hook é apenas para referência de preço atual
  const { candles: candlestickData, currentPrice: marketPrice, pair, loading: marketLoading } = useMarketData({
    symbol: selectedAsset,
    timeframe: '1m', // Sempre buscar dados de 1m, o AnimatedCanvasChart agrupa por timeframe selecionado
    limit: 100,
    autoUpdate: false
  });

  // Carregar pares disponíveis
  useEffect(() => {
    const pairs = marketService.getPairs();
    setAvailablePairs(pairs.map(p => p.symbol));
  }, []);

  // Atualizar tempo a cada segundo (usar performance.now para evitar atrasos)
  useEffect(() => {
    // Obter tempo inicial do servidor se disponível, senão usar tempo local
    const initialTime = new Date();
    let startTime = performance.now();
    
    const interval = setInterval(() => {
      // Usar performance.now para calcular tempo decorrido e evitar atrasos de clock
      const elapsed = performance.now() - startTime;
      const newTime = new Date(initialTime.getTime() + elapsed);
      setCurrentTime(newTime);
    }, 1000);
    
    // Resetar startTime a cada minuto para evitar drift acumulado
    const resetInterval = setInterval(() => {
      startTime = performance.now();
      const now = new Date();
      initialTime.setTime(now.getTime());
    }, 60000); // Resetar a cada minuto
    
    return () => {
      clearInterval(interval);
      clearInterval(resetInterval);
    };
  }, []);

  // Função para animar mudanças de saldo (Counter)
  const animateBalance = (from: number, to: number) => {
    const duration = 500; // 500ms de animação
    const startTime = performance.now();
    const difference = to - from;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentBalance = from + (difference * easeOut);
      
      updateBalance(currentBalance);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Garantir valor final exato
        updateBalance(to);
      }
    };
    
    requestAnimationFrame(animate);
  };

  // Função processTradeResult - Alta Performance (chamada no loop de 60 FPS)
  const processTradeResult = async (trade: Trade) => {
    // Evitar processar o mesmo trade múltiplas vezes
    if (processedTradeIdsRef.current.has(trade.id)) {
      return;
    }
    processedTradeIdsRef.current.add(trade.id);

    // 1. Congelar o preço final para evitar discrepâncias visuais
    const finalPrice = chartRef.current?.getCurrentPrice() || trade.entryPrice;
    
    // 2. Cálculo imediato do resultado (Lógica de Frontend)
    const isWin = trade.type === 'call' ? finalPrice > trade.entryPrice : finalPrice < trade.entryPrice;
    const isDraw = finalPrice === trade.entryPrice;
    
    // 3. Atualizar trade local com resultado
    const payoutPercent = 0.88; // 88% payout (consistente com tradeService)
    const updatedTrade: Trade = {
      ...trade,
      exitPrice: finalPrice,
      result: isDraw ? undefined : (isWin ? 'win' : 'loss'),
      profit: isDraw ? 0 : (isWin ? trade.amount * payoutPercent : -trade.amount),
    };
    
    // Atualizar no array local
    setLocalActiveTrades(prev => prev.map(t => t.id === trade.id ? updatedTrade : t));
    localActiveTradesRef.current = localActiveTradesRef.current.map(t => t.id === trade.id ? updatedTrade : t);
    
    // Salvar resultado no card do ativo (se não for o ativo atualmente selecionado, persiste visualmente)
    if (!isDraw) {
      const resultData = {
        result: isWin ? 'win' as const : 'loss' as const,
        profit: isWin ? trade.amount * payoutPercent : -trade.amount,
        timestamp: Date.now(),
      };
      setTradeResults(prev => ({ ...prev, [trade.symbol]: resultData }));
    }
    
    // 4. Feedback Sonoro e Visual Instantâneo
    if (!isDraw) {
      if (isWin) {
        playWin();
      } else {
        playLoss();
      }
      // Toast customizado de resultado
      const profit = isWin ? trade.amount * payoutPercent : trade.amount;
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } pointer-events-auto overflow-hidden`}
          style={{
            borderRadius: '6px',
            width: '260px',
            background: isWin 
              ? 'linear-gradient(135deg, #052e16 0%, #064e3b 100%)' 
              : 'linear-gradient(135deg, #300a0a 0%, #450a0a 100%)',
            border: `1px solid ${isWin ? '#22c55e30' : '#ef444430'}`,
            boxShadow: `0 4px 12px ${isWin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
          }}
        >
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {isWin ? 'Operação Vencedora' : 'Operação Perdida'}
              </p>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-base font-bold text-white">
                {isWin ? '+' : '-'}R$ {profit.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400">
                {trade.symbol}
              </span>
            </div>
          </div>
          <div className="h-[2px] w-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div 
              className="h-full"
              style={{
                background: isWin ? '#22c55e' : '#ef4444',
                animation: 'toast-progress 4s linear forwards',
              }}
            />
          </div>
        </div>
      ), { 
        duration: 4000,
        position: 'top-right',
      });
    }
    
    // 5. Sincronização com o Backend e Atualização de Saldo
    try {
      const result = await tradeService.calculateTradeResult(trade.id, finalPrice);
      if (result.success && result.trade.profit !== undefined && user) {
        // Ler saldo ATUAL do ref (evita stale closure)
        const currentBalance = activeBalanceRef.current;
        
        // FLUXO: Na execução, o investimento já foi DESCONTADO do saldo
        // Se ganhou: devolver investimento + adicionar lucro (amount + amount * 0.88)
        // Se perdeu: saldo já está correto (investimento já foi descontado)
        // Se empatou: devolver o investimento (amount)
        let newBalance: number;
        if (isDraw) {
          newBalance = currentBalance + trade.amount;
        } else if (isWin) {
          newBalance = currentBalance + trade.amount + (result.trade.profit || 0);
        } else {
          // Perdeu: saldo já descontado na abertura — não alterar
          newBalance = currentBalance;
        }
        
        // Atualizar saldo com animação (persiste no banco via updateBalance)
        if (newBalance !== currentBalance) {
          animateBalance(currentBalance, newBalance);
        }
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown');
    }
    
    // 6. Snapshot permanece aberto até ser fechado manualmente pelo usuário
    // Removido setTimeout - o snapshot só será removido quando o usuário clicar no botão de fechar
  };

  // Loop de 60 FPS para verificar trades expirados (substitui verificação de 5 segundos)
  useEffect(() => {
    let animationFrameId: number;
    
    const checkTrades = () => {
      const now = Date.now();
      const tradesToProcess = localActiveTradesRef.current.filter(
        trade => !trade.result && trade.expiration <= now
      );
      
      tradesToProcess.forEach(trade => {
        processTradeResult(trade);
      });
      
      animationFrameId = requestAnimationFrame(checkTrades);
    };
    
    animationFrameId = requestAnimationFrame(checkTrades);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  // Sincronizar localActiveTrades com activeTrades do hook (para trades já existentes)
  useEffect(() => {
    // Adicionar trades do hook que ainda não estão no local
    const existingIds = new Set(localActiveTradesRef.current.map(t => t.id));
    const newTrades = activeTrades.filter(t => !existingIds.has(t.id));
    
    if (newTrades.length > 0) {
      setLocalActiveTrades(prev => [...prev, ...newTrades]);
      localActiveTradesRef.current = [...localActiveTradesRef.current, ...newTrades];
    }
  }, [activeTrades]);

  // Tick a cada 500ms para atualizar timers circulares nos cards de ativos + limpeza de resultados expirados
  useEffect(() => {
    const hasActiveTrades = localActiveTrades.some(t => !t.result && t.expiration > Date.now());
    const hasResults = Object.keys(tradeResults).length > 0;
    if (!hasActiveTrades && !hasResults) return;
    
    const interval = setInterval(() => {
      setCardTimerTick(prev => prev + 1);
      // Limpar resultados com mais de 30s
      const now = Date.now();
      setTradeResults(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const sym of Object.keys(updated)) {
          if (now - updated[sym].timestamp > 30000) {
            delete updated[sym];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [localActiveTrades, tradeResults]);

  // Salvar addedPairs no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined' && addedPairs.length > 0) {
      localStorage.setItem('trading_addedPairs', JSON.stringify(addedPairs));
    }
  }, [addedPairs]);
  
  // Salvar selectedAsset no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedAsset) {
      localStorage.setItem('trading_selectedAsset', selectedAsset);
    }
  }, [selectedAsset]);
  
  // Carregar todas as configurações de trading ao montar o componente
  useEffect(() => {
    const loadTradingConfigs = async () => {
      try {
        const configs = await getAllTradingConfigs();
        const payoutMap = new Map<string, { payout_percentage: number }>();
        configs.forEach((config, symbol) => {
          payoutMap.set(symbol, { payout_percentage: config.payout_percentage });
        });
        setTradingConfigs(payoutMap);
      } catch (error: any) {
        // Se for erro de tabela não existir, apenas continuar silenciosamente
        if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
          return;
        }
        console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      }
    };

    loadTradingConfigs();
  }, []);
  
  // Ref para controlar se o horário foi ajustado manualmente
  const expirationTimeManuallySet = useRef(false);
  
  // Carregar logo e nome da broker (logo para fundo preto)
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null;
        let brokerNameValue: string | null = null;
        
        // Primeiro, tentar carregar do Supabase (priorizar logoDark para fundo preto)
        if (supabase) {
          try {
            const { data: logoDarkData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_logo_dark')
              .single();
            
            if (logoDarkData?.value) {
              logoUrl = logoDarkData.value as string;
              localStorage.setItem('broker_logo_dark', logoUrl);
            } else {
              // Fallback: tentar logo padrão
              const { data: logoData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_logo')
                .single();
              
              if (logoData?.value) {
                logoUrl = logoData.value as string;
                localStorage.setItem('broker_logo', logoUrl);
              }
            }
            
            // Buscar nome da broker
            const { data: nameData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_name')
              .single();
            
            if (nameData?.value) {
              brokerNameValue = nameData.value as string;
              localStorage.setItem('broker_name', brokerNameValue);
            }

            // Buscar email de suporte
            const { data: emailData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_support_email')
              .single();
            
            if (emailData?.value) {
              const supportEmailValue = emailData.value as string;
              localStorage.setItem('broker_support_email', supportEmailValue);
              localStorage.setItem('platform_contact_email', supportEmailValue);
              setSupportEmail(supportEmailValue);
            }
          } catch {
            // Fallback to localStorage on error
          }
        }
        
        // Se não encontrou no Supabase, usar localStorage
        if (!logoUrl) {
          logoUrl = localStorage.getItem('broker_logo_dark') || localStorage.getItem('broker_logo');
        }
        if (!brokerNameValue) {
          brokerNameValue = localStorage.getItem('broker_name');
        }

        // Carregar email de suporte do localStorage se não foi carregado do Supabase
        const savedSupportEmail = localStorage.getItem('broker_support_email') || localStorage.getItem('platform_contact_email');
        if (savedSupportEmail) {
          setSupportEmail(savedSupportEmail);
        }
        
        if (logoUrl) {
          setBrokerLogo(logoUrl);
        }
        if (brokerNameValue) {
          setBrokerName(brokerNameValue);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      }
    };
    
    loadBrokerData();
  }, []);
  
  // Carregar gateways de pagamento ativos
  useEffect(() => {
    const loadPaymentGateways = async () => {
      if (!supabase) {
        setLoadingGateways(false);
        return;
      }
      
      setLoadingGateways(true);
      try {
        const { data, error } = await supabase
          .from('payment_gateways')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });
        
        if (error) {
          // Se a tabela não existir, apenas não mostrar gateways (não é um erro crítico)
          if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
            setPaymentGateways([]);
            return;
          }
          console.error('Error:', error instanceof Error ? error.message : 'Unknown');
          setPaymentGateways([]);
          return;
        }
        setPaymentGateways(data || []);
      } catch (error: any) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown');
        setPaymentGateways([]);
      } finally {
        setLoadingGateways(false);
      }
    };
    
    loadPaymentGateways();
  }, []);

  // Verificar periodicamente status de depósitos na API HorsePay
  // Verifica depósitos pendentes E aprovados recentes (últimos 60 minutos) para garantir sincronização com gateway
  useEffect(() => {
    if (!user || !supabase) return;

    const checkPendingDepositsStatus = async () => {
      try {
        // Calcular data limite: últimos 60 minutos para verificar depósitos recentes
        const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        // Buscar depósitos pendentes E aprovados recentes que têm transaction_id (PIX/HorsePay)
        // Verificamos ambos para corrigir inconsistências (approved incorreto ou pending concluído)
        const { data: pendingDeposits, error } = await supabase
          .from('deposits')
          .select('id, amount, status, transaction_id, method, admin_notes, created_at')
          .eq('user_id', user.id)
          .in('status', ['pending', 'approved'])
          .not('transaction_id', 'is', null)
          .gte('created_at', sixtyMinutesAgo)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error:', error instanceof Error ? error.message : 'Unknown');
          return;
        }

        if (!pendingDeposits || pendingDeposits.length === 0) {
          return;
        }

        // Para cada depósito pendente, verificar status na API HorsePay
        for (const deposit of pendingDeposits) {
          // Evitar processar se já foi marcado como processado
          if (processedDepositIds.has(deposit.id)) {
            continue;
          }

          // Buscar gateway configurado para este método de pagamento
          const { data: gateways, error: gatewayError } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('type', deposit.method)
            .eq('is_active', true)
            .limit(1);

          if (gatewayError || !gateways || gateways.length === 0) {
            continue;
          }

          const gatewayData = gateways[0];

          // Verificar se é gateway PIX (HorsePay)
          if (gatewayData.type === 'pix' && gatewayData.api_key_encrypted && gatewayData.api_secret_encrypted) {
            try {
              // Autenticar na API HorsePay
              const clientKey = atob(gatewayData.api_key_encrypted);
              const clientSecret = atob(gatewayData.api_secret_encrypted);
              const gatewayConfig = gatewayData.config || {};
              const apiBaseUrl = gatewayConfig.api_base_url || gatewayData.api_base_url || 'https://api.horsepay.io';

              const authResponse = await fetch(`${apiBaseUrl}/auth/token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  client_key: clientKey,
                  client_secret: clientSecret,
                }),
              });

              if (!authResponse.ok) {
                continue;
              }

              const authData = await authResponse.json();
              const accessToken = authData.access_token;

              // Verificar status da transação usando o transaction_id (external_id)
              // Tentar diferentes formatos de endpoint
              let statusResponse;
              
              // Primeiro, tentar GET /transaction/{id}
              statusResponse = await fetch(`${apiBaseUrl}/transaction/${deposit.transaction_id}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              });

              // Se não funcionar, tentar GET /transaction/status/{id} ou /transaction/check/{id}
              if (!statusResponse.ok && statusResponse.status === 404) {
                statusResponse = await fetch(`${apiBaseUrl}/transaction/status/${deposit.transaction_id}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
              }

              if (!statusResponse.ok) {
                // Se ainda não funcionar, tentar /transaction/check/{id}
                statusResponse = await fetch(`${apiBaseUrl}/transaction/check/${deposit.transaction_id}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
              }

              if (!statusResponse.ok) {
                continue;
              }

              const transactionData = await statusResponse.json();

              // Verificar status na API da gateway
              // Status concluído: "concluida", "completed", "paid", ou 1
              // Status não concluído: "ativa", "pending", "waiting", etc.
              const gatewayStatus = transactionData.status?.toString().toLowerCase() || 
                                   transactionData.payment_status?.toString().toLowerCase() || 
                                   transactionData.status_pagamento?.toString().toLowerCase() || '';
              
              const isCompleted = 
                gatewayStatus === 'concluida' ||
                gatewayStatus === 'completed' ||
                gatewayStatus === 'paid' ||
                gatewayStatus === 'pago' ||
                transactionData.status === 1;
              
              const isNotCompleted = 
                gatewayStatus === 'ativa' ||
                gatewayStatus === 'active' ||
                gatewayStatus === 'pending' ||
                gatewayStatus === 'waiting' ||
                gatewayStatus === 'aguardando';

              // Se o depósito está "approved" no banco mas não está concluído na gateway, reverter
              if (deposit.status === 'approved' && !isCompleted) {
                // Buscar o saldo atual do usuário para descontar o valor
                const { data: currentUser } = await supabase
                  .from('users')
                  .select('balance')
                  .eq('id', user.id)
                  .single();

                if (currentUser) {
                  const depositAmount = parseFloat(deposit.amount.toString());
                  const newBalance = Math.max(0, (currentUser.balance || 0) - depositAmount);
                  
                  // Reverter status do depósito para pending
                  const { error: updateError } = await supabase
                    .from('deposits')
                    .update({
                      status: 'pending',
                      admin_notes: `Status revertido de 'approved' para 'pending'. Gateway status: "${gatewayStatus}". Transaction ID: ${deposit.transaction_id}. Revertido em: ${new Date().toISOString()}`,
                    })
                    .eq('id', deposit.id);

                  if (!updateError) {
                    // Atualizar saldo do usuário (persiste no banco via updateBalance)
                    updateBalance(newBalance);
                    
                    toast.warning(
                      `Depósito de ${formatCurrency(depositAmount)} revertido. Status na gateway: "${gatewayStatus}".`,
                      { duration: 5000 }
                    );
                  }
                }
                
                // Continuar para próximo depósito
                continue;
              }

              // Se o status indica que o pagamento foi concluído
              if (isCompleted && deposit.status === 'pending') {
                // Atualizar depósito para approved e processar saldo
                const { error: updateError } = await supabase
                  .from('deposits')
                  .update({
                    status: 'approved',
                    admin_notes: `Depósito aprovado automaticamente após confirmação do pagamento PIX. Transaction ID: ${deposit.transaction_id}. Verificado em: ${new Date().toISOString()}`,
                  })
                  .eq('id', deposit.id);

                if (updateError) {
                  console.error('Error:', updateError instanceof Error ? updateError.message : 'Unknown');
                  continue;
                }

                // Atualizar saldo do usuário (persiste no banco via updateBalance)
                const depositAmount = parseFloat(deposit.amount.toString());
                const newBalance = activeBalance + depositAmount;
                updateBalance(newBalance);

                // Marcar como processado para evitar duplicação
                setProcessedDepositIds(prev => new Set(prev).add(deposit.id));

                // Mostrar notificação de sucesso
                toast.success(
                  `Pagamento confirmado! Depósito de ${formatCurrency(depositAmount)} aprovado. Saldo atualizado.`,
                  { duration: 5000 }
                );

                // Se o modal de pagamento PIX estiver aberto, mostrar mensagem de sucesso
                // Se o modal de pagamento PIX estiver aberto, atualizar status
                if (showPixPaymentModal && pixPaymentData && 
                    (pixPaymentData.externalId === deposit.transaction_id || 
                     pixPaymentData.depositId === deposit.id)) {
                  setDepositPaymentStatus('completed');
                  // Fechar modal após 5 segundos
                  setTimeout(() => {
                    setShowPixPaymentModal(false);
                    setPixPaymentData(null);
                    setDepositPaymentStatus(null);
                  }, 5000);
                }

              }
            } catch (apiError) {
              console.error('Error:', apiError instanceof Error ? apiError.message : 'Unknown');
              // Continuar para o próximo depósito mesmo se houver erro
            }
          }
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      }
    };

    // Verificar imediatamente ao montar o componente
    checkPendingDepositsStatus();

    // Verificar a cada 15 segundos (reduzido para verificar mais frequentemente)
    const interval = setInterval(checkPendingDepositsStatus, 15000);

    return () => clearInterval(interval);
  }, [user, supabase, updateBalance, processedDepositIds, showPixPaymentModal, pixPaymentData]);

  // Função para agrupar gateways por categoria
  const groupGatewaysByCategory = (gateways: any[]) => {
    const filtered = depositSearchQuery
      ? gateways.filter(g => 
          (g.name || '').toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
          (g.description || '').toLowerCase().includes(depositSearchQuery.toLowerCase()) ||
          (g.type || '').toLowerCase().includes(depositSearchQuery.toLowerCase())
        )
      : gateways;

    const grouped: Record<string, any[]> = {};
    filtered.forEach(gateway => {
      // Se category não existir, inferir do type
      let category = gateway.category;
      if (!category) {
        if (gateway.type === 'crypto') category = 'crypto';
        else if (gateway.type === 'bank_transfer') category = 'bank';
        else if (gateway.type === 'pix') category = 'recommended';
        else category = 'other';
      }
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(gateway);
    });
    
    return grouped;
  };

  // Função para formatar valor em reais
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Função para renderizar ícone do gateway
  const renderDefaultIcon = (gateway: any) => {
    if (gateway.icon_url) {
      let iconUrl = gateway.icon_url;
      
      // Se não for URL completa, buscar do bucket banks
      if (!iconUrl.startsWith('http')) {
        if (supabase) {
          const { data } = supabase.storage.from('banks').getPublicUrl(gateway.icon_url);
          iconUrl = data.publicUrl;
        }
      }
      
      return (
        <GatewayIcon gateway={gateway} iconUrl={iconUrl} />
      );
    }
    
    // Ícone padrão baseado no tipo
    const typeColors: Record<string, string> = {
      pix: 'bg-teal-500',
      stripe: 'bg-blue-500',
      crypto: 'bg-orange-500',
      bank_transfer: 'bg-blue-600',
      other: 'bg-gray-700',
    };
    
    const color = typeColors[gateway.type] || 'bg-gray-700';
    const initial = gateway.name.charAt(0).toUpperCase();
    
    return (
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">{initial}</span>
      </div>
    );
  };

  // Nomes das categorias
  const categoryNames: Record<string, string> = {
    recommended: 'RECOMMENDED',
    crypto: 'CRYPTO DEPOSIT',
    bank: 'BANK TRANSFER',
    other: 'OTHER METHODS',
  };
  
  // Handler para arrastar painel de indicadores
  useEffect(() => {
    if (!isDraggingIndicatorPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingIndicatorPanel) return;
      const container = document.querySelector('[data-chart-container]') as HTMLElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setIndicatorPanelPosition({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top
      });
    };
    
    const handleMouseUp = () => {
      setIsDraggingIndicatorPanel(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingIndicatorPanel]);

  // Funções de exportação
  const handleExportChart = async (format: 'png' | 'jpeg' = 'png') => {
    if (!chartRef.current) {
      toast.error('Gráfico não disponível');
      return;
    }

    try {
      const imageUrl = await chartRef.current.exportAsImage(format);
      if (!imageUrl) {
        toast.error('Erro ao exportar gráfico');
        return;
      }

      // Criar link de download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `chart-${selectedAsset.replace('/', '-')}-${new Date().toISOString().slice(0, 10)}.${format === 'jpeg' ? 'jpg' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(imageUrl);
      
      toast.success('Gráfico exportado com sucesso!');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      toast.error('Erro ao exportar gráfico');
    }
  };

  const handleExportData = (format: 'csv' | 'json') => {
    if (!chartRef.current) {
      toast.error('Gráfico não disponível');
      return;
    }

    try {
      const baseFilename = `chart-data-${selectedAsset.replace('/', '-')}-${new Date().toISOString().slice(0, 10)}`;
      let data: string;
      let mimeType: string;
      let extension: string;

      if (format === 'csv') {
        data = chartRef.current.exportAsCSV();
        mimeType = 'text/csv';
        extension = 'csv';
      } else {
        data = chartRef.current.exportAsJSON();
        mimeType = 'application/json';
        extension = 'json';
      }

      if (!data) {
        toast.error('Nenhum dado disponível para exportar');
        return;
      }

      // Criar blob e download
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Dados exportados como ${format.toUpperCase()}!`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      toast.error('Erro ao exportar dados');
    }
  };

  const handleCopyChart = async () => {
    if (!chartRef.current) {
      toast.error('Gráfico não disponível');
      return;
    }

    try {
      const success = await chartRef.current.copyToClipboard();
      if (success) {
        toast.success('Gráfico copiado para a área de transferência!');
      } else {
        toast.error('Erro ao copiar gráfico');
      }
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      toast.error('Erro ao copiar gráfico');
    }
  };

  const handlePrintChart = () => {
    if (!chartRef.current) {
      toast.error('Gráfico não disponível');
      return;
    }

    try {
      chartRef.current.print();
      setShowExportMenu(false);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown');
      toast.error('Erro ao imprimir gráfico');
    }
  };

  // Fechar menu de exportação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const exportMenu = target.closest('[data-export-menu]');
      const exportButton = target.closest('[data-export-button]');
      
      if (showExportMenu && !exportMenu && !exportButton) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Fechar dropdown de estilo da linha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const lineStyleDropdown = target.closest('[data-line-style-dropdown]');
      const lineStyleButton = target.closest('[data-line-style-button]');
      
      if (showLineStyleDropdown && !lineStyleDropdown && !lineStyleButton) {
        setShowLineStyleDropdown(false);
      }
    };

    if (showLineStyleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLineStyleDropdown]);

  // Fechar seletores de cor ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showLineColorPicker && !target.closest('[data-line-color-picker]')) {
        setShowLineColorPicker(false);
      }
      if (showCandleUpColorPicker && !target.closest('[data-candle-up-color-picker]')) {
        setShowCandleUpColorPicker(false);
      }
      if (showCandleDownColorPicker && !target.closest('[data-candle-down-color-picker]')) {
        setShowCandleDownColorPicker(false);
      }
      if (showToolColorPicker && !target.closest('[data-tool-color-picker]')) {
        setShowToolColorPicker(false);
      }
      if (showToolStyleDropdown && !target.closest('[data-tool-style-dropdown]')) {
        setShowToolStyleDropdown(false);
      }
    };

    if (showLineColorPicker || showCandleUpColorPicker || showCandleDownColorPicker || showToolColorPicker || showToolStyleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLineColorPicker, showCandleUpColorPicker, showCandleDownColorPicker, showToolColorPicker, showToolStyleDropdown]);

  // Gerenciar drag do painel de ferramentas
  useEffect(() => {
    if (!isDraggingToolPanel) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('[data-chart-container]') as HTMLElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newX = e.clientX - containerRect.left;
      const newY = e.clientY - containerRect.top;
      setToolPanelPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingToolPanel(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingToolPanel]);

  // Fechar painéis expansíveis ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const controlsPanel = target.closest('[data-controls-panel]');
      const addPairButton = target.closest('[data-add-pair-button]');
      const addPairModal = target.closest('[data-add-pair-modal]');
      
      if (!controlsPanel && (showTimeframes || showTools || showChartTypeMenu || showIndicators || showPeriod)) {
        setShowTimeframes(false);
        setShowTools(false);
        setShowChartTypeMenu(false);
        setShowIndicators(false);
        setShowPeriod(false);
      }
      
      if (!addPairButton && !addPairModal && showAddPairModal) {
        setShowAddPairModal(false);
      }
    };

    if (showTimeframes || showTools || showAddPairModal || showChartTypeMenu || showIndicators || showPeriod) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTimeframes, showTools, showAddPairModal, showChartTypeMenu, showIndicators, showPeriod]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <MarketLoading message="Carregando..." />
      </div>
    );
  }

  // Função para obter URL da imagem usando CoinMarketCap CDN
  // IMPORTANTE: CoinMarketCap usa IDs NUMÉRICOS únicos para cada moeda, NÃO o símbolo
  // Cada moeda tem um ID fixo no CoinMarketCap (ex: Bitcoin = 1, Ethereum = 1027)
  // Formato da URL: https://s2.coinmarketcap.com/static/img/coins/64x64/{id}.png
  // 
  // Como funciona:
  // 1. Pegamos o símbolo do par (ex: "BTC/USD")
  // 2. Extraímos a base currency (ex: "BTC")
  // 3. Mapeamos o símbolo para o ID numérico do CoinMarketCap
  // 4. Construímos a URL usando o ID numérico
  const getCryptoImageUrl = (symbol: string): string => {
    const pair = marketService.getPair(symbol);
    const category = pair?.category || 'crypto';
    const baseCurrency = symbol.split('/')[0].toUpperCase();
    
    // ===== CRYPTO =====
    if (category === 'crypto') {
      const coinMarketCapIds: Record<string, number> = {
        'BTC': 1, 'ETH': 1027, 'BNB': 1839, 'SOL': 5426,
        'XRP': 52, 'DOGE': 74, 'ADA': 2010, 'AVAX': 5805,
        'DOT': 6636, 'MATIC': 3890, 'LINK': 1975, 'UNI': 7083,
        'LTC': 2, 'ATOM': 3794, 'ETC': 1321, 'XLM': 512,
        'ALGO': 4030, 'VET': 3077, 'FIL': 2280, 'TRX': 1958,
      };
      const id = coinMarketCapIds[baseCurrency];
      if (id) return `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`;
    }
    
    // ===== FOREX (bandeiras dos países) =====
    if (category === 'forex') {
      // Mapear moeda → código de país ISO para flagcdn.com
      const currencyToCountry: Record<string, string> = {
        'EUR': 'eu', 'USD': 'us', 'GBP': 'gb', 'JPY': 'jp',
        'AUD': 'au', 'CAD': 'ca', 'CHF': 'ch', 'NZD': 'nz',
        'BRL': 'br', 'CNY': 'cn', 'HKD': 'hk', 'SGD': 'sg',
        'SEK': 'se', 'NOK': 'no', 'DKK': 'dk', 'PLN': 'pl',
        'ZAR': 'za', 'MXN': 'mx', 'TRY': 'tr', 'INR': 'in',
        'RUB': 'ru', 'KRW': 'kr', 'THB': 'th',
      };
      const country = currencyToCountry[baseCurrency];
      if (country) return `https://flagcdn.com/w80/${country}.png`;
    }
    
    // ===== AÇÕES (ícones SVG com cores das marcas) =====
    if (category === 'stocks') {
      const stockBrands: Record<string, { color: string; text: string }> = {
        'AAPL': { color: '#A2AAAD', text: 'AAPL' },
        'GOOGL': { color: '#4285F4', text: 'GOOG' },
        'MSFT': { color: '#00A4EF', text: 'MSFT' },
        'AMZN': { color: '#FF9900', text: 'AMZN' },
        'TSLA': { color: '#CC0000', text: 'TSLA' },
        'META': { color: '#0668E1', text: 'META' },
        'NVDA': { color: '#76B900', text: 'NVDA' },
        'NFLX': { color: '#E50914', text: 'NFLX' },
        'DIS': { color: '#113CCF', text: 'DIS' },
        'PYPL': { color: '#003087', text: 'PYPL' },
        'INTC': { color: '#0071C5', text: 'INTC' },
        'AMD': { color: '#ED1C24', text: 'AMD' },
        'CRM': { color: '#00A1E0', text: 'CRM' },
        'ORCL': { color: '#F80000', text: 'ORCL' },
        'CSCO': { color: '#1BA0D7', text: 'CSCO' },
        'IBM': { color: '#054ADA', text: 'IBM' },
        'UBER': { color: '#000000', text: 'UBER' },
        'SHOP': { color: '#96BF48', text: 'SHOP' },
        'SQ': { color: '#3E4348', text: 'SQ' },
        'SNAP': { color: '#FFFC00', text: 'SNAP' },
        'SPOT': { color: '#1DB954', text: 'SPOT' },
        'BA': { color: '#0033A0', text: 'BA' },
        'JPM': { color: '#0A6EBD', text: 'JPM' },
        'V': { color: '#1A1F71', text: 'VISA' },
        'MA': { color: '#EB001B', text: 'MA' },
        'WMT': { color: '#0071CE', text: 'WMT' },
        'KO': { color: '#F40009', text: 'KO' },
        'PEP': { color: '#004B93', text: 'PEP' },
        'MCD': { color: '#FFC72C', text: 'MCD' },
      };
      const brand = stockBrands[symbol];
      if (brand) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${brand.color}"/><text x="32" y="38" text-anchor="middle" font-size="${brand.text.length > 3 ? 13 : 18}" font-weight="bold" fill="white" font-family="Arial,sans-serif">${brand.text}</text></svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
      }
    }
    
    // ===== ÍNDICES =====
    if (category === 'indices') {
      const indexImages: Record<string, string> = {
        'SPX': 'https://flagcdn.com/w80/us.png',      // S&P 500 (US)
        'IXIC': 'https://flagcdn.com/w80/us.png',     // NASDAQ (US)
        'DJI': 'https://flagcdn.com/w80/us.png',      // Dow Jones (US)
        'FTSE': 'https://flagcdn.com/w80/gb.png',     // FTSE 100 (UK)
        'DAX': 'https://flagcdn.com/w80/de.png',      // DAX (Alemanha)
        'N225': 'https://flagcdn.com/w80/jp.png',     // Nikkei (Japão)
        'HSI': 'https://flagcdn.com/w80/hk.png',      // Hang Seng (HK)
        'IBOV': 'https://flagcdn.com/w80/br.png',     // Ibovespa (Brasil)
        'CAC': 'https://flagcdn.com/w80/fr.png',      // CAC 40 (França)
        'ASX': 'https://flagcdn.com/w80/au.png',      // ASX (Austrália)
      };
      if (indexImages[symbol]) return indexImages[symbol];
    }
    
    // ===== COMMODITIES (ícones SVG) =====
    if (category === 'commodities') {
      const commoditySvgs: Record<string, string> = {
        'XAU': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#F59E0B"/><circle cx="32" cy="32" r="24" fill="#FBBF24"/><text x="32" y="40" text-anchor="middle" font-size="28" font-weight="bold" fill="#92400E" font-family="Arial">Au</text></svg>`,
        'XAG': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#9CA3AF"/><circle cx="32" cy="32" r="24" fill="#D1D5DB"/><text x="32" y="40" text-anchor="middle" font-size="28" font-weight="bold" fill="#4B5563" font-family="Arial">Ag</text></svg>`,
        'XPT': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#6B7280"/><circle cx="32" cy="32" r="24" fill="#E5E7EB"/><text x="32" y="40" text-anchor="middle" font-size="28" font-weight="bold" fill="#374151" font-family="Arial">Pt</text></svg>`,
        'WTI': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1F2937"/><path d="M32 12 C28 20,22 28,22 36 C22 42,26 48,32 48 C38 48,42 42,42 36 C42 28,36 20,32 12Z" fill="#F59E0B"/><path d="M32 22 C30 26,28 30,28 34 C28 37,30 40,32 40 C34 40,36 37,36 34 C36 30,34 26,32 22Z" fill="#DC2626"/></svg>`,
        'XBR': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#374151"/><path d="M32 12 C28 20,22 28,22 36 C22 42,26 48,32 48 C38 48,42 42,42 36 C42 28,36 20,32 12Z" fill="#F59E0B"/><path d="M32 22 C30 26,28 30,28 34 C28 37,30 40,32 40 C34 40,36 37,36 34 C36 30,34 26,32 22Z" fill="#EF4444"/></svg>`,
        'NG': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0EA5E9"/><path d="M26 44 L32 14 L38 44 Z" fill="#F97316"/><path d="M29 44 L32 24 L35 44 Z" fill="#FBBF24"/></svg>`,
      };
      const svg = commoditySvgs[baseCurrency];
      if (svg) return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    
    return '';
  };

  // Obter assets disponíveis - apenas os pares adicionados como tabs
  const assets = useMemo(() => {
    const pairs = marketService.getPairs();
    // Filtrar apenas os pares que foram adicionados
    return addedPairs
      .map(symbol => pairs.find(p => p.symbol === symbol))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map(p => ({
        symbol: p.symbol,
        label: `${p.symbol} (${p.category.toUpperCase()})`,
        category: p.category,
        imageUrl: getCryptoImageUrl(p.symbol)
      }));
  }, [addedPairs]);

  // Obter todos os pares disponíveis para o modal de adição (excluindo os já adicionados)
  const availablePairsToAdd = useMemo(() => {
    const pairs = marketService.getPairs();
    return pairs
      .filter(p => {
        // Filtrar por mercado
        if (selectedMarket !== 'all') {
          const marketMap: Record<string, string> = {
            'forex': 'forex',
            'crypto': 'crypto',
            'stocks': 'stocks',
            'indices': 'indices',
            'commodities': 'commodities'
          };
          if (p.category !== marketMap[selectedMarket]) {
            return false;
          }
        }
        
        // Filtrar por pesquisa
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          if (!p.symbol.toLowerCase().includes(query)) {
            return false;
          }
        }
        
        return !addedPairs.includes(p.symbol) && p.enabled;
      })
      .map(p => ({
        symbol: p.symbol,
        label: `${p.symbol} (${p.category.toUpperCase()})`,
        category: p.category,
        currentPrice: p.currentPrice,
        payout: p.payout
      }));
  }, [addedPairs, selectedMarket, searchQuery]);

  // Calcular lucro baseado no payout do par (prioridade: trading_config > marketService > padrão)
  const configPayout = tradingConfigs.get(selectedAsset)?.payout_percentage;
  const profitPercent = configPayout || pair?.payout || 88;
  const profit = Math.round(tradeValue * (profitPercent / 100));

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Top Bar - Modelo da Referência */}
      <div className={`absolute top-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-sm border-b border-gray-900/50 px-2 py-2 md:px-4 md:py-3.5 ${isMobile && isLandscape ? 'py-1' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
            {/* Logo - esconde no landscape mobile para dar mais espaço */}
            {brokerLogo && (
              <div className={`flex items-center space-x-2 flex-shrink-0 ${isMobile && isLandscape ? 'hidden' : ''}`}>
                <img 
                  src={brokerLogo} 
                  alt={brokerName}
                  className="h-8 md:h-12 w-auto object-contain"
                />
              </div>
            )}

            {/* Asset Tabs - Cards Melhorados com Efeito 3D */}
            <div className="flex items-center space-x-2 overflow-x-auto overflow-y-visible pb-2">
              {assets.map((asset) => {
                // Verificar se há trade ativo neste ativo
                const assetActiveTrade = localActiveTrades.find(
                  t => t.symbol === asset.symbol && !t.result && t.expiration > Date.now()
                );
                // Verificar se há resultado recente neste ativo
                const assetResult = tradeResults[asset.symbol];
                const hasResult = assetResult && (Date.now() - assetResult.timestamp < 30000); // Mostrar por 30s
                
                return (
                <div
                  key={asset.symbol}
                  className="relative group flex-shrink-0"
                >
                  <div
                    onClick={() => {
                      setSelectedAsset(asset.symbol);
                      // Limpar resultado ao clicar no card
                      if (tradeResults[asset.symbol]) {
                        setTradeResults(prev => {
                          const updated = { ...prev };
                          delete updated[asset.symbol];
                          return updated;
                        });
                      }
                    }}
                    className={`relative text-xs rounded transition-all duration-300 flex items-center space-x-2 cursor-pointer ${
                      hasResult
                        ? 'border-0'
                        : assetActiveTrade
                          ? 'border-0'
                          : `border border-gray-800/50 ${selectedAsset === asset.symbol
                              ? 'bg-gray-800/60 text-white'
                              : 'bg-gray-800/60 text-gray-300 hover:bg-gray-900 hover:text-white'
                            }`
                    }`}
                    style={{
                      width: '135px',
                      height: '47px',
                      padding: '0 8px',
                      ...(hasResult ? {
                        background: assetResult.result === 'win'
                          ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.25) 0%, rgba(6, 30, 15, 0.6) 100%)'
                          : 'linear-gradient(to bottom, rgba(239, 68, 68, 0.25) 0%, rgba(40, 8, 8, 0.6) 100%)',
                        boxShadow: assetResult.result === 'win'
                          ? '0 4px 16px rgba(34, 197, 94, 0.2)'
                          : '0 4px 16px rgba(239, 68, 68, 0.2)',
                      } : assetActiveTrade ? (() => {
                        // Calcular P&L em tempo real para determinar cor do gradiente
                        const livePrice = asset.symbol === selectedAsset 
                          ? (currentPrice || marketService.getPair(asset.symbol)?.currentPrice || 0) 
                          : (marketService.getPair(asset.symbol)?.currentPrice || 0);
                        const isWinning = assetActiveTrade.type === 'call' 
                          ? livePrice > assetActiveTrade.entryPrice 
                          : livePrice < assetActiveTrade.entryPrice;
                        const isNeutral = livePrice === assetActiveTrade.entryPrice || livePrice === 0;
                        return {
                          background: isNeutral 
                            ? 'linear-gradient(to bottom, rgba(59, 130, 246, 0.2) 0%, rgba(17, 24, 39, 0.7) 100%)'
                            : isWinning
                              ? 'linear-gradient(to bottom, rgba(34, 197, 94, 0.2) 0%, rgba(6, 30, 15, 0.5) 100%)'
                              : 'linear-gradient(to bottom, rgba(239, 68, 68, 0.2) 0%, rgba(40, 8, 8, 0.5) 100%)',
                          boxShadow: isNeutral
                            ? '0 2px 8px rgba(59, 130, 246, 0.15)'
                            : isWinning
                              ? '0 2px 8px rgba(34, 197, 94, 0.15)'
                              : '0 2px 8px rgba(239, 68, 68, 0.15)',
                        };
                      })() : {
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                      }),
                      borderBottom: selectedAsset === asset.symbol ? '2px solid #3b82f6' : '2px solid transparent'
                    }}
                  >
                    {/* Ícone/Timer/Resultado do par */}
                    <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
                      {(() => {
                        // PRIORIDADE 1: Trade ativo → Mostrar timer circular
                        if (assetActiveTrade) {
                          const now = Date.now();
                          const totalDuration = assetActiveTrade.expiration - new Date(assetActiveTrade.createdAt).getTime();
                          const remaining = Math.max(0, assetActiveTrade.expiration - now);
                          const progress = totalDuration > 0 ? 1 - (remaining / totalDuration) : 1;
                          const remainingSec = Math.ceil(remaining / 1000);
                          const minutes = Math.floor(remainingSec / 60);
                          const seconds = remainingSec % 60;
                          const timeText = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}`;
                          const circumference = 2 * Math.PI * 10;
                          const strokeDashoffset = circumference * (1 - progress);
                          const isCall = assetActiveTrade.type === 'call';
                          const color = isCall ? '#22c55e' : '#ef4444';
                          
                          return (
                            <div className="relative w-7 h-7 flex items-center justify-center">
                              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                                <circle cx="14" cy="14" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                                <circle 
                                  cx="14" cy="14" r="10" fill="none" 
                                  stroke={color} strokeWidth="2.5"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                                />
                              </svg>
                              <span className="absolute text-[7px] font-bold text-white">{timeText}</span>
                            </div>
                          );
                        }
                        
                        // PRIORIDADE 2: Resultado recente → Mostrar imagem do ativo normalmente
                        if (hasResult) {
                          // Não mostrar ícone especial, deixar a imagem do ativo
                        }
                        
                        // PADRÃO: Imagem do ativo
                        const imageUrl = asset.imageUrl || getCryptoImageUrl(asset.symbol);
                        if (!imageUrl) {
                          return (
                            <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-white text-[8px] font-bold">
                              {asset.symbol.split('/')[0].charAt(0)}
                            </div>
                          );
                        }
                        return (
                          <img
                            src={imageUrl}
                            alt={asset.symbol}
                            className="w-4 h-4 object-contain rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.fallback-icon')) {
                                const fallback = document.createElement('div');
                                fallback.className = 'fallback-icon w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center text-white text-[8px] font-bold';
                                fallback.textContent = asset.symbol.split('/')[0].charAt(0);
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                    
                    <div className="text-left flex-1 min-w-0 overflow-hidden">
                      {/* Se tem resultado finalizado */}
                      {hasResult ? (
                        <>
                          <div className="font-semibold text-[11px] truncate">{asset.symbol}</div>
                          <div className={`text-[9px] font-bold truncate ${assetResult.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                            {assetResult.profit >= 0 ? '+' : '-'}R$ {Math.abs(assetResult.profit).toFixed(2)}
                          </div>
                        </>
                      ) : assetActiveTrade ? (() => {
                        // P&L em tempo real durante operação
                        const livePrice = asset.symbol === selectedAsset 
                          ? (currentPrice || marketService.getPair(asset.symbol)?.currentPrice || 0) 
                          : (marketService.getPair(asset.symbol)?.currentPrice || 0);
                        const payoutPct = 0.88;
                        const isWinning = assetActiveTrade.type === 'call' 
                          ? livePrice > assetActiveTrade.entryPrice 
                          : livePrice < assetActiveTrade.entryPrice;
                        const isNeutral = livePrice === assetActiveTrade.entryPrice || livePrice === 0;
                        const livePnl = isNeutral ? 0 : (isWinning ? assetActiveTrade.amount * payoutPct : -assetActiveTrade.amount);
                        
                        return (
                          <>
                            <div className="font-semibold text-[11px] truncate">{asset.symbol}</div>
                            <div className={`text-[9px] font-bold truncate ${
                              isNeutral ? 'text-gray-400' : isWinning ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {isNeutral ? 'R$ 0.00' : `${livePnl >= 0 ? '+' : '-'}R$ ${Math.abs(livePnl).toFixed(2)}`}
                            </div>
                          </>
                        );
                      })() : (
                        <>
                          <div className="font-semibold text-[11px] truncate">{asset.symbol}</div>
                          <div className="text-[8px] opacity-80 truncate">
                            {(() => {
                              const p = marketService.getPair(asset.symbol);
                              const cat = p?.category || 'crypto';
                              const catLabels: Record<string, string> = { crypto: 'Cripto', forex: 'Forex', stocks: 'Ações', indices: 'Índices', commodities: 'Commodities' };
                              const label = catLabels[cat] || cat;
                              if (selectedAsset === asset.symbol && marketStatus?.isOTC) {
                                return <>{label} <span className="text-amber-400 font-bold">OTC</span></>;
                              }
                              return label;
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Botão de fechar - dentro do card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (addedPairs.length > 1) {
                          const newPairs = addedPairs.filter(p => p !== asset.symbol);
                          setAddedPairs(newPairs);
                          if (selectedAsset === asset.symbol) {
                            setSelectedAsset(newPairs[0] || 'BTC/USD');
                          }
                        } else {
                          toast.error('Você precisa ter pelo menos um par adicionado');
                        }
                      }}
                      className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 hover:text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                );
              })}
              
              {/* Botão de adicionar par */}
              <div className="relative flex-shrink-0" data-add-pair-button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddPairModal(!showAddPairModal);
                  }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-all duration-200 border border-gray-700/50 hover:border-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
                
                {/* Modal de seleção de pares - Design igual ao modal de timeframes */}
                {showAddPairModal && (
                  <>
                    {/* Overlay */}
                    <div 
                      className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm" 
                      onClick={() => setShowAddPairModal(false)}
                    />
                    {/* Modal - Design igual ao timeframe */}
                    <div 
                      className="fixed left-0 md:left-4 top-20 bg-black backdrop-blur-xl shadow-2xl z-[60] overflow-hidden w-full md:w-[720px] max-h-[80vh] animate-[fadeIn_0.2s_ease-out_forwards] border border-gray-800/50 rounded mx-2 md:mx-0" 
                      data-add-pair-modal
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        top: '60px'
                      }}
                    >
                      {/* Campo de pesquisa */}
                      <div className="px-4 py-3 border-b border-gray-700/50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Pesquisar por nome..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                          />
                        </div>
                      </div>
                      
                      {/* Layout: Coluna de mercados + Lista de pares */}
                      <div className="flex">
                        {/* Coluna de seleção de mercados (lado esquerdo) */}
                        <div className="w-[170px] border-r border-gray-700/50 bg-gray-800/30">
                          <div className="py-2">
                            {(['all', 'crypto', 'forex', 'stocks', 'indices', 'commodities'] as const).map((market, idx) => {
                              const marketConfig: Record<string, { label: string; icon: React.ReactNode }> = {
                                'all': { label: 'Todos', icon: <LayoutGrid className="w-4 h-4" /> },
                                'crypto': { label: 'Cripto', icon: <Bitcoin className="w-4 h-4" /> },
                                'forex': { label: 'Forex', icon: <DollarSign className="w-4 h-4" /> },
                                'stocks': { label: 'Ações', icon: <Landmark className="w-4 h-4" /> },
                                'indices': { label: 'Índices', icon: <BarChart3 className="w-4 h-4" /> },
                                'commodities': { label: 'Commodities', icon: <Droplets className="w-4 h-4" /> },
                              };
                              const config = marketConfig[market];
                              
                              return (
                                <React.Fragment key={market}>
                                  <button
                                    onClick={() => setSelectedMarket(market)}
                                    className={`w-full text-left px-3 py-2.5 text-xs text-white transition-colors flex items-center space-x-2.5 ${
                                      selectedMarket === market
                                        ? 'bg-gray-700/60'
                                        : 'hover:bg-gray-800/50'
                                    }`}
                                  >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      selectedMarket === market
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-gray-700/60 text-gray-400'
                                    }`}>
                                      {config.icon}
                                    </div>
                                    <span className="font-medium">{config.label}</span>
                                  </button>
                                  {idx < 5 && <div className="h-px bg-gray-700/30"></div>}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Lista de pares (lado direito) */}
                        <div className="flex-1 py-2 max-h-[calc(80vh-120px)] overflow-y-auto custom-scrollbar">
                          {availablePairsToAdd.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-400 text-sm">
                              {searchQuery.trim() 
                                ? 'Nenhum par encontrado para a pesquisa'
                                : selectedMarket !== 'all'
                                  ? 'Nenhum par disponível neste mercado'
                                  : 'Todos os pares já foram adicionados'}
                            </div>
                          ) : (
                            <div className="space-y-0">
                              {availablePairsToAdd.map((pair, idx) => {
                                const pairImageUrl = getCryptoImageUrl(pair.symbol);
                                const pairData = marketService.getPair(pair.symbol);
                                // Buscar payout da tabela trading_config (já carregado no estado)
                                const tradingConfig = tradingConfigs.get(pair.symbol);
                                // Preço atual do par (valores em tempo real da API ou estáticos do marketService)
                                // Todos os pares usam USD como moeda base (BTC/USD, ETH/USD, etc.)
                                const displayPrice = realTimePrices[pair.symbol] || pairData?.currentPrice || pair.currentPrice || 0;
                                const displayPayout = tradingConfig?.payout_percentage || pairData?.payout || pair.payout || 88;
                                
                                return (
                                  <React.Fragment key={pair.symbol}>
                                    <button
                                      onClick={() => {
                                        setAddedPairs([...addedPairs, pair.symbol]);
                                        setSelectedAsset(pair.symbol);
                                        setShowAddPairModal(false);
                                        setSearchQuery('');
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors grid grid-cols-12 gap-2 items-center"
                                    >
                                      {/* Coluna 1-6: Par com imagem */}
                                      <div className="col-span-6 flex items-center space-x-2">
                                        {/* Imagem do par */}
                                        <div className="w-6 h-6 flex-shrink-0 relative">
                                          {(() => {
                                            if (!pairImageUrl) {
                                              return (
                                                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                                                  {pair.symbol.split('/')[0].charAt(0)}
                                                </div>
                                              );
                                            }
                                            return (
                                              <img
                                                src={pairImageUrl}
                                                alt={pair.symbol}
                                                className="w-full h-full object-contain rounded-full"
                                                onError={(e) => {
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const parent = target.parentElement;
                                                  if (parent && !parent.querySelector('.fallback-icon')) {
                                                    const fallback = document.createElement('div');
                                                    fallback.className = 'fallback-icon w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold';
                                                    fallback.textContent = pair.symbol.split('/')[0].charAt(0);
                                                    parent.appendChild(fallback);
                                                  }
                                                }}
                                              />
                                            );
                                          })()}
                                        </div>
                                        <div>
                                          <div className="font-medium text-xs">{pair.symbol}</div>
                                          <div className="text-[10px] text-gray-500">{pair.category === 'crypto' ? 'Cripto' : pair.category.toUpperCase()}</div>
                                        </div>
                                      </div>
                                      
                                      {/* Coluna 7-9: Preço (em USD) */}
                                      <div className="col-span-3 text-right">
                                        <div className="text-xs font-medium text-white">
                                          ${displayPrice.toLocaleString('pt-BR', { 
                                            minimumFractionDigits: displayPrice < 1 ? 6 : 2,
                                            maximumFractionDigits: displayPrice < 1 ? 6 : 2
                                          })}
                                        </div>
                                      </div>
                                      
                                      {/* Coluna 10-12: Lucro */}
                                      <div className="col-span-3 text-right flex items-center justify-end space-x-2">
                                        <div className="text-xs font-bold text-green-400">
                                          {displayPayout}%
                                        </div>
                                        <Plus className="w-3.5 h-3.5 text-gray-500" />
                                      </div>
                                    </button>
                                    {idx < availablePairsToAdd.length - 1 && <div className="h-px bg-gray-700/30"></div>}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* User Info - Modelo da Referência */}
          <div className="flex items-center space-x-3">
            {/* Avatar clicável com seta dropdown */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative flex-shrink-0 flex items-center space-x-1"
            >
              <div className="relative">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-gray-300" />
                  </div>
                )}
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-black">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
            {/* Seletor Conta Demo / Real + Saldo */}
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 leading-none">
                    {accountType === 'demo' ? 'Conta Demo' : 'Conta Real'}
                  </div>
                  <div className={`text-lg font-bold leading-tight ${accountType === 'demo' ? 'text-blue-400' : 'text-green-400'}`}>
                    R$ {activeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAccountDropdown && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountDropdown(false)} />
                <div className="absolute top-full right-0 mt-1.5 w-52 bg-black border border-gray-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={() => { switchAccount('demo'); setShowAccountDropdown(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      accountType === 'demo' ? 'bg-blue-500/10' : 'hover:bg-gray-900'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${accountType === 'demo' ? 'text-blue-400' : 'text-gray-300'}`}>Conta Demo</div>
                      <div className="text-xs text-gray-500">
                        R$ {(user?.demoBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {accountType === 'demo' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                  </button>
                  <div className="border-t border-gray-800" />
                  <button
                    onClick={() => { switchAccount('real'); setShowAccountDropdown(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      accountType === 'real' ? 'bg-green-500/10' : 'hover:bg-gray-900'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${accountType === 'real' ? 'text-green-400' : 'text-gray-300'}`}>Conta Real</div>
                      <div className="text-xs text-gray-500">
                        R$ {(user?.balance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {accountType === 'real' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  </button>
                </div>
                </>
              )}
            </div>
            <button 
              onClick={() => setShowDepositModal(true)}
              className="border border-green-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-500/10 transition-colors"
            >
              Depositar
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen pt-12 md:pt-14 pb-0 md:pb-12">
        {/* Sidebar - Compacto com ícones modernos */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-20'} bg-black border-r border-gray-900 transition-all duration-300 hidden md:flex flex-col pt-6`} style={{ boxShadow: '2px 0 8px rgba(0, 0, 0, 0.5)' }}>
          {!sidebarCollapsed && (
            <div className="flex-1 py-3 space-y-6 overflow-hidden">
              {/* Navegação - Ícones com títulos abaixo */}
              <div className="space-y-4">
                <button 
                  onClick={() => {
                    if (showBottomTab) {
                      setShowBottomTab(false);
                    } else {
                      setShowBottomTab(true);
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group ${showBottomTab ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <Briefcase className={`w-5 h-5 ${showBottomTab ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${showBottomTab ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>PORTFÓLIO<br/>TOTAL</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'history') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('history');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group ${leftPanelOpen === 'history' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <History className={`w-5 h-5 ${leftPanelOpen === 'history' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'history' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>HISTÓRICO<br/>TRADING</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'chat') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('chat');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group relative ${leftPanelOpen === 'chat' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <MessageSquare className={`w-5 h-5 ${leftPanelOpen === 'chat' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'chat' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>CHATS E<br/>SUPORTE</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'leaders') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('leaders');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group relative ${leftPanelOpen === 'leaders' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <Trophy className={`w-5 h-5 ${leftPanelOpen === 'leaders' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'leaders' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>TABELA<br/>LÍDERES</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'promotion') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('promotion');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group relative ${leftPanelOpen === 'promotion' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <Megaphone className={`w-5 h-5 ${leftPanelOpen === 'promotion' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'promotion' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>PROMOÇÃO</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'analysis') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('analysis');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group relative ${leftPanelOpen === 'analysis' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <BarChart3 className={`w-5 h-5 ${leftPanelOpen === 'analysis' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'analysis' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>ANÁLISE<br/>MERCADO</span>
                </button>
                <button 
                  onClick={() => {
                    if (leftPanelOpen === 'more') {
                      setLeftPanelOpen(null);
                      setLeftPanelWidth(0);
                    } else {
                      setLeftPanelOpen('more');
                      setLeftPanelWidth(300);
                      setShowBottomTab(false);
                      setShowTimeframes(false);
                      setShowTools(false);
                      setShowIndicators(false);
                      setShowPeriod(false);
                      setShowChartTypeMenu(false);
                    }
                  }}
                  className={`w-full flex flex-col items-center space-y-1 px-2 py-2 rounded group ${leftPanelOpen === 'more' ? 'bg-gray-800' : 'hover:bg-gray-900'}`} 
                  style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
                >
                  <MoreHorizontal className={`w-5 h-5 ${leftPanelOpen === 'more' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${leftPanelOpen === 'more' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>MAIS</span>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Main Chart Area - Ocupa todo o espaço restante */}
        <div className="flex-1 flex flex-col relative min-h-0">
          {/* Painel Lateral Esquerdo - Empurra tudo (header, gráfico, etc) */}
          {leftPanelOpen && (
            <div 
              className="bg-black border-r border-gray-800 transition-all duration-300 overflow-hidden flex-shrink-0"
              style={{ width: leftPanelWidth > 0 ? `${leftPanelWidth}px` : '0px', minWidth: leftPanelWidth > 0 ? `${leftPanelWidth}px` : '0px', position: 'absolute', top: '1.5rem', left: 0, bottom: '2.5rem', zIndex: 50 }}
            >
                  {leftPanelOpen === 'history' && (
                    <TradeHistory onClose={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }} />
                  )}
              {leftPanelOpen === 'chat' && (
                <ChatSupport onClose={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }} />
              )}
              {leftPanelOpen === 'leaders' && (
                <Leaderboard onClose={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }} />
              )}
              {leftPanelOpen === 'promotion' && (
                <Promotions onClose={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }} />
              )}
              {leftPanelOpen === 'analysis' && (
                <MarketAnalysis onClose={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }} />
              )}
              {leftPanelOpen === 'more' && (
                <div className="h-full flex flex-col bg-black">
                  <div className="px-4 py-2.5 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-700/30" style={{ paddingTop: '1.5rem' }}>
                    <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Mais</div>
                    <button 
                      onClick={() => { setLeftPanelOpen(null); setLeftPanelWidth(0); }}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="p-3 flex-1 bg-black">
                    <div className="text-center text-xs text-gray-400 py-4">Conteúdo de Mais Opções</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chart Header - Compacto e sobrepondo */}
          <div className="absolute left-0 right-0 z-20 bg-transparent px-4 py-2 pointer-events-none" style={{ left: leftPanelOpen && leftPanelWidth > 0 ? `${leftPanelWidth}px` : '0', transition: 'left 0.3s', top: '1.5rem' }}>
            {/* Primeira linha: Ícone, Título e Botões */}
            <div className="flex items-center justify-between mb-2 pointer-events-auto">
              <div className="flex items-center space-x-3">
                {/* Ícone do par */}
                <div className="w-6 h-6 flex-shrink-0 relative">
                  {(() => {
                    const imageUrl = getCryptoImageUrl(selectedAsset);
                    if (!imageUrl) {
                      return (
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {selectedAsset.split('/')[0].charAt(0)}
                        </div>
                      );
                    }
                    return (
                      <img
                        src={imageUrl}
                        alt={selectedAsset}
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.fallback-icon')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'fallback-icon w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold';
                            fallback.textContent = selectedAsset.split('/')[0].charAt(0);
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    );
                  })()}
                </div>
                
                <h2 className="text-base font-semibold">{selectedAsset}</h2>
                {marketStatus?.isOTC && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    OTC
                  </span>
                )}
                
                {/* Botões: Info, Alerta (Bell) e Estrela (Favoritos) */}
                <div className="flex items-center space-x-1">
                  <button className="p-1 text-gray-400 hover:text-white transition-colors" title="Informações">
                    <Info className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-white transition-colors" title="Alertas">
                    <Bell className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`p-1 transition-colors ${isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
                    title="Adicionar aos favoritos"
                  >
                    <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Indicador de Sentimento do Mercado - Chevrons */}
              {!showBottomTab && (
              <div 
                className="relative flex flex-col items-center pointer-events-auto"
                style={{ width: '36px' }}
                onMouseEnter={() => setShowSentimentTooltip(true)}
                onMouseLeave={() => setShowSentimentTooltip(false)}
              >
                {/* Label Compradores */}
                <div className="flex flex-col items-center mb-1">
                  <span className="text-[7px] font-semibold uppercase tracking-wider text-gray-500">COMPRAR</span>
                  <span className="text-[13px] font-bold text-white">{marketSentiment.buyPercent}%</span>
                </div>
                
                {/* Chevrons Container */}
                <div className="flex flex-col items-center" style={{ gap: '3px' }}>
                  {/* Chevrons verdes (compra) - quantidade proporcional */}
                  {Array.from({ length: Math.round(marketSentiment.buyPercent / 10) }).map((_, i, arr) => {
                    const opacity = 0.3 + (0.7 * (1 - i / arr.length));
                    return (
                      <svg key={`buy-${i}`} width="18" height="11" viewBox="0 0 18 11" style={{ opacity, transition: 'opacity 1.5s ease' }}>
                        <path d="M1 10 L9 2 L17 10" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    );
                  })}
                  
                  {/* Separador central tracejado */}
                  <div className="flex flex-col items-center" style={{ gap: '3px', margin: '3px 0' }}>
                    {[0, 1].map(i => (
                      <div key={`dash-${i}`} style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    ))}
                  </div>
                  
                  {/* Chevrons vermelhos (venda) - quantidade proporcional */}
                  {Array.from({ length: Math.round(marketSentiment.sellPercent / 10) }).map((_, i, arr) => {
                    const opacity = 0.3 + (0.7 * (i / (arr.length - 1 || 1)));
                    return (
                      <svg key={`sell-${i}`} width="18" height="11" viewBox="0 0 18 11" style={{ opacity, transition: 'opacity 1.5s ease' }}>
                        <path d="M1 1 L9 9 L17 1" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    );
                  })}
                </div>
                
                {/* Label Vendedores */}
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[13px] font-bold text-white">{marketSentiment.sellPercent}%</span>
                  <span className="text-[7px] font-semibold uppercase tracking-wider text-gray-500">VENDER</span>
                </div>
                
                {/* Tooltip Explicativo */}
                {showSentimentTooltip && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-56 bg-black border border-gray-800/60 shadow-2xl p-3 z-[60] rounded pointer-events-auto" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                    <div className="text-[11px] font-semibold text-white mb-1">Humor dos Traders</div>
                    <div className="text-[10px] text-gray-500 leading-relaxed">
                      Proporção de traders posicionados em alta vs baixa neste ativo.
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800/50">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px] text-green-400 font-medium">{marketSentiment.buyPercent}%</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[10px] text-red-400 font-medium">{marketSentiment.sellPercent}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}
          </div>

          {/* Botões de Ferramentas - Container separado, limitado apenas à área dos botões */}
          <div className="absolute left-4 z-20 pointer-events-none" style={{ left: leftPanelOpen && leftPanelWidth > 0 ? `calc(1rem + ${leftPanelWidth}px)` : '1rem', bottom: showBottomTab ? 'calc(3rem + 25vh)' : '3rem', transition: 'left 0.3s, bottom 0.3s ease-in-out' }}>
            <div className="flex flex-col items-start space-y-2 pointer-events-auto">
              {/* 1. Botão de Tipo de Gráfico */}
              <div className="relative" data-controls-panel>
                <button
                  onClick={() => { 
                    setShowChartTypeMenu(!showChartTypeMenu); 
                    setShowTimeframes(false); 
                    setShowTools(false); 
                    setShowIndicators(false); 
                    setShowPeriod(false); 
                    setLeftPanelOpen(null);
                    setLeftPanelWidth(0);
                    setShowBottomTab(false);
                  }}
                  className={`p-2 bg-black backdrop-blur-sm hover:bg-gray-900 text-white transition-all duration-200 flex items-center justify-center relative group`}
                  style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)' }}
                  title="Tipo de Gráfico"
                >
                  <ChartCandlestick className="w-4 h-4" />
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#111827] border border-gray-700/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[70]">
                    Tipo de Gráfico
                  </span>
                </button>
                {/* Dropdown normal como outros botões */}
                {showChartTypeMenu && (
                  <div className="absolute left-full bottom-0 ml-2 bg-black backdrop-blur-xl shadow-2xl z-[60] w-full md:w-[720px] max-h-[70vh] overflow-hidden flex flex-col border border-gray-800/50 rounded">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-black flex-shrink-0 border-b border-gray-700/30">
                      <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">TIPO DE GRÁFICO</div>
                    </div>
                    
                    {/* Conteúdo: Dois painéis lado a lado */}
                    <div className="flex overflow-hidden flex-1 min-h-0">
                      {/* Painel Esquerdo: Lista de Tipos de Gráfico */}
                      <div className="w-1/2 border-r border-gray-700/50 flex flex-col overflow-hidden">
                        <div className="flex flex-col flex-shrink-0">
                          {/* Linha */}
                          <button
                            onClick={() => { setChartType('line'); setShowColorPicker(false); setShowChartTypeMenu(false); }}
                            className={`flex-1 flex items-center space-x-3 px-3 py-3 text-xs text-white transition-colors ${
                              chartType === 'line' ? 'bg-gray-700/50' : 'hover:bg-gray-800/50'
                            }`}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                              <path d="M2 10 L8 6 L12 8 L18 4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Linha</span>
                          </button>
                          <div className="h-px bg-gray-700/30"></div>
                          
                          {/* Velas */}
                          <button
                            onClick={() => { setChartType('candlestick'); setShowColorPicker(true); setShowChartTypeMenu(false); }}
                            className={`flex-1 flex items-center space-x-3 px-3 py-3 text-xs text-white transition-colors ${
                              chartType === 'candlestick' ? 'bg-gray-700/50' : 'hover:bg-gray-800/50'
                            }`}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                              {/* Candlestick verde */}
                              <rect x="2" y="6" width="2.5" height="4" fill="#22c55e" />
                              <line x1="3.25" y1="4" x2="3.25" y2="6" stroke="#22c55e" strokeWidth="1.5" />
                              <line x1="3.25" y1="10" x2="3.25" y2="12" stroke="#22c55e" strokeWidth="1.5" />
                              {/* Candlestick vermelho */}
                              <rect x="8" y="8" width="2.5" height="2" fill="#f87171" />
                              <line x1="9.25" y1="6" x2="9.25" y2="8" stroke="#f87171" strokeWidth="1.5" />
                              <line x1="9.25" y1="10" x2="9.25" y2="12" stroke="#f87171" strokeWidth="1.5" />
                            </svg>
                            <span>Velas</span>
                          </button>
                          <div className="h-px bg-gray-700/30"></div>
                          
                          {/* Barras */}
                          <button
                            onClick={() => { setChartType('bar'); setShowColorPicker(true); setShowChartTypeMenu(false); }}
                            className={`flex-1 flex items-center space-x-3 px-3 py-3 text-xs text-white transition-colors ${
                              chartType === 'bar' ? 'bg-gray-700/50' : 'hover:bg-gray-800/50'
                            }`}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                              {/* Barra verde */}
                              <rect x="2" y="8" width="3" height="4" fill="#22c55e" />
                              {/* Barra vermelha */}
                              <rect x="7" y="10" width="3" height="2" fill="#f87171" />
                            </svg>
                            <span>Barras</span>
                          </button>
                          <div className="h-px bg-gray-700/30"></div>
                          
                          {/* Heikin-Ashi */}
                          <button
                            onClick={() => { setChartType('heikin-ashi'); setShowColorPicker(true); setShowChartTypeMenu(false); }}
                            className={`flex-1 flex items-center space-x-3 px-3 py-3 text-xs text-white transition-colors ${
                              chartType === 'heikin-ashi' ? 'bg-gray-700/50' : 'hover:bg-gray-800/50'
                            }`}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                              {/* Heikin-Ashi vermelho */}
                              <rect x="2" y="7" width="2.5" height="3" fill="#ef4444" />
                              <line x1="3.25" y1="5" x2="3.25" y2="7" stroke="#ef4444" strokeWidth="1.5" />
                              <line x1="3.25" y1="10" x2="3.25" y2="12" stroke="#ef4444" strokeWidth="1.5" />
                              {/* Heikin-Ashi azul */}
                              <rect x="8" y="9" width="2.5" height="1" fill="#3b82f6" />
                              <line x1="9.25" y1="7" x2="9.25" y2="9" stroke="#3b82f6" strokeWidth="1.5" />
                              <line x1="9.25" y1="10" x2="9.25" y2="13" stroke="#3b82f6" strokeWidth="1.5" />
                            </svg>
                            <span>Heikin-Ashi</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* Painel Direito: Ajustes de Exibição */}
                      <div className="w-1/2 p-4 overflow-y-auto overflow-x-visible custom-scrollbar">
                        {/* Header Ajustes de exibição */}
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-white mb-3">Ajustes de exibição</div>
                          
                          {/* Configuração para LINHA */}
                          {chartType === 'line' && (
                            <>
                              {/* Previews dos gráficos - Linha */}
                              <div className="flex space-x-2 mb-4">
                                {/* Preview Linha com área preenchida (sombra) */}
                                <div 
                                  onClick={() => setLineWithShadow(true)}
                                  className={`flex-1 p-2 border-2 rounded cursor-pointer transition-colors ${lineWithShadow ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'}`}
                                >
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    <path d="M5 30 L20 20 L35 25 L50 15 L65 18 L80 10 L95 12 L95 40 L5 40 Z" fill={lineColor} fillOpacity="0.3" />
                                    <path d="M5 30 L20 20 L35 25 L50 15 L65 18 L80 10 L95 12" stroke={lineColor} strokeWidth="2" fill="none" />
                                  </svg>
                                </div>
                                
                                {/* Preview Linha simples (sem sombra) */}
                                <div 
                                  onClick={() => setLineWithShadow(false)}
                                  className={`flex-1 p-2 border-2 rounded cursor-pointer transition-colors ${!lineWithShadow ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'}`}
                                >
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    <path d="M5 30 L20 20 L35 25 L50 15 L65 18 L80 10 L95 12" stroke={lineColor} strokeWidth="2" fill="none" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Seletores de estilo para linha */}
                              <div className="space-y-3">
                                {/* Seletor de Cor da Linha */}
                                <div className="relative" data-line-color-picker>
                                  <div 
                                    className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowLineColorPicker(!showLineColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: lineColor === 'transparent' ? 'transparent' : lineColor,
                                          backgroundImage: lineColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor da linha</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showLineColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setLineColor(color);
                                              setShowLineColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              lineColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Seletor de Estilo da Linha */}
                                <div className="relative" data-line-style-dropdown>
                                  <button
                                    data-line-style-button
                                    onClick={() => setShowLineStyleDropdown(!showLineStyleDropdown)}
                                    className="w-full flex items-center space-x-3 p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                  >
                                    <div className="w-6 h-1" style={{
                                      backgroundColor: lineStyle === 'solid' ? '#9ca3af' : 'transparent',
                                      backgroundImage: lineStyle === 'dashed' ? 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 3px, transparent 3px, transparent 6px)' :
                                                       lineStyle === 'dotted' ? 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 1px, transparent 1px, transparent 3px)' : 'none'
                                    }}></div>
                                    <ChevronDown className="w-4 h-4 text-gray-400 transition-colors" />
                                    <span className="text-xs text-gray-300 flex-1 text-left">Estilo da linha</span>
                                  </button>
                                  {/* Dropdown de estilos - aparece ao clicar, posicionado para não ser cortado */}
                                  {showLineStyleDropdown && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] w-full min-w-[120px]">
                                      <button
                                        onClick={() => {
                                          setLineStyle('solid');
                                          setShowLineStyleDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors whitespace-nowrap"
                                      >
                                        Sólida
                                      </button>
                                      <div className="h-px bg-gray-700/30"></div>
                                      <button
                                        onClick={() => {
                                          setLineStyle('dashed');
                                          setShowLineStyleDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors whitespace-nowrap"
                                      >
                                        Tracejada
                                      </button>
                                      <div className="h-px bg-gray-700/30"></div>
                                      <button
                                        onClick={() => {
                                          setLineStyle('dotted');
                                          setShowLineStyleDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors whitespace-nowrap"
                                      >
                                        Pontilhada
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          
                          {/* Configuração para VELAS */}
                          {chartType === 'candlestick' && (
                            <>
                              {/* Previews dos gráficos - Velas */}
                              <div className="flex space-x-2 mb-4">
                                {/* Preview Candlestick */}
                                <div className="flex-1 p-2 border-2 border-blue-500 rounded cursor-pointer">
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    <rect x="10" y="15" width="4" height="10" fill={candleUpColor} />
                                    <line x1="12" y1="10" x2="12" y2="15" stroke={candleUpColor} strokeWidth="1" />
                                    <line x1="12" y1="25" x2="12" y2="30" stroke={candleUpColor} strokeWidth="1" />
                                    <rect x="20" y="20" width="4" height="5" fill={candleDownColor} />
                                    <line x1="22" y1="15" x2="22" y2="20" stroke={candleDownColor} strokeWidth="1" />
                                    <line x1="22" y1="25" x2="22" y2="30" stroke={candleDownColor} strokeWidth="1" />
                                    <rect x="30" y="12" width="4" height="13" fill={candleUpColor} />
                                    <line x1="32" y1="8" x2="32" y2="12" stroke={candleUpColor} strokeWidth="1" />
                                    <line x1="32" y1="25" x2="32" y2="32" stroke={candleUpColor} strokeWidth="1" />
                                    <rect x="40" y="18" width="4" height="7" fill={candleDownColor} />
                                    <line x1="42" y1="12" x2="42" y2="18" stroke={candleDownColor} strokeWidth="1" />
                                    <line x1="42" y1="25" x2="42" y2="30" stroke={candleDownColor} strokeWidth="1" />
                                  </svg>
                                </div>
                                
                                {/* Preview Candlestick Vazio (só borda) */}
                                <div className="flex-1 p-2 border-2 border-gray-700 rounded cursor-pointer">
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    {/* Candles vazios - só borda */}
                                    <rect x="10" y="15" width="4" height="10" fill="none" stroke={candleUpColor} strokeWidth="1.5" />
                                    <line x1="12" y1="10" x2="12" y2="15" stroke={candleUpColor} strokeWidth="1" />
                                    <line x1="12" y1="25" x2="12" y2="30" stroke={candleUpColor} strokeWidth="1" />
                                    <rect x="20" y="20" width="4" height="5" fill="none" stroke={candleDownColor} strokeWidth="1.5" />
                                    <line x1="22" y1="15" x2="22" y2="20" stroke={candleDownColor} strokeWidth="1" />
                                    <line x1="22" y1="25" x2="22" y2="30" stroke={candleDownColor} strokeWidth="1" />
                                    <rect x="30" y="12" width="4" height="13" fill="none" stroke={candleUpColor} strokeWidth="1.5" />
                                    <line x1="32" y1="8" x2="32" y2="12" stroke={candleUpColor} strokeWidth="1" />
                                    <line x1="32" y1="25" x2="32" y2="32" stroke={candleUpColor} strokeWidth="1" />
                                    <rect x="40" y="18" width="4" height="7" fill="none" stroke={candleDownColor} strokeWidth="1.5" />
                                    <line x1="42" y1="12" x2="42" y2="18" stroke={candleDownColor} strokeWidth="1" />
                                    <line x1="42" y1="25" x2="42" y2="30" stroke={candleDownColor} strokeWidth="1" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Seletores de Cor - Design Moderno */}
                              <div className="space-y-3">
                                {/* Seletor de Cor Alta */}
                                <div className="relative" data-candle-up-color-picker>
                                  <div 
                                    className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleUpColorPicker(!showCandleUpColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleUpColor === 'transparent' ? 'transparent' : candleUpColor,
                                          backgroundImage: candleUpColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Alta</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleUpColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleUpColor(color);
                                              setShowCandleUpColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleUpColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Seletor de Cor Baixa */}
                                <div className="relative" data-candle-down-color-picker>
                                  <div 
                                    className="flex items-center space-x-2 p-1.5 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleDownColorPicker(!showCandleDownColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleDownColor === 'transparent' ? 'transparent' : candleDownColor,
                                          backgroundImage: candleDownColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Baixa</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleDownColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleDownColor(color);
                                              setShowCandleDownColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleDownColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          
                          {/* Configuração para BARRAS */}
                          {chartType === 'bar' && (
                            <>
                              {/* Seletores de Cor - Design Moderno */}
                              <div className="space-y-3">
                                {/* Seletor de Cor Alta */}
                                <div className="relative" data-candle-up-color-picker>
                                  <div 
                                    className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleUpColorPicker(!showCandleUpColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleUpColor === 'transparent' ? 'transparent' : candleUpColor,
                                          backgroundImage: candleUpColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Alta</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleUpColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleUpColor(color);
                                              setShowCandleUpColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleUpColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Seletor de Cor Baixa */}
                                <div className="relative" data-candle-down-color-picker>
                                  <div 
                                    className="flex items-center space-x-2 p-1.5 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleDownColorPicker(!showCandleDownColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleDownColor === 'transparent' ? 'transparent' : candleDownColor,
                                          backgroundImage: candleDownColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Baixa</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleDownColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleDownColor(color);
                                              setShowCandleDownColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleDownColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          
                          {/* Configuração para HEIKIN-ASHI */}
                          {chartType === 'heikin-ashi' && (
                            <>
                              {/* Previews dos gráficos - Heikin-Ashi */}
                              <div className="flex space-x-2 mb-4">
                                {/* Preview Candlestick azul/vermelho */}
                                <div className="flex-1 p-2 border-2 border-blue-500 rounded cursor-pointer">
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    <rect x="10" y="15" width="4" height="10" fill="#3b82f6" />
                                    <line x1="12" y1="10" x2="12" y2="15" stroke="#3b82f6" strokeWidth="1" />
                                    <line x1="12" y1="25" x2="12" y2="30" stroke="#3b82f6" strokeWidth="1" />
                                    <rect x="20" y="20" width="4" height="5" fill="#ef4444" />
                                    <line x1="22" y1="15" x2="22" y2="20" stroke="#ef4444" strokeWidth="1" />
                                    <line x1="22" y1="25" x2="22" y2="30" stroke="#ef4444" strokeWidth="1" />
                                    <rect x="30" y="12" width="4" height="13" fill="#3b82f6" />
                                    <line x1="32" y1="8" x2="32" y2="12" stroke="#3b82f6" strokeWidth="1" />
                                    <line x1="32" y1="25" x2="32" y2="32" stroke="#3b82f6" strokeWidth="1" />
                                    <rect x="40" y="18" width="4" height="7" fill="#ef4444" />
                                    <line x1="42" y1="12" x2="42" y2="18" stroke="#ef4444" strokeWidth="1" />
                                    <line x1="42" y1="25" x2="42" y2="30" stroke="#ef4444" strokeWidth="1" />
                                  </svg>
                                </div>
                                
                                {/* Preview Barras */}
                                <div className="flex-1 p-2 border-2 border-gray-700 rounded cursor-pointer">
                                  <svg className="w-full h-12" viewBox="0 0 100 40" preserveAspectRatio="none">
                                    <rect x="10" y="20" width="6" height="10" fill="#3b82f6" />
                                    <rect x="22" y="25" width="6" height="5" fill="#ef4444" />
                                    <rect x="34" y="15" width="6" height="15" fill="#3b82f6" />
                                    <rect x="46" y="22" width="6" height="8" fill="#ef4444" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Seletores de Cor - Design Moderno */}
                              <div className="space-y-3">
                                {/* Seletor de Cor Alta */}
                                <div className="relative" data-candle-up-color-picker>
                                  <div 
                                    className="flex items-center space-x-3 p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleUpColorPicker(!showCandleUpColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleUpColor === 'transparent' ? 'transparent' : candleUpColor,
                                          backgroundImage: candleUpColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Alta</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleUpColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleUpColor(color);
                                              setShowCandleUpColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleUpColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Seletor de Cor Baixa */}
                                <div className="relative" data-candle-down-color-picker>
                                  <div 
                                    className="flex items-center space-x-2 p-1.5 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => setShowCandleDownColorPicker(!showCandleDownColorPicker)}
                                  >
                                    <div className="relative">
                                      <div 
                                        className="w-8 h-8 rounded border-2 border-gray-600 cursor-pointer"
                                        style={{ 
                                          backgroundColor: candleDownColor === 'transparent' ? 'transparent' : candleDownColor,
                                          backgroundImage: candleDownColor === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none',
                                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-300 flex-1">Cor Baixa</span>
                                  </div>
                                  {/* Grade de cores */}
                                  {showCandleDownColorPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/50 rounded shadow-lg z-[70] p-2">
                                      <div className="grid grid-cols-7 gap-1 w-[196px]">
                                        {colorPalette.map((color, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              setCandleDownColor(color);
                                              setShowCandleDownColorPicker(false);
                                            }}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                              candleDownColor === color ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-500'
                                            }`}
                                            style={{
                                              backgroundColor: color === 'transparent' ? 'transparent' : color,
                                              backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 4px 4px' : 'none'
                                            }}
                                            title={color}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Botão de Seleção de Timeframe */}
              <div className="relative" data-controls-panel>
                <button
                  onClick={() => { 
                    setShowTimeframes(!showTimeframes); 
                    setShowChartTypeMenu(false);
                    setShowTools(false);
                    setShowIndicators(false);
                    setShowPeriod(false);
                    setLeftPanelOpen(null);
                    setLeftPanelWidth(0);
                  }}
                  className="p-2 bg-black backdrop-blur-sm hover:bg-gray-900 text-white transition-all duration-200 flex items-center justify-center relative group"
                  style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)' }}
                  title="Período da Vela"
                >
                  <span className="whitespace-nowrap text-xs">{selectedTimeframe}</span>
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#111827] border border-gray-700/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[70]">
                    Período da Vela
                  </span>
                </button>
                {showTimeframes && (
                  <div className="absolute left-full bottom-0 ml-2 bg-black backdrop-blur-xl shadow-2xl z-[60] w-[420px] max-h-[calc(100vh-200px)] overflow-hidden flex flex-col border border-gray-800/50 rounded">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-black flex-shrink-0 border-b border-gray-700/30">
                      <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Período da Vela</div>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1">
                      <div className="grid grid-cols-3 gap-x-3">
                        {/* Coluna 1: Minutos */}
                        <div className="space-y-0">
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Minutos</div>
                          {(['1m', '2m', '5m', '10m', '15m'] as const).map((tf, idx) => (
                            <React.Fragment key={tf}>
                              <button
                                onClick={() => {
                                  setSelectedTimeframe(tf);
                                  setShowTimeframes(false);
                                }}
                                className={`w-full text-left px-2 py-2 text-xs text-white transition-colors ${
                                  selectedTimeframe === tf
                                    ? 'bg-gray-700/50'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                {tf === '1m' ? '1 minuto' :
                                 tf === '2m' ? '2 minutos' :
                                 tf === '5m' ? '5 minutos' :
                                 tf === '10m' ? '10 minutos' :
                                 '15 minutos'}
                              </button>
                              {idx < 4 && <div className="h-px bg-gray-700/30"></div>}
                            </React.Fragment>
                          ))}
                        </div>
                        {/* Coluna 2: Horas */}
                        <div className="space-y-0">
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Horas</div>
                          {(['30m', '1h', '2h', '4h', '8h'] as const).map((tf, idx) => (
                            <React.Fragment key={tf}>
                              <button
                                onClick={() => {
                                  setSelectedTimeframe(tf);
                                  setShowTimeframes(false);
                                }}
                                className={`w-full text-left px-2 py-2 text-xs text-white transition-colors ${
                                  selectedTimeframe === tf
                                    ? 'bg-gray-700/50'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                {tf === '30m' ? '30 minutos' :
                                 tf === '1h' ? '1 hora' :
                                 tf === '2h' ? '2 horas' :
                                 tf === '4h' ? '4 horas' :
                                 '8 horas'}
                              </button>
                              {idx < 4 && <div className="h-px bg-gray-700/30"></div>}
                            </React.Fragment>
                          ))}
                        </div>
                        {/* Coluna 3: Dias+ */}
                        <div className="space-y-0">
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Dias+</div>
                          {(['12h', '1d', '1w', '1M'] as const).map((tf, idx) => (
                            <React.Fragment key={tf}>
                              <button
                                onClick={() => {
                                  setSelectedTimeframe(tf);
                                  setShowTimeframes(false);
                                }}
                                className={`w-full text-left px-2 py-2 text-xs text-white transition-colors ${
                                  selectedTimeframe === tf
                                    ? 'bg-gray-700/50'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                {tf === '12h' ? '12 horas' :
                                 tf === '1d' ? '1 dia' :
                                 tf === '1w' ? '1 semana' :
                                 '1 mês'}
                              </button>
                              {idx < 3 && <div className="h-px bg-gray-700/30"></div>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Botão de Ferramentas */}
              <div className="relative" data-controls-panel>
                <button
                  onClick={() => { setShowTools(!showTools); setShowChartTypeMenu(false); setShowTimeframes(false); setShowIndicators(false); setShowPeriod(false); }}
                  className="p-2 bg-black backdrop-blur-sm hover:bg-gray-900 text-white transition-all duration-200 flex items-center justify-center relative group"
                  style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)' }}
                  title="Ferramentas de Desenho"
                >
                  <PenTool className="w-4 h-4" />
                  {activeTools.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded-full min-w-[14px] text-center">
                      {activeTools.length}
                    </span>
                  )}
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#111827] border border-gray-700/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[70]">
                    Ferramentas de Desenho
                  </span>
                </button>
                {showTools && (
                  <div className="absolute left-full bottom-0 ml-2 bg-black backdrop-blur-xl shadow-2xl z-[60] w-full md:w-[600px] max-h-[calc(100vh-200px)] overflow-hidden flex flex-col border border-gray-800/50 rounded">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-black flex items-center justify-between border-b border-gray-700/30">
                      <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">FERRAMENTAS GRÁFICAS</div>
                      <div className="flex items-center space-x-2">
                        <button className="p-1 hover:bg-gray-800/50 rounded transition-colors">
                          <Eye className="w-3 h-3 text-gray-400" />
                        </button>
                        <button className="p-1 hover:bg-gray-800/50 rounded transition-colors">
                          <Trash2 className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 overflow-hidden">
                      {/* Coluna 1: Lista de ferramentas disponíveis */}
                      <div className="w-1/2 border-r border-gray-700/50 flex flex-col">
                        <div className="p-2 space-y-0 overflow-y-auto flex-1">
                          {[
                            { icon: TrendingUp, label: 'Linha', id: 'line', color: '#ef4444', style: 'solid' as const },
                            { icon: TrendingUp, label: 'Linha de tendência', id: 'trendline', color: '#eab308', style: 'dashed' as const },
                            { icon: Minus, label: 'Linha horizontal', id: 'horizontal-line', color: '#3b82f6', style: 'solid' as const },
                            { icon: Minus, label: 'Linha vertical', id: 'vertical-line', color: '#3b82f6', style: 'solid' as const },
                            { icon: Layers, label: 'Linhas Fibonacci', id: 'fibonacci', color: '#3b82f6', style: 'solid' as const }
                          ].map((tool, idx) => {
                            const Icon = tool.icon;
                            const isActive = activeTools.some(t => t.id === tool.id);
                            return (
                              <React.Fragment key={tool.id}>
                                <button 
                                  onClick={() => {
                                    setSelectedToolType(tool.id);
                                    // Fechar o menu após selecionar
                                    setShowTools(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center space-x-2 ${
                                    isActive 
                                      ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' 
                                      : 'text-white hover:bg-gray-800/50'
                                  }`}
                                >
                                  <div className="w-4 h-4 flex items-center justify-center">
                                    {tool.id === 'fibonacci' ? (
                                      <div className="flex flex-col space-y-0.5">
                                        <div className="w-3 h-0.5 bg-blue-500"></div>
                                        <div className="w-3 h-0.5 bg-green-500"></div>
                                        <div className="w-3 h-0.5 bg-red-500"></div>
                                      </div>
                                    ) : tool.id === 'vertical-line' ? (
                                      <Minus className="w-3 h-3 rotate-90" style={{ color: tool.color }} />
                                    ) : (
                                      <Icon className="w-3 h-3" style={{ color: tool.color }} />
                                    )}
                                  </div>
                                  <span>{tool.label}</span>
                                </button>
                                {idx < 4 && <div className="h-px bg-gray-700/30"></div>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Coluna 2: Ferramentas ativas/em uso */}
                      <div className="w-1/2 flex flex-col">
                        <div className="p-2 space-y-0 overflow-y-auto flex-1">
                          {activeTools.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-gray-500 text-center">
                              Nenhuma ferramenta em uso
                            </div>
                          ) : (
                            activeTools.map((tool, idx) => {
                              const getIcon = () => {
                                switch (tool.id) {
                                  case 'line':
                                  case 'trendline':
                                    return <TrendingUp className="w-3 h-3" style={{ color: tool.color }} />;
                                  case 'horizontal-line':
                                    return <Minus className="w-3 h-3" style={{ color: tool.color }} />;
                                  case 'vertical-line':
                                    return <Minus className="w-3 h-3 rotate-90" style={{ color: tool.color }} />;
                                  case 'fibonacci':
                                    return (
                                      <div className="flex flex-col space-y-0.5">
                                        <div className="w-3 h-0.5 bg-blue-500"></div>
                                        <div className="w-3 h-0.5 bg-green-500"></div>
                                        <div className="w-3 h-0.5 bg-red-500"></div>
                                      </div>
                                    );
                                  default:
                                    return null;
                                }
                              };
                              
                              return (
                                <React.Fragment key={`${tool.id}-${tool.createdAt}`}>
                                  <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 transition-colors group">
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                        {getIcon()}
                                      </div>
                                      <span className="text-xs text-white truncate">{tool.label}</span>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                      {/* Preview da linha */}
                                      <div className="w-8 h-0.5 bg-gray-600"></div>
                                      <div 
                                        className="w-8 h-0.5" 
                                        style={{ 
                                          backgroundColor: tool.color,
                                          borderTop: tool.style === 'dashed' ? '1px dashed' : 'none',
                                          borderBottom: tool.style === 'dotted' ? '1px dotted' : 'none'
                                        }}
                                      ></div>
                                      {/* Ícone de configurações */}
                                      <button 
                                        className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedToolForEdit({ id: tool.id, createdAt: tool.createdAt });
                                          setShowToolProperties(true);
                                        }}
                                      >
                                        <Settings className="w-3 h-3 text-gray-400" />
                                      </button>
                                      {/* Ícone de duplicar */}
                                      <button 
                                        className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const duplicatedTool: GraphicTool = {
                                            ...tool,
                                            createdAt: Date.now()
                                          };
                                          setActiveTools(prev => [...prev, duplicatedTool]);
                                        }}
                                      >
                                        <Copy className="w-3 h-3 text-gray-400" />
                                      </button>
                                      {/* Ícone de visibilidade */}
                                      <button 
                                        className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTools(activeTools.map(t => 
                                            t.id === tool.id && t.createdAt === tool.createdAt
                                              ? { ...t, visible: !t.visible }
                                              : t
                                          ));
                                        }}
                                      >
                                        {tool.visible ? (
                                          <Eye className="w-3 h-3 text-gray-400" />
                                        ) : (
                                          <EyeOff className="w-3 h-3 text-gray-500" />
                                        )}
                                      </button>
                                      {/* Ícone de excluir */}
                                      <button 
                                        className="p-1 hover:bg-red-600/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTools(activeTools.filter(t => 
                                            !(t.id === tool.id && t.createdAt === tool.createdAt)
                                          ));
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3 text-gray-400" />
                                      </button>
                                    </div>
                                  </div>
                                  {idx < activeTools.length - 1 && <div className="h-px bg-gray-700/30"></div>}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
              </div>

              {/* 5. Botão de Indicadores */}
              <div className="relative" data-controls-panel>
                <button
                  onClick={() => { setShowIndicators(!showIndicators); setShowChartTypeMenu(false); setShowTimeframes(false); setShowTools(false); setShowPeriod(false); }}
                  className="p-2 bg-black backdrop-blur-sm hover:bg-gray-900 text-white transition-all duration-200 flex items-center justify-center relative group"
                  style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)' }}
                  title="Indicadores"
                >
                  <Gauge className="w-4 h-4" />
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#111827] border border-gray-700/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[70]">
                    Indicadores
                  </span>
                </button>
                {showIndicators && (
                  <div className="absolute left-full bottom-0 ml-2 bg-black backdrop-blur-xl shadow-2xl z-[60] min-w-[180px] max-h-[calc(100vh-200px)] overflow-hidden flex flex-col border border-gray-800/50 rounded">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-black border-b border-gray-700/30">
                      <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Indicadores</div>
                    </div>
                    <div className="p-2 space-y-0 overflow-y-auto">
                    {([
                      { label: 'Média Móvel Simples (SMA)', type: 'sma' as const, defaultPeriod: 20, icon: TrendingUpIcon2 },
                      { label: 'Média Móvel Exponencial (EMA)', type: 'ema' as const, defaultPeriod: 12, icon: LineChartIcon },
                      { label: 'Bandas de Bollinger', type: 'bollinger' as const, defaultPeriod: 20, icon: Waves },
                      { label: 'RSI', type: 'rsi' as const, defaultPeriod: 14, icon: Activity },
                      { label: 'MACD', type: 'macd' as const, defaultPeriod: 12, icon: BarChart3 },
                      { label: 'Volume', type: 'volume' as const, icon: BarChart2 }
                    ]).map((indicator, idx) => {
                      const activeIndicatorsOfType = activeIndicators.filter(ai => ai.type === indicator.type);
                      const isActive = activeIndicatorsOfType.length > 0;
                      
                      return (
                        <React.Fragment key={indicator.type}>
                          <button 
                            onClick={() => {
                              if (!isActive) {
                                // Adicionar indicador
                                const newId = `${indicator.type}-${Date.now()}`;
                                setActiveIndicators(prev => [...prev, {
                                  id: newId,
                                  type: indicator.type,
                                  period: indicator.defaultPeriod,
                                  color: indicator.type === 'sma' ? '#3b82f6' :
                                         indicator.type === 'ema' ? '#f59e0b' :
                                         indicator.type === 'bollinger' ? '#f59e0b' :
                                         indicator.type === 'rsi' ? '#ef4444' :
                                         indicator.type === 'macd' ? '#8b5cf6' :
                                         '#6b7280',
                                  visible: true
                                }]);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              isActive 
                                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' 
                                : 'text-white hover:bg-gray-800/50'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {indicator.icon && <indicator.icon className="w-3 h-3" />}
                              <span>{indicator.label}</span>
                              {isActive && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                            </div>
                        </button>
                          
                          {/* Lista de indicadores ativos deste tipo */}
                          {activeIndicatorsOfType.map((activeInd, indIdx) => {
                            return (
                              <React.Fragment key={activeInd.id}>
                                <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/50 transition-colors group">
                                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                      {indicator.icon && <indicator.icon className="w-3 h-3" style={{ color: activeInd.color }} />}
                                    </div>
                                    <span className="text-xs text-white truncate">
                                      {indicator.label} ({activeInd.period || indicator.defaultPeriod})
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    {/* Preview da linha */}
                                    <div className="w-8 h-0.5 bg-gray-600"></div>
                                    <div 
                                      className="w-8 h-0.5" 
                                      style={{ backgroundColor: activeInd.color || '#3b82f6' }}
                                    ></div>
                                    {/* Ícone de configurações */}
                                    <button 
                                      className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIndicatorForEdit(activeInd.id);
                                        setShowIndicatorProperties(true);
                                      }}
                                    >
                                      <Settings className="w-3 h-3 text-gray-400" />
                                    </button>
                                    {/* Ícone de duplicar */}
                                    <button 
                                      className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newId = `${activeInd.type}-${Date.now()}`;
                                        setActiveIndicators(prev => [...prev, {
                                          ...activeInd,
                                          id: newId,
                                          visible: true
                                        }]);
                                      }}
                                    >
                                      <Copy className="w-3 h-3 text-gray-400" />
                                    </button>
                                    {/* Ícone de visibilidade */}
                                    <button 
                                      className="p-1 hover:bg-gray-800/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveIndicators(prev => prev.map(ai => 
                                          ai.id === activeInd.id
                                            ? { ...ai, visible: ai.visible === false ? true : false }
                                            : ai
                                        ));
                                      }}
                                    >
                                      {(activeInd.visible !== false) ? (
                                        <Eye className="w-3 h-3 text-gray-400" />
                                      ) : (
                                        <EyeOff className="w-3 h-3 text-gray-500" />
                                      )}
                                    </button>
                                    {/* Ícone de excluir */}
                                    <button 
                                      className="p-1 hover:bg-red-600/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveIndicators(prev => prev.filter(ai => ai.id !== activeInd.id));
                                        if (selectedIndicatorForEdit === activeInd.id) {
                                          setSelectedIndicatorForEdit(null);
                                          setShowIndicatorProperties(false);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3 text-gray-400" />
                                    </button>
                                  </div>
                                </div>
                                {indIdx < activeIndicatorsOfType.length - 1 && <div className="h-px bg-gray-700/30"></div>}
                              </React.Fragment>
                            );
                          })}
                          {idx < 5 && <div className="h-px bg-gray-700/30"></div>}
                        </React.Fragment>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Botão de Período */}
              <div className="relative" data-controls-panel>
                <button
                  onClick={() => { setShowPeriod(!showPeriod); setShowChartTypeMenu(false); setShowTimeframes(false); setShowTools(false); setShowIndicators(false); }}
                  className="p-2 bg-black backdrop-blur-sm hover:bg-gray-900 text-white text-xs transition-all duration-200 flex items-center justify-center relative group"
                  style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)' }}
                  title="Período"
                >
                  <Clock className="w-4 h-4" />
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#111827] border border-gray-700/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[70]">
                    Período
                  </span>
                </button>
                {showPeriod && (
                  <div className="absolute left-full bottom-0 ml-2 bg-black backdrop-blur-xl shadow-2xl z-[60] min-w-[200px] max-h-[calc(100vh-200px)] overflow-hidden flex flex-col border border-gray-800/50 rounded">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-black border-b border-gray-700/30">
                      <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">PERÍODO</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">O período para o qual o gráfico é mostrado</div>
                    </div>
                    {/* Opções de período em duas colunas */}
                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-0">
                        {/* Coluna esquerda */}
                        <div className="space-y-0">
                          {([
                            { value: '30d' as const, label: '30 dias' },
                            { value: '1d' as const, label: '1 dia' },
                            { value: '3h' as const, label: '3 horas' },
                            { value: '30m' as const, label: '30 min' }
                          ]).map((period, idx) => (
                            <React.Fragment key={period.value}>
                              <button
                                onClick={() => {
                                  setSelectedPeriod(period.value);
                                  setShowPeriod(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs text-white transition-colors ${
                                  selectedPeriod === period.value
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                {period.label}
                              </button>
                              {idx < 3 && <div className="h-px bg-gray-700/30"></div>}
                            </React.Fragment>
                          ))}
                        </div>
                        {/* Coluna direita */}
                        <div className="space-y-0 border-l border-gray-700/30">
                          {([
                            { value: '15m' as const, label: '15 min' },
                            { value: '5m' as const, label: '5 min' },
                            { value: '2m' as const, label: '2 min' }
                          ]).map((period, idx) => (
                            <React.Fragment key={period.value}>
                              <button
                                onClick={() => {
                                  setSelectedPeriod(period.value);
                                  setShowPeriod(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs text-white transition-colors ${
                                  selectedPeriod === period.value
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                {period.label}
                              </button>
                              {idx < 2 && <div className="h-px bg-gray-700/30"></div>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

                {/* Chart - Ocupa todo o espaço disponível */}
                <div className="flex-1 bg-black relative pb-0 md:pb-0 min-h-0 overflow-visible flex" style={{ minHeight: 0, marginLeft: leftPanelOpen && leftPanelWidth > 0 ? `${leftPanelWidth}px` : '0', paddingTop: '1.5rem', paddingBottom: isMobile ? '5rem' : '0', marginBottom: showBottomTab ? 'calc(25vh - 1rem)' : '0', transition: 'margin-bottom 0.3s ease-in-out, margin-left 0.3s' }}>
                  <div className="flex-1 relative min-w-0" style={{ height: leftPanelOpen && leftPanelWidth > 0 ? 'calc(100vh - 1.5rem - 2rem)' : (showBottomTab ? 'calc(100% - 25vh + 1rem - 1.5rem)' : 'calc(100% - 1.5rem)'), width: '100%', maxHeight: leftPanelOpen && leftPanelWidth > 0 ? 'calc(100vh - 1.5rem - 2rem)' : (showBottomTab ? 'calc(100vh - 1.5rem - 25vh + 1rem - 2rem)' : 'none'), transition: 'height 0.3s ease-in-out, max-height 0.3s ease-in-out' }}>
            {marketLoading && candlestickData.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <MarketLoading message="Carregando dados do mercado..." />
              </div>
            ) : (
              <div className="relative w-full h-full" data-chart-container style={{ height: '100%', width: '100%', position: leftPanelOpen && leftPanelWidth > 0 ? 'absolute' : 'relative', top: leftPanelOpen && leftPanelWidth > 0 ? '0' : 'auto', paddingBottom: leftPanelOpen && leftPanelWidth > 0 ? '1.5rem' : '0' }}>
                <AnimatedCanvasChart
                          ref={chartRef}
                  key={`${selectedAsset}-${selectedTimeframe}-${chartType}-canvas`}
                  symbol={selectedAsset}
                  timeframe={selectedTimeframe}
                  className="absolute inset-0"
                  chartType={chartType}
                  candleUpColor={candleUpColor}
                  candleDownColor={candleDownColor}
                  lineColor={lineColor}
                  lineStyle={lineStyle}
                  lineWithShadow={lineWithShadow}
                  graphicTools={graphicToolsForChart}
                  selectedToolType={selectedToolType}
                  selectedToolId={selectedToolOnChart ? `${selectedToolOnChart.id}-${selectedToolOnChart.createdAt}` : null}
                  onToolDrawing={handleToolDrawing}
                          expirationTime={expirationTime}
                          currentTime={currentTime}
                  onToolComplete={handleToolComplete}
                  onToolClick={handleToolClick}
                  onToolMove={handleToolMove}
                  indicators={indicatorsForChart}
                  period={selectedPeriod}
                          buyButtonHover={buyButtonHover}
                          sellButtonHover={sellButtonHover}
                  activeTrades={(() => {
                    const filtered = localActiveTrades
                      .filter(t => t.symbol === selectedAsset && !closedSnapshots.has(t.id));
                    return filtered.map(t => ({
                      id: t.id,
                      entryPrice: t.entryPrice,
                      expiration: t.expiration,
                      type: t.type,
                      amount: t.amount,
                      result: t.result,
                      profit: t.profit,
                      symbol: t.symbol,
                    }));
                  })()}
                  onCloseSnapshot={(tradeId) => {
                    setClosedSnapshots(prev => new Set(prev).add(tradeId));
                  }}
                  onPriceUpdate={(price) => {
                    setCurrentPrice(price);
                  }}
                  onExpirationTimeChange={(newExpirationTime) => {
                    // Atualizar expirationTime quando o timer zera automaticamente
                    setExpirationTime(newExpirationTime);
                    expirationTimeManuallySet.current = false;
                  }}
                  onMarketStatusChange={setMarketStatus}
                />
                
                {/* Painel de Propriedades do Indicador - Sobre o gráfico */}
                {showIndicatorProperties && selectedIndicatorForEdit && (() => {
                  const activeInd = activeIndicators.find(ai => ai.id === selectedIndicatorForEdit);
                  if (!activeInd) {
                    return null;
                  }
                  
                  const indicator = [
                    { label: 'Média Móvel Simples (SMA)', type: 'sma' as const, defaultPeriod: 20, icon: TrendingUpIcon2 },
                    { label: 'Média Móvel Exponencial (EMA)', type: 'ema' as const, defaultPeriod: 12, icon: LineChartIcon },
                    { label: 'Bandas de Bollinger', type: 'bollinger' as const, defaultPeriod: 20, icon: Waves },
                    { label: 'RSI', type: 'rsi' as const, defaultPeriod: 14, icon: Activity },
                    { label: 'MACD', type: 'macd' as const, defaultPeriod: 12, icon: BarChart3 },
                    { label: 'Volume', type: 'volume' as const, icon: BarChart2 }
                  ].find(ind => ind.type === activeInd.type);
                  
                  if (!indicator) return null;
                  
                  // Handler para iniciar drag
                  const handleDragStart = (e: React.MouseEvent) => {
                    const target = e.target as HTMLElement;
                    
                    // Não iniciar drag se clicou em elementos interativos
                    if (target.closest('button, input, [data-indicator-color-picker]')) {
                      return;
                    }
                    if (target.tagName === 'svg' || target.tagName === 'path' || target.closest('svg')) {
                      return;
                    }
                    if (target.closest('.absolute.bottom-full') || target.closest('.grid.grid-cols-7')) {
                      return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    const panel = e.currentTarget as HTMLElement;
                    const rect = panel.getBoundingClientRect();
                    const container = document.querySelector('[data-chart-container]') as HTMLElement;
                    if (!container) return;
                    const containerRect = container.getBoundingClientRect();
                    setIndicatorPanelPosition({
                      x: rect.left - containerRect.left + (e.clientX - rect.left),
                      y: rect.top - containerRect.top + (e.clientY - rect.top)
                    });
                    setIsDraggingIndicatorPanel(true);
                  };
                  
                  // Calcular posição inicial se ainda não foi definida
                  const panelStyle = indicatorPanelPosition.x === 0 && indicatorPanelPosition.y === 0
                    ? { top: '1rem', right: '1rem' }
                    : { left: `${indicatorPanelPosition.x}px`, top: `${indicatorPanelPosition.y}px` };
                  
                  return (
                    <div 
                      className="absolute bg-[#111827] shadow-xl z-[70] overflow-visible select-none min-w-[200px]"
                      style={{
                        ...panelStyle,
                        borderRadius: '4px',
                        cursor: isDraggingIndicatorPanel ? 'grabbing' : 'default'
                      }}
                      onMouseDown={handleDragStart}
                    >
                      {/* Header com título e botão de fechar */}
                      <div 
                        className="flex items-center justify-between px-3 py-2 bg-black border-b border-gray-700/30"
                        style={{ cursor: isDraggingIndicatorPanel ? 'grabbing' : 'grab' }}
                        onMouseDown={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button, input, svg, path')) {
                            return;
                          }
                          handleDragStart(e);
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          {indicator.icon && <indicator.icon className="w-4 h-4" style={{ color: activeInd.color }} />}
                          <span className="text-xs font-semibold text-white">{indicator.label}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowIndicatorProperties(false);
                            setSelectedIndicatorForEdit(null);
                          }}
                          className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                      
                      {/* Conteúdo do painel */}
                      <div className="p-3 space-y-3">
                        {/* Controle de Período (se aplicável) */}
                        {indicator.type !== 'volume' && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Período</label>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              value={activeInd.period || indicator.defaultPeriod}
                              onChange={(e) => {
                                const newPeriod = parseInt(e.target.value) || indicator.defaultPeriod;
                                setActiveIndicators(prev => prev.map(ai => 
                                  ai.id === activeInd.id 
                                    ? { ...ai, period: newPeriod }
                                    : ai
                                ));
                              }}
                              className="w-full px-2 py-1 bg-[#1a1f2e] border border-gray-700/50 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                        
                        {/* Controle de Cor */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Cor</label>
                          <div className="grid grid-cols-7 gap-1">
                            {[
                              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
                              '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7', '#f43f5e', '#64748b'
                            ].map((color) => (
                              <button
                                key={color}
                                onClick={() => {
                                  setActiveIndicators(prev => prev.map(ai => 
                                    ai.id === activeInd.id 
                                      ? { ...ai, color }
                                      : ai
                                  ));
                                }}
                                className={`w-6 h-6 rounded border-2 transition-all ${
                                  activeInd.color === color
                                    ? 'border-white scale-110'
                                    : 'border-gray-600 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                          {/* Input de cor customizada */}
                          <div className="mt-2 flex items-center space-x-2">
                            <input
                              type="color"
                              value={activeInd.color || '#3b82f6'}
                              onChange={(e) => {
                                setActiveIndicators(prev => prev.map(ai => 
                                  ai.id === activeInd.id 
                                    ? { ...ai, color: e.target.value }
                                    : ai
                                ));
                              }}
                              className="w-8 h-6 rounded border border-gray-700/50 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={activeInd.color || '#3b82f6'}
                              onChange={(e) => {
                                setActiveIndicators(prev => prev.map(ai => 
                                  ai.id === activeInd.id 
                                    ? { ...ai, color: e.target.value }
                                    : ai
                                ));
                              }}
                              className="flex-1 px-2 py-1 bg-[#1a1f2e] border border-gray-700/50 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                              placeholder="#3b82f6"
                            />
                          </div>
                        </div>
                        
                        {/* Preview da linha */}
                        <div className="flex items-center space-x-2 pt-1 border-t border-gray-700/30">
                          <span className="text-xs text-gray-400">Preview:</span>
                          <div 
                            className="flex-1 h-0.5 rounded"
                            style={{ backgroundColor: activeInd.color || '#3b82f6' }}
                          />
                        </div>
                        
                        {/* Botão para adicionar mais uma média (apenas para SMA e EMA) */}
                        {(indicator.type === 'sma' || indicator.type === 'ema') && (
                          <div className="pt-1 border-t border-gray-700/30">
                            <button
                              onClick={() => {
                                const newId = `${indicator.type}-${Date.now()}`;
                                setActiveIndicators(prev => [...prev, {
                                  id: newId,
                                  type: indicator.type,
                                  period: indicator.defaultPeriod,
                                  color: indicator.type === 'sma' ? '#3b82f6' : '#f59e0b',
                                  visible: true
                                }]);
                              }}
                              className="w-full px-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded transition-colors flex items-center justify-center space-x-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Adicionar {indicator.type === 'sma' ? 'SMA' : 'EMA'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Painel de Propriedades da Ferramenta - Sobre o gráfico (formato da imagem) */}
                {(showToolProperties || selectedToolOnChart) && (() => {
                  const tool = activeTools.find(t => 
                    (selectedToolForEdit && t.id === selectedToolForEdit.id && t.createdAt === selectedToolForEdit.createdAt) ||
                    (selectedToolOnChart && t.id === selectedToolOnChart.id && t.createdAt === selectedToolOnChart.createdAt)
                  );
                  if (!tool) {
                    return null;
                  }
                  
                  // Handler para iniciar drag
                  const handleDragStart = (e: React.MouseEvent) => {
                    const target = e.target as HTMLElement;
                    
                    // Não iniciar drag se clicou em elementos interativos
                    if (target.closest('button, input, [data-tool-color-picker], [data-tool-style-dropdown]')) {
                      return;
                    }
                    // Não iniciar drag se clicou em SVG ou path (ícones)
                    if (target.tagName === 'svg' || target.tagName === 'path' || target.closest('svg')) {
                      return;
                    }
                    
                    // Não iniciar drag se clicou dentro de um dropdown ou color picker aberto
                    if (target.closest('.absolute.bottom-full') || target.closest('.grid.grid-cols-7')) {
                      return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    const panel = e.currentTarget as HTMLElement;
                    const rect = panel.getBoundingClientRect();
                    const container = document.querySelector('[data-chart-container]') as HTMLElement;
                    if (!container) return;
                    const containerRect = container.getBoundingClientRect();
                    setToolPanelPosition({
                      x: rect.left - containerRect.left + (e.clientX - rect.left),
                      y: rect.top - containerRect.top + (e.clientY - rect.top)
                    });
                    setIsDraggingToolPanel(true);
                  };
                  
                  // Calcular posição inicial se ainda não foi definida
                  const panelStyle = toolPanelPosition.x === 0 && toolPanelPosition.y === 0
                    ? { top: '1rem', right: '1rem' }
                    : { left: `${toolPanelPosition.x}px`, top: `${toolPanelPosition.y}px` };
                  
                  return (
                    <div 
                      className="absolute bg-[#111827] shadow-xl z-[70] overflow-visible select-none"
                      style={{
                        ...panelStyle,
                        borderRadius: '4px', // Cantos mais quadrados
                        cursor: isDraggingToolPanel ? 'grabbing' : 'default'
                      }}
                      onMouseDown={handleDragStart}
                    >
                      {/* Linha de ícones horizontais */}
                      <div 
                        className="flex items-center gap-2 px-3 py-2 bg-black"
                        style={{ cursor: isDraggingToolPanel ? 'grabbing' : 'grab' }}
                        onMouseDown={(e) => {
                          // Permitir drag apenas na área do header (não nos botões)
                          const target = e.target as HTMLElement;
                          if (target.closest('button, input, [data-tool-color-picker], [data-tool-style-dropdown], svg, path')) {
                            return;
                          }
                          handleDragStart(e);
                        }}
                      >
                        {/* Quadrado de cor com grid de cores */}
                        <div className="relative" data-tool-color-picker>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowToolColorPicker(!showToolColorPicker);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded border border-gray-700/50 cursor-pointer transition-all hover:scale-105"
                            style={{ 
                              backgroundColor: tool.color,
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}
                            title="Cor"
                          />
                          {showToolColorPicker && (
                            <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/80 rounded p-3 grid grid-cols-4 gap-2.5 z-[80] shadow-lg min-w-[140px]">
                              {colorPalette.map((color, index) => (
                                <button
                                  key={index}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTools(activeTools.map(t => 
                                      t.id === tool.id && t.createdAt === tool.createdAt
                                        ? { ...t, color: color === 'transparent' ? '#3b82f6' : color }
                                        : t
                                    ));
                                    setShowToolColorPicker(false);
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className={`w-7 h-7 rounded border transition-all hover:scale-110 ${
                                    tool.color === color || (color === 'transparent' && tool.color === '#3b82f6')
                                      ? 'border-blue-500 scale-110 ring-2 ring-blue-500/50' 
                                      : 'border-gray-700/50'
                                  }`}
                                  style={{
                                    backgroundColor: color === 'transparent' ? 'transparent' : color,
                                    backgroundImage: color === 'transparent' 
                                      ? 'repeating-linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%, #333), repeating-linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%, #333)'
                                      : undefined,
                                    backgroundSize: color === 'transparent' ? '4px 4px' : undefined,
                                    backgroundPosition: color === 'transparent' ? '0 0, 2px 2px' : undefined
                                  }}
                                  title={color === 'transparent' ? 'Transparente' : color}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Botão de estilo de linha (tipo de linha) */}
                        <div className="relative" data-tool-style-dropdown>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setShowToolStyleDropdown(!showToolStyleDropdown);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            className="p-1 hover:bg-gray-800/50 rounded transition-colors relative flex items-center justify-center"
                            title="Estilo da linha"
                          >
                            {/* Ícone visual representando o estilo da linha */}
                            <div className="w-6 h-4 flex items-center justify-center">
                              {tool.style === 'solid' && (
                                <div className="w-full h-0.5 bg-gray-400"></div>
                              )}
                              {tool.style === 'dashed' && (
                                <div className="w-full h-0.5 bg-gray-400" style={{ 
                                  backgroundImage: 'linear-gradient(to right, #9ca3af 50%, transparent 50%)', 
                                  backgroundSize: '6px 1px',
                                  backgroundRepeat: 'repeat-x'
                                }}></div>
                              )}
                              {tool.style === 'dotted' && (
                                <div className="w-full h-0.5 bg-gray-400" style={{ 
                                  backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', 
                                  backgroundSize: '4px 1px',
                                  backgroundRepeat: 'repeat-x',
                                  backgroundPosition: 'center'
                                }}></div>
                              )}
                            </div>
                          </button>
                          {showToolStyleDropdown && (
                            <div className="absolute bottom-full left-0 mb-1 bg-[#111827] border border-gray-700/80 rounded overflow-hidden z-[80] shadow-lg min-w-full whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTools(activeTools.map(t => 
                                    t.id === tool.id && t.createdAt === tool.createdAt
                                      ? { ...t, style: 'solid' }
                                      : t
                                  ));
                                  setShowToolStyleDropdown(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors ${
                                  tool.style === 'solid' ? 'bg-gray-800/70' : ''
                                }`}
                              >
                                Sólida
                              </button>
                              <div className="h-px bg-gray-700/30"></div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTools(activeTools.map(t => 
                                    t.id === tool.id && t.createdAt === tool.createdAt
                                      ? { ...t, style: 'dashed' }
                                      : t
                                  ));
                                  setShowToolStyleDropdown(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors ${
                                  tool.style === 'dashed' ? 'bg-gray-800/70' : ''
                                }`}
                              >
                                Tracejada
                              </button>
                              <div className="h-px bg-gray-700/30"></div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTools(activeTools.map(t => 
                                    t.id === tool.id && t.createdAt === tool.createdAt
                                      ? { ...t, style: 'dotted' }
                                      : t
                                  ));
                                  setShowToolStyleDropdown(false);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className={`w-full text-left px-3 py-2 text-xs text-white hover:bg-gray-800/50 transition-colors ${
                                  tool.style === 'dotted' ? 'bg-gray-800/70' : ''
                                }`}
                              >
                                Pontilhada
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Quadrados sobrepostos (duplicar) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            
                            // Calcular offset baseado no tipo de ferramenta
                            let offsetPrice = 0;
                            let offsetTime = 0;
                            
                            // Calcular offset baseado no preço atual e tipo de ferramenta
                            // Offset menor para que a linha duplicada apareça apenas um pouco distante
                            if (tool.type === 'horizontal' && tool.points && tool.points.length > 0) {
                              const firstPoint = tool.points[0];
                              // Para linha horizontal, calcular offset baseado no preço atual e range visível
                              if (firstPoint.price !== undefined) {
                                const basePrice = firstPoint.price;
                                // Usar preço atual do mercado para calcular range aproximado
                                const refPrice = currentPrice || marketPrice || basePrice;
                                // Calcular offset como uma pequena porcentagem do preço atual (0.2% do preço)
                                // Isso garante que a linha fique visível no viewport sem sair muito
                                const calculatedOffset = refPrice * 0.002; // 0.2% do preço de referência
                                // Usar o menor entre o offset calculado e 0.5% do preço base
                                offsetPrice = Math.min(calculatedOffset, basePrice * 0.005);
                                // Garantir offset mínimo visível (0.1% do preço base)
                                offsetPrice = Math.max(offsetPrice, basePrice * 0.001);
                              } else {
                                const refPrice = currentPrice || marketPrice || 1000;
                                offsetPrice = Math.max(refPrice * 0.001, 1);
                              }
                            } else if (tool.type === 'vertical' && tool.points && tool.points[0]?.time !== undefined) {
                              offsetTime = 5 * 60 * 1000;
                            } else if ((tool.type === 'line' || tool.type === 'trendline') && tool.points && tool.points.length >= 2) {
                              // Para linhas e trendlines, offset pequeno em ambas direções
                              const basePrice = tool.points[0]?.price || currentPrice || marketPrice || 1000;
                              const refPrice = currentPrice || marketPrice || basePrice;
                              // Offset em preço: 0.2-0.5% do preço de referência
                              const calculatedOffset = refPrice * 0.002; // 0.2% do preço de referência
                              offsetPrice = Math.min(calculatedOffset, basePrice * 0.005); // Máximo 0.5% do preço base
                              offsetPrice = Math.max(offsetPrice, basePrice * 0.001);
                              offsetTime = 5 * 60 * 1000;
                            } else if (tool.type === 'fibonacci' && tool.points && tool.points.length >= 2) {
                              // Para Fibonacci, offset apenas em price (não em time)
                              // Verificar se ambos os pontos têm price (obrigatório para Fibonacci)
                              const startPrice = tool.points[0]?.price;
                              const endPrice = tool.points[1]?.price;
                              
                              if (startPrice !== undefined && endPrice !== undefined) {
                                const priceRange = Math.abs(endPrice - startPrice);
                                const refPrice = currentPrice || marketPrice || Math.max(startPrice, endPrice);
                                // Offset baseado no range atual (10% do range) ou 0.5% do preço de referência
                                const rangeOffset = priceRange * 0.1; // 10% do range
                                const priceOffset = refPrice * 0.005; // 0.5% do preço de referência
                                offsetPrice = Math.max(rangeOffset, priceOffset);
                                // Limitar offset máximo para não sair muito do viewport (máximo 2% do preço maior)
                                offsetPrice = Math.min(offsetPrice, Math.max(startPrice, endPrice) * 0.02);
                                offsetPrice = Math.max(offsetPrice, refPrice * 0.001);
                              } else {
                                const refPrice = currentPrice || marketPrice || 1000;
                                offsetPrice = Math.max(refPrice * 0.005, 1);
                              }
                            }
                            
                            // Manter o ID base original para manter compatibilidade com graphicToolsForChart
                            // O graphicToolsForChart espera id-createdAt, então mantemos o id original
                            // e apenas atualizamos o createdAt para garantir unicidade
                            
                            // Para linhas horizontais, garantir que o price seja preservado corretamente
                            const duplicatedTool: GraphicTool = {
                              ...tool,
                              id: tool.id, // Manter ID original
                              createdAt: Date.now(), // Novo timestamp para garantir unicidade
                              visible: tool.visible !== undefined ? tool.visible : true, // Garantir que visible seja true por padrão
                              points: tool.points?.map((p, index) => {
                                // Criar novo ponto usando spread para copiar todas as propriedades
                                const newPoint: { x: number; y: number; price?: number; time?: number } = {
                                  ...p, // Copiar todas as propriedades originais primeiro
                                };
                                
                                // Aplicar offset apenas se o valor original existir e offset não for zero
                                if (p.price !== undefined && offsetPrice !== 0) {
                                  // Para Fibonacci, manter a direção do range (alto->baixo ou baixo->alto)
                                  if (tool.type === 'fibonacci' && tool.points && tool.points.length >= 2) {
                                    const startPrice = tool.points[0]?.price || 0;
                                    const endPrice = tool.points[1]?.price || 0;
                                    // Se startPrice < endPrice (tendência de alta), adicionar offset
                                    // Se startPrice > endPrice (tendência de baixa), subtrair offset
                                    if (startPrice < endPrice) {
                                  newPoint.price = p.price + offsetPrice;
                                    } else {
                                      newPoint.price = p.price - offsetPrice;
                                    }
                                  } else {
                                    newPoint.price = p.price + offsetPrice;
                                  }
                                }
                                if (p.time !== undefined && offsetTime !== 0) {
                                  // Aplicar offset em tempo apenas para linhas, trendlines e verticais
                                  // Fibonacci não deve ter offset em tempo
                                  if (tool.type !== 'fibonacci') {
                                  newPoint.time = p.time + offsetTime;
                                  }
                                }
                                
                                // Garantir que x e y tenham valores padrão se não existirem
                                if (newPoint.x === undefined) newPoint.x = 0;
                                if (newPoint.y === undefined) newPoint.y = 0;
                                
                                return newPoint;
                              }) || tool.points
                            };
                            
                            // Verificar se a ferramenta duplicada tem price válido
                            if (duplicatedTool.points && duplicatedTool.points.length > 0) {
                              const dupPoint = duplicatedTool.points[0];
                              if (tool.type === 'horizontal' && dupPoint.price === undefined) {
                                toast.error('Erro ao duplicar linha: price não definido');
                                return;
                              }
                            }
                            
                            setActiveTools(prev => [...prev, duplicatedTool]);
                            
                            // Notificação removida - será usada em outra função no futuro
                            // toast.success('Linha duplicada com sucesso!');
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                          title="Duplicar"
                        >
                          <Layers className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {/* Olho (ocultar/mostrar) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTools(activeTools.map(t => 
                              t.id === tool.id && t.createdAt === tool.createdAt
                                ? { ...t, visible: !t.visible }
                                : t
                            ));
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                          title={tool.visible ? "Ocultar" : "Mostrar"}
                        >
                          {tool.visible ? (
                            <Eye className="w-4 h-4 text-gray-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        
                        {/* Cadeado desbloqueado (editar) */}
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                          title="Editar"
                        >
                          <Unlock className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {/* Lixeira (remover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTools(activeTools.filter(t => 
                              !(t.id === tool.id && t.createdAt === tool.createdAt)
                            ));
                            setShowToolProperties(false);
                            setSelectedToolForEdit(null);
                            setSelectedToolOnChart(null);
                            setToolPanelPosition({ x: 0, y: 0 }); // Resetar posição
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
                  </div>
          </div>
        </div>


        {/* Right Trading Panel - Ultra Compacto */}
        <div className="w-40 bg-black border-l border-gray-900 p-1.5 hidden md:block">
          <div className="space-y-2.5 pt-10">
            {/* Valor - Design Melhorado com Botões Internos */}
            <div className="bg-gray-800/60 border border-gray-800/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] font-medium text-white block mb-1">Valor</label>
                <div className="flex items-center space-x-1.5">
                    <span className="text-gray-400 text-xs flex-shrink-0">R$</span>
                  <input
                    type="number"
                    value={tradeValue}
                    onChange={(e) => setTradeValue(Math.max(10, parseInt(e.target.value) || 10))}
                      className="bg-transparent text-white font-bold text-base outline-none min-w-0 flex-1 max-w-[70px]"
                    style={{ 
                      caretColor: '#3b82f6',
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                  />
                </div>
              </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button 
                  onClick={() => setTradeValue(tradeValue + 10)}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
                >
                    <ChevronUp className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => setTradeValue(Math.max(10, tradeValue - 10))}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
                >
                    <ChevronDown className="w-3 h-3" />
                </button>
                </div>
              </div>
            </div>

            {/* Expiração - Design Melhorado com Botões Internos */}
            <div className="bg-gray-800/60 border border-gray-800/50 p-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                <div className="flex items-center space-x-1 mb-1">
                  <label className="text-[9px] font-medium text-white">Expiração</label>
                  <button className="w-3.5 h-3.5 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors">
                    <HelpCircle className="w-2 h-2 text-gray-300" />
                  </button>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-base font-bold text-white">
                      {expirationTime.toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </span>
                </div>
              </div>
                <div className="flex flex-col gap-0.5 ml-2">
                <button 
                    onClick={() => {
                      expirationTimeManuallySet.current = true;
                      const newTime = new Date(expirationTime);
                      newTime.setMinutes(newTime.getMinutes() + 1);
                      newTime.setSeconds(0);
                      newTime.setMilliseconds(0);
                      setExpirationTime(newTime);
                    }}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronUp className="w-3 h-3" />
                </button>
                <button 
                    onClick={() => {
                      expirationTimeManuallySet.current = true;
                      const newTime = new Date(expirationTime);
                      newTime.setMinutes(newTime.getMinutes() - 1);
                      newTime.setSeconds(0);
                      newTime.setMilliseconds(0);
                      // Usar minimumExpiration para garantir buffer de 30s
                      if (newTime.getTime() >= minimumExpiration.getTime()) {
                        setExpirationTime(newTime);
                      } else {
                        setExpirationTime(new Date(minimumExpiration));
                      }
                    }}
                    className="w-6 h-6 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={expirationTime.getTime() <= minimumExpiration.getTime()}
                  >
                    <ChevronDown className="w-3 h-3" />
                </button>
                </div>
              </div>
            </div>

            {/* Lucro - Porcentagem Maior e Centralizado */}
            <div className="py-1">
              <div className="flex items-center justify-center space-x-1 mb-1.5">
                <span className="text-[9px] font-medium text-white">Lucro</span>
                <button className="w-3.5 h-3.5 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors">
                  <HelpCircle className="w-2 h-2 text-gray-300" />
                </button>
              </div>
              <div className="text-center text-4xl font-bold text-green-400 mb-1" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>+{profitPercent}%</div>
              <div className="text-center text-lg font-semibold text-green-400" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>+R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>

            {/* Trade Buttons - Proporção do Print */}
            <div className="space-y-1.5 flex flex-col items-center">
              <button 
                onMouseEnter={() => setBuyButtonHover(true)}
                onMouseLeave={() => setBuyButtonHover(false)}
                onClick={async () => {
                  playClick();
                  if (!user) {
                    toast.error('Usuário não autenticado');
                    return;
                  }

                  if (tradeValue > activeBalance) {
                    toast.error('Saldo insuficiente');
                    return;
                  }

                  try {
                    // Snapshot de Entrada: capturar visualPrice no momento do clique
                    const snapshotPrice = chartRef.current?.getCurrentPrice() || currentPrice || 0;
                    
                    // Usar o timestamp exato do expirationTime escolhido pelo usuário
                    const expirationTimestamp = expirationTime.getTime();
                    
                    const result = await tradeService.executeTrade({
                      userId: user.id,
                      symbol: selectedAsset,
                      type: 'call',
                      amount: tradeValue,
                      expiration: expirationTimestamp, // Passar timestamp diretamente (será detectado como timestamp)
                      entryPrice: snapshotPrice, // Usar snapshotPrice ao invés de currentPrice
                    });

                    if (result.success) {
                      // Adicionar trade ao array local para renderização instantânea
                      const newTrade: Trade = {
                        ...result.trade,
                        entryPrice: snapshotPrice, // Garantir que usa o snapshot
                      };
                      setLocalActiveTrades(prev => [...prev, newTrade]);
                      localActiveTradesRef.current = [...localActiveTradesRef.current, newTrade];
                      
                      // Removido toast de confirmação conforme solicitado
                      // Atualizar saldo com animação (persiste no banco via updateBalance)
                      if (user) {
                        animateBalance(activeBalance, activeBalance - tradeValue);
                      }
                    } else {
                      toast.error(result.message || 'Erro ao executar trade');
                    }
                  } catch (error) {
                    console.error('Error:', error instanceof Error ? error.message : 'Unknown');
                    toast.error('Erro ao executar trade');
                  }
                }}
                className="w-full bg-gray-800/60 hover:bg-black text-white py-4 transition-all flex flex-col items-center justify-center space-y-1.5 border border-gray-800/50"
              >
                <div className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                <span className="text-xs font-bold uppercase">COMPRAR</span>
              </button>
              <button 
                onMouseEnter={() => setSellButtonHover(true)}
                onMouseLeave={() => setSellButtonHover(false)}
                onClick={async () => {
                  playClick();
                  if (!user) {
                    toast.error('Usuário não autenticado');
                    return;
                  }

                  if (tradeValue > activeBalance) {
                    toast.error('Saldo insuficiente');
                    return;
                  }

                  try {
                    // Snapshot de Entrada: capturar visualPrice no momento do clique
                    const snapshotPrice = chartRef.current?.getCurrentPrice() || currentPrice || 0;
                    
                    // Usar o timestamp exato do expirationTime escolhido pelo usuário
                    const expirationTimestamp = expirationTime.getTime();
                    
                    const result = await tradeService.executeTrade({
                      userId: user.id,
                      symbol: selectedAsset,
                      type: 'put',
                      amount: tradeValue,
                      expiration: expirationTimestamp, // Passar timestamp diretamente (será detectado como timestamp)
                      entryPrice: snapshotPrice, // Usar snapshotPrice ao invés de currentPrice
                    });

                    if (result.success) {
                      // Adicionar trade ao array local para renderização instantânea
                      const newTrade: Trade = {
                        ...result.trade,
                        entryPrice: snapshotPrice, // Garantir que usa o snapshot
                      };
                      setLocalActiveTrades(prev => [...prev, newTrade]);
                      localActiveTradesRef.current = [...localActiveTradesRef.current, newTrade];
                      
                      // Removido toast de confirmação conforme solicitado
                      // Atualizar saldo com animação (persiste no banco via updateBalance)
                      if (user) {
                        animateBalance(activeBalance, activeBalance - tradeValue);
                      }
                    } else {
                      toast.error(result.message || 'Erro ao executar trade');
                    }
                  } catch (error) {
                    console.error('Error:', error instanceof Error ? error.message : 'Unknown');
                    toast.error('Erro ao executar trade');
                  }
                }}
                className="w-full bg-gray-800/60 hover:bg-black text-white py-4 transition-all flex flex-col items-center justify-center space-y-1.5 border border-gray-800/50"
              >
                <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-bold uppercase">VENDER</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Trade Panel - Bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-sm border-t border-gray-800 px-3 py-2 safe-area-bottom">
        <div className="flex items-center gap-2">
          {/* Valor */}
          <div className="flex items-center bg-gray-800/60 rounded px-2 py-1.5 gap-1 flex-shrink-0">
            <span className="text-gray-400 text-xs">R$</span>
            <input
              type="number"
              value={tradeValue}
              onChange={(e) => setTradeValue(Math.max(10, parseInt(e.target.value) || 10))}
              className="bg-transparent text-white font-bold text-sm outline-none w-14"
              style={{ caretColor: '#3b82f6', WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            />
          </div>
          
          {/* Expiração compacta */}
          <div className="flex items-center bg-gray-800/60 rounded px-2 py-1.5 gap-1 flex-shrink-0">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-white text-xs font-bold">
              {expirationTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          {/* Botões Comprar/Vender */}
          <div className="flex gap-1.5 flex-1">
            <button
              onClick={async () => {
                playClick();
                if (!user) { toast.error('Usuário não autenticado'); return; }
                if (tradeValue > activeBalance) { toast.error('Saldo insuficiente'); return; }
                try {
                  const snapshotPrice = chartRef.current?.getCurrentPrice() || currentPrice || 0;
                  const expirationTimestamp = expirationTime.getTime();
                  const result = await tradeService.executeTrade({
                    userId: user.id, symbol: selectedAsset, type: 'call',
                    amount: tradeValue, expiration: expirationTimestamp, entryPrice: snapshotPrice,
                  });
                  if (result.success) {
                    const newTrade: Trade = { ...result.trade, entryPrice: snapshotPrice };
                    setLocalActiveTrades(prev => [...prev, newTrade]);
                    localActiveTradesRef.current = [...localActiveTradesRef.current, newTrade];
                    if (user) { animateBalance(activeBalance, activeBalance - tradeValue); }
                  } else { toast.error(result.message || 'Erro ao executar trade'); }
                } catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown'); toast.error('Erro ao executar trade'); }
              }}
              className="flex-1 bg-green-600/80 active:bg-green-700 text-white py-3 rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold">COMPRAR</span>
            </button>
            <button
              onClick={async () => {
                playClick();
                if (!user) { toast.error('Usuário não autenticado'); return; }
                if (tradeValue > activeBalance) { toast.error('Saldo insuficiente'); return; }
                try {
                  const snapshotPrice = chartRef.current?.getCurrentPrice() || currentPrice || 0;
                  const expirationTimestamp = expirationTime.getTime();
                  const result = await tradeService.executeTrade({
                    userId: user.id, symbol: selectedAsset, type: 'put',
                    amount: tradeValue, expiration: expirationTimestamp, entryPrice: snapshotPrice,
                  });
                  if (result.success) {
                    const newTrade: Trade = { ...result.trade, entryPrice: snapshotPrice };
                    setLocalActiveTrades(prev => [...prev, newTrade]);
                    localActiveTradesRef.current = [...localActiveTradesRef.current, newTrade];
                    if (user) { animateBalance(activeBalance, activeBalance - tradeValue); }
                  } else { toast.error(result.message || 'Erro ao executar trade'); }
                } catch (error) { console.error('Error:', error instanceof Error ? error.message : 'Unknown'); toast.error('Erro ao executar trade'); }
              }}
              className="flex-1 bg-red-600/80 active:bg-red-700 text-white py-3 rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-bold">VENDER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aba Embaixo do Gráfico - Portfólio Total (Primeiro item do menu lateral) */}
      {showBottomTab && (
        <div className="fixed z-40 bg-black border-t border-gray-800 transition-all duration-300 overflow-hidden" style={{ 
          height: '25vh', 
          maxHeight: '300px',
          bottom: '3rem', 
          left: isMobile ? '0px' : `${sidebarCollapsed ? 64 : 80}px`,
          right: isMobile ? '0px' : '160px',
          pointerEvents: 'auto'
        }}>
          <PortfolioTotal onClose={() => setShowBottomTab(false)} />
        </div>
      )}

      {/* Bottom Bar - Compacta */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/95 backdrop-blur-sm border-t border-gray-900/50 px-4 py-1.5 hidden md:block">
        <div className="flex items-center justify-between">
          {/* Lado Esquerdo - Suporte */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                if (leftPanelOpen === 'chat') {
                  setLeftPanelOpen(null);
                  setLeftPanelWidth(0);
                } else {
                  setLeftPanelOpen('chat');
                  setLeftPanelWidth(300);
                  setShowBottomTab(false);
                  setShowTimeframes(false);
                  setShowTools(false);
                  setShowIndicators(false);
                  setShowPeriod(false);
                  setShowChartTypeMenu(false);
                }
              }}
              className={`${
                leftPanelOpen === 'chat' 
                  ? 'bg-red-700 hover:bg-red-800' 
                  : 'bg-red-600 hover:bg-red-700'
              } text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-md hover:shadow-lg`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>SUPORTE</span>
            </button>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-300">{supportEmail}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">TODO DIA, A TODA HORA</span>
            </div>
          </div>
          
          {/* Lado Direito - Informações e Ações */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={toggleSound}
              className={`p-1.5 transition-colors ${soundEnabled ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`} 
              title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <div className="text-xs text-gray-300">
              HORA ATUAL: {currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }).toUpperCase()}, {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (UTC-3)
            </div>
            <button 
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors" 
              title="Tela cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Menu do Usuário - Design igual ao modal de seleção de ativos */}
      {showUserMenu && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm" 
            onClick={() => setShowUserMenu(false)}
          />
          {/* Janela - Design igual ao modal de ativos */}
          <div 
            className="fixed right-2 md:right-4 top-20 bg-black backdrop-blur-xl shadow-2xl z-[60] overflow-hidden w-[calc(100%-1rem)] md:w-[400px] max-h-[80vh] animate-[fadeIn_0.2s_ease-out_forwards] border border-gray-800/50 rounded" 
            onClick={(e) => e.stopPropagation()}
            style={{
              top: '60px'
            }}
          >
            {/* Layout de duas colunas */}
            <div className="flex">
              {/* Coluna Esquerda - Informações do Usuário */}
              <div className="w-[160px] border-r border-gray-700/50 bg-gray-800/30">
                <div className="p-4">
                  <div className="flex flex-col items-center space-y-3 mb-4">
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <div className="text-xs font-medium text-white text-center">{user.name}</div>
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">{user.email}</div>
                  </div>
                  
                  <div className="border-t border-gray-700/50 pt-4 space-y-3">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-lg">🇧🇷</span>
                      <span className="text-xs text-gray-300">Brazil</span>
                    </div>
                    
                    <div>
                      <div className="text-[10px] text-gray-500 mb-1">Date registered</div>
                      <div className="text-xs text-gray-300">
                        {new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <div className="text-[10px] text-gray-500 mb-1">User ID</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-300 font-mono">{user.id.replace(/-/g, '').substring(0, 9)}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(user.id.replace(/-/g, '').substring(0, 9));
                            toast.success('ID copiado!');
                          }}
                          className="p-1 hover:bg-gray-700/50 rounded transition-colors"
                          title="Copiar ID"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna Direita - Menu de Opções */}
              <div className="flex-1 py-2 max-h-[calc(80vh-60px)] overflow-y-auto custom-scrollbar">
                <div className="space-y-0">
                  <button 
                    onClick={() => {
                      // Upload photo functionality
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const photoUrl = event.target?.result as string;
                            setUserPhoto(photoUrl);
                            localStorage.setItem('user_photo', photoUrl);
                            toast.success('Foto atualizada!');
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <Camera className="w-4 h-4 text-gray-400" />
                    <span>Upload a Photo</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      router.push('/profile');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4 text-gray-400" />
                    <span>Personal Data</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      // Salvar a seção ativa no localStorage para a página de profile ler
                      localStorage.setItem('profile_active_section', 'verification');
                      router.push('/profile');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                    <span>Verify Account</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      setShowDepositModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4 text-gray-400" />
                    <span>Deposit Funds</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      router.push('/dashboard/withdrawal');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span>Withdraw Funds</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      router.push('/dashboard/transactions');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <RotateCcw className="w-4 h-4 text-gray-400" />
                    <span>Balance History</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      router.push('/dashboard/trading-history');
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <History className="w-4 h-4 text-gray-400" />
                    <span>Trading History</span>
                  </button>
                  <div className="h-px bg-gray-700/30"></div>
                  
                  <button 
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                      router.push('/login');
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Janela de Depósito - Sobre o gráfico */}
      {showDepositModal && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-sm" 
            onClick={() => {
              setShowDepositModal(false);
              setDepositStep('method');
              setSelectedGateway(null);
              setDepositAmount(20);
              setPromoCode('');
              setCpf('');
              setAcceptedTerms(false);
            }}
          />
          {/* Janela de Depósito */}
          <div 
            className="fixed inset-0 flex items-center justify-center z-[60] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-black backdrop-blur-xl shadow-2xl overflow-hidden w-full max-w-5xl max-h-[90vh] md:max-h-[85vh] animate-[fadeIn_0.2s_ease-out_forwards] border border-gray-800/50 flex flex-col rounded overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                {depositStep !== 'method' && (
                  <button
                    onClick={() => {
                      if (depositStep === 'payment') {
                        setDepositStep('amount');
                      } else if (depositStep === 'amount') {
                        setDepositStep('method');
                        setSelectedGateway(null);
                      }
                    }}
                    className="p-1 hover:bg-gray-800/50 rounded transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                  </button>
                )}
                <h2 className="text-lg font-semibold text-white">
                  {depositStep === 'method' ? 'Payment method' : 
                   depositStep === 'amount' ? (selectedGateway?.description || selectedGateway?.name || 'PIX (Apenas seu CPF)') : 
                   'Payment Details'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositStep('method');
                  setSelectedGateway(null);
                  setDepositAmount(20);
                  setPromoCode('');
                  setCpf('');
                  setAcceptedTerms(false);
                }}
                className="p-2 hover:bg-gray-800/50 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Conteúdo - Renderização condicional baseada na etapa */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Etapa 1: Seleção de Método */}
              {depositStep === 'method' && (
                <>
                  {/* Lista de métodos */}
                  <div className="p-6">
                    {loadingGateways ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-gray-400 text-sm">Carregando métodos de pagamento...</div>
                      </div>
                    ) : paymentGateways.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="text-gray-400 text-sm mb-2">Nenhum método de pagamento disponível</div>
                        <div className="text-gray-500 text-xs">Configure os gateways de pagamento no painel administrativo</div>
                      </div>
                    ) : (
                      Object.entries(groupGatewaysByCategory(paymentGateways)).map(([category, gateways]) => (
                        <div key={category} className={category !== Object.keys(groupGatewaysByCategory(paymentGateways))[0] ? 'mt-8' : 'mb-8'}>
                          {category === 'crypto' && (
                            <div className="mb-3">
                              <p className="text-[10px] text-gray-500 leading-relaxed opacity-60">
                                When you make a deposit using Crypto methods, the selected cryptocurrency is converted to the currency of your balance.
                              </p>
                            </div>
                          )}
                          <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                            {categoryNames[category] || category.toUpperCase()}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {gateways.map((gateway) => (
                              <button
                                key={gateway.id}
                                className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors text-left"
                                onClick={() => {
                                  setSelectedGateway(gateway);
                                  setDepositStep('amount');
                                  setDepositAmount(gateway.min_amount || 20);
                                }}
                              >
                                <div className="flex items-center space-x-3 mb-3">
                                  <div className="flex-shrink-0">
                                    {renderDefaultIcon(gateway)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">
                                      {gateway.description || gateway.name}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {gateway.estimated_time || 'Tempo variável'} • 
                                  min {formatCurrency(gateway.min_amount)}
                                  {gateway.max_amount && ` • max ${formatCurrency(gateway.max_amount)}`}
                                  {gateway.service_fee_percentage > 0 && ` • taxa ${gateway.service_fee_percentage}%`}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* Etapa 2: Seleção de Valor */}
              {depositStep === 'amount' && selectedGateway && (
                <div className="p-6 space-y-6">
                  {/* Campo de Valor */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Amount</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        const min = selectedGateway.min_amount || 20;
                        const max = selectedGateway.max_amount || 50000;
                        if (value >= min && value <= max) {
                          setDepositAmount(value);
                        }
                      }}
                      min={selectedGateway.min_amount || 20}
                      max={selectedGateway.max_amount || 50000}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-white/10 rounded text-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                      placeholder="R$ 20,00"
                    />
                  </div>

                  {/* Botões de Valores Pré-definidos */}
                  <div>
                    <div className="grid grid-cols-4 gap-3">
                      {[20, 50, 100, 250, 500, 1000, 2500, 5000].map((amount) => {
                        const isValid = amount >= (selectedGateway.min_amount || 20) && (!selectedGateway.max_amount || amount <= selectedGateway.max_amount);
                        if (!isValid) return null;
                        return (
                          <button
                            key={amount}
                            onClick={() => setDepositAmount(amount)}
                            className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                              depositAmount === amount
                                ? 'bg-green-600 text-white shadow-lg'
                                : 'bg-gray-800/50 text-white border border-gray-700/50 hover:bg-gray-800/70'
                            }`}
                          >
                            {formatCurrency(amount)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Seção de Promoção */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-sm">PROMOTION</span>
                      <div className="flex items-center space-x-1 text-gray-400 text-xs">
                        <Tag className="w-3 h-3" />
                        <span>View available (0)</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter your promo code"
                        className="flex-1 px-4 py-2 bg-gray-800/50 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                      />
                      <button
                        disabled={!promoCode}
                        className={`px-6 py-2 rounded text-sm font-medium transition-all ${
                          promoCode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Apply
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">One promo code per deposit.</p>
                  </div>

                  {/* Botão Continuar */}
                  <button
                    onClick={() => setDepositStep('payment')}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* Etapa 3: Detalhes do Pagamento */}
              {depositStep === 'payment' && selectedGateway && (
                <div className="p-6 space-y-6">
                  {/* Aviso Informativo */}
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Our platform does not allow CNPJ, third-party CPF and/or third-party payment methods. 90% of payments are processed by the provider within 5 minutes.
                    </p>
                  </div>

                  {/* Campo CPF */}
                  <div>
                    <label className="block text-sm text-white mb-2 flex items-center space-x-1">
                      <span>CPF</span>
                      <Info className="w-4 h-4 text-gray-400" />
                    </label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                        setCpf(value);
                      }}
                      placeholder="11 digits"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
                    />
                  </div>

                  {/* Checkbox de Termos */}
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="acceptTerms"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-700 bg-gray-800 text-green-600 focus:ring-green-500 focus:ring-2"
                    />
                    <label htmlFor="acceptTerms" className="text-sm text-gray-300 leading-relaxed">
                      I hereby accept the{' '}
                      <a href="#" className="text-blue-400 hover:text-blue-300 underline">
                        Terms & Conditions
                      </a>
                    </label>
                  </div>

                  {/* Logos de Segurança */}
                  <div className="flex items-center justify-center pt-4 border-t border-gray-700/50">
                    <img 
                      src="https://tgrhgkqpqsnkhewnmarr.supabase.co/storage/v1/object/public/banks/payaments.png" 
                      alt="Payment Security Badges" 
                      className="h-12 w-auto object-contain"
                    />
                  </div>

                  {/* Botão de Depósito */}
                  <button
                    onClick={async () => {
                      if (!cpf || cpf.length !== 11) {
                        toast.error('Por favor, informe um CPF válido (11 dígitos)');
                        return;
                      }
                      if (!acceptedTerms) {
                        toast.error('Por favor, aceite os termos e condições');
                        return;
                      }
                      if (!user || !selectedGateway || !supabase) {
                        toast.error('Erro ao processar depósito. Tente novamente.');
                        return;
                      }

                      try {
                        // Mostrar loading
                        toast.loading('Processando depósito...', { id: 'deposit-processing' });

                        // Buscar configurações completas do gateway
                        const { data: gatewayData, error: gatewayError } = await supabase
                          .from('payment_gateways')
                          .select('*')
                          .eq('id', selectedGateway.id)
                          .single();

                        if (gatewayError || !gatewayData) {
                          toast.error('Erro ao carregar configurações do gateway', { id: 'deposit-processing' });
                          return;
                        }

                        // Se o gateway é PIX (HorsePay), processar via API
                        if (gatewayData.type === 'pix' && gatewayData.api_key_encrypted && gatewayData.api_secret_encrypted) {
                          // Decodificar credenciais
                          const clientKey = atob(gatewayData.api_key_encrypted);
                          const clientSecret = atob(gatewayData.api_secret_encrypted);
                          
                          // Ler api_base_url e split_config do campo config (JSONB)
                          const gatewayConfig = gatewayData.config || {};
                          const apiBaseUrl = gatewayConfig.api_base_url || gatewayData.api_base_url || 'https://api.horsepay.io';
                          // Callback URL - obrigatório pela API HorsePay
                          // Usar webhook_url se configurado, senão usar URL padrão da aplicação
                          const callbackUrl = gatewayData.webhook_url?.trim() || `${window.location.origin}/api/deposits/callback`;

                          // 1. Autenticar na API HorsePay
                          const authResponse = await fetch(`${apiBaseUrl}/auth/token`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              client_key: clientKey,
                              client_secret: clientSecret,
                            }),
                          });

                          if (!authResponse.ok) {
                            let errorMessage = 'Erro ao autenticar na API';
                            try {
                              const authError = await authResponse.json();
                              errorMessage = authError.message || authError.error || JSON.stringify(authError);
                            } catch {
                              const errorText = await authResponse.text();
                              errorMessage = errorText || `Erro HTTP ${authResponse.status}: ${authResponse.statusText}`;
                            }
                            throw new Error(errorMessage);
                          }

                          const authData = await authResponse.json();
                          const accessToken = authData.access_token;

                          // 2. Criar pedido de depósito
                          // Parse split_config se existir (pode estar em config.split ou split_config)
                          let split = null;
                          if (gatewayConfig.split) {
                            split = gatewayConfig.split;
                          } else if (gatewayData.split_config) {
                            try {
                              split = typeof gatewayData.split_config === 'string' 
                                ? JSON.parse(gatewayData.split_config)
                                : gatewayData.split_config;
                            } catch {
                              // Ignore parse error, use null
                            }
                          }

                          // Validar dados antes de enviar
                          if (!user.name || user.name.trim().length === 0) {
                            throw new Error('Nome do usuário é obrigatório para realizar depósito');
                          }

                          if (depositAmount < 20) {
                            throw new Error('Valor mínimo de depósito é R$ 20,00');
                          }

                          // Preparar dados do pedido
                          // callback_url é obrigatório pela API HorsePay
                          const orderPayload: any = {
                            payer_name: user.name.trim(),
                            amount: parseFloat(depositAmount.toFixed(2)), // Garantir 2 casas decimais
                            callback_url: callbackUrl.trim(), // Obrigatório
                            client_reference_id: `deposit_${user.id}_${Date.now()}`,
                          };

                          // Adicionar phone apenas se fornecido e válido
                          if (user.phone && user.phone.trim()) {
                            // Remover caracteres não numéricos do telefone
                            const cleanPhone = user.phone.replace(/\D/g, '');
                            if (cleanPhone.length >= 10) {
                              orderPayload.phone = cleanPhone;
                            }
                          }

                          // Adicionar split apenas se configurado e válido
                          if (split && Array.isArray(split) && split.length > 0) {
                            orderPayload.split = split;
                          }

                          const orderResponse = await fetch(`${apiBaseUrl}/transaction/neworder`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify(orderPayload),
                          });

                          if (!orderResponse.ok) {
                            let errorMessage = 'Erro ao criar pedido de depósito';
                            try {
                              const orderError = await orderResponse.json();
                              errorMessage = orderError.message || orderError.error || JSON.stringify(orderError);
                            } catch {
                              const errorText = await orderResponse.text();
                              errorMessage = errorText || `Erro HTTP ${orderResponse.status}: ${orderResponse.statusText}`;
                            }
                            throw new Error(errorMessage);
                          }

                          const orderData = await orderResponse.json();

                          // 3. Se a API retornar sucesso, criar depósito no banco com status "pending"
                          // O depósito só será aprovado quando o pagamento for confirmado via webhook
                          const isSuccess = orderData.status === 0 || orderData.external_id;

                          if (isSuccess) {
                            // Verificar se temos QR code ou chave PIX para pagamento
                            const hasPaymentData = orderData.copy_past || orderData.payment;

                            if (!hasPaymentData) {
                              toast.error('Erro: QR code PIX não foi gerado pela API', { id: 'deposit-processing' });
                              return;
                            }

                            // Criar depósito no banco com status "pending" (aguardando pagamento)
                            const paymentInfo = {
                              qr_code: orderData.copy_past || null,
                              payment_image: orderData.payment || null,
                              external_id: orderData.external_id || null,
                            };
                            
                            const { data: depositRecord, error: depositError } = await supabase
                              .from('deposits')
                              .insert({
                                user_id: user.id,
                                amount: depositAmount,
                                method: gatewayData.type,
                                status: 'pending', // Pendente até confirmação do pagamento
                                transaction_id: orderData.external_id?.toString() || orderData.client_reference_id,
                                admin_notes: `Aguardando pagamento PIX. External ID: ${orderData.external_id || 'N/A'}. Payment Info: ${JSON.stringify(paymentInfo)}`,
                              })
                              .select()
                              .single();

                            if (depositError) {
                              console.error('Error:', depositError instanceof Error ? depositError.message : 'Unknown');
                              toast.error('Erro ao criar registro de depósito. Tente novamente.', { id: 'deposit-processing' });
                              return;
                            }

                            // NÃO atualizar saldo ainda - apenas após confirmação do pagamento via webhook
                            // O saldo será atualizado quando o webhook confirmar o pagamento

                            // Mostrar modal com QR code PIX para o usuário pagar
                            setPixPaymentData({
                              qrCode: orderData.copy_past || '',
                              paymentImage: orderData.payment || '',
                              amount: depositAmount,
                              externalId: orderData.external_id?.toString() || orderData.client_reference_id || '',
                              depositId: depositRecord?.id,
                            });
                            setDepositPaymentStatus('pending');

                            // Fechar modal de depósito e abrir modal de pagamento PIX
                            setShowDepositModal(false);
                            setShowPixPaymentModal(true);

                            // Resetar estados do formulário
                            setDepositStep('method');
                            setSelectedGateway(null);
                            setDepositAmount(20);
                            setPromoCode('');
                            setCpf('');
                            setAcceptedTerms(false);

                            toast.success(
                              `Pedido de depósito criado! Complete o pagamento PIX para finalizar.`,
                              { id: 'deposit-processing', duration: 5000 }
                            );
                          } else {
                            // Se a API não retornar sucesso, criar como pending
                            await supabase
                              .from('deposits')
                              .insert({
                                user_id: user.id,
                                amount: depositAmount,
                                method: gatewayData.type,
                                status: 'pending',
                                transaction_id: orderData.external_id?.toString() || null,
                              });

                            toast.success(
                              `Pedido de depósito criado. Aguardando confirmação do pagamento.`,
                              { id: 'deposit-processing', duration: 5000 }
                            );

                            setShowDepositModal(false);
                            setDepositStep('method');
                            setSelectedGateway(null);
                            setDepositAmount(20);
                            setPromoCode('');
                            setCpf('');
                            setAcceptedTerms(false);
                          }
                        } else {
                          // Para outros tipos de gateway, criar como pending para aprovação manual
                          const { error: depositError } = await supabase
                            .from('deposits')
                            .insert({
                              user_id: user.id,
                              amount: depositAmount,
                              method: gatewayData.type,
                              status: 'pending',
                              admin_notes: `CPF: ${cpf}`,
                            });

                          if (depositError) {
                            toast.error('Erro ao criar pedido de depósito', { id: 'deposit-processing' });
                            return;
                          }

                          toast.success(
                            `Pedido de depósito de ${formatCurrency(depositAmount)} criado. Aguardando aprovação.`,
                            { id: 'deposit-processing', duration: 5000 }
                          );

                          setShowDepositModal(false);
                          setDepositStep('method');
                          setSelectedGateway(null);
                          setDepositAmount(20);
                          setPromoCode('');
                          setCpf('');
                          setAcceptedTerms(false);
                        }
                      } catch (error: any) {
                        console.error('Error:', error instanceof Error ? error.message : 'Unknown');
                        toast.error(
                          error.message || 'Erro ao processar depósito. Tente novamente.',
                          { id: 'deposit-processing', duration: 5000 }
                        );
                      }
                    }}
                    disabled={!cpf || cpf.length !== 11 || !acceptedTerms}
                    className={`w-full py-4 rounded-lg font-medium text-lg transition-all ${
                      cpf && cpf.length === 11 && acceptedTerms
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Deposit {formatCurrency(depositAmount)}
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de Pagamento PIX */}
      {showPixPaymentModal && pixPaymentData && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowPixPaymentModal(false)}
          />
          {/* Modal */}
          <div 
            className="fixed inset-0 flex items-center justify-center z-[60] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-black backdrop-blur-xl shadow-2xl overflow-hidden w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease-out_forwards] border border-gray-800/50 flex flex-col max-h-[90vh] sm:max-h-[85vh] rounded"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700/50 flex items-center justify-between flex-shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-white">Pagamento PIX</h2>
                <button
                  onClick={() => setShowPixPaymentModal(false)}
                  className="p-2 hover:bg-gray-800/50 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Conteúdo - Scroll */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Status do Pagamento - Sucesso */}
                {depositPaymentStatus === 'completed' && (
                  <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 text-center animate-pulse">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                      <p className="text-lg font-semibold text-green-400">Pagamento Confirmado!</p>
                    </div>
                    <p className="text-sm text-gray-300">
                      Seu depósito de {formatCurrency(pixPaymentData.amount)} foi aprovado e seu saldo foi atualizado.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Esta janela será fechada em breve...</p>
                  </div>
                )}

                {/* Valor */}
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-400 mb-2">Valor a pagar</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{formatCurrency(pixPaymentData.amount)}</p>
                </div>

                {/* QR Code - Ocultar quando pagamento confirmado */}
                {depositPaymentStatus !== 'completed' && pixPaymentData.paymentImage && (
                  <div className="flex flex-col items-center space-y-3 sm:space-y-4">
                    <p className="text-xs sm:text-sm text-gray-400 text-center px-2">
                      Escaneie o QR code com o app do seu banco
                    </p>
                    <div className="bg-white p-2 sm:p-4 rounded-lg w-full max-w-[280px] sm:max-w-none">
                      <img 
                        src={pixPaymentData.paymentImage} 
                        alt="QR Code PIX" 
                        className="w-full h-auto object-contain aspect-square"
                      />
                    </div>
                  </div>
                )}

                {/* Código PIX Copiável - Ocultar quando pagamento confirmado */}
                {depositPaymentStatus !== 'completed' && pixPaymentData.qrCode && (
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm text-gray-400 text-center px-2">
                      Ou copie o código PIX abaixo
                    </p>
                    <div className="relative">
                      <textarea
                        readOnly
                        value={pixPaymentData.qrCode}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800/50 border border-gray-700/50 rounded text-[10px] sm:text-xs text-white font-mono resize-none pr-12 sm:pr-14"
                        rows={4}
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pixPaymentData.qrCode);
                            toast.success('Código PIX copiado!', { duration: 2000 });
                          } catch (error) {
                            // Fallback para navegadores mais antigos
                            const textArea = document.createElement('textarea');
                            textArea.value = pixPaymentData.qrCode;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            toast.success('Código PIX copiado!', { duration: 2000 });
                          }
                        }}
                        className="absolute top-2 right-2 p-1.5 sm:p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="Copiar código PIX"
                      >
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Instruções - Ocultar quando pagamento confirmado */}
                {depositPaymentStatus !== 'completed' && (
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                      <strong className="text-white">Instruções:</strong>
                      <br />
                      1. Escaneie o QR code ou copie o código PIX
                      <br />
                      2. Abra o app do seu banco e faça o pagamento
                      <br />
                      3. Aguarde a confirmação (geralmente em até 5 minutos)
                      <br />
                      4. Seu saldo será atualizado automaticamente após a confirmação
                    </p>
                  </div>
                )}

                {/* ID da Transação */}
                {pixPaymentData.externalId && (
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      ID da transação: <span className="text-gray-400 font-mono break-all">{pixPaymentData.externalId}</span>
                    </p>
                  </div>
                )}

                {/* Botão Fechar */}
                <button
                  onClick={() => setShowPixPaymentModal(false)}
                  className="w-full py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base font-medium rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TradingPage;