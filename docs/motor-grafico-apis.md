# Motor do Gráfico e APIs - Documentação Técnica

## 📊 Visão Geral do Sistema

O sistema de gráfico utiliza uma arquitetura em camadas que combina:
- **WebGL** para renderização de alta performance
- **APIs híbridas** (WebSocket + Polling) para dados em tempo real
- **Animações fluidas** com requestAnimationFrame
- **Otimizações** para garantir 60 FPS constante

---

## 🎨 Motor de Renderização (WebGL)

### Arquitetura em Camadas

```
WebGLChart (React Component)
    ↓
Canvas (WebGL Context)
    ↓
Renderer (Orquestrador)
    ↓
ChartManager (Lógica de Renderização)
    ↓
WebGL Shaders (GPU)
```

### Componentes Principais

#### 1. **ChartManager** (`src/engine/charts/ChartManager.ts`)
- **Responsabilidade**: Gerencia shaders, buffers WebGL e cálculos de geometria
- **Funcionalidades**:
  - Compilação e gerenciamento de shaders (Candlestick, Line, Area)
  - Cálculo de geometria de candlesticks (corpo, pavio, cores)
  - Sistema de coordenadas (clip space: -1 a 1)
  - Gerenciamento de ViewState (zoom, pan)
  - Cálculo de VisibleRange (range visível de dados)
  - Renderização de desenhos (trendlines, retângulos, linhas horizontais)

**Principais Métodos**:
```typescript
renderCandlestick(data: CandlestickData[], drawings: DrawingShape[]): void
updateViewState(viewState: Partial<ViewState>): void
getVisibleRange(data: CandlestickData[]): VisibleRange
```

#### 2. **Renderer** (`src/engine/webgl/Renderer.ts`)
- **Responsabilidade**: Orquestra renderização e gerencia estado do gráfico
- **Funcionalidades**:
  - Inicialização do contexto WebGL
  - Gerenciamento de histórico de zoom/pan (undo/redo)
  - Coordenação entre ChartManager e renderers específicos
  - Performance monitoring
  - Gerenciamento de desenhos

**Principais Métodos**:
```typescript
renderCandlestick(data: CandlestickData[]): void
updateViewState(viewState: Partial<ViewState>): void
zoomToRange(startX: number, endX: number): void
centerOnCandle(candleX: number, visibleCandles: number, totalCandles: number): void
```

#### 3. **SmoothRenderer** (`src/utils/smoothRenderer.ts`)
- **Responsabilidade**: Garante renderização suave a 60 FPS
- **Funcionalidades**:
  - Loop de renderização com `requestAnimationFrame`
  - Controle de FPS (target: 60 FPS)
  - Throttling inteligente para evitar renderizações desnecessárias

**Como Funciona**:
```typescript
// Inicia loop de renderização
smoothRenderer.start(() => {
  renderer.renderCandlestick(data);
});

// Para loop
smoothRenderer.stop();
```

---

## 🔌 APIs de Dados em Tempo Real

### Arquitetura Híbrida

O sistema detecta automaticamente o tipo de ativo e escolhe a melhor estratégia:

```
useRealtimeMarketData Hook
    ↓
    ├─ Forex (GBP/USD, EUR/USD, etc.)
    │   └─ ForexPollingService → Yahoo Finance API (via Next.js API Route)
    │
    └─ Crypto (BTC/USDT, ETH/USDT, etc.)
        └─ BinanceWebSocket → Binance WebSocket Stream
```

### 1. **Binance WebSocket** (`src/services/binanceWebSocket.ts`)

**Para**: Criptomoedas (BTC, ETH, etc.)

**Características**:
- ✅ Tempo real verdadeiro (WebSocket)
- ✅ Sem autenticação necessária
- ✅ Múltiplos tipos de stream:
  - `ticker`: Preço atual (24h ticker)
  - `trade`: Últimas transações
  - `kline`: Candles formatados

**Fluxo de Dados**:
```
Binance WebSocket
    ↓
onTick Handler
    ↓
UpdateBatcher (agrupa updates)
    ↓
handleTickUpdate
    ↓
Atualiza/Cria Candle
    ↓
onCandleUpdate Callback
    ↓
WebGLChart (re-renderiza)
```

