/**
 * MarketDataServer - Servidor WebSocket Centralizado
 * 
 * Single Source of Truth (SSoT) para dados de mercado
 * 
 * Responsabilidades:
 * 1. Conectar a APIs externas (Binance, Polygon/TwelveData)
 * 2. Normalizar dados para formato canônico
 * 3. Gravar no Redis (SSoT)
 * 4. Broadcast para todos os clientes conectados
 */

import WebSocket from 'ws';
import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import { marketService } from '../services/marketService';
import { OTCEngineManager, OTCTick } from '../engine/otcEngine';
import { shouldUseOTC, getMarketStatus, MarketCategory } from '../utils/marketHours';

// Carregar variáveis de ambiente do .env.local
// tsx carrega automaticamente, mas garantimos com dotenv se necessário
try {
  // Tentar carregar dotenv se disponível
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch (e) {
  // dotenv não disponível, tsx deve carregar automaticamente
}

// Formato canônico de dados de mercado
export interface CanonicalTick {
  symbol: string;
  price: number; // Preço principal (close para candles)
  timestamp: number;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  // Dados OHLC completos (quando disponíveis, ex: kline da Binance)
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  isClosed?: boolean; // Indica se o candle está fechado ou em formação
  isOTC?: boolean; // Indica se o tick é OTC (preço sintético)
}

// Configuração do servidor
const WS_PORT = process.env.MARKET_DATA_PORT ? parseInt(process.env.MARKET_DATA_PORT) : 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Clientes WebSocket conectados
const clients = new Set<WebSocket>();

// Mapa de subscrições: cliente -> Set de símbolos subscritos
const clientSubscriptions = new Map<WebSocket, Set<string>>();

// Conexões upstream (APIs externas)
interface UpstreamConnection {
  ws: WebSocket | null;
  symbol: string;
  source: 'binance' | 'polygon' | 'twelvedata';
  reconnectInterval?: NodeJS.Timeout | null;
}

const upstreamConnections = new Map<string, UpstreamConnection>();

// Rate limiting: rastrear última tentativa de conexão por símbolo
const lastConnectionAttempt = new Map<string, number>();
const CONNECTION_COOLDOWN = 60000; // 60 segundos entre tentativas de reconexão

// ===== OTC Engine =====
// Gerenciador de motores OTC para preços sintéticos quando mercado fechado
const otcManager = new OTCEngineManager((otcTick: OTCTick) => {
  // Converter OTCTick para CanonicalTick e processar
  const canonicalTick: CanonicalTick = {
    symbol: otcTick.symbol,
    price: otcTick.price,
    timestamp: otcTick.timestamp,
    bid: otcTick.bid,
    ask: otcTick.ask,
    change: otcTick.change,
    changePercent: otcTick.changePercent,
    isOTC: true,
  };
  processTickOTC(canonicalTick);
});

// Cache de último preço real por símbolo (para iniciar OTC quando mercado fecha)
const lastRealPrices = new Map<string, number>();

/**
 * Processa tick OTC (bypass da validação de timestamp do processTick normal)
 * Ticks OTC são sempre válidos pois são gerados no momento
 */
async function processTickOTC(tick: CanonicalTick): Promise<void> {
  if (!tick.symbol || !tick.price || !isFinite(tick.price)) {
    return;
  }
  
  // Salvar no Redis
  await saveToRedis(tick);
  
  // Broadcast para clientes subscritos
  const message = JSON.stringify({
    type: 'tick',
    data: tick
  });
  
  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const subscriptions = clientSubscriptions.get(client);
      if (subscriptions && subscriptions.has(tick.symbol)) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          clients.delete(client);
          clientSubscriptions.delete(client);
        }
      }
    }
  });
}

// Contador incremental por símbolo para garantir timestamps únicos para candles em formação
// Isso resolve o problema de timestamps duplicados quando a Binance envia múltiplas atualizações rapidamente
const tickCounter = new Map<string, number>();

// Redis Client
let redisClient: RedisClientType | null = null;

/**
 * Inicializa conexão com Redis
 */
async function initRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 2) return false; // Desistir após 2 tentativas
          return Math.min(retries * 500, 2000);
        }
      }
    });
    
    redisClient.on('error', () => {
      // Silenciar erros de conexão Redis (modo degradado)
    });
    
    redisClient.on('connect', () => {});
    
    // Timeout de 5s para conexão Redis
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis timeout')), 5000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
  } catch {
    redisClient = null; // Modo degradado: continuar sem Redis
  }
}

/**
 * Grava tick no Redis (SSoT)
 */
async function saveToRedis(tick: CanonicalTick): Promise<void> {
  if (!redisClient) {
    return; // Modo degradado: continuar sem Redis
  }

  try {
    const key = `PRICE:LATEST:${tick.symbol}`;
    const value = JSON.stringify({
      ...tick,
      updatedAt: Date.now()
    });
    
    await redisClient.set(key, value);
    // Opcional: também salvar histórico com TTL
    const historyKey = `PRICE:HISTORY:${tick.symbol}`;
    await redisClient.lPush(historyKey, value);
    await redisClient.lTrim(historyKey, 0, 999); // Manter últimos 1000 ticks
  } catch (error) {
    console.error('[Redis] Erro ao salvar tick:', tick.symbol);
  }
}

/**
 * Conecta à Binance WebSocket
 */
