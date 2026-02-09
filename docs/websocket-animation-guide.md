# 📡 Guia: WebSocket e Animações Fluidas de Candles

## 🔍 Como as Brokers de Referência Funcionam

Baseado na investigação da broker de referência (Polarium Broker), aqui está como eles implementam WebSocket e animações fluidas:

---

## 1. 🌐 WebSocket para Dados em Tempo Real

### **Endpoint Identificado:**
```
ws02.ws.prod.sc-ams-1b.quadcode.tech
```

### **Como Funciona:**

#### **A. Conexão WebSocket**
```javascript
// Estrutura típica de conexão
const ws = new WebSocket('wss://ws02.ws.prod.sc-ams-1b.quadcode.tech');

ws.onopen = () => {
  // Inscrever-se em símbolos específicos
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbols: ['GBP/USD', 'EUR/USD', 'BTC/USD']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Processar dados em tempo real
  handleMarketData(data);
};
```

#### **B. Formato de Dados Recebidos**
```javascript
// Exemplo de mensagem WebSocket
{
  type: 'tick',           // ou 'candle', 'price'
  symbol: 'GBP/USD',
  timestamp: 1704067200000,
  price: 1.2650,
  volume: 125000,
  bid: 1.2648,
  ask: 1.2652
}
```

#### **C. Frequência de Atualização**
- **Ticks (preços instantâneos):** ~10-50ms (20-100 updates/segundo)
- **Candles (velas):** A cada segundo ou quando o candle fecha
- **Volume:** Atualizado em tempo real

---

## 2. 🎨 Animações Fluidas: Como Funcionam

### **A. Arquitetura de Renderização**

A broker de referência usa uma arquitetura híbrida:

```
┌─────────────────────────────────────────┐
│  WebSocket → Dados em Tempo Real        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  JavaScript → Processamento e UI         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  WebAssembly → Cálculos de Gráficos      │
│  (C/C++ compilado)                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  WebGL → Renderização na GPU            │
│  (60 FPS constante)                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Canvas → Exibição Final                │
└─────────────────────────────────────────┘
```

### **B. Técnicas para Animações Fluidas**

#### **1. Interpolação de Preços (Price Interpolation)**
```javascript
// Em vez de atualizar o preço instantaneamente,
// interpola suavemente entre o preço atual e o novo preço

class SmoothPriceAnimator {
  constructor() {
    this.currentPrice = 0;
    this.targetPrice = 0;
    this.animationSpeed = 0.1; // 0-1, quanto maior, mais rápido
  }

  update(newPrice) {
    this.targetPrice = newPrice;
  }

  animate() {
    // Interpolação linear suave
    const diff = this.targetPrice - this.currentPrice;
    this.currentPrice += diff * this.animationSpeed;
    
    // Ou usar easing function para movimento mais natural
    // this.currentPrice += diff * this.easeOutQuad(this.animationSpeed);
    
    return this.currentPrice;
  }

  easeOutQuad(t) {
    return t * (2 - t);
  }
}
```

#### **2. Atualização do Último Candle (Live Candle Update)**
```javascript
// Quando recebe um novo tick, atualiza o último candle
// em vez de criar um novo candle imediatamente

function updateLastCandle(tick) {
  const lastCandle = candles[candles.length - 1];
  const now = Date.now();
  const candleInterval = 60000; // 1 minuto
  
  // Se ainda estamos no mesmo período do candle
  if (now - lastCandle.timestamp < candleInterval) {
    // Atualizar candle existente
    lastCandle.close = tick.price;
    lastCandle.high = Math.max(lastCandle.high, tick.price);
    lastCandle.low = Math.min(lastCandle.low, tick.price);
    lastCandle.volume += tick.volume;
  } else {
    // Criar novo candle
    createNewCandle(tick);
  }
}
```

#### **3. RequestAnimationFrame (RAF) para Renderização**
```javascript
// Usar RAF para renderização suave a 60 FPS
let animationFrameId;

function renderLoop() {
  // Atualizar animações
  priceAnimator.animate();
  
  // Renderizar gráfico
  renderChart();
  
  // Continuar loop
  animationFrameId = requestAnimationFrame(renderLoop);
}

// Iniciar loop
renderLoop();

// Limpar ao desmontar
function cleanup() {
  cancelAnimationFrame(animationFrameId);
}
```

#### **4. Throttling de Atualizações WebSocket**
```javascript
// Não renderizar a cada mensagem WebSocket
// Agrupar atualizações e renderizar em batches

class UpdateBatcher {
  constructor(renderCallback, batchInterval = 16) { // ~60 FPS
    this.pendingUpdates = [];
    this.renderCallback = renderCallback;
    this.batchInterval = batchInterval;
    this.lastRender = 0;
  }

  addUpdate(data) {
    this.pendingUpdates.push(data);
    this.scheduleRender();
  }

  scheduleRender() {
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRender;
    
    if (timeSinceLastRender >= this.batchInterval) {
      this.render();
    } else {
      // Agendar renderização
      setTimeout(() => this.render(), 
        this.batchInterval - timeSinceLastRender);
    }
  }

  render() {
    if (this.pendingUpdates.length === 0) return;
    
    // Processar todas as atualizações pendentes
    const updates = this.pendingUpdates.splice(0);
    this.renderCallback(updates);
    this.lastRender = performance.now();
  }
}
```

