/**
 * OTC Price Engine
 * 
 * Gera preços sintéticos realistas para ativos quando o mercado está fechado.
 * Usa modelo Ornstein-Uhlenbeck (mean-reverting random walk) com:
 * - Volatilidade calibrada por tipo de ativo
 * - Mean reversion para evitar drift excessivo
 * - Micro-tendências aleatórias para parecer natural
 * - Spread bid/ask simulado
 * 
 * Todos os clientes conectados vêem os mesmos preços (gerados no servidor).
 */

export interface OTCConfig {
  /** Volatilidade por tick (desvio padrão relativo ao preço) */
  volatility: number;
  /** Velocidade de reversão à média (0-1, maior = mais rápido) */
  meanReversionSpeed: number;
  /** Frequência de geração de ticks em ms */
  tickIntervalMs: number;
  /** Spread bid/ask em % do preço */
  spreadPercent: number;
  /** Força máxima de micro-tendência */
  maxTrendStrength: number;
  /** Duração média de uma micro-tendência em ticks */
  trendDurationTicks: number;
}

/** Configurações por categoria de ativo */
const OTC_CONFIGS: Record<string, OTCConfig> = {
  forex: {
    // Calibrado para ~3-5 pips/min em EUR/USD (1.19): sqrt(100)*0.00002*1.19 ≈ 2.4 pips random
    volatility: 0.00002,
    meanReversionSpeed: 0.003,
    tickIntervalMs: 600,
    spreadPercent: 0.001,
    maxTrendStrength: 0.000008,
    trendDurationTicks: 80,
  },
  stocks: {
    volatility: 0.0001,
    meanReversionSpeed: 0.005,
    tickIntervalMs: 800,
    spreadPercent: 0.01,
    maxTrendStrength: 0.00005,
    trendDurationTicks: 50,
  },
  indices: {
    volatility: 0.00007,
    meanReversionSpeed: 0.005,
    tickIntervalMs: 700,
    spreadPercent: 0.005,
    maxTrendStrength: 0.00004,
    trendDurationTicks: 50,
  },
  commodities: {
    volatility: 0.00008,
    meanReversionSpeed: 0.004,
    tickIntervalMs: 800,
    spreadPercent: 0.008,
    maxTrendStrength: 0.00004,
    trendDurationTicks: 50,
  },
};

export interface OTCTick {
  symbol: string;
  price: number;
  timestamp: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  isOTC: true;
}

export interface OTCCandle {
  time: number;     // timestamp em ms
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Motor OTC para um símbolo individual
 */
class OTCSymbolEngine {
  private symbol: string;
  private config: OTCConfig;
  private basePrice: number;       // Preço de referência (último preço real)
  private currentPrice: number;
  private lastPrice: number;
  private interval: NodeJS.Timeout | null = null;
  private onTick: (tick: OTCTick) => void;
  
  // Estado do modelo Ornstein-Uhlenbeck
  private meanPrice: number;       // Preço médio para reversão
  private trendDirection: number;  // Direção da micro-tendência (-1, 0, 1)
  private trendStrength: number;   // Força atual da tendência
  private trendTicksLeft: number;  // Ticks restantes na tendência atual
  private momentum: number;        // Inércia do movimento
  
  // Seed para reproducibilidade (todos os clientes vêem o mesmo)
  private seed: number;

  constructor(
    symbol: string,
    category: string,
    basePrice: number,
    onTick: (tick: OTCTick) => void
  ) {
    this.symbol = symbol;
    this.config = OTC_CONFIGS[category] || OTC_CONFIGS.forex;
    this.basePrice = basePrice;
    this.currentPrice = basePrice;
    this.lastPrice = basePrice;
    this.meanPrice = basePrice;
    this.onTick = onTick;
    this.trendDirection = 0;
    this.trendStrength = 0;
    this.trendTicksLeft = 0;
    this.momentum = 0;
    
    // Seed baseado no símbolo e na hora atual (arredondada para minuto)
    // Isso garante que todos os clientes que se conectam no mesmo minuto
    // vejam a mesma sequência de preços
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60000);
    this.seed = this.hashCode(`${symbol}:${minuteKey}`);
  }

  /**
   * Inicia geração de ticks OTC
   */
  start(): void {
    if (this.interval) return;
    
    this.interval = setInterval(() => {
      this.generateTick();
    }, this.config.tickIntervalMs);
    
    // Gerar primeiro tick imediatamente
    this.generateTick();
  }

  /**
   * Para geração de ticks
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Retorna se está rodando
   */
  isRunning(): boolean {
    return this.interval !== null;
  }