function connectBinance(symbol: string): void {
  // Binance usa formato específico: BTC/USD -> BTCUSDT, ETH/USD -> ETHUSDT
  // Mapear símbolos corretamente
  let binanceSymbol = symbol.replace('/', '').toUpperCase();
  
  // Mapear pares crypto para formato Binance (sempre usar USDT como quote)
  // Binance suporta muitos pares: BTC, ETH, SOL, BNB, ADA, DOT, MATIC, AVAX, LINK, UNI, XRP, DOGE, etc.
  if (symbol === 'BTC/USD' || symbol.includes('BTC')) {
    binanceSymbol = 'BTCUSDT';
  } else if (symbol === 'ETH/USD' || symbol.includes('ETH')) {
    binanceSymbol = 'ETHUSDT';
  } else if (symbol.includes('/USD')) {
    // Para outros pares crypto com USD, tentar converter para USDT
    // Ex: SOL/USD -> SOLUSDT
    const baseCurrency = symbol.split('/')[0].toUpperCase();
    binanceSymbol = `${baseCurrency}USDT`;
  } else {
    // Se já está no formato correto (ex: BTCUSDT), usar diretamente
    binanceSymbol = symbol.replace('/', '').toUpperCase();
  }
  
  // Usar stream de kline (candles) em vez de ticker para ter dados completos OHLC
  // O stream @kline_1m envia candles de 1 minuto atualizados a cada segundo
  const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@kline_1m`;
  
  const ws = new WebSocket(wsUrl);
  const connection: UpstreamConnection = {
    ws,
    symbol,
    source: 'binance'
  };
  
  upstreamConnections.set(`binance:${symbol}`, connection);
  
  ws.on('open', () => {
    // Conectado ao Binance
  });
  
  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Binance kline format: { e: "kline", E: 123456789, s: "BTCUSDT", k: { ... } }
      // k.kline = { t: start time, T: end time, s: symbol, i: interval, o: open, h: high, l: low, c: close, v: volume, x: is closed }
      // x = true significa que o candle está fechado, false significa que está em formação
      if (!message.k) {
        return;
      }
      
      const kline = message.k;
      const isClosed = kline.x === true; // Candle fechado
      const open = parseFloat(kline.o || '0');
      const high = parseFloat(kline.h || '0');
      const low = parseFloat(kline.l || '0');
      const close = parseFloat(kline.c || '0'); // Preço de fechamento (último preço se não fechado)
      const volume = parseFloat(kline.v || '0');
      const startTime = kline.t || Date.now(); // Timestamp de início do candle (milissegundos)
      const endTime = kline.T || Date.now(); // Timestamp de fim do candle (milissegundos)
      
      // Validar preços
      if (!close || !isFinite(close) || close <= 0) {
        return;
      }
      
      // Usar o preço de fechamento (close) como preço principal
      // O candle em formação (x=false) será atualizado continuamente até fechar
      const price = close;
      const eventTime = endTime; // Usar endTime como timestamp do tick
      
      // CRÍTICO: Calcular o período atual (início do minuto atual)
      const PERIOD_MS = 60000; // 1 minuto em milissegundos
      const now = Date.now();
      const currentPeriodStart = Math.floor(now / PERIOD_MS) * PERIOD_MS;
      const tickPeriodStart = Math.floor(startTime / PERIOD_MS) * PERIOD_MS;
      
      // CRÍTICO: Ignorar candles que não sejam do período atual
      // Isso evita enviar dados antigos quando a conexão é estabelecida
      // Apenas enviar:
      // 1. Candles em formação (isClosed = false) do período atual
      // 2. Candles fechados do período atual (último minuto fechado)
      const isCurrentPeriod = tickPeriodStart === currentPeriodStart || tickPeriodStart === (currentPeriodStart - PERIOD_MS);
      
      if (!isCurrentPeriod && isClosed) {
        return;
      }
      
      // CRÍTICO: Para candles em formação, usar timestamp único incremental para permitir animação
      // Para candles fechados, usar startTime (início do período) para manter consistência
      // Isso resolve o problema de timestamps duplicados quando a Binance envia múltiplas atualizações rapidamente
      let tickTimestamp: number;
      if (isClosed) {
        // Candle fechado: usar startTime (início do período)
        tickTimestamp = startTime;
      } else {
        // Candle em formação: usar timestamp atual + contador incremental para garantir unicidade
        const baseTimestamp = Date.now();
        const counter = (tickCounter.get(symbol) || 0) + 1;
        tickCounter.set(symbol, counter);
        // Adicionar contador como milissegundos fracionários para garantir unicidade
        // Usar apenas os últimos 3 dígitos do contador para não exceder 1 segundo
        tickTimestamp = baseTimestamp + (counter % 1000);
      }
      
      // Normalizar formato Binance para canônico
      const tick: CanonicalTick = {
        symbol,
        price: close, // Preço principal (close)
        timestamp: tickTimestamp, // Timestamp atual para candles em formação, startTime para fechados
        volume: volume,
        // Dados OHLC completos do kline
        open: open,
        high: high,
        low: low,
        close: close,
        isClosed: isClosed, // Indica se o candle está fechado
        // Para candles, podemos incluir informações adicionais
        bid: low, // Usar low como bid aproximado
        ask: high, // Usar high como ask aproximado
      };
      
      processTick(tick);
    } catch (error) {
      console.error('[Binance] Erro ao processar kline para', symbol);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[Binance] Erro WebSocket para', symbol);
  });
  
  ws.on('close', () => {
    // Reconexão automática
    const reconnectInterval = setTimeout(() => {
      connectBinance(symbol);
    }, 5000);
    
    connection.reconnectInterval = reconnectInterval;
  });
}

/**
 * Conecta à API real de Forex
 * Tenta usar Polygon.io WebSocket (se API key disponível)
 * Fallback para REST API se não tiver key
 */
function connectPolygon(symbol: string): void {
  const twelvedataApiKey = process.env.TWELVEDATA_API_KEY;
  const polygonApiKey = process.env.POLYGON_API_KEY;
  
  // Prioridade 1: Twelve Data WebSocket (tempo real)
  if (twelvedataApiKey) {
    connectTwelveData(symbol, twelvedataApiKey);
    return;
  }
  
  // Prioridade 2: Polygon.io WebSocket (requer plano pago)
  if (polygonApiKey) {
    connectPolygonWebSocket(symbol, polygonApiKey);
    return;
  }
  
  // Prioridade 3: Fallback REST API (sem key - ExchangeRate-API)
  connectPolygonREST(symbol);
}

/**
 * Conecta ao Twelve Data REST API para Forex (melhor que ExchangeRate-API)
 */
function connectTwelveDataREST(symbol: string, apiKey: string): void {
  // Converter símbolo para formato Twelve Data (ex: GBP/USD -> GBPUSD)
  const twelvedataSymbol = symbol.replace('/', '');
  
  let lastPrice = 0;
  let lastUpdate = 0;
  let consecutiveErrors = 0;
  const maxErrors = 5;
  const updateInterval = 60000; // Atualizar a cada 60 segundos (melhor que 1 hora)
  const intervalRef = { current: null as NodeJS.Timeout | null };

  const fetchPrice = async () => {
    try {
      // Twelve Data REST API - Real-time price
      // Para Forex, o símbolo pode precisar do prefixo "FX:" ou formato específico
      // Tentar primeiro sem prefixo, depois com prefixo se falhar
      let url = `https://api.twelvedata.com/price?symbol=${twelvedataSymbol}&apikey=${apiKey}`;
      let response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      
      // Se falhar, tentar com prefixo FX: para Forex
      if (!response.ok && consecutiveErrors === 0) {
        const fxSymbol = `FX:${twelvedataSymbol}`;
        url = `https://api.twelvedata.com/price?symbol=${fxSymbol}&apikey=${apiKey}`;
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
      }

      if (response.ok) {
        const data = await response.json();
        
        // Twelve Data pode retornar diferentes formatos
        // Formato 1: { price: "1.2750" }
        // Formato 2: { close: "1.2750" }
        // Formato 3: { value: "1.2750" }
        // Formato 4: { data: { price: "1.2750" } }
        // Também pode retornar erro: { code: 400, message: "..." }
        
        if (data.code && data.message) {
          throw new Error(`API Error: ${data.message} (code: ${data.code})`);
        }
        
        const price = parseFloat(
          data.price || 
          data.close || 
          data.value || 
          data.data?.price || 
          data.data?.close ||
          0
        );
        
        if (price && isFinite(price) && price > 0) {
          const change = lastPrice > 0 ? price - lastPrice : 0;
          const changePercent = lastPrice > 0 ? (change / lastPrice) * 100 : 0;

          const tick: CanonicalTick = {
            symbol,
            price,
            timestamp: Date.now(),
            change,
            changePercent,
            bid: price * 0.9999, // Aproximação
            ask: price * 1.0001, // Aproximação
          };

          lastPrice = price;
          lastUpdate = Date.now();
          consecutiveErrors = 0;
          processTick(tick);
        } else {
          throw new Error(`Preço inválido na resposta. Dados recebidos: ${JSON.stringify(data)}`);
        }
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        // Se erro 404 ou 429, lançar erro específico para usar fallback imediatamente
        if (response.status === 404 || response.status === 429) {
          throw new Error(`API Error: ${errorData.message || errorText} (code: ${response.status})`);
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      consecutiveErrors++;
      const errorMessage = error.message || error.toString();
      console.error('[TwelveData] Erro ao buscar preço para', symbol);

      // Se erro 404 (símbolo não encontrado) ou 429 (limite excedido), usar fallback imediatamente
      if (errorMessage.includes('404') || errorMessage.includes('429') || errorMessage.includes('symbol') || errorMessage.includes('invalid')) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        connectPolygonREST(symbol); // Fallback final para ExchangeRate-API
        return;
      }

      if (consecutiveErrors >= maxErrors) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        connectPolygonREST(symbol); // Fallback final para ExchangeRate-API
        return;
      }
    }
  };

  // Buscar imediatamente
  fetchPrice();
  
  // Depois atualizar periodicamente
  intervalRef.current = setInterval(fetchPrice, updateInterval) as any;

  const connection: UpstreamConnection = {
    ws: null,
    symbol,
    source: 'twelvedata',
    reconnectInterval: intervalRef.current
  };

  upstreamConnections.set(`twelvedata:${symbol}`, connection);
}