**Exemplo de Uso**:
```typescript
const binanceWs = new BinanceWebSocket({
  symbol: 'BTCUSDT',
  streamType: 'ticker'
});

binanceWs.onTick((tick) => {
  // tick: { symbol, price, volume, timestamp, bid, ask }
  console.log('Preço atual:', tick.price);
});

await binanceWs.connect();
```

**Reconexão Automática**:
- Tenta reconectar até 10 vezes
- Backoff exponencial (1s, 2s, 4s, ... até 30s)
- Heartbeat para manter conexão viva

### 2. **Forex Polling Service** (`src/services/forexPollingService.ts`)

**Para**: Pares de Forex (GBP/USD, EUR/USD, etc.)

**Características**:
- ⚠️ Polling (não é verdadeiramente tempo real)
- ✅ Gratuito (sem API key)
- ✅ Via Next.js API Route (evita CORS)
- ⏱️ Intervalo configurável (padrão: 2 segundos)

**Fluxo de Dados**:
```
ForexPollingService
    ↓ (a cada 2 segundos)
fetchCurrentPrice()
    ↓
Next.js API Route (/api/forex/price)
    ↓
Yahoo Finance API (proxy)
    ↓
onTick Handler
    ↓
UpdateBatcher
    ↓
handleTickUpdate
    ↓
Atualiza/Cria Candle
```

**Exemplo de Uso**:
```typescript
const forexPolling = new ForexPollingService({
  symbol: 'GBP/USD',
  interval: 2000, // 2 segundos
  onTick: (tick) => {
    // tick: { symbol, price, timestamp, change, changePercent }
    console.log('Preço atual:', tick.price);
  }
});

forexPolling.start();
```

**Otimizações**:
- Só notifica se o preço mudou significativamente (> 0.0001)
- Sempre notifica o primeiro tick
- Fallback para preço simulado se API falhar

### 3. **useRealtimeMarketData Hook** (`src/hooks/useRealtimeMarketData.ts`)

**Responsabilidade**: Unifica Binance WebSocket e Forex Polling em uma interface única

**Funcionalidades**:
- ✅ Detecção automática de tipo de ativo (Forex vs Crypto)
- ✅ Animação de preço fluida (`PriceAnimator`)
- ✅ Batching de updates (`UpdateBatcher`)
- ✅ Gerenciamento automático de candles
- ✅ Loop de animação com RAF

**Fluxo Completo**:
```typescript
useRealtimeMarketData({
  symbol: 'GBP/USD',
  initialCandles: [...], // Dados históricos
  enableAnimation: true,
  animationSpeed: 0.15,
  pollingInterval: 2000,
  onCandleUpdate: (candles) => {
    // Candles atualizados
    setRealtimeCandles(candles);
  },
  onTick: (tick) => {
    // Tick recebido (opcional)
  }
})
```

**Detecção de Tipo de Ativo**:
```typescript
function isForexSymbol(symbol: string): boolean {
  const hasSlash = symbol.includes('/');
  const isCrypto = ['BTC', 'ETH', 'USDT', ...].some(k => 
    symbol.includes(k)
  );
  return hasSlash && !isCrypto;
}
```

**Animações**:
- `PriceAnimator`: Suaviza transições de preço
- `UpdateBatcher`: Agrupa múltiplos updates em batches (~60 FPS)
- Loop RAF: Atualiza preço animado a cada frame

---

## 🔄 Fluxo de Dados Completo

### Cenário: Atualização de Preço em Tempo Real

```
1. API Recebe Dados
   ├─ Binance WebSocket: tick recebido
   └─ Forex Polling: poll executado (a cada 2s)

2. Processamento
   ├─ UpdateBatcher.add(tick) → agrupa updates
   └─ handleTickUpdate(tick) → processa tick

3. Atualização de Candle
   ├─ Se candle atual (< 1 minuto):
   │   └─ Atualiza: close, high, low, volume
   └─ Se novo minuto:
       └─ Cria novo candle

4. Animação (se habilitada)
   ├─ PriceAnimator.setTarget(price)
   └─ Loop RAF atualiza animatedPrice

5. Renderização
   ├─ onCandleUpdate([...candles])
   ├─ setRealtimeCandles(candles)
   ├─ SmoothRenderer detecta mudança
   └─ renderer.renderCandlestick(candles)

6. WebGL Renderiza
   ├─ ChartManager.renderCandlestick()
   ├─ Calcula geometria
   ├─ Atualiza buffers WebGL
   └─ GPU renderiza (60 FPS)
```