  /**
   * Gera um tick sintético usando modelo Ornstein-Uhlenbeck com micro-tendências
   */
  private generateTick(): void {
    const { volatility, meanReversionSpeed, maxTrendStrength, trendDurationTicks, spreadPercent } = this.config;
    
    // 1. Atualizar micro-tendência
    if (this.trendTicksLeft <= 0) {
      // Iniciar nova micro-tendência
      const rand = this.nextRandom();
      if (rand < 0.3) {
        this.trendDirection = -1; // Tendência de baixa
      } else if (rand > 0.7) {
        this.trendDirection = 1;  // Tendência de alta
      } else {
        this.trendDirection = 0;  // Sem tendência (consolidação)
      }
      this.trendStrength = this.nextRandom() * maxTrendStrength;
      this.trendTicksLeft = Math.floor(this.nextRandom() * trendDurationTicks) + 5;
    }
    this.trendTicksLeft--;
    
    // 2. Componente de tendência
    const trendComponent = this.trendDirection * this.trendStrength * this.currentPrice;
    
    // 3. Componente de reversão à média (Ornstein-Uhlenbeck)
    const meanReversionComponent = meanReversionSpeed * (this.meanPrice - this.currentPrice);
    
    // 4. Componente aleatório (ruído gaussiano)
    const randomComponent = this.gaussianRandom() * volatility * this.currentPrice;
    
    // 5. Momentum (inércia do movimento anterior) - fator reduzido para evitar impulsos
    this.momentum = this.momentum * 0.5 + (this.currentPrice - this.lastPrice) * 0.2;
    const momentumComponent = this.momentum * 0.3;
    
    // 6. Calcular novo preço
    this.lastPrice = this.currentPrice;
    const priceChange = trendComponent + meanReversionComponent + randomComponent + momentumComponent;
    this.currentPrice = this.currentPrice + priceChange;
    
    // 7. Garantir que o preço não fique negativo ou excessivamente distante
    const maxDeviation = this.basePrice * 0.02; // 2% de desvio máximo do preço base
    const deviation = Math.abs(this.currentPrice - this.basePrice);
    if (deviation > maxDeviation) {
      const pullStrength = 0.05 + 0.15 * ((deviation - maxDeviation) / maxDeviation);
      this.currentPrice = this.currentPrice + (this.basePrice - this.currentPrice) * pullStrength;
    }
    
    // 8. Calcular bid/ask
    const halfSpread = this.currentPrice * spreadPercent / 200;
    const bid = this.currentPrice - halfSpread;
    const ask = this.currentPrice + halfSpread;
    
    // 9. Criar tick
    const change = this.currentPrice - this.basePrice;
    const changePercent = (change / this.basePrice) * 100;
    
    const tick: OTCTick = {
      symbol: this.symbol,
      price: this.currentPrice,
      timestamp: Date.now(),
      bid,
      ask,
      change,
      changePercent,
      isOTC: true,
    };
    
    this.onTick(tick);
  }