/**
 * Conecta ao Twelve Data WebSocket para Forex
 */
function connectTwelveData(symbol: string, apiKey: string): void {
  // Verificar rate limiting
  const lastAttempt = lastConnectionAttempt.get(`twelvedata:${symbol}`);
  const now = Date.now();
  if (lastAttempt && (now - lastAttempt) < CONNECTION_COOLDOWN) {
    return;
  }
  
  // Verificar se o símbolo está habilitado
  const pair = marketService.getPair(symbol);
  if (!pair || !pair.enabled) {
    return;
  }
  
  // Registrar tentativa de conexão
  lastConnectionAttempt.set(`twelvedata:${symbol}`, now);
  
  // Converter símbolo para formato Twelve Data
  // Forex/Commodities: EUR/USD -> EUR/USD (manter com barra, formato aceito pelo Twelve Data)
  // Stocks/Indices: AAPL, SPX -> AAPL, SPX (sem barra, já correto)
  const twelvedataSymbol = symbol;
  
  // Variáveis de estado
  let ws: WebSocket | null = null;
  let lastPrice = 0;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3; // Reduzido de 5 para 3 para evitar excesso de requisições
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let formatAttempts = 0; // Contador de tentativas de formato
  const maxFormatAttempts = 1; // Reduzido de 2 para 1 para evitar excesso de requisições
  let subscriptionSuccessful = false; // Flag para indicar se subscrição foi bem-sucedida

  const connect = () => {
    try {
      // Twelve Data WebSocket endpoint
      // Sempre usar endpoint /price conforme documentação
      const endpoint = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;
      ws = new WebSocket(endpoint);

      ws.on('open', () => {
        reconnectAttempts = 0;
        formatAttempts = 0; // Reset contador de formatos
        subscriptionSuccessful = false; // Reset flag

        // Formato de subscrição do Twelve Data
        // Usar formato original com barra (EUR/USD funciona conforme logs)
        const subscribeMessage = JSON.stringify({
          action: 'subscribe',
          params: {
            symbols: symbol // Formato original: EUR/USD
          }
        });

        ws!.send(subscribeMessage);
        
        // Iniciar heartbeat (requerido pela documentação)
        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN && subscriptionSuccessful) {
            const heartbeatMessage = JSON.stringify({
              action: 'heartbeat'
            });
            ws.send(heartbeatMessage);
          } else if (!ws || ws.readyState !== WebSocket.OPEN) {
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
          }
        }, 30000); // Heartbeat a cada 30 segundos
      });

      ws.on('message', (data: Buffer) => {
        try {
          const rawData = data.toString();
          const message = JSON.parse(rawData);

          // Twelve Data WebSocket pode retornar diferentes formatos:
          // Formato 1: { "event": "price", "symbol": "GBPUSD", "price": "1.2750", ... }
          // Formato 2: { "type": "quote", "symbol": "GBPUSD", "close": "1.2750", ... }
          // Formato 3: { "status": "ok", "message": "subscribed" }
          // Formato 4: { "event": "heartbeat", "status": "ok" }
          
          // Ignorar heartbeats
          if (message.event === 'heartbeat' || message.type === 'heartbeat') {
            return;
          }
          
          // Verificar se é confirmação de subscrição
          if (message.status === 'ok' && (message.event === 'subscribe' || message.event === 'subscribe-status' || message.message?.includes('subscribed'))) {
            subscriptionSuccessful = true;
            return;
          }
          
          // Verificar se é erro de subscrição - APENAS UMA VEZ
          if (message.event === 'subscribe-status' && message.status === 'error' && !subscriptionSuccessful && formatAttempts < maxFormatAttempts) {
            formatAttempts++;
            const failedSymbols = message.fails || [];
              if (failedSymbols.length > 0) {
              console.error('[TwelveData] Erro ao subscrever', symbol);
              
              // Tentar formato alternativo apenas uma vez
              if (ws && ws.readyState === WebSocket.OPEN && formatAttempts === 1) {
                // Tentar sem barra
                const altSymbol = symbol.replace('/', '');
                const altMessage = JSON.stringify({
                  action: 'subscribe',
                  params: {
                    symbols: altSymbol
                  }
                });
                ws.send(altMessage);
              } else if (formatAttempts >= maxFormatAttempts) {
                if (ws) {
                  ws.close();
                }
                if (heartbeatInterval) {
                  clearInterval(heartbeatInterval);
                  heartbeatInterval = null;
                }
                // Usar ExchangeRate-API como fallback final (mais confiável que Twelve Data REST)
                connectPolygonREST(symbol);
                return; // Parar processamento para este símbolo
              }
            }
            return;
          }
          
          // Ignorar erros de limite de eventos (já excedemos o limite)
          if (message.event === 'message-processing' && message.status === 'error') {
            if (ws) {
              ws.close();
            }
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
              heartbeatInterval = null;
            }
            connectPolygonREST(symbol);
            return;
          }
          
          
          // Extrair preço de diferentes formatos
          const price = parseFloat(
            message.price || 
            message.close || 
            message.last || 
            message.ask || 
            message.bid ||
            message.data?.price ||
            message.data?.close ||
            0
          );
          
          // Verificar se é mensagem de cotação válida
          if (price && isFinite(price) && price > 0 && 
              (message.event === 'price' || message.type === 'price' || message.type === 'quote' || 
               message.symbol || message.data?.symbol)) {
            // Se recebeu dados de preço, subscrição foi bem-sucedida
            if (!subscriptionSuccessful) {
              subscriptionSuccessful = true;
            }
            
            const change = lastPrice > 0 ? price - lastPrice : 0;
            const changePercent = lastPrice > 0 ? (change / lastPrice) * 100 : 0;

            // CRÍTICO: Twelve Data WebSocket envia timestamp em SEGUNDOS (Unix epoch)
            // Precisamos converter para milissegundos para ser compatível com Date.now()
            const rawTimestamp = message.timestamp || message.time || message.data?.timestamp;
            let tickTimestamp: number;
            if (rawTimestamp) {
              // Se o timestamp é menor que 10^12, está em segundos → converter para ms
              // Timestamps em ms são >= 10^12 (ex: 1770493082000)
              // Timestamps em segundos são < 10^12 (ex: 1770493082)
              tickTimestamp = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
            } else {
              tickTimestamp = Date.now();
            }
            
            const canonicalTick: CanonicalTick = {
              symbol,
              price,
              timestamp: tickTimestamp,
              change,
              changePercent,
              bid: parseFloat(message.bid || message.bid_price || message.data?.bid || price.toString()),
              ask: parseFloat(message.ask || message.ask_price || message.data?.ask || price.toString()),
            };

            lastPrice = price;
            processTick(canonicalTick);
          } else if (message.status === 'error' || message.error) {
            if (message.event !== 'subscribe-status') {
              console.error('[TwelveData] Erro recebido');
            }
          }
        } catch (error) {
          console.error('[TwelveData] Erro ao processar mensagem');
        }
      });

      ws.on('error', () => {
        console.error('[TwelveData] Erro WebSocket para', symbol);
      });

      ws.on('close', (code, reason) => {
        
        // Limpar timeout de retry se existir
        if ((ws as any)?.retryTimeout) {
          clearTimeout((ws as any).retryTimeout);
        }
        
        // Limpar heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        
        ws = null;
        
        // Se subscrição foi bem-sucedida antes, tentar reconectar
        // Se nunca funcionou, usar fallback após menos tentativas
        const maxAttemptsForUnsupported = subscriptionSuccessful ? maxReconnectAttempts : 1; // Reduzido para 1 tentativa se nunca funcionou
        
        if (reconnectAttempts < maxAttemptsForUnsupported) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000);
          reconnectTimeout = setTimeout(() => {
            const lastAttempt = lastConnectionAttempt.get(`twelvedata:${symbol}`);
            const now = Date.now();
            if (lastAttempt && (now - lastAttempt) < CONNECTION_COOLDOWN) {
              return;
            }
            connect();
          }, delay);
        } else {
          console.error('[TwelveData] Máximo de tentativas de reconexão atingido');
          // Fallback final para ExchangeRate-API (mais confiável)
          connectPolygonREST(symbol);
        }
      });
    } catch (error) {
      console.error('[TwelveData] Erro ao conectar WebSocket');
      // Fallback para REST API do Twelve Data
      connectTwelveDataREST(symbol, apiKey);
    }
  };

  // Iniciar conexão
  connect();

  // Salvar conexão para cleanup
  const connection: UpstreamConnection = {
    ws: ws as any,
    symbol,
    source: 'twelvedata',
    reconnectInterval: reconnectTimeout as any
  };

  upstreamConnections.set(`twelvedata:${symbol}`, connection);
}

