/**
 * MarketDataServer - Servidor WebSocket Centralizado
 * 
 * Single Source of Truth (SSoT) para dados de mercado
 * 
 * Arquitetura:
 * - Crypto: Binance WebSocket (kline_1m) → broadcast direto (já traz OHLC + isClosed)
 * - Forex/OTC: Motor Sintético (padrão) ou TwelveData WS se FOREX_SYNTHETIC_ONLY=false → KlineAggregator 1m
 */

import WebSocket from 'ws';
import { createClient, RedisClientType } from 'redis';
import { marketService } from '../services/marketService';
import { OTCEngineManager, OTCTick } from '../engine/otcEngine';
import { KlineAggregator } from '../engine/klineAggregator';
import { resolveAnchorPrice, resolveAnchorPriceSync } from '../services/anchorPrice';
import { shouldUseOTC, getMarketStatus, MarketCategory } from '../utils/marketHours';
import { isForexSyntheticOnly } from '../config/forexData';

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

const tickCounter = new Map<string, number>();

// Agregador 1m — forex/OTC passam por aqui antes do broadcast (mesmo formato Binance)
let klineAggregator!: KlineAggregator;

function ingestForexTick(tick: {
  symbol: string;
  price: number;
  timestamp?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  isOTC?: boolean;
}): void {
  klineAggregator.ingest(tick);
}

// ===== OTC Engine =====
const otcManager = new OTCEngineManager((otcTick: OTCTick) => {
  ingestForexTick({
    symbol: otcTick.symbol,
    price: otcTick.price,
    timestamp: otcTick.timestamp,
    bid: otcTick.bid,
    ask: otcTick.ask,
    change: otcTick.change,
    changePercent: otcTick.changePercent,
    isOTC: true,
  });
});

const lastRealPrices = new Map<string, number>();

/** Re-ancora preço OTC + agregador (TwelveData → OTC ou refinamento async) */
function reanchorSymbol(symbol: string, price: number, isOTC = true): void {
  if (!price || !isFinite(price) || price <= 0) return;
  lastRealPrices.set(symbol, price);
  if (otcManager.isActive(symbol)) {
    otcManager.forcePrice(symbol, price);
  }
  klineAggregator.seed(symbol, price, { isOTC });
}

/**
 * Inicia ou re-ancora motor sintético (OTC Engine) para forex.
 * anchorOverride: último preço TwelveData ao fazer fallback WS → OTC.
 */
function startSyntheticForex(symbol: string, anchorOverride?: number): void {
  const pair = marketService.getPair(symbol);
  const category = (pair?.category || 'forex') as string;

  const cached = anchorOverride ?? lastRealPrices.get(symbol);
  const { price: syncPrice, source: syncSource } = resolveAnchorPriceSync(symbol, cached);
  const anchor = syncPrice;

  if (otcManager.isActive(symbol)) {
    console.log(`[Synthetic] Re-anchor ${symbol} @ ${anchor.toFixed(5)} (${anchorOverride ? 'twelvedata-fallback' : syncSource})`);
    reanchorSymbol(symbol, anchor, true);
    return;
  }

  console.log(`[Synthetic] Motor sintético para ${symbol} @ ${anchor.toFixed(5)} (${syncSource})`);
  otcManager.startSymbol(symbol, category, anchor);
  otcManager.forcePrice(symbol, anchor);
  klineAggregator.seed(symbol, anchor, { isOTC: true });
  lastRealPrices.set(symbol, anchor);

  resolveAnchorPrice(symbol).then(({ price: apiPrice, source }) => {
    if (apiPrice <= 0 || !otcManager.isActive(symbol)) return;
    const diff = Math.abs(apiPrice - anchor) / anchor;
    if (diff <= 0.002) return;
    console.log(`[Synthetic] Re-anchor async ${symbol}: ${anchor.toFixed(5)} → ${apiPrice.toFixed(5)} (${source})`);
    reanchorSymbol(symbol, apiPrice, true);
  }).catch(() => {});
}

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
  const forexSyntheticOnly = isForexSyntheticOnly();

  console.log(
    `[Forex] ${symbol} — synthetic-only: ${forexSyntheticOnly} (TwelveData key: ${twelvedataApiKey ? 'sim' : 'não'})`
  );

  if (forexSyntheticOnly || !twelvedataApiKey) {
    startSyntheticForex(symbol);
  } else {
    connectTwelveData(symbol, twelvedataApiKey);
  }
}

/**
 * Conecta ao TwelveData WebSocket para Forex.
 * Se falhar ou não receber dados em 15s → startSyntheticForex.
 */
function connectTwelveData(symbol: string, apiKey: string): void {
  const lastAttempt = lastConnectionAttempt.get(`twelvedata:${symbol}`);
  const now = Date.now();
  if (lastAttempt && (now - lastAttempt) < CONNECTION_COOLDOWN) {
    // Em cooldown — garantir que OTC está rodando como fallback
    if (!otcManager.isActive(symbol)) {
      console.log(`[TwelveData] Em cooldown para ${symbol}, iniciando motor sintético`);
      startSyntheticForex(symbol);
    }
    return;
  }
  
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
            startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
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
              startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
            }
            return;
          }
          
          // Qualquer erro → fallback para motor sintético
          if ((message.status === 'error') || (message.code && message.code >= 400)) {
            console.log(`[TwelveData] Erro recebido para ${symbol}: ${message.message || message.event || 'unknown'}`);
            cleanup();
            if (ws) ws.close();
            upstreamConnections.delete(`twelvedata:${symbol}`);
            startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
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
            
            lastPrice = price;
            ingestForexTick({
              symbol,
              price,
              timestamp: tickTimestamp,
              change,
              changePercent,
              bid: parseFloat(message.bid || message.bid_price || message.data?.bid || price.toString()),
              ask: parseFloat(message.ask || message.ask_price || message.data?.ask || price.toString()),
              isOTC: false,
            });
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
          startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
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
          startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
        }
      });
    } catch {
      console.error('[TwelveData] Erro ao conectar WebSocket, usando motor sintético');
      startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
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

// Inicializar agregador após processTick estar definido
klineAggregator = new KlineAggregator((tick) => {
  void processTick(tick as CanonicalTick);
});

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
              startSyntheticForex(symbol, lastPrice > 0 ? lastPrice : undefined);
            }
          } else {
            // Mercado aberto: TwelveData WS → fallback motor sintético
            // Se OTC já está ativo (TwelveData falhou antes), NÃO parar — manter dados fluindo
            if (otcManager.isActive(symbol)) {
              // OTC já está rodando como fallback, manter
            } else if (!upstreamConnections.has(`twelvedata:${symbol}`)) {
              connectForex(symbol);
            }
          }
          
        } else if (data.type === 'unsubscribe') {
          const subscriptions = clientSubscriptions.get(ws);
          if (subscriptions) subscriptions.delete(data.symbol);
          klineAggregator.resetSymbol(data.symbol);
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
