# 🗑️ SÍMBOLOS DESABILITADOS: Pares Forex não suportados pelo Twelve Data

## 📊 DECISÃO

**Desabilitados:** Todos os pares Forex exceto `EUR/USD`

**Motivo:** Twelve Data WebSocket suporta apenas `EUR/USD` no plano gratuito/básico

### **Pares Desabilitados:**
- ❌ `GBP/USD` - Não suportado
- ❌ `USD/JPY` - Não suportado
- ❌ `AUD/CAD` - Não suportado
- ❌ `AUD/USD` - Não suportado
- ❌ `USD/CAD` - Não suportado
- ❌ `EUR/GBP` - Não suportado
- ❌ `EUR/JPY` - Não suportado
- ❌ `GBP/JPY` - Não suportado
- ❌ `USD/BRL` - Não suportado

---

## ✅ SÍMBOLOS ATIVOS

### **Forex:**
- ✅ **EUR/USD** - Funciona perfeitamente com Twelve Data WebSocket

### **Crypto:**
- ✅ **BTC/USD** - Funciona com Binance WebSocket
- ✅ **ETH/USD** - Funciona com Binance WebSocket

---

## 🔄 MUDANÇAS IMPLEMENTADAS

### **1. `src/services/marketService.ts`**
- ❌ Desabilitado: Todos os pares Forex não suportados (`enabled: false`)
- ✅ Mantido: Apenas `EUR/USD` ativo para Forex
- ✅ Mantidos: `BTC/USD` e `ETH/USD` para Crypto

### **2. `src/server/MarketDataServer.ts`**
- ✅ Configurado: Apenas `EUR/USD` para Forex
- ✅ Configurado: `BTC/USD` e `ETH/USD` para Crypto
- ✅ Atualizado: Mensagem de log para refletir mudanças

---

## 📋 PARES FOREX DESABILITADOS

Os seguintes pares estão no `marketService.ts` mas estão **desabilitados** (`enabled: false`):
- USD/JPY
- AUD/CAD
- AUD/USD
- USD/CAD
- EUR/GBP
- EUR/JPY
- GBP/JPY
- USD/BRL
- GBP/USD

**Nota:** Estes pares não aparecerão no frontend. Se precisar reativá-los no futuro, será necessário:
1. Verificar se Twelve Data suporta o símbolo
2. Ou usar `ExchangeRate-API` como fallback (atualização a cada hora)
3. Alterar `enabled: false` para `enabled: true` no `marketService.ts`

---

## 🎯 PRÓXIMOS PASSOS

Se quiser adicionar mais pares Forex:
1. Verificar se Twelve Data suporta o símbolo
2. Testar subscrição WebSocket
3. Se funcionar, adicionar à lista de símbolos padrão
4. Se não funcionar, usar ExchangeRate-API como fallback

---

**Status:** ✅ GBP/USD removido, sistema usando apenas EUR/USD para Forex