/**
 * Conecta à API REST de Forex (fallback quando não tem API key ou WebSocket falha)
 */
function connectPolygonREST(symbol: string): void {
  
  // Mapear símbolos para formato da API - EXPANDIDO com mais pares
  const symbolMap: Record<string, { base: string; quote: string }> = {
    // Principais pares
    'GBP/USD': { base: 'GBP', quote: 'USD' },
    'EUR/USD': { base: 'EUR', quote: 'USD' },
    'USD/JPY': { base: 'USD', quote: 'JPY' },
    'AUD/USD': { base: 'AUD', quote: 'USD' },
    'USD/CAD': { base: 'USD', quote: 'CAD' },
    'USD/CHF': { base: 'USD', quote: 'CHF' },
    'NZD/USD': { base: 'NZD', quote: 'USD' },
    'AUD/CAD': { base: 'AUD', quote: 'CAD' },
    // Pares cruzados adicionais
    'EUR/GBP': { base: 'EUR', quote: 'GBP' },
    'EUR/JPY': { base: 'EUR', quote: 'JPY' },
    'GBP/JPY': { base: 'GBP', quote: 'JPY' },
    'AUD/JPY': { base: 'AUD', quote: 'JPY' },
    'CAD/JPY': { base: 'CAD', quote: 'JPY' },
    'CHF/JPY': { base: 'CHF', quote: 'JPY' },
    'EUR/AUD': { base: 'EUR', quote: 'AUD' },
    'EUR/CAD': { base: 'EUR', quote: 'CAD' },
    'GBP/AUD': { base: 'GBP', quote: 'AUD' },
    'GBP/CAD': { base: 'GBP', quote: 'CAD' },
    // Exóticos
    'USD/ZAR': { base: 'USD', quote: 'ZAR' },
    'USD/MXN': { base: 'USD', quote: 'MXN' },
    'USD/BRL': { base: 'USD', quote: 'BRL' },
    'EUR/BRL': { base: 'EUR', quote: 'BRL' },
    'GBP/BRL': { base: 'GBP', quote: 'BRL' },
  };

  const pair = symbolMap[symbol];
  if (!pair) {
    connectForexSimulation(symbol);
    return;
  }

  let lastPrice = 0;
  let lastUpdate = 0;
  let consecutiveErrors = 0;
  const maxErrors = 5;
  const intervalRef = { current: null as NodeJS.Timeout | null };

  // Função para buscar preço atual - usando múltiplas APIs para melhor cobertura
  const fetchPrice = async () => {
    try {
      let price: number = 0;
      let success = false;

      // ESTRATÉGIA 1: Tentar ExchangeRate-API primeiro (gratuita, sem key)
      try {
        if (pair.quote === 'USD') {
          // Para pares com USD como quote
          const url = `https://api.exchangerate-api.com/v4/latest/${pair.base}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000), // Timeout de 5s
          });

          if (response.ok) {
            const data = await response.json();
            price = data.rates[pair.quote];
            if (price && isFinite(price)) {
              success = true;
            }
          }
        } else if (pair.base === 'USD') {
          // Para pares com USD como base
          const url = `https://api.exchangerate-api.com/v4/latest/USD`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const data = await response.json();
            const quoteRate = data.rates[pair.quote];
            if (quoteRate && isFinite(quoteRate)) {
              price = quoteRate;
              success = true;
            }
          }
        } else {
          // Para pares cruzados, calcular via USD
          const [baseResponse, quoteResponse] = await Promise.all([
            fetch(`https://api.exchangerate-api.com/v4/latest/${pair.base}`, {
              signal: AbortSignal.timeout(5000),
            }),
            fetch(`https://api.exchangerate-api.com/v4/latest/USD`, {
              signal: AbortSignal.timeout(5000),
            }),
          ]);

          if (baseResponse.ok && quoteResponse.ok) {
            const baseData = await baseResponse.json();
            const quoteData = await quoteResponse.json();
            const baseToUsd = baseData.rates?.USD;
            const quoteToUsd = quoteData.rates?.[pair.quote];

            if (baseToUsd && quoteToUsd && isFinite(baseToUsd) && isFinite(quoteToUsd)) {
              price = baseToUsd / quoteToUsd;
              success = true;
            }
          }
        }
      } catch (error) {
        // Continuar para próxima estratégia
      }

      // ESTRATÉGIA 2: Se primeira falhar, tentar API alternativa (CurrencyLayer via proxy público)
      if (!success) {
        try {
          // Usar endpoint público que não requer key
          const url = `https://api.exchangerate-api.com/v4/latest/${pair.base}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const data = await response.json();
            if (pair.quote === 'USD') {
              price = data.rates?.USD;
            } else if (pair.base === 'USD') {
              // Buscar taxa inversa
              const quoteUrl = `https://api.exchangerate-api.com/v4/latest/${pair.quote}`;
              const quoteResponse = await fetch(quoteUrl, {
                signal: AbortSignal.timeout(5000),
              });
              if (quoteResponse.ok) {
                const quoteData = await quoteResponse.json();
                const usdToQuote = quoteData.rates?.USD;
                if (usdToQuote && isFinite(usdToQuote)) {
                  price = 1 / usdToQuote; // Inverso
                  success = true;
                }
              }
            } else {
              // Par cruzado
              const baseToUsd = data.rates?.USD;
              const quoteUrl = `https://api.exchangerate-api.com/v4/latest/${pair.quote}`;
              const quoteResponse = await fetch(quoteUrl, {
                signal: AbortSignal.timeout(5000),
              });
              if (quoteResponse.ok && baseToUsd) {
                const quoteData = await quoteResponse.json();
                const quoteToUsd = quoteData.rates?.USD;
                if (quoteToUsd && isFinite(quoteToUsd)) {
                  price = baseToUsd / quoteToUsd;
                  success = true;
                }
              }
            }

            if (price && isFinite(price)) {
              success = true;
            }
          }
        } catch (error) {
          // Continuar para fallback
        }
      }

      if (!success || !price || !isFinite(price)) {
        throw new Error('Nenhuma API retornou preço válido');
      }

      // Se for o primeiro preço, usar como base
      if (lastPrice === 0) {
        lastPrice = price;
        lastUpdate = Date.now();
        
        // Enviar primeiro tick
        const tick: CanonicalTick = {
          symbol,
          price,
          timestamp: Date.now(),
          change: 0,
          changePercent: 0,
        };
        processTick(tick);
        return;
      }

      // Calcular variação
      const variation = price - lastPrice;
      const changePercent = (variation / lastPrice) * 100;

      const tick: CanonicalTick = {
        symbol,
        price,
        timestamp: Date.now(),
        change: variation,
        changePercent,
      };

      lastPrice = price;
      lastUpdate = Date.now();
      consecutiveErrors = 0; // Reset contador de erros

      processTick(tick);
    } catch (error) {
      consecutiveErrors++;
      console.error('[Forex] Erro ao buscar preço para', symbol);
      
      if (consecutiveErrors >= maxErrors) {
        // Limpar intervalo atual
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Usar simulação como fallback
        connectForexSimulation(symbol);
        return;
      }

      // Se ainda temos um preço válido recente, não fazer nada (aguardar próxima tentativa)
      // A API pode estar temporariamente indisponível, mas não vamos simular dados
      if (lastPrice > 0 && Date.now() - lastUpdate < 60000) {
        // Preço ainda válido, aguardar próxima tentativa
        return;
      }
    }
  };

  // Buscar preço inicial
  fetchPrice();

  // Buscar preço a cada 2 segundos para atualização mais frequente
  // Usando múltiplas APIs para melhor cobertura
  intervalRef.current = setInterval(() => {
    fetchPrice();
  }, 2000); // 2 segundos para atualização mais frequente (simula tempo real)

  const connection: UpstreamConnection = {
    ws: null,
    symbol,
    source: 'polygon',
    reconnectInterval: intervalRef.current as any
  };

  upstreamConnections.set(`polygon:${symbol}`, connection);
}

