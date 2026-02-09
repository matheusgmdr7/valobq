# 📊 Origem dos Dados para Criptomoedas (BTC/USD, ETH/USD)

## ✅ Sim, todos os dados vêm da **Binance**

### 🔄 Fluxo Completo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    BTC/USD - Dados Reais                     │
└─────────────────────────────────────────────────────────────┘

1️⃣ DADOS HISTÓRICOS (Candles Passados)
   └─> Binance REST API
       └─> Endpoint: https://api.binance.com/api/v3/klines
       └─> Símbolo: BTCUSDT (BTC/USD mapeado para BTCUSDT)
       └─> Busca: Últimos 500 candles históricos
       └─> Formato: [timestamp, open, high, low, close, volume, ...]
       └─> Via: /api/market/historical (Next.js API Route)
       └─> Arquivo: src/app/api/market/historical/route.ts (linhas 46-98)

2️⃣ DADOS EM TEMPO REAL (Ticks Atuais)
   └─> Binance WebSocket
       └─> URL: wss://stream.binance.com:9443/ws/btcusdt@ticker
       └─> Símbolo: BTCUSDT (BTC/USD mapeado para BTCUSDT)
       └─> Formato: { e: "24hrTicker", E: timestamp, s: "BTCUSDT", c: "price", ... }
       └─> Via: MarketDataServer (WebSocket Server)
       └─> Arquivo: src/server/MarketDataServer.ts (linhas 123-212)
```

## 📍 Detalhes da Implementação

### 1. Dados Históricos (Candles Passados)

**Arquivo:** `src/app/api/market/historical/route.ts`

```typescript
// Linha 25-29: Detecta se é crypto
const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');

if (isCrypto) {
  // Buscar dados históricos de Binance para crypto
  return await fetchBinanceHistorical(symbol, timeframe, limit);
}

// Linha 54-55: Mapeamento de símbolos
if (symbol === 'BTC/USD') binanceSymbol = 'BTCUSDT';
else if (symbol === 'ETH/USD') binanceSymbol = 'ETHUSDT';

// Linha 69: Endpoint Binance REST API
const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
```

**Endpoint Binance usado:**
- `GET https://api.binance.com/api/v3/klines`
- Parâmetros:
  - `symbol=BTCUSDT` (ou ETHUSDT)
  - `interval=1m` (ou 5m, 15m, 1h, etc.)
  - `limit=500` (últimos 500 candles)

### 2. Dados em Tempo Real (Ticks Atuais)

**Arquivo:** `src/server/MarketDataServer.ts`

```typescript
// Linha 123-135: Conexão Binance WebSocket
function connectBinance(symbol: string): void {
  // Mapear BTC/USD -> BTCUSDT
  if (symbol === 'BTC/USD') {
    binanceSymbol = 'BTCUSDT';
  }
  
  const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@ticker`;
  const ws = new WebSocket(wsUrl);
}

// Linha 152-196: Processamento de mensagens
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  // Formato Binance: { e: "24hrTicker", E: timestamp, s: "BTCUSDT", c: "price", ... }
  const price = parseFloat(message.c); // c = last price
  const eventTime = message.E; // E = event time (timestamp em ms)
});
```

**WebSocket Binance usado:**
- `wss://stream.binance.com:9443/ws/btcusdt@ticker`
- Stream: `24hrTicker` (atualizações de preço em tempo real)
- Formato: JSON com campos `c` (preço), `E` (timestamp), `v` (volume), etc.

## 🔄 Fluxo Completo no Sistema

### Quando o Gráfico Carrega:

1. **Frontend** (`TradingViewChart.tsx`):
   - Chama `fetchHistoricalData('BTC/USD', 500)`
   - Faz requisição: `GET /api/market/historical?symbol=BTC/USD&timeframe=1m&limit=500`

2. **API Route** (`/api/market/historical/route.ts`):
   - Detecta que é crypto (`isCrypto = true`)
   - Chama `fetchBinanceHistorical('BTC/USD', '1m', 500)`
   - Faz requisição para: `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500`
   - Retorna candles históricos reais

3. **Frontend recebe dados:**
   - Carrega 500 candles históricos reais no gráfico
   - Gráfico mostra dados corretos desde o início

### Quando Dados em Tempo Real Chegam:

1. **MarketDataServer** (`MarketDataServer.ts`):
   - Conecta ao WebSocket Binance: `wss://stream.binance.com:9443/ws/btcusdt@ticker`
   - Recebe ticks em tempo real
   - Normaliza para formato canônico
   - Broadcast para clientes conectados

2. **Frontend** (`useRealtimeStream` hook):
   - Conecta ao MarketDataServer: `ws://localhost:8080`
   - Recebe ticks normalizados
   - Passa para `TradingViewChart`

3. **TradingViewChart**:
   - Atualiza candles em tempo real
   - Substitui/atualiza último candle conforme necessário

## ✅ Resumo

| Tipo de Dado | Fonte | Endpoint/Stream | Arquivo |
|--------------|-------|-----------------|---------|
| **Históricos** | Binance REST API | `GET /api/v3/klines` | `src/app/api/market/historical/route.ts` |
| **Tempo Real** | Binance WebSocket | `wss://stream.binance.com/ws/btcusdt@ticker` | `src/server/MarketDataServer.ts` |

**Todos os dados de BTC/USD e ETH/USD vêm 100% da Binance!** 🎯


