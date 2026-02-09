# Problema: Candles Históricos e Renderização Visual

## Como os Candles Históricos são Carregados

### 1. Geração de Dados Simulados (linhas 319-436)

```typescript
const loadHistoricalData = async (series, currentSymbol) => {
  // 1. Gera 1000 candles históricos simulados
  // 2. Usa preços base diferentes por símbolo:
  //    - BTC: 60000 (SIMULADO)
  //    - ETH: 3000 (SIMULADO)
  //    - EUR/USD: 1.0800 (SIMULADO)
  //    - etc.
  
  // 3. Cria candles com timestamps do passado (últimos 1000 minutos)
  // 4. Usa Random Walk para simular movimento realista
  // 5. Carrega na série com series.setData(candles)
}
```

### 2. O Problema Identificado

**Cenário:**
- Candles históricos são gerados com preço simulado: **BTC = 60000**
- Preço real que chega do servidor: **BTC = 88660**
- **Diferença: 28660 (47% de diferença!)**

**O que acontece:**
1. Gráfico carrega 1000 candles históricos com preço ~60000
2. TradingView calcula escala de preço baseada nesses candles (60000-61000)
3. Primeiro tick real chega com preço 88660
4. Último candle histórico (60000) é substituído pelo real (88660)
5. **PROBLEMA:** TradingView não recalcula a escala de preço corretamente
6. Gráfico continua mostrando escala antiga (60000-61000) mesmo com dados reais (88660)

### 3. Por que a Renderização Visual Não Funciona?

O TradingView Lightweight Charts usa cache interno e otimizações que podem:
- Não detectar mudanças significativas de preço
- Não recalcular a escala automaticamente
- Usar cache de renderização do canvas

Mesmo com `setData()` e `applyOptions({ autoScale: true })`, o gráfico pode não renderizar visualmente se:
- A mudança de preço é muito grande (47% no caso do BTC)
- O canvas já foi renderizado com a escala antiga
- O cache interno não foi invalidado

## Solução Implementada

### 1. Recriação Completa da Série
- Quando o preço muda, recriamos TODA a série com `setData()`
- Isso força o TradingView a recalcular tudo do zero

### 2. Múltiplos Métodos de Atualização Visual
- `chart.applyOptions({ rightPriceScale: { autoScale: true } })`
- Forçar resize via `applyOptions({ width, height })`
- `timeScale.scrollToRealTime()`
- Disparar evento `resize` manualmente

### 3. Verificação Pós-Atualização
- Verifica se os dados foram realmente atualizados
- Se houver discrepância, força nova atualização

## Próximos Passos

Se o problema persistir, podemos:
1. **Recriar o gráfico completamente** quando o primeiro tick real chega
2. **Usar preço real como base** para gerar candles históricos (se disponível)
3. **Forçar recriação do canvas** diretamente via DOM manipulation