/**
 * Conecta ao Polygon.io WebSocket para dados em tempo real
 */
function connectPolygonWebSocket(symbol: string, apiKey: string): void {
  // Mapear símbolo para formato Polygon.io
  // Polygon.io usa formato: C.EURUSD (C = Currency, sem barra)
  const polygonSymbol = `C.${symbol.replace('/', '')}`;
  
  let ws: WebSocket | null = null;
  let lastPrice = 0;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  const connect = () => {
    try {
      ws = new WebSocket('wss://socket.polygon.io/forex');

      ws.on('open', () => {
        reconnectAttempts = 0;

        // Autenticar - Polygon.io requer formato específico
        // Formato correto: {"action":"auth","params":"API_KEY"}
        const authMessage = JSON.stringify({
          action: 'auth',
          params: apiKey
        });
        
        ws!.send(authMessage);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const rawData = data.toString();
          const messages = JSON.parse(rawData);
          
          // Polygon.io envia array de mensagens
          const messageArray = Array.isArray(messages) ? messages : [messages];
          
          messageArray.forEach((message: any) => {
            // Resposta de autenticação
            if (message.ev === 'status') {
              if (message.status === 'auth_success') {
                // Subscrever ao par
                ws!.send(JSON.stringify({
                  action: 'subscribe',
                  params: polygonSymbol
                }));
                return;
              } else if (message.status === 'connected') {
                return;
              } else if (message.status === 'auth_failed') {
                console.error('[Polygon] Erro de autenticação para', symbol);
                // Fallback para REST após algumas tentativas
                if (reconnectAttempts >= 3) {
                  connectPolygonREST(symbol);
                  return;
                }
              }
            }

            // Dados de tick (C = Currency quote)
            if (message.ev === 'C') {
              const price = message.p; // Preço
              
              if (price && isFinite(price)) {
                // Calcular variação
                const change = lastPrice > 0 ? price - lastPrice : 0;
                const changePercent = lastPrice > 0 ? (change / lastPrice) * 100 : 0;

                const canonicalTick: CanonicalTick = {
                  symbol,
                  price,
                  timestamp: message.t || Date.now(),
                  change,
                  changePercent,
                  bid: message.bp, // Bid price
                  ask: message.ap, // Ask price
                };

                lastPrice = price;
                processTick(canonicalTick);
              }
            }
          });
        } catch (error) {
          console.error('[Polygon] Erro ao processar mensagem');
        }
      });

      ws.on('error', () => {
        console.error('[Polygon] Erro WebSocket para', symbol);
      });

      ws.on('close', (code: number, reason: Buffer) => {
        ws = null;

        if (code === 1006 || code === 1008) {
          // Após algumas tentativas, usar REST
          if (reconnectAttempts >= 3) {
            connectPolygonREST(symbol);
            return;
          }
        }

        // Tentar reconectar
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          
          reconnectTimeout = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[Polygon] Máximo de tentativas de reconexão atingido');
          // Fallback para REST API
          connectPolygonREST(symbol);
        }
      });

    } catch (error) {
      console.error('[Polygon] Erro ao conectar WebSocket');
      // Fallback para REST API
      connectPolygonREST(symbol);
    }
  };

  // Iniciar conexão
  connect();

  // Salvar conexão para cleanup
  const connection: UpstreamConnection = {
    ws: ws as any,
    symbol,
    source: 'polygon',
    reconnectInterval: reconnectTimeout as any
  };

  upstreamConnections.set(`polygon:${symbol}`, connection);
}


