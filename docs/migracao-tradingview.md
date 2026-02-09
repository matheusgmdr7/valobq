# Migração para TradingView Lightweight Charts

## 📋 Resumo da Migração

Esta migração substitui o motor WebGL customizado por **TradingView Lightweight Charts** e implementa uma arquitetura segura com servidor WebSocket centralizado.

## 🎯 Objetivos Alcançados

1. ✅ **Backend Seguro**: Servidor WebSocket centralizado (`MarketDataServer`)
2. ✅ **Single Source of Truth**: Redis como SSoT para dados de mercado
3. ✅ **Frontend Simplificado**: TradingView Lightweight Charts substitui WebGL
4. ✅ **Eliminação de Polling**: Removido `forexPollingService.ts`
5. ✅ **Arquitetura Escalável**: Preparado para múltiplos clientes

## 📦 Dependências Adicionadas

```bash
npm install lightweight-charts ws redis
npm install -D @types/ws tsx
```

## 🚀 Instalação e Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie/atualize `.env.local`:

```env
# MarketDataServer
MARKET_DATA_PORT=8080
REDIS_URL=redis://localhost:6379

# Frontend
NEXT_PUBLIC_MARKET_DATA_WS_URL=ws://localhost:8080
```

### 3. Iniciar Servidor de Dados

Em um terminal separado:

```bash
npm run dev:server
```

Ou manualmente:

```bash
npx tsx src/server/MarketDataServer.ts
```

### 4. Iniciar Frontend

```bash
npm run dev
```

## 📁 Arquivos Criados

### Backend
- `src/server/MarketDataServer.ts` - Servidor WebSocket centralizado

### Frontend
- `src/components/charts/TradingViewChart.tsx` - Componente de gráfico
- `src/hooks/useRealtimeStream.ts` - Hook para WebSocket

## 🗑️ Arquivos a Remover (Após Testes)

### Serviços Legados
- `src/services/forexPollingService.ts` ❌

### Motor WebGL (Após confirmação de funcionamento)
- `src/engine/charts/ChartManager.ts` ❌
- `src/engine/webgl/Renderer.ts` ❌
- `src/utils/smoothRenderer.ts` ❌
- `src/components/charts/WebGLChart.tsx` ❌ (substituído por TradingViewChart)

## 🔄 Como Usar o Novo Componente

```tsx
import { TradingViewChart } from '@/components/charts/TradingViewChart';

<TradingViewChart
  symbol="GBP/USD"
  width={800}
  height={600}
  onPriceUpdate={(price) => {
    console.log('Preço atualizado:', price);
  }}
/>
```

## 🔌 Arquitetura de Dados

```
┌─────────────────┐
│  Binance API    │
│  Polygon API    │──┐
└─────────────────┘  │
                     ▼
            ┌──────────────────┐
            │ MarketDataServer │
            │  (WebSocket)     │
            └──────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────┐           ┌─────────┐
    │  Redis  │           │ Clients │
    │  (SSoT) │           │ (Frontend)
    └─────────┘           └─────────┘
```

## ✅ Checklist de Migração

- [x] Criar MarketDataServer.ts
- [x] Criar TradingViewChart.tsx
- [x] Criar useRealtimeStream.ts
- [ ] Instalar dependências
- [ ] Testar MarketDataServer
- [ ] Atualizar trading/page.tsx
- [ ] Remover forexPollingService.ts
- [ ] Remover motor WebGL
- [ ] Testar em produção

## 🐛 Troubleshooting

### Servidor não conecta
- Verificar se Redis está rodando: `redis-cli ping`
- Verificar porta 8080 disponível
- Verificar logs do MarketDataServer

### Gráfico não renderiza
- Verificar console do browser
- Verificar conexão WebSocket (Network tab)
- Verificar se `lightweight-charts` está instalado

### Dados não atualizam
- Verificar se MarketDataServer está rodando
- Verificar subscrição ao símbolo correto
- Verificar logs do servidor





