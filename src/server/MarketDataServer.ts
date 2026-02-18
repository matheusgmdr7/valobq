/**
 * MarketDataServer - Servidor WebSocket Centralizado
 * 
 * Single Source of Truth (SSoT) para dados de mercado
 * 
 * Arquitetura simplificada:
 * - Crypto: Binance WebSocket (kline_1m) → broadcast direto
 * - Forex (mercado aberto): TwelveData WebSocket → broadcast direto
 * - Forex (WS falha ou sem key): Motor Sintético OTC → broadcast direto
 * - Forex (mercado fechado): Motor Sintético OTC → broadcast direto
 */

import WebSocket from 'ws';
import { createClient, RedisClientType } from 'redis';
import { marketService } from '../services/marketService';
import { OTCEngineManager, OTCTick } from '../engine/otcEngine';
import { shouldUseOTC, getMarketStatus, MarketCategory } from '../utils/marketHours';

try {
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch (e) {}

// Formato canônico de dados de mercado
export interface CanonicalTick {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  isClosed?: boolean;
  isOTC?: boolean;
}

const WS_PORT = process.env.MARKET_DATA_PORT ? parseInt(process.env.MARKET_DATA_PORT) : 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const clients = new Set<WebSocket>();
const clientSubscriptions = new Map<WebSocket, Set<string>>();

interface UpstreamConnection {
  ws: WebSocket | null;
  symbol: string;
  source: 'binance' | 'twelvedata' | 'synthetic';
  reconnectInterval?: NodeJS.Timeout | null;
}

const upstreamConnections = new Map<string, UpstreamConnection>();
const lastConnectionAttempt = new Map<string, number>();
const CONNECTION_COOLDOWN = 60000;

// ===== OTC Engine =====
const otcManager = new OTCEngineManager((otcTick: OTCTick) => {
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

const lastRealPrices = new Map<string, number>();

/**
 * Processa tick OTC — broadcast direto para clientes subscritos
 */
async function processTickOTC(tick: CanonicalTick): Promise<void> {
  if (!tick.symbol || !tick.price || !isFinite(tick.price)) return;
  
  await saveToRedis(tick);
  
  const message = JSON.stringify({ type: 'tick', data: tick });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const subscriptions = clientSubscriptions.get(client);
      if (subscriptions && subscriptions.has(tick.symbol)) {
        try {
          client.send(message);
        } catch {
          clients.delete(client);
          clientSubscriptions.delete(client);
        }
      }
    }
  });
}

const tickCounter = new Map<string, number>();

// ===== REDIS =====
let redisClient: RedisClientType | null = null;

async function initRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 2) return false;
          return Math.min(retries * 500, 2000);
        }
      }
    });
    redisClient.on('error', () => {});
    redisClient.on('connect', () => {});
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis timeout')), 5000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
  } catch {
    redisClient = null;
  }
}

async function saveToRedis(tick: CanonicalTick): Promise<void> {
  if (!redisClient) return;
  try {
    const key = `PRICE:LATEST:${tick.symbol}`;
    const value = JSON.stringify({ ...tick, updatedAt: Date.now() });
    await redisClient.set(key, value);
    const historyKey = `PRICE:HISTORY:${tick.symbol}`;
    await redisClient.lPush(historyKey, value);
    await redisClient.lTrim(historyKey, 0, 999);
  } catch {
    console.error('[Redis] Erro ao salvar tick:', tick.symbol);
  }
}

// ===== BINANCE (Crypto) =====