/**
 * Função de fallback: simulação de Forex (usada quando API falha)
 */
function connectForexSimulation(symbol: string): void {
  
  let lastPrice = 1.2650;
  const basePrices: Record<string, number> = {
    'GBP/USD': 1.2650,
    'EUR/USD': 1.0850,
    'USD/JPY': 149.50,
    'AUD/CAD': 0.8950,
    'USD/CHF': 0.8750,
    'NZD/USD': 0.6250
  };
  
  lastPrice = basePrices[symbol] || 1.2650;
  
  const interval = setInterval(() => {
    // Random Walk (Geometric Brownian Motion)
    const volatility = 0.0002; // 0.02% de volatilidade
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2); // Z-score gaussiano
    const randomShock = z * volatility;
    
    const newPrice = lastPrice * (1 + randomShock);
    const variation = newPrice - lastPrice;
    
    const tick: CanonicalTick = {
      symbol,
      price: newPrice,
      timestamp: Date.now(),
      change: variation,
      changePercent: (variation / lastPrice) * 100
    };
    
    lastPrice = newPrice;
    processTick(tick);
  }, 2000);
  
  const connection: UpstreamConnection = {
    ws: null,
    symbol,
    source: 'polygon',
    reconnectInterval: interval as any
  };
  
  upstreamConnections.set(`polygon:${symbol}`, connection);
}

