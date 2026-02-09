# Fase 4 - Semana 23-24: Monitoramento e Analytics - Completa

## Resumo

Implementação completa de sistemas de monitoramento, error tracking e analytics para a plataforma de trading.

## Implementações Realizadas

### 1. Sistema de Monitoramento (`src/utils/monitoring.ts`)

**Características:**
- ✅ Suporte opcional para Sentry (carregamento dinâmico)
- ✅ Fallback próprio de error tracking
- ✅ Captura automática de erros não tratados
- ✅ Captura de unhandled promise rejections
- ✅ Métricas de performance
- ✅ Armazenamento local de erros
- ✅ Estatísticas de erros

**Funcionalidades:**
- `initMonitoring()`: Inicializa monitoramento (com Sentry opcional)
- `captureError()`: Captura erro com contexto
- `captureMessage()`: Captura mensagem (info/warning/error)
- `recordMetric()`: Registra métrica de performance
- `getStoredErrors()`: Obtém erros armazenados
- `getStats()`: Obtém estatísticas

**Integração Sentry:**
- Carregamento dinâmico (não quebra se não instalado)
- Configuração via `NEXT_PUBLIC_SENTRY_DSN`
- Integrações: BrowserTracing, Replay
- Traces e replays configurados

### 2. Sistema de Analytics (`src/utils/analytics.ts`)

**Características:**
- ✅ Tracking de eventos customizados
- ✅ Page views
- ✅ Ações do usuário
- ✅ Eventos de trading
- ✅ Eventos de gráfico
- ✅ Estatísticas agregadas
- ✅ Session tracking

**Funcionalidades:**
- `track()`: Track evento genérico
- `pageView()`: Track visualização de página
- `userAction()`: Track ação do usuário
- `tradingEvent()`: Track evento de trading
- `chartEvent()`: Track evento de gráfico
- `getStats()`: Estatísticas de eventos

### 3. Integração com PerformanceMonitor

**Métricas Automáticas:**
- FPS médio (a cada 1 segundo)
- Frame time médio
- Alertas quando FPS < 30
- Métricas enviadas para sistema de monitoramento

### 4. Tracking de Eventos Integrado

**WebGLChart:**
- `chart_initialized`: Quando gráfico é inicializado
- `zoom_reset`: Quando zoom é resetado

**RealtimeDataManager:**
- `websocket_connected`: Quando WebSocket conecta
- `websocket_disconnected`: Quando WebSocket desconecta
- `polling_fallback_activated`: Quando polling é ativado

## Arquivos Criados

1. `src/utils/monitoring.ts`
   - Sistema de monitoramento completo

2. `src/utils/analytics.ts`
   - Sistema de analytics completo

3. `src/components/MonitoringInit.tsx`
   - Componente de inicialização

4. `src/engine/webgl/PerformanceMonitor.ts` (atualizado)
   - Integração com monitoramento

5. `src/components/charts/WebGLChart.tsx` (atualizado)
   - Tracking de eventos de gráfico

6. `src/engine/websocket/RealtimeDataManager.ts` (atualizado)
   - Tracking de eventos de WebSocket

## Configuração

### Variáveis de Ambiente

```env
# Sentry (opcional)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Analytics (opcional, default: true)
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

### Uso Básico

```typescript
import { captureError, captureMessage, recordMetric } from '@/utils/monitoring';
import { trackEvent, trackChartEvent, trackTradingEvent } from '@/utils/analytics';

// Capturar erro
try {
  // código
} catch (error) {
  captureError(error as Error, {
    userId: 'user123',
    action: 'trade_execution'
  });
}

// Capturar mensagem
captureMessage('WebSocket reconnected', 'info', {
  symbol: 'EURUSD'
});

// Registrar métrica
recordMetric({
  name: 'trade.execution_time',
  value: 150,
  unit: 'ms',
  tags: { type: 'call' }
});

// Track evento
trackChartEvent('indicator_added', {
  indicator: 'SMA',
  period: 20
});
```

## Métricas Coletadas

### Performance
- `chart.fps`: FPS médio do gráfico
- `chart.frameTime`: Tempo de frame médio
- `chart.performance.warning`: Alertas de FPS baixo

### Eventos de Gráfico
- `chart_initialized`: Inicialização
- `zoom_reset`: Reset de zoom
- `indicator_added`: Indicador adicionado
- `indicator_removed`: Indicador removido

### Eventos de Trading
- `websocket_connected`: WebSocket conectado
- `websocket_disconnected`: WebSocket desconectado
- `polling_fallback_activated`: Polling ativado

## Integração Sentry (Opcional)

Para usar Sentry, instale o pacote:

```bash
npm install @sentry/nextjs
```

E configure a variável de ambiente:

```env
NEXT_PUBLIC_SENTRY_DSN=your-dsn-here
```

O sistema detectará automaticamente e usará Sentry. Se não configurado, usa fallback próprio.

## Estatísticas Disponíveis

### Monitoramento
```typescript
const stats = monitoring.getStats();
// {
//   errorCount: 10,
//   metricCount: 500,
//   recentErrors: 2,
//   recentMetrics: 50
// }
```

### Analytics
```typescript
const stats = analytics.getStats();
// {
//   totalEvents: 1000,
//   eventsByType: {
//     'chart_initialized': 5,
//     'zoom_reset': 20,
//     ...
//   },
//   recentEvents: 100
// }
```

## Próximos Passos

### Semana 25-26: Testes e Deploy
- [ ] Testes de performance completos
- [ ] Testes de integração
- [ ] Testes de usuário
- [ ] Deploy em produção
- [ ] Monitoramento pós-deploy

## Conclusão

Sistema completo de monitoramento e analytics implementado:
- ✅ Error tracking (Sentry opcional + fallback)
- ✅ Performance monitoring integrado
- ✅ Analytics de eventos
- ✅ Métricas automáticas
- ✅ Tracking em componentes principais

Pronto para produção com monitoramento completo.