  /**
   * Gera candles históricos sintéticos (para preencher o gráfico)
   * Gera de trás para frente a partir do preço base
   */
  generateHistoricalCandles(count: number, intervalMs: number): OTCCandle[] {
    const now = Date.now();
    
    // Ancorar no currentPrice (se engine está rodando) ou basePrice
    const anchorPrice = this.currentPrice > 0 ? this.currentPrice : this.basePrice;
    const { volatility } = this.config;
    
    let tempSeed = this.hashCode(`${this.symbol}:hist:${Math.floor(now / intervalMs)}`);
    
    const tempRandom = (): number => {
      tempSeed = (tempSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (tempSeed >>> 0) / 0xFFFFFFFF;
    };
    
    const tempGaussian = (): number => {
      const u1 = tempRandom();
      const u2 = tempRandom();
      return Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
    };
    
    // Gerar candles do mais recente para o mais antigo, começando em anchorPrice
    let price = anchorPrice;
    const rawCandles: OTCCandle[] = [];
    for (let i = 0; i < count; i++) {
      const candleTime = now - (i * intervalMs);
      const candleTimeAligned = Math.floor(candleTime / intervalMs) * intervalMs;
      
      const candleVolatility = volatility * Math.sqrt(intervalMs / 1000) * price;
      
      const open = price;
      const ticksInCandle = Math.max(4, Math.floor(intervalMs / 1000));
      
      let high = open;
      let low = open;
      
      let innerPrice = open;
      for (let t = 0; t < ticksInCandle; t++) {
        const change = tempGaussian() * candleVolatility / Math.sqrt(ticksInCandle);
        const trend = (tempRandom() - 0.5) * candleVolatility * 0.1;
        innerPrice += change + trend;
        
        high = Math.max(high, innerPrice);
        low = Math.min(low, innerPrice);
      }
      const close = innerPrice;
      
      high = Math.max(open, close, high);
      low = Math.min(open, close, low);
      
      rawCandles.push({ time: candleTimeAligned, open, high, low, close });
      
      price = close;
    }
    
    // Inverter para ordem cronológica
    rawCandles.reverse();

    // Garantir continuidade OHLC: open de cada candle = close do anterior
    for (let i = 1; i < rawCandles.length; i++) {
      const prevClose = rawCandles[i - 1].close;
      rawCandles[i].open = prevClose;
      rawCandles[i].high = Math.max(rawCandles[i].high, rawCandles[i].open, rawCandles[i].close);
      rawCandles[i].low = Math.min(rawCandles[i].low, rawCandles[i].open, rawCandles[i].close);
    }

    // Último candle fecha exatamente no preço-âncora (continuidade histórico → live)
    if (rawCandles.length > 0) {
      const lastIdx = rawCandles.length - 1;
      const last = rawCandles[lastIdx];
      const prevClose = lastIdx > 0 ? rawCandles[lastIdx - 1].close : anchorPrice;

      last.open = prevClose;
      last.close = anchorPrice;
      last.high = Math.max(last.open, last.close, last.high);
      last.low = Math.min(last.open, last.close, last.low);
    }

    return rawCandles;
  }

  /**
   * Atualiza o preço base suavemente (sem salto brusco)
   * Transiciona o preço atual gradualmente em vez de pular
   */
  updateBasePrice(newPrice: number): void {
    this.basePrice = newPrice;
    this.meanPrice = newPrice;
    // NÃO resetar currentPrice e lastPrice - deixar o motor transicionar suavemente
    // A mean reversion vai puxar o preço atual em direção ao novo basePrice naturalmente
  }

  /**
   * Força o preço para um valor específico (hard reset)
   */
  forcePrice(newPrice: number): void {
    this.basePrice = newPrice;
    this.meanPrice = newPrice;
    this.currentPrice = newPrice;
    this.lastPrice = newPrice;
  }

  getCurrentPrice(): number {
    return this.currentPrice;
  }

  // -- Funções utilitárias de aleatoriedade determinística --
  
  private nextRandom(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }

  private gaussianRandom(): number {
    const u1 = this.nextRandom();
    const u2 = this.nextRandom();
    return Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Gerenciador global de motores OTC
 * Mantém um motor por símbolo ativo
 */
export class OTCEngineManager {
  private engines: Map<string, OTCSymbolEngine> = new Map();
  private onTickCallback: (tick: OTCTick) => void;

  constructor(onTick: (tick: OTCTick) => void) {
    this.onTickCallback = onTick;
  }

  /**
   * Inicia OTC para um símbolo
   */
  startSymbol(symbol: string, category: string, lastRealPrice: number): void {
    // Se já existe motor para este símbolo, parar antes
    this.stopSymbol(symbol);
    
    const engine = new OTCSymbolEngine(
      symbol,
      category,
      lastRealPrice,
      this.onTickCallback
    );
    
    this.engines.set(symbol, engine);
    engine.start();
  }

  /**
   * Para OTC para um símbolo
   */
  stopSymbol(symbol: string): void {
    const engine = this.engines.get(symbol);
    if (engine) {
      engine.stop();
      this.engines.delete(symbol);
    }
  }

  /**
   * Para todos os motores OTC
   */
  stopAll(): void {
    this.engines.forEach((engine) => engine.stop());
    this.engines.clear();
  }

  /**
   * Verifica se OTC está ativo para um símbolo
   */
  isActive(symbol: string): boolean {
    const engine = this.engines.get(symbol);
    return engine?.isRunning() ?? false;
  }

  /**
   * Gera candles históricos OTC para um símbolo
   */
  generateHistorical(symbol: string, category: string, lastRealPrice: number, count: number, intervalMs: number): OTCCandle[] {
    // Criar engine temporária para gerar histórico
    const tempEngine = new OTCSymbolEngine(symbol, category, lastRealPrice, () => {});
    return tempEngine.generateHistoricalCandles(count, intervalMs);
  }

  /**
   * Atualiza o preço base de um símbolo ativo (transição suave, sem parar)
   */
  updateBasePrice(symbol: string, newPrice: number): void {
    const engine = this.engines.get(symbol);
    if (engine) {
      engine.updateBasePrice(newPrice);
    }
  }

  /**
   * Força preço imediato (re-anchor após TwelveData → OTC)
   */
  forcePrice(symbol: string, newPrice: number): void {
    const engine = this.engines.get(symbol);
    if (engine) {
      engine.forcePrice(newPrice);
    }
  }

  /**
   * Retorna preço atual OTC de um símbolo
   */
  getCurrentPrice(symbol: string): number | null {
    const engine = this.engines.get(symbol);
    return engine?.getCurrentPrice() ?? null;
  }

  /**
   * Retorna lista de símbolos com OTC ativo
   */
  getActiveSymbols(): string[] {
    return Array.from(this.engines.keys()).filter(s => this.isActive(s));
  }
}