/**
 * Processa tick recebido (normaliza, salva no Redis, broadcast)
 */
async function processTick(tick: CanonicalTick): Promise<void> {
  // 1. Validar tick
  if (!tick.symbol || !tick.price || !isFinite(tick.price)) {
    return;
  }
  
  // 2. CRÍTICO: Garantir que apenas ticks recentes sejam processados
  // Suporta timeframes menores que 1 minuto (5s, 15s, 30s)
  // Para candles (com timestamp de início do período), verificar se é do período atual ou anterior
  // Para ticks normais (com timestamp atual), verificar se não é muito antigo
  const now = Date.now();
  const MIN_PERIOD_MS = 5000; // 5 segundos (período mínimo para suportar timeframes de 5s)
  const MAX_TICK_AGE_MS = 10000; // Aceitar ticks até 10 segundos de idade (para suportar timeframes menores)
  
  // Verificar se o tick é recente (timestamp atual ou muito próximo)
  const tickAge = Math.abs(now - tick.timestamp);
  const isRecentTick = tickAge < MAX_TICK_AGE_MS;
  
  // Se o tick tem timestamp de início de período (candle), verificar se é do período atual ou anterior
  // Para timeframes menores, aceitar ticks dos últimos 2 períodos
  const tickPeriodStart = Math.floor(tick.timestamp / MIN_PERIOD_MS) * MIN_PERIOD_MS;
  const currentPeriodStart = Math.floor(now / MIN_PERIOD_MS) * MIN_PERIOD_MS;
  const previousPeriodStart = currentPeriodStart - MIN_PERIOD_MS;
  const isCurrentOrPreviousPeriod = tickPeriodStart === currentPeriodStart || tickPeriodStart === previousPeriodStart;
  
  // Aceitar ticks se:
  // 1. É um tick recente (timestamp atual ou muito próximo)
  // 2. É do período atual ou anterior (para candles)
  if (!isRecentTick && !isCurrentOrPreviousPeriod) {
    return;
  }
  
  // 3. Salvar último preço real (para referência OTC quando mercado fechar)
  if (!tick.isOTC) {
    lastRealPrices.set(tick.symbol, tick.price);
  }
  
  // 4. Gravar no Redis (SSoT)
  await saveToRedis(tick);

  // 4. Broadcast apenas para clientes subscritos ao símbolo
  const message = JSON.stringify({
    type: 'tick',
    data: tick
  });
  
  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Verificar se o cliente está subscrito a este símbolo
      const subscriptions = clientSubscriptions.get(client);
      if (subscriptions && subscriptions.has(tick.symbol)) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error('[MarketDataServer] Erro ao enviar para cliente');
          clients.delete(client);
          clientSubscriptions.delete(client);
        }
      }
    }
  });
  
}

/**
 * Busca último preço do Redis para iniciar OTC
 */