#### **5. WebGL para Renderização GPU**
```javascript
// Renderização direta na GPU é muito mais rápida
// que manipular DOM ou Canvas 2D

// Exemplo de renderização WebGL otimizada
function renderCandlesWebGL(candles) {
  // Preparar dados para GPU
  const vertices = prepareCandleVertices(candles);
  const colors = prepareCandleColors(candles);
  
  // Enviar para GPU de uma vez
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
  
  // Renderizar em batch
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);
}
```

---

## 3. 📊 APIs de Preços Utilizadas

### **A. Provedores Comuns**

#### **1. Quadcode (Usado pela Broker de Referência)**
```
Endpoint: ws02.ws.prod.sc-ams-1b.quadcode.tech
Tipo: WebSocket proprietário
Características:
- Dados em tempo real
- Baixa latência
- Suporte a múltiplos símbolos
- Formato binário otimizado
```

#### **2. Alpha Vantage**
```
Endpoint: https://www.alphavantage.co/query
Tipo: REST API
Limitações:
- 5 calls/minuto (free)
- 500 calls/dia (free)
- Requer API key
```

#### **3. Yahoo Finance**
```
Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/
Tipo: REST API (não oficial)
Características:
- Gratuito
- Sem API key
- Pode ser bloqueado
```

#### **4. Binance WebSocket**
```
Endpoint: wss://stream.binance.com:9443/ws/
Tipo: WebSocket público
Características:
- Dados de criptomoedas
- Muito rápido
- Formato JSON
```

#### **5. TradingView**
```
Endpoint: wss://data.tradingview.com/socket.io/
Tipo: WebSocket
Características:
- Dados de múltiplos mercados
- Formato Socket.IO
- Requer autenticação
```

---

## 4. 🚀 Implementação Recomendada

### **A. Estrutura de WebSocket Client**

```typescript
class MarketDataWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private subscribers = new Map<string, Set<Function>>();
  private priceAnimator = new SmoothPriceAnimator();
  private updateBatcher = new UpdateBatcher(this.render.bind(this));

  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.subscribeToSymbols();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.scheduleReconnect();
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.scheduleReconnect();
    };
  }

  subscribe(symbol: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        symbol: symbol
      }));
    }
  }

  handleMessage(data: any) {
    switch (data.type) {
      case 'tick':
        // Atualizar preço com animação
        this.priceAnimator.update(data.price);
        this.updateBatcher.addUpdate(data);
        break;
        
      case 'candle':
        // Atualizar candle
        this.updateCandle(data);
        this.updateBatcher.addUpdate(data);
        break;
    }
  }

  render(updates: any[]) {
    // Renderizar todas as atualizações de uma vez
    // usando WebGL ou Canvas otimizado
    requestAnimationFrame(() => {
      updates.forEach(update => {
        this.processUpdate(update);
      });
      this.renderChart();
    });
  }
}
```

### **B. Integração com Gráfico**

```typescript
// No componente do gráfico
useEffect(() => {
  const ws = new MarketDataWebSocket();
  ws.connect('wss://your-websocket-url');
  
  ws.subscribe('GBP/USD');
  
  // Atualizar gráfico quando receber dados
  ws.onUpdate((data) => {
    setCandles(prev => {
      // Atualizar último candle ou criar novo
      return updateCandles(prev, data);
    });
  });
  
  return () => {
    ws.disconnect();
  };
}, []);
```

---

## 5. 🎯 Otimizações para Performance

### **A. Técnicas Implementadas pela Broker de Referência**

1. **WebAssembly para Cálculos**
   - Cálculos pesados em C/C++ compilado para WASM
   - 10-100x mais rápido que JavaScript puro

2. **WebGL para Renderização**
   - Renderização direta na GPU
   - Batch rendering (renderizar múltiplos candles de uma vez)
   - Viewport culling (renderizar apenas o que está visível)

3. **Throttling Inteligente**
   - Limitar atualizações a 60 FPS
   - Agrupar múltiplas atualizações em um frame

4. **Interpolação Suave**
   - Animar transições de preço
   - Easing functions para movimento natural

5. **Memory Pooling**
   - Reutilizar buffers e objetos
   - Reduzir alocações de memória

---

## 6. 📝 Resumo das Melhores Práticas

### **Para WebSocket:**
✅ Usar reconexão automática com backoff exponencial  
✅ Implementar heartbeat para manter conexão ativa  
✅ Throttle de mensagens para evitar sobrecarga  
✅ Buffer de mensagens para não perder dados durante reconexão  

### **Para Animações:**
✅ Usar `requestAnimationFrame` para renderização  
✅ Interpolar preços em vez de atualizar instantaneamente  
✅ Atualizar último candle em vez de criar novo imediatamente  
✅ Renderizar em batches (agrupar múltiplas atualizações)  
✅ Usar WebGL para renderização GPU quando possível  

### **Para Performance:**
✅ WebAssembly para cálculos pesados  
✅ WebGL para renderização GPU  
✅ Throttling a 60 FPS  
✅ Memory pooling  
✅ Viewport culling  

---

## 7. 🔗 Próximos Passos

1. **Implementar WebSocket Client** com reconexão automática
2. **Adicionar Price Animator** para interpolação suave
3. **Implementar Update Batcher** para agrupar atualizações
4. **Otimizar renderização** com WebGL e RAF
5. **Integrar com provedor de dados** (Quadcode, Binance, etc.)

---

**Última Atualização:** 2025-01-11  
**Baseado em:** Investigação da Polarium Broker

