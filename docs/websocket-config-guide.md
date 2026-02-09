# 📡 Guia: Como Configurar WebSocket Real para Dados de Mercado

Este guia explica como encontrar e configurar uma URL de WebSocket real para receber dados de mercado em tempo real.

---

## 🔍 Como Encontrar URLs de WebSocket

### **Método 1: Inspecionar Conexões WebSocket no Navegador**

1. **Abra o DevTools** (F12 ou Cmd+Option+I no Mac)
2. **Vá para a aba Network**
3. **Filtre por "WS" (WebSocket)**
4. **Recarregue a página** ou navegue até uma página que use WebSocket
5. **Procure por conexões `wss://` ou `ws://`**
6. **Clique na conexão** para ver detalhes:
   - URL completa
   - Headers de autenticação
   - Mensagens enviadas/recebidas
   - Formato dos dados

### **Método 2: Analisar Código JavaScript**

1. **Abra o DevTools** (F12)
2. **Vá para a aba Sources**
3. **Procure por arquivos JavaScript** que contenham:
   - `new WebSocket(`
   - `WebSocket(` 
   - `wss://` ou `ws://`
4. **Inspecione o código** para encontrar a URL

### **Método 3: Usar Provedores de Dados Conhecidos**

#### **Opção A: Binance WebSocket (Criptomoedas)**
```
URL: wss://stream.binance.com:9443/ws/btcusdt@ticker
Formato: JSON
Autenticação: Não necessária (público)
```

#### **Opção B: Alpha Vantage (Forex/Ações)**
```
URL: wss://www.alphavantage.co/query (REST API, não WebSocket)
Nota: Alpha Vantage não oferece WebSocket, apenas REST API
```

#### **Opção C: TradingView WebSocket**
```
URL: wss://data.tradingview.com/socket.io/
Formato: Socket.IO
Autenticação: Pode ser necessária
```

#### **Opção D: Yahoo Finance (Não oficial)**
```
URL: Não oferece WebSocket público
Nota: Apenas REST API não oficial
```

---

## ⚙️ Como Configurar no Projeto

### **Passo 1: Criar/Editar arquivo `.env.local`**

Crie um arquivo `.env.local` na raiz do projeto (se não existir):

```bash
# Na raiz do projeto
touch .env.local
```

### **Passo 2: Adicionar Variáveis de Ambiente**

Adicione as seguintes variáveis no arquivo `.env.local`:

```env
# ============================================
# WEBSOCKET PARA CRIPTOMOEDAS (Binance)
# ============================================
NEXT_PUBLIC_WEBSOCKET_CRYPTO=wss://stream.binance.com:9443/ws/btcusdt@ticker

# ============================================
# WEBSOCKET PARA FOREX (TradingView)
# ============================================
# Nota: Alpha Vantage NÃO oferece WebSocket, apenas REST API
NEXT_PUBLIC_WEBSOCKET_FOREX=wss://data.tradingview.com/socket.io/

# ============================================
# WEBSOCKET PARA AÇÕES (TradingView)
# ============================================
NEXT_PUBLIC_WEBSOCKET_STOCKS=wss://data.tradingview.com/socket.io/

# ============================================
# FALLBACK
# ============================================
NEXT_PUBLIC_POLLING_URL=/api/market-data
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=
```

**Importante:** O sistema seleciona automaticamente a URL correta baseado na categoria do ativo:
- **Criptomoedas** (BTC, ETH, etc.) → Usa `NEXT_PUBLIC_WEBSOCKET_CRYPTO`
- **Forex** (GBP/USD, EUR/USD, etc.) → Usa `NEXT_PUBLIC_WEBSOCKET_FOREX`
- **Ações** (Apple, etc.) → Usa `NEXT_PUBLIC_WEBSOCKET_STOCKS`

### **Passo 3: Configuração Automática por Tipo de Ativo**

O sistema agora seleciona automaticamente a URL correta baseado na categoria do ativo. Você só precisa configurar as URLs uma vez:

```env
# Criptomoedas → Binance
NEXT_PUBLIC_WEBSOCKET_CRYPTO=wss://stream.binance.com:9443/ws/btcusdt@ticker

# Forex → TradingView (Alpha Vantage não tem WebSocket)
NEXT_PUBLIC_WEBSOCKET_FOREX=wss://data.tradingview.com/socket.io/

# Ações → TradingView
NEXT_PUBLIC_WEBSOCKET_STOCKS=wss://data.tradingview.com/socket.io/
```