async function getLastPriceFromRedis(symbol: string): Promise<number> {
  try {
    if (!redisClient) return 0;
    const key = `market:${symbol}:latest`;
    const data = await redisClient.get(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.price || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Busca último preço via Twelve Data REST API para iniciar OTC
 */
async function fetchLastPriceForOTC(symbol: string, category: string): Promise<number> {
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) return 0;
    
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return 0;
    
    const data: any = await response.json();
    const price = parseFloat(data.price);
    if (isFinite(price) && price > 0) {
      return price;
    }
    
    // Fallback: tentar buscar da time_series (último candle)
    const tsUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1&timezone=UTC&apikey=${apiKey}&format=json`;
    const tsResponse = await fetch(tsUrl);
    if (!tsResponse.ok) return 0;
    
    const tsData: any = await tsResponse.json();
    if (tsData.values && tsData.values.length > 0) {
      return parseFloat(tsData.values[0].close) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error('[OTC] Erro ao buscar preço para', symbol);
    return 0;
  }
}

/**
 * Inicia o servidor WebSocket
 */
function startServer(): void {
  const wss = new WebSocket.Server({ port: WS_PORT, host: '0.0.0.0' });
  
  console.log('[MarketDataServer] Started on port', WS_PORT);

  // Heartbeat: ping clientes a cada 30s para detectar conexões mortas
  const aliveClients = new WeakSet<WebSocket>();
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (!aliveClients.has(ws)) {
        clients.delete(ws);
        clientSubscriptions.delete(ws);
        return ws.terminate();
      }
      aliveClients.delete(ws);
      try { ws.ping(); } catch { /* ignore */ }
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeatInterval));
  
  wss.on('connection', (ws: WebSocket, _req: any) => {
    clients.add(ws);
    aliveClients.add(ws);
    // Inicializar Set de subscrições para este cliente
    clientSubscriptions.set(ws, new Set<string>());
    
    // Marcar cliente como vivo quando responder ao ping
    ws.on('pong', () => { aliveClients.add(ws); });
    
    // Enviar mensagem de boas-vindas
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Conectado ao MarketDataServer',
      timestamp: Date.now()
    }));
    
    ws.on('message', (message: WebSocket.Data) => {
      try {
        const rawMessage = message.toString();
        const data = JSON.parse(rawMessage);
        
        if (data.type === 'subscribe') {
          const symbol = data.symbol;
          const pair = marketService.getPair(symbol);
          if (!pair) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Símbolo ${symbol} não encontrado`,
              symbol: symbol
            }));
            return;
          }
          if (!pair.enabled) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Símbolo ${symbol} está desabilitado`,
              symbol: symbol
            }));
            return;
          }
          
          const subscriptions = clientSubscriptions.get(ws);
          
          if (subscriptions) {
            subscriptions.add(symbol);
          }
          
          // Conectar upstream baseado na categoria e status do mercado
          const pairForConnect = marketService.getPair(symbol);
          if (pairForConnect) {
            const category = pairForConnect.category as MarketCategory;
            const useOTC = shouldUseOTC(category);
            const marketStatus = getMarketStatus(category);
            
            // Informar cliente sobre status do mercado
            ws.send(JSON.stringify({
              type: 'market-status',
              symbol: symbol,
              ...marketStatus
            }));
            
            if (pairForConnect.category === 'crypto') {
              // Crypto: sempre dados reais (24/7)
              if (!upstreamConnections.has(`binance:${symbol}`)) {
                connectBinance(symbol);
              }
            } else if (useOTC) {
              // Mercado fechado: usar OTC
              if (!otcManager.isActive(symbol)) {
                const cachedPrice = lastRealPrices.get(symbol);
                if (cachedPrice && cachedPrice > 0) {
                  otcManager.startSymbol(symbol, category, cachedPrice);
                } else {
                  getLastPriceFromRedis(symbol).then(redisPrice => {
                    const price = redisPrice > 0 ? redisPrice : 0;
                    if (price > 0) {
                      lastRealPrices.set(symbol, price);
                      otcManager.startSymbol(symbol, category, price);
                    } else {
                      // Fallback: buscar via API REST
                        fetchLastPriceForOTC(symbol, category).then(apiPrice => {
                        if (apiPrice > 0) {
                          lastRealPrices.set(symbol, apiPrice);
                          otcManager.startSymbol(symbol, category, apiPrice);
                        }
                      });
                    }
                  });
                }
              }
            } else {
              // Mercado aberto: usar Twelve Data
              // Parar OTC se estiver ativo
              if (otcManager.isActive(symbol)) {
                otcManager.stopSymbol(symbol);
              }
              if (!upstreamConnections.has(`twelvedata:${symbol}`)) {
                const twelvedataApiKey = process.env.TWELVEDATA_API_KEY;
                if (twelvedataApiKey) {
                  connectTwelveData(symbol, twelvedataApiKey);
                }
              }
            }
          }
        } else if (data.type === 'unsubscribe') {
          const symbol = data.symbol;
          const subscriptions = clientSubscriptions.get(ws);
          
          if (subscriptions) {
            subscriptions.delete(symbol);
          }
        }
      } catch (error) {
        console.error('[MarketDataServer] Erro ao processar mensagem');
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      clientSubscriptions.delete(ws);
    });
    
    ws.on('error', () => {
      console.error('[MarketDataServer] Client error');
      clients.delete(ws);
      clientSubscriptions.delete(ws);
    });
  });
  
  wss.on('error', (error: any) => {
    console.error('[MarketDataServer] Server error:', error.message);
  });
}

/**
 * Inicializa o servidor
 */
async function main(): Promise<void> {
  await initRedis();
  startServer();
}

// ========== PROTEÇÃO CONTRA CRASHES ==========

// Capturar exceções não tratadas — evitar que o servidor morra
process.on('uncaughtException', (error) => {
  console.error('[MarketDataServer] Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MarketDataServer] Unhandled Rejection:', reason);
});

// Shutdown gracioso
const gracefulShutdown = (signal: string) => {
  console.log('[MarketDataServer] Shutting down:', signal);
  
  // Notificar todos os clientes que o servidor está encerrando
  clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'server_shutdown', message: 'Servidor reiniciando...' }));
        client.close(1001, 'Server shutting down');
      }
    } catch { /* ignore */ }
  });
  
  // Aguardar 2s para mensagens serem enviadas, depois sair
  setTimeout(() => process.exit(0), 2000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Executar se for o arquivo principal
if (require.main === module) {
  main().catch((error) => {
    console.error('[MarketDataServer] Fatal error:', error.message);
    process.exit(1);
  });
}

export { main, processTick, saveToRedis };