function connectBinance(symbol: string): void {
  let binanceSymbol = symbol.replace('/', '').toUpperCase();
  
  if (symbol === 'BTC/USD' || symbol.includes('BTC')) {
    binanceSymbol = 'BTCUSDT';
  } else if (symbol === 'ETH/USD' || symbol.includes('ETH')) {
    binanceSymbol = 'ETHUSDT';
  } else if (symbol.includes('/USD')) {
    const baseCurrency = symbol.split('/')[0].toUpperCase();
    binanceSymbol = `${baseCurrency}USDT`;
  } else {
    binanceSymbol = symbol.replace('/', '').toUpperCase();
  }
  
  const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@kline_1m`;
  const ws = new WebSocket(wsUrl);
  const connection: UpstreamConnection = { ws, symbol, source: 'binance' };
  upstreamConnections.set(`binance:${symbol}`, connection);
  
  ws.on('open', () => {});
  
  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      if (!message.k) return;
      
      const kline = message.k;
      const isClosed = kline.x === true;
      const open = parseFloat(kline.o || '0');
      const high = parseFloat(kline.h || '0');
      const low = parseFloat(kline.l || '0');
      const close = parseFloat(kline.c || '0');
      const volume = parseFloat(kline.v || '0');
      const startTime = kline.t || Date.now();
      
      if (!close || !isFinite(close) || close <= 0) return;
      
      const PERIOD_MS = 60000;
      const now = Date.now();
      const currentPeriodStart = Math.floor(now / PERIOD_MS) * PERIOD_MS;
      const tickPeriodStart = Math.floor(startTime / PERIOD_MS) * PERIOD_MS;
      const isCurrentPeriod = tickPeriodStart === currentPeriodStart || tickPeriodStart === (currentPeriodStart - PERIOD_MS);
      
      if (!isCurrentPeriod && isClosed) return;
      
      // CRÍTICO: Sempre usar Date.now() como timestamp do tick
      // O startTime (kline.t) é o início do período, NÃO quando o dado chegou.
      // Usar startTime para isClosed causava filtragem em processTick (tick de 60s atrás era descartado)
      const baseTimestamp = Date.now();
      const counter = (tickCounter.get(symbol) || 0) + 1;
      tickCounter.set(symbol, counter);
      const tickTimestamp = baseTimestamp + (counter % 1000);
      
      const tick: CanonicalTick = {
        symbol, price: close, timestamp: tickTimestamp, volume,
        open, high, low, close: close,
        isClosed, bid: low, ask: high,
      };
      
      processTick(tick);
    } catch {
      console.error('[Binance] Erro ao processar kline para', symbol);
    }
  });
  
  ws.on('error', () => console.error('[Binance] Erro WebSocket para', symbol));
  
  ws.on('close', () => {
    const reconnectInterval = setTimeout(() => connectBinance(symbol), 5000);
    connection.reconnectInterval = reconnectInterval;
  });
}

// ===== FOREX: TwelveData WS → Motor Sintético =====

/**
 * Conecta a dados forex em tempo real.
 * TwelveData WebSocket → se falhar → Motor Sintético (OTC Engine)
 */
function connectForex(symbol: string): void {
  const twelvedataApiKey = process.env.TWELVEDATA_API_KEY;
  
  console.log(`[Forex] Iniciando conexão para ${symbol} (TwelveData key: ${twelvedataApiKey ? 'sim' : 'não'})`);
  
  if (twelvedataApiKey) {
    connectTwelveData(symbol, twelvedataApiKey);
  } else {
    console.log(`[Forex] Sem API key, usando motor sintético para ${symbol}`);
    startSyntheticForex(symbol);
  }
}

/**
 * Inicia o motor sintético (OTC Engine) para um símbolo forex.
 * Gera ticks realistas via Ornstein-Uhlenbeck.
 */
function startSyntheticForex(symbol: string): void {
  if (otcManager.isActive(symbol)) return;
  
  const pair = marketService.getPair(symbol);
  const category = (pair?.category || 'forex') as string;
  
  const PRICE_DEFAULTS: Record<string, number> = {
    // Forex
    'EUR/USD': 1.0850, 'GBP/USD': 1.2700, 'USD/JPY': 149.50,
    'AUD/CAD': 0.8950, 'AUD/USD': 0.6550, 'USD/CAD': 1.3600,
    'EUR/GBP': 0.8550, 'EUR/JPY': 162.50, 'GBP/JPY': 190.00,
    'USD/BRL': 4.9500, 'NZD/USD': 0.6250, 'USD/CHF': 0.8750,
    // Ações (stocks)
    'AAPL': 264.00, 'GOOGL': 185.00, 'MSFT': 397.00,
    'AMZN': 201.00, 'TSLA': 411.00, 'META': 639.00, 'NVDA': 185.00,
    // Índices
    'SPX': 5800.00, 'IXIC': 18500.00, 'DJI': 43000.00,
    'FTSE': 8400.00, 'DAX': 18500.00, 'N225': 38000.00,
    // Commodities
    'XAU/USD': 2050.00, 'XAG/USD': 23.00, 'WTI/USD': 78.00,
    'XBR/USD': 82.00, 'NG/USD': 2.50, 'XPT/USD': 920.00,
  };

  const cachedPrice = lastRealPrices.get(symbol);
  if (cachedPrice && cachedPrice > 0) {
    console.log(`[Synthetic] Motor sintético para ${symbol} @ ${cachedPrice.toFixed(5)} (cache)`);
    otcManager.startSymbol(symbol, category, cachedPrice);
  } else {
    // Iniciar imediatamente com preço padrão para não deixar o usuário esperando
    const defaultPrice = PRICE_DEFAULTS[symbol] || 100.0;
    console.log(`[Synthetic] Motor sintético para ${symbol} @ ${defaultPrice} (padrão imediato)`);
    otcManager.startSymbol(symbol, category, defaultPrice);
    
    // Em paralelo, tentar obter preço mais recente da API
    fetchLastPriceForOTC(symbol, category).then(apiPrice => {
      if (apiPrice > 0 && Math.abs(apiPrice - defaultPrice) / defaultPrice > 0.01) {
        lastRealPrices.set(symbol, apiPrice);
        console.log(`[Synthetic] Atualizando preço de ${symbol}: ${defaultPrice} → ${apiPrice.toFixed(5)} (via API)`);
        // Reiniciar o motor com o preço correto da API
        otcManager.stopSymbol(symbol);
        otcManager.startSymbol(symbol, category, apiPrice);
      }
    }).catch(() => {});
  }
}

/**
 * Conecta ao TwelveData WebSocket para Forex.
 * Se falhar ou não receber dados em 30s → startSyntheticForex.
 */
function connectTwelveData(symbol: string, apiKey: string): void {
  const lastAttempt = lastConnectionAttempt.get(`twelvedata:${symbol}`);
  const now = Date.now();
  if (lastAttempt && (now - lastAttempt) < CONNECTION_COOLDOWN) return;
  
  const pair = marketService.getPair(symbol);
  if (!pair || !pair.enabled) return;
  
  lastConnectionAttempt.set(`twelvedata:${symbol}`, now);
  
  let ws: WebSocket | null = null;
  let lastPrice = 0;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let formatAttempts = 0;
  let subscriptionSuccessful = false;
  let receivedPriceData = false;
  let dataTimeoutId: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    if (dataTimeoutId) { clearTimeout(dataTimeoutId); dataTimeoutId = null; }
  };

  const connect = () => {
    try {
      const endpoint = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;
      console.log(`[TwelveData] Conectando WS para ${symbol}...`);
      ws = new WebSocket(endpoint);

      ws.on('open', () => {
        console.log(`[TwelveData] WS aberto para ${symbol}, enviando subscrição`);
        reconnectAttempts = 0;
        formatAttempts = 0;
        subscriptionSuccessful = false;

        ws!.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbol } }));
        
        // Timeout: sem dados de preço em 15s → motor sintético (reduzido de 30s para resposta rápida)
        dataTimeoutId = setTimeout(() => {
          if (!receivedPriceData) {
            console.log(`[TwelveData] Sem dados para ${symbol} após 15s, usando motor sintético`);
            cleanup();
            if (ws) ws.close();
            upstreamConnections.delete(`twelvedata:${symbol}`);
            startSyntheticForex(symbol);
          }
        }, 15000);
        
        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN && subscriptionSuccessful) {
            ws.send(JSON.stringify({ action: 'heartbeat' }));
          } else if (!ws || ws.readyState !== WebSocket.OPEN) {
            if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
          }
        }, 30000);
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.event === 'heartbeat' || message.type === 'heartbeat') return;
          
          // Log de mensagens não-heartbeat para diagnóstico
          if (!receivedPriceData) {
            console.log(`[TwelveData] Msg para ${symbol}: event=${message.event} status=${message.status} type=${message.type}`);
          }
          
          if (message.status === 'ok' && (message.event === 'subscribe' || message.event === 'subscribe-status' || message.message?.includes('subscribed'))) {
            console.log(`[TwelveData] Subscrição confirmada para ${symbol}`);
            subscriptionSuccessful = true;
            return;
          }
          
          // Erro de subscrição → tentar formato alternativo ou fallback
          if (message.event === 'subscribe-status' && message.status === 'error' && !subscriptionSuccessful) {
            console.log(`[TwelveData] Erro de subscrição para ${symbol}, tentativa ${formatAttempts + 1}`);
            formatAttempts++;
            if (formatAttempts === 1 && ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbol.replace('/', '') } }));
            } else {
              cleanup();
              if (ws) ws.close();
              upstreamConnections.delete(`twelvedata:${symbol}`);
              startSyntheticForex(symbol);
            }
            return;
          }
          
          // Qualquer erro → fallback para motor sintético
          if ((message.status === 'error') || (message.code && message.code >= 400)) {
            console.log(`[TwelveData] Erro recebido para ${symbol}: ${message.message || message.event || 'unknown'}`);
            cleanup();
            if (ws) ws.close();
            upstreamConnections.delete(`twelvedata:${symbol}`);
            startSyntheticForex(symbol);
            return;
          }
          
          // Extrair preço
          const price = parseFloat(
            message.price || message.close || message.last ||
            message.ask || message.bid ||
            message.data?.price || message.data?.close || 0
          );
          
          if (price && isFinite(price) && price > 0 && 
              (message.event === 'price' || message.type === 'price' || message.type === 'quote' || 
               message.symbol || message.data?.symbol)) {
            
            if (!subscriptionSuccessful) subscriptionSuccessful = true;
            if (!receivedPriceData) {
              receivedPriceData = true;
              if (dataTimeoutId) { clearTimeout(dataTimeoutId); dataTimeoutId = null; }
            }
            
            const change = lastPrice > 0 ? price - lastPrice : 0;
            const changePercent = lastPrice > 0 ? (change / lastPrice) * 100 : 0;

            const rawTimestamp = message.timestamp || message.time || message.data?.timestamp;
            const tickTimestamp = rawTimestamp
              ? (rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp)
              : Date.now();
            
            const canonicalTick: CanonicalTick = {
              symbol, price, timestamp: tickTimestamp, change, changePercent,
              bid: parseFloat(message.bid || message.bid_price || message.data?.bid || price.toString()),
              ask: parseFloat(message.ask || message.ask_price || message.data?.ask || price.toString()),
            };

            lastPrice = price;
            processTick(canonicalTick);
          }
        } catch {
          console.error('[TwelveData] Erro ao processar mensagem');
        }
      });

      ws.on('error', () => console.error('[TwelveData] Erro WebSocket para', symbol));

      ws.on('close', (code) => {
        console.log(`[TwelveData] WS fechado para ${symbol} (code=${code}, subscOk=${subscriptionSuccessful}, priceOk=${receivedPriceData})`);
        cleanup();
        ws = null;
        
        // Se nunca recebeu dados de preço, ir direto para motor sintético (sem reconexão)
        if (!receivedPriceData) {
          console.log(`[TwelveData] Sem dados de preço para ${symbol}, usando motor sintético direto`);
          upstreamConnections.delete(`twelvedata:${symbol}`);
          startSyntheticForex(symbol);
          return;
        }
        
        // Se tinha dados antes, tentar reconectar
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`[TwelveData] Reconectando ${symbol} em ${delay}ms (tentativa ${reconnectAttempts}/${maxReconnectAttempts})`);
          reconnectTimeout = setTimeout(() => {
            lastConnectionAttempt.set(`twelvedata:${symbol}`, Date.now());
            connect();
          }, delay);
        } else {
          console.log(`[TwelveData] Reconexão esgotada para ${symbol}, usando motor sintético`);
          upstreamConnections.delete(`twelvedata:${symbol}`);
          startSyntheticForex(symbol);
        }
      });
    } catch {
      console.error('[TwelveData] Erro ao conectar WebSocket, usando motor sintético');
      startSyntheticForex(symbol);
    }
  };

  connect();

  const connection: UpstreamConnection = {
    ws: ws as any, symbol, source: 'twelvedata',
    reconnectInterval: reconnectTimeout as any
  };
  upstreamConnections.set(`twelvedata:${symbol}`, connection);
}

// ===== PROCESS TICK =====

/**
 * Processa tick recebido — valida, salva no Redis, broadcast direto
 */
async function processTick(tick: CanonicalTick): Promise<void> {
  if (!tick.symbol || !tick.price || !isFinite(tick.price)) return;
  
  const now = Date.now();
  const MAX_TICK_AGE_MS = 10000;
  const MIN_PERIOD_MS = 5000;
  
  const tickAge = Math.abs(now - tick.timestamp);
  const isRecentTick = tickAge < MAX_TICK_AGE_MS;
  
  const tickPeriodStart = Math.floor(tick.timestamp / MIN_PERIOD_MS) * MIN_PERIOD_MS;
  const currentPeriodStart = Math.floor(now / MIN_PERIOD_MS) * MIN_PERIOD_MS;
  const isCurrentOrPreviousPeriod = tickPeriodStart === currentPeriodStart || tickPeriodStart === (currentPeriodStart - MIN_PERIOD_MS);
  
  // CRÍTICO: Sempre permitir sinais de fechamento de candle (isClosed: true)
  // Estes são essenciais para o frontend saber quando congelar o live candle
  if (!isRecentTick && !isCurrentOrPreviousPeriod && !tick.isClosed) return;
  
  if (!tick.isOTC) {
    lastRealPrices.set(tick.symbol, tick.price);
  }
  
  await saveToRedis(tick);

  const message = JSON.stringify({ type: 'tick', data: tick });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const subscriptions = clientSubscriptions.get(client);
      if (subscriptions && subscriptions.has(tick.symbol)) {
        try {
          client.send(message);
        } catch {
          clients.delete(client);
          clientSubscriptions.delete(client);
        }
      }
    }
  });
}

// ===== HELPERS =====

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
  } catch { return 0; }
}

async function fetchLastPriceForOTC(symbol: string, category: string): Promise<number> {
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) {
      console.log(`[OTC] Sem API key TwelveData, usando default para ${symbol}`);
      return 0;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[OTC] API price retornou ${response.status} para ${symbol}`);
      return 0;
    }
    
    const data: any = await response.json();
    if (data.code && data.code !== 200) {
      console.log(`[OTC] API price erro para ${symbol}: ${data.message || data.code}`);
      return 0;
    }
    const price = parseFloat(data.price);
    if (isFinite(price) && price > 0) {
      console.log(`[OTC] Preço obtido via API price para ${symbol}: ${price}`);
      return price;
    }
    
    console.log(`[OTC] API price retornou valor inválido para ${symbol}, tentando time_series...`);
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
    
    const tsUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1&timezone=UTC&apikey=${apiKey}&format=json`;
    const tsResponse = await fetch(tsUrl, { signal: controller2.signal });
    clearTimeout(timeoutId2);
    
    if (!tsResponse.ok) return 0;
    
    const tsData: any = await tsResponse.json();
    if (tsData.values && tsData.values.length > 0) {
      const tsPrice = parseFloat(tsData.values[0].close) || 0;
      if (tsPrice > 0) console.log(`[OTC] Preço obtido via time_series para ${symbol}: ${tsPrice}`);
      return tsPrice;
    }
    return 0;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error(`[OTC] Timeout ao buscar preço para ${symbol}`);
    } else {
      console.error(`[OTC] Erro ao buscar preço para ${symbol}:`, err.message);
    }
    return 0;
  }
}

// ===== SERVIDOR WEBSOCKET =====

function startServer(): void {
  const wss = new WebSocket.Server({ port: WS_PORT, host: '0.0.0.0' });
  console.log('[MarketDataServer] Started on port', WS_PORT);

  const aliveClients = new WeakSet<WebSocket>();
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (!aliveClients.has(ws)) {
        clients.delete(ws);
        clientSubscriptions.delete(ws);
        return ws.terminate();
      }
      aliveClients.delete(ws);
      try { ws.ping(); } catch {}
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeatInterval));
  
  wss.on('connection', (ws: WebSocket, _req: any) => {
    clients.add(ws);
    aliveClients.add(ws);
    clientSubscriptions.set(ws, new Set<string>());
    
    ws.on('pong', () => { aliveClients.add(ws); });
    
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Conectado ao MarketDataServer',
      timestamp: Date.now()
    }));
    
    ws.on('message', (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe') {
          const symbol = data.symbol;
          const pair = marketService.getPair(symbol);
          if (!pair || !pair.enabled) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Símbolo ${symbol} não encontrado ou desabilitado`,
              symbol
            }));
            return;
          }
          
          const subscriptions = clientSubscriptions.get(ws);
          if (subscriptions) subscriptions.add(symbol);
          
          const category = pair.category as MarketCategory;
          const useOTC = shouldUseOTC(category);
          const marketStatus = getMarketStatus(category);
          
          ws.send(JSON.stringify({ type: 'market-status', symbol, ...marketStatus }));
          
          console.log(`[Subscribe] ${symbol} cat=${pair.category} useOTC=${useOTC} hasUpstream=${upstreamConnections.has(`twelvedata:${symbol}`)} otcActive=${otcManager.isActive(symbol)}`);
          
          if (pair.category === 'crypto') {
            if (!upstreamConnections.has(`binance:${symbol}`)) {
              connectBinance(symbol);
            }
          } else if (useOTC) {
            if (!otcManager.isActive(symbol)) {
              startSyntheticForex(symbol);
            }
          } else {
            // Mercado aberto: TwelveData WS → fallback motor sintético
            if (otcManager.isActive(symbol)) {
              otcManager.stopSymbol(symbol);
            }
            const hasConnection = 
              upstreamConnections.has(`twelvedata:${symbol}`) ||
              otcManager.isActive(symbol);
            if (!hasConnection) {
              connectForex(symbol);
            }
          }
          
        } else if (data.type === 'unsubscribe') {
          const subscriptions = clientSubscriptions.get(ws);
          if (subscriptions) subscriptions.delete(data.symbol);
        }
      } catch {
        console.error('[MarketDataServer] Erro ao processar mensagem');
      }
    });
    
    ws.on('close', () => { clients.delete(ws); clientSubscriptions.delete(ws); });
    ws.on('error', () => { clients.delete(ws); clientSubscriptions.delete(ws); });
  });
  
  wss.on('error', (error: any) => {
    console.error('[MarketDataServer] Server error:', error.message);
  });
}

async function main(): Promise<void> {
  await initRedis();
  startServer();
}

// ===== PROTEÇÃO CONTRA CRASHES =====

process.on('uncaughtException', (error) => {
  console.error('[MarketDataServer] Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MarketDataServer] Unhandled Rejection:', reason);
});

const gracefulShutdown = (signal: string) => {
  console.log('[MarketDataServer] Shutting down:', signal);
  clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'server_shutdown', message: 'Servidor reiniciando...' }));
        client.close(1001, 'Server shutting down');
      }
    } catch {}
  });
  setTimeout(() => process.exit(0), 2000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  main().catch((error) => {
    console.error('[MarketDataServer] Fatal error:', error.message);
    process.exit(1);
  });
}

export { main, processTick, saveToRedis };