**Como funciona:**
- Quando você seleciona **BTC/USD** → Usa automaticamente `NEXT_PUBLIC_WEBSOCKET_CRYPTO`
- Quando você seleciona **GBP/USD** → Usa automaticamente `NEXT_PUBLIC_WEBSOCKET_FOREX`
- Quando você seleciona **Apple** → Usa automaticamente `NEXT_PUBLIC_WEBSOCKET_STOCKS`

**Nota sobre Alpha Vantage:**
- Alpha Vantage **NÃO oferece WebSocket**, apenas REST API
- Para forex e ações, estamos usando TradingView como alternativa
- O sistema faz fallback automático para polling se WebSocket falhar

### **Passo 4: Reiniciar o Servidor**

Após adicionar as variáveis de ambiente, **reinicie o servidor de desenvolvimento**:

```bash
# Parar o servidor (Ctrl+C)
# Iniciar novamente
npm run dev
# ou
yarn dev
```

---

## 📋 Formato Esperado dos Dados

O WebSocket deve enviar mensagens no seguinte formato JSON:

```json
{
  "type": "tick",           // ou "candle", "price"
  "symbol": "GBP/USD",      // Símbolo do par
  "timestamp": 1704067200000, // Timestamp em milissegundos
  "price": 1.2650,          // Preço atual
  "volume": 125000,         // Volume (opcional)
  "bid": 1.2648,            // Preço de compra (opcional)
  "ask": 1.2652             // Preço de venda (opcional)
}
```

### **Para Candles (Velas):**
```json
{
  "type": "candle",
  "symbol": "GBP/USD",
  "timestamp": 1704067200000,
  "data": {
    "open": 1.2645,
    "high": 1.2655,
    "low": 1.2640,
    "close": 1.2650,
    "volume": 125000
  }
}
```

---

## 🔧 Testando a Conexão

### **Verificar se está funcionando:**

1. **Abra o console do navegador** (F12 → Console)
2. **Procure por mensagens:**
   - `✅ WebSocket connected` - Conexão bem-sucedida
   - `WebSocket disconnected` - Conexão perdida
   - `Polling fallback activated` - Usando fallback de polling

3. **Verifique os logs:**
   - Mensagens de erro
   - Status da conexão
   - Dados recebidos

### **Debug no Código:**

O sistema já está configurado para:
- ✅ Tentar WebSocket primeiro
- ✅ Fazer fallback automático para polling se WebSocket falhar
- ✅ Reconectar automaticamente se a conexão cair
- ✅ Mostrar status no console

---

## 🚨 Troubleshooting

### **Problema: WebSocket não conecta**

**Soluções:**
1. Verifique se a URL está correta (deve começar com `wss://` ou `ws://`)
2. Verifique se o servidor WebSocket está acessível
3. Verifique se há autenticação necessária
4. Verifique o console para mensagens de erro

### **Problema: Dados não aparecem**

**Soluções:**
1. Verifique o formato dos dados (deve ser JSON)
2. Verifique se o símbolo está correto
3. Verifique se o tipo de mensagem está correto (`tick`, `candle`, etc.)
4. Verifique os logs no console

### **Problema: CORS ou bloqueio**

**Soluções:**
1. Alguns WebSockets podem precisar de proxy
2. Configure CORS no servidor se necessário
3. Use polling como fallback

---

## 📚 Recursos Adicionais

### **Documentação de Provedores:**

- **Binance WebSocket:** https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams
- **TradingView:** https://www.tradingview.com/support/solutions/43000529348
- **Alpha Vantage:** https://www.alphavantage.co/documentation/

### **Ferramentas Úteis:**

- **WebSocket King:** https://websocketking.com/ (testar conexões WebSocket)
- **Postman:** Testar APIs REST de fallback

---

## ✅ Checklist de Configuração

- [ ] Arquivo `.env.local` criado na raiz do projeto
- [ ] Variável `NEXT_PUBLIC_WEBSOCKET_URL` configurada
- [ ] Variável `NEXT_PUBLIC_POLLING_URL` configurada (opcional)
- [ ] Servidor reiniciado após adicionar variáveis
- [ ] Console do navegador verificado para erros
- [ ] Conexão WebSocket testada
- [ ] Dados aparecendo no gráfico

---

**Última Atualização:** 2025-01-11  
**Versão:** 1.0