---

## 🎯 Otimizações Implementadas

### 1. **Batching de Updates**
- Agrupa múltiplos ticks em batches de ~16ms (60 FPS)
- Evita renderizações excessivas
- Melhora performance em alta frequência

### 2. **SmoothRenderer**
- Controla FPS para garantir 60 FPS constante
- Evita renderizações quando não há mudanças
- Usa `requestAnimationFrame` para sincronização

### 3. **Throttling de Logs**
- Logs apenas 10% das vezes (evita spam no console)
- Throttling de erros WebAssembly (5 segundos)

### 4. **Lazy Loading**
- WebAssembly inicializado de forma assíncrona
- Não bloqueia renderização inicial
- Fallback para JavaScript se WASM falhar

### 5. **Memory Management**
- Limita candles a 1000 (`.slice(-1000)`)
- Limpa buffers WebGL quando necessário
- Gerenciamento de histórico de zoom (máx. 50 entradas)

---

## 📡 APIs Externas Utilizadas

### 1. **Binance WebSocket**
- **URL**: `wss://stream.binance.com:9443/ws/`
- **Formato**: `{symbol}@ticker` (ex: `btcusdt@ticker`)
- **Dados**: Preço, volume, bid, ask, timestamp
- **Limite**: Sem limite conhecido (público)

### 2. **Yahoo Finance** (via Next.js API Route)
- **Endpoint**: `/api/forex/price?symbol=GBP/USD`
- **Backend**: `src/app/api/forex/price/route.ts`
- **Fonte**: `query1.finance.yahoo.com/v8/finance/chart/`
- **Limite**: Sem limite conhecido (gratuito)

---

## 🐛 Problemas Conhecidos e Limitações

### 1. **Forex Polling**
- ⚠️ Não é verdadeiramente tempo real (2s de delay)
- ⚠️ Depende de Yahoo Finance (pode falhar)
- ✅ Fallback para preço simulado

### 2. **Binance WebSocket**
- ⚠️ Só funciona para criptomoedas
- ⚠️ Requer normalização de símbolos (BTC/USD → BTCUSDT)
- ✅ Reconexão automática implementada

### 3. **Centralização do Último Candle**
- ⚠️ Lógica de centralização pode não funcionar corretamente em todos os casos
- ⚠️ Pode precisar de ajustes quando há muitos dados

### 4. **Performance**
- ✅ Otimizado para 60 FPS
- ⚠️ Pode degradar com > 1000 candles
- ✅ Limite de 1000 candles implementado

---

## 🚀 Melhorias Futuras Sugeridas

1. **WebSocket Privado para Forex**
   - Integração com broker que forneça WebSocket
   - Tempo real verdadeiro para Forex

2. **Otimização de Renderização**
   - Renderização incremental (só renderiza candles novos)
   - Level of Detail (LOD) para muitos candles

3. **Cache de Dados**
   - Cache local de candles históricos
   - IndexedDB para persistência

4. **Múltiplos Timeframes**
   - Suporte para 1m, 5m, 15m, 1h, etc.
   - Agregação automática de candles

5. **Web Workers**
   - Processamento de dados em background
   - Cálculos pesados fora da thread principal

---

## 📝 Resumo Técnico

**Motor de Renderização**:
- WebGL 1.0/2.0 com shaders customizados
- Renderização a 60 FPS com SmoothRenderer
- Sistema de coordenadas clip space (-1 a 1)
- Gerenciamento de zoom/pan com histórico

**APIs de Dados**:
- Binance WebSocket para crypto (tempo real)
- Forex Polling para forex (2s delay)
- Detecção automática de tipo de ativo
- Animação fluida de preços

**Otimizações**:
- Batching de updates
- Throttling de logs
- Limite de candles (1000)
- Lazy loading de WebAssembly

**Status Atual**: ✅ Funcional, com limitações conhecidas em Forex (polling)

