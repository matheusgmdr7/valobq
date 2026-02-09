# 📚 TWELVE DATA: DOCUMENTAÇÃO APLICADA

## 📋 INFORMAÇÕES DA DOCUMENTAÇÃO OFICIAL

### **Da FAQ do Twelve Data:**
- ✅ WebSocket pode ser testado com planos Basic e Grow
- ✅ Acesso completo requer plano Pro
- ✅ Até 3 conexões simultâneas permitidas
- ✅ Limite de 100 eventos por minuto (subscribe/unsubscribe/reset)
- ✅ Número de símbolos depende do plano

**Fonte:** [WebSocket FAQ](https://support.twelvedata.com/en/articles/5194610-websocket-faq)

---

### **Do Exemplo Python (GitHub):**
- ✅ Usa `td.websocket(symbols="BTC/USD", on_event=on_event)`
- ✅ Depois `ws.subscribe(['ETH/BTC', 'AAPL'])`
- ✅ E `ws.connect()`
- ✅ Envia `ws.heartbeat()` periodicamente

**Fonte:** [GitHub twelvedata-python](https://github.com/twelvedata/twelvedata-python)

---

## ✅ AJUSTES IMPLEMENTADOS

### **1. Formato de Símbolo**
- ✅ Tenta primeiro com formato original: `GBP/USD`
- ✅ Se falhar, tenta sem barra: `GBPUSD`
- ✅ Baseado no exemplo Python que usa `BTC/USD`

### **2. Heartbeat Implementado**
- ✅ Envia heartbeat a cada 30 segundos
- ✅ Mantém conexão ativa
- ✅ Requerido pela documentação

### **3. Endpoint com Fallback**
- ✅ Tenta primeiro: `wss://ws.twelvedata.com/v1/quotes/price?apikey=API_KEY`
- ✅ Se falhar, tenta: `wss://ws.twelvedata.com/v1/quotes?apikey=API_KEY`

### **4. Formato de Subscrição**
- ✅ Usa: `{ "action": "subscribe", "params": { "symbols": "GBP/USD" } }`
- ✅ Mantém formato original do símbolo (com barra)

---

## 🔄 ORDEM DE TENTATIVAS

```
1. Conectar: wss://ws.twelvedata.com/v1/quotes/price
2. Subscrever: { "action": "subscribe", "params": { "symbols": "GBP/USD" } }
3. Se falhar, tentar sem barra: "GBPUSD"
4. Se ainda falhar, tentar endpoint alternativo: /v1/quotes (sem /price)
5. Se tudo falhar, usar REST API como fallback
```

---

## 📊 LOGS ESPERADOS

**Sucesso:**
```
🔗 [TwelveData] Conectando a wss://ws.twelvedata.com/v1/quotes/price?apikey=...
✅ [TwelveData] WebSocket conectado para GBP/USD
📡 [TwelveData] Subscrito a GBP/USD
✅ [TwelveData] Subscrição confirmada para GBP/USD
```

**Com Fallback:**
```
❌ [TwelveData] Erro WebSocket (404)
🔄 [TwelveData] Tentando endpoint alternativo...
```

---

**Status:** ✅ Ajustes baseados na documentação oficial aplicados


