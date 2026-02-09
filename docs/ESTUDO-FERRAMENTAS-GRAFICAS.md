# Estudo das Ferramentas Gráficas: Linha, Trendline e Fibonacci

## 📋 Resumo Executivo

Este documento analisa como funcionam as ferramentas gráficas de **Linha**, **Trendline** e **Linhas Fibonacci** no sistema de trading, incluindo como são desenhadas, renderizadas e manipuladas.

---

## 🎯 1. FERRAMENTA: LINHA (Line)

### 1.1 Características

- **Tipo**: `'line'`
- **ID**: `'line'`
- **Pontos necessários**: 2 pontos (início e fim)
- **Uso**: Conectar dois pontos específicos no gráfico

### 1.2 Como Funciona

#### Desenho
1. **Primeiro clique**: Define o ponto inicial
   - Captura coordenadas X, Y do mouse
   - Calcula preço (`price`) e tempo (`time`) baseado na posição
   - Armazena: `{ x, y, price, time }`

2. **Segundo clique**: Define o ponto final
   - Captura coordenadas do segundo ponto
   - Completa o desenho automaticamente

#### Renderização
```typescript
// Localização: AnimatedCanvasChart.tsx (linhas 1098-1156)
if (tool.points.length >= 2) {
  // Para cada ponto, recalcula coordenadas baseado em price/time
  tool.points.forEach((point, idx) => {
    // Recalcular X baseado no tempo
    if (point.time !== undefined) {
      // Encontra candle mais próximo do tempo
      x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
    }
    
    // Recalcular Y baseado no preço
    if (point.price !== undefined) {
      y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
    }
    
    // Desenha linha conectando os pontos
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}
```

#### Propriedades Armazenadas
```typescript
{
  id: 'line',
  type: 'line',
  color: '#ef4444', // Vermelho padrão
  style: 'solid' | 'dashed' | 'dotted',
  visible: boolean,
  points: [
    { x: number, y: number, price?: number, time?: number }, // Ponto inicial
    { x: number, y: number, price?: number, time?: number }  // Ponto final
  ],
  createdAt: number
}
```

#### Manipulação (Arraste)
- Quando arrastada, ambos os pontos se movem proporcionalmente
- Usa delta do mouse: `deltaX` e `deltaY`
- Recalcula `price` e `time` baseado na nova posição

---

## 📈 2. FERRAMENTA: TRENDLINE

### 2.1 Características

- **Tipo**: `'trendline'`
- **ID**: `'trendline'`
- **Pontos necessários**: 2 pontos (início e fim)
- **Uso**: Identificar tendências de alta ou baixa conectando dois pontos significativos

### 2.2 Como Funciona

#### Desenho
**Idêntico à Linha**: Requer 2 cliques para definir início e fim

#### Renderização
**Idêntica à Linha**: Usa o mesmo código de renderização (linhas 1098-1156)

#### Diferenças da Linha
- **Propósito**: Trendline é usada para análise de tendência
- **Cor padrão**: Pode ser diferente (definida no código)
- **Interpretação**: Traders usam para identificar suporte/resistência

#### Propriedades Armazenadas
```typescript
{
  id: 'trendline',
  type: 'trendline',
  color: string,
  style: 'solid' | 'dashed' | 'dotted',
  visible: boolean,
  points: [
    { x: number, y: number, price?: number, time?: number },
    { x: number, y: number, price?: number, time?: number }
  ],
  createdAt: number
}
```

#### Manipulação (Arraste)
**Idêntica à Linha**: Ambos os pontos se movem proporcionalmente

---

## 🔢 3. FERRAMENTA: LINHAS FIBONACCI

### 3.1 Características

- **Tipo**: `'fibonacci'`
- **ID**: `'fibonacci'`
- **Pontos necessários**: 2 pontos (início e fim do range)
- **Uso**: Mostrar níveis de retração de Fibonacci para análise técnica

### 3.2 Como Funciona

#### Desenho
1. **Primeiro clique**: Define o ponto inicial (pode ser topo ou fundo)
   - Captura: `{ x, y, price, time }`

2. **Segundo clique**: Define o ponto final (oposto ao inicial)
   - Completa o desenho automaticamente
   - Calcula o range de preços entre os dois pontos

#### Renderização
```typescript
// Localização: AnimatedCanvasChart.tsx (linhas 1077-1096)
if (tool.type === 'fibonacci' && tool.points.length >= 2) {
  const startPrice = tool.points[0].price || 0;
  const endPrice = tool.points[1].price || 0;
  const priceRange = Math.abs(endPrice - startPrice);
  
  // Níveis de Fibonacci padrão
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
  const colors = ['#3b82f6', '#22c55e', '#eab308', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];
  
  levels.forEach((level, idx) => {
    // Calcular preço do nível Fibonacci
    const fibPrice = startPrice < endPrice 
      ? startPrice + priceRange * level 
      : startPrice - priceRange * level;
    
    // Calcular Y no gráfico
    const fibY = chartY + chartHeight - ((fibPrice - actualMinPrice) / actualPriceRange) * chartHeight;
    
    // Desenhar linha horizontal para cada nível
    ctx.strokeStyle = colors[idx] || tool.color;
    ctx.beginPath();
    ctx.moveTo(chartX, fibY);
    ctx.lineTo(chartX + chartWidth, fibY);
    ctx.stroke();
  });
}
```

#### Níveis de Fibonacci
Os níveis são calculados como porcentagens do range de preços:

| Nível | Porcentagem | Descrição |
|-------|-------------|-----------|
| 0.0   | 0%          | Ponto inicial |
| 0.236 | 23.6%       | Primeiro nível de retração |
| 0.382 | 38.2%       | Segundo nível de retração |
| 0.5   | 50%         | Nível médio |
| 0.618 | 61.8%       | Nível dourado (Golden Ratio) |
| 0.786 | 78.6%       | Terceiro nível de retração |
| 1.0   | 100%        | Ponto final |

#### Cores por Nível
- **0.0 e 1.0**: Azul (`#3b82f6`)
- **0.236**: Verde (`#22c55e`)
- **0.382**: Amarelo (`#eab308`)
- **0.5**: Laranja (`#f59e0b`)
- **0.618**: Vermelho (`#ef4444`)
- **0.786**: Roxo (`#8b5cf6`)

#### Propriedades Armazenadas
```typescript
{
  id: 'fibonacci',
  type: 'fibonacci',
  color: string, // Cor base (usada para níveis 0 e 1)
  style: 'solid' | 'dashed' | 'dotted',
  visible: boolean,
  points: [
    { x: number, y: number, price: number, time?: number }, // Ponto inicial (obrigatório price)
    { x: number, y: number, price: number, time?: number }  // Ponto final (obrigatório price)
  ],
  createdAt: number
}
```

**Importante**: Para Fibonacci, `price` é **obrigatório** em ambos os pontos, pois os níveis são calculados baseados no range de preços.

#### Manipulação (Arraste)
- Quando arrastada, ambos os pontos se movem proporcionalmente
- Os níveis são recalculados automaticamente baseados nos novos preços

---

## 🔄 4. COMPARAÇÃO ENTRE AS FERRAMENTAS

| Característica | Linha | Trendline | Fibonacci |
|----------------|-------|-----------|-----------|
| **Pontos necessários** | 2 | 2 | 2 |
| **Renderização** | 1 linha | 1 linha | 7 linhas horizontais |
| **Price obrigatório** | Opcional | Opcional | **Obrigatório** |
| **Time obrigatório** | Opcional | Opcional | Opcional |
| **Uso principal** | Conexão de pontos | Análise de tendência | Níveis de retração |
| **Cálculo especial** | Não | Não | Sim (níveis Fibonacci) |

---

## 🎨 5. SISTEMA DE COORDENADAS

### 5.1 Coordenadas Armazenadas

Todas as ferramentas armazenam pontos com:
```typescript
{
  x: number,      // Coordenada X em pixels (pode ser recalculada)
  y: number,      // Coordenada Y em pixels (pode ser recalculada)
  price?: number, // Preço no gráfico (usado para recalcular Y)
  time?: number   // Timestamp (usado para recalcular X)
}
```

### 5.2 Recalculação de Coordenadas

O sistema recalcula coordenadas baseado em `price` e `time`:

**Recalcular X (baseado em time)**:
```typescript
// Encontrar candle mais próximo do tempo
let closestIndex = 0;
let minDiff = Math.abs(visibleCandles[0].time - point.time);
for (let i = 1; i < visibleCandles.length; i++) {
  const diff = Math.abs(visibleCandles[i].time - point.time);
  if (diff < minDiff) {
    minDiff = diff;
    closestIndex = i;
  }
}
x = chartX + (closestIndex / visibleCandles.length) * chartWidth;
```

**Recalcular Y (baseado em price)**:
```typescript
y = chartY + chartHeight - ((point.price - actualMinPrice) / actualPriceRange) * chartHeight;
```

### 5.3 Por que Recalcular?

- **Zoom/Pan**: Quando o usuário faz zoom ou pan, as coordenadas em pixels mudam, mas `price` e `time` permanecem constantes
- **Redimensionamento**: Quando a janela é redimensionada, o gráfico recalcula posições
- **Atualização de dados**: Novos candles podem mudar o viewport, mas as ferramentas mantêm seus preços/tempos

---

## 🖱️ 6. INTERAÇÕES DO USUÁRIO

### 6.1 Desenho

1. **Selecionar ferramenta**: Clicar no ícone da ferramenta na barra de ferramentas
2. **Primeiro clique**: Define ponto inicial
3. **Segundo clique**: Define ponto final (completa o desenho)

### 6.2 Seleção

- **Clicar na ferramenta**: Seleciona a ferramenta
- **Indicador visual**: Círculo azul aparece no centro (linha/trendline) ou nas extremidades (Fibonacci)

### 6.3 Arraste

- **Clicar e arrastar**: Move a ferramenta inteira
- **Linha horizontal**: Move apenas verticalmente (mantém preço)
- **Linha vertical**: Move apenas horizontalmente (mantém tempo)
- **Linha/Trendline**: Move ambos os pontos proporcionalmente
- **Fibonacci**: Move ambos os pontos, recalculando todos os níveis

### 6.4 Edição

- **Painel de propriedades**: Aparece quando a ferramenta está selecionada
- **Cor**: Pode ser alterada via seletor de cores
- **Estilo**: Pode ser alterado (sólida, tracejada, pontilhada)
- **Visibilidade**: Pode ser ocultada/mostrada

---

## 🔧 7. IMPLEMENTAÇÃO TÉCNICA

### 7.1 Fluxo de Desenho

```
1. Usuário seleciona ferramenta
   ↓
2. Clica no gráfico (primeiro ponto)
   ↓
3. toolDrawingRef.current.isDrawing = true
   ↓
4. Clica novamente (segundo ponto)
   ↓
5. handleMouseUp() é chamado
   ↓
6. onToolComplete() é chamado com a ferramenta completa
   ↓
7. Ferramenta é adicionada a activeTools
   ↓
8. graphicToolsForChart é recalculado
   ↓
9. AnimatedCanvasChart renderiza a ferramenta
```

### 7.2 Estrutura de Dados

```typescript
// Estado no TradingPage
const [activeTools, setActiveTools] = useState<GraphicTool[]>([]);

// Convertido para formato do AnimatedCanvasChart
const graphicToolsForChart = useMemo(() => {
  return activeTools
    .filter(tool => tool.visible && tool.points && tool.points.length > 0)
    .map(tool => ({
      id: `${tool.id}-${tool.createdAt}`, // ID único
      type: tool.type,
      color: tool.color,
      style: tool.style,
      visible: tool.visible,
      points: tool.points || []
    }));
}, [activeTools]);
```

### 7.3 Callbacks

```typescript
// Quando o desenho é completado
onToolComplete?: (tool: GraphicToolData) => void;

// Quando o usuário clica em uma ferramenta
onToolClick?: (toolId: string, toolType: string, position: { x: number; y: number }) => void;

// Quando o usuário move uma ferramenta
onToolMove?: (toolId: string, newPoints: Array<{ x: number; y: number; price?: number; time?: number }>) => void;
```

---

## 📝 8. CONSIDERAÇÕES PARA DUPLICAÇÃO

### 8.1 Linha e Trendline

**Estratégia de Offset**:
- Aplicar offset pequeno em ambos os pontos
- Offset em `price`: 0.2-0.5% do preço de referência
- Offset em `time`: 5 minutos (300000ms)

**Código sugerido**:
```typescript
if (tool.type === 'line' || tool.type === 'trendline') {
  const basePrice = tool.points[0]?.price || currentPrice || 1000;
  offsetPrice = Math.min(currentPrice * 0.002, basePrice * 0.005);
  offsetTime = 5 * 60 * 1000; // 5 minutos
  
  // Aplicar offset em ambos os pontos
  newPoints = tool.points.map((p, index) => ({
    ...p,
    price: p.price !== undefined ? p.price + offsetPrice : p.price,
    time: p.time !== undefined ? p.time + offsetTime : p.time
  }));
}
```

### 8.2 Fibonacci

**Estratégia de Offset**:
- Aplicar offset apenas nos preços (não no tempo)
- Offset maior para garantir que os níveis sejam visíveis
- Manter a direção do range (alto->baixo ou baixo->alto)

**Código sugerido**:
```typescript
if (tool.type === 'fibonacci') {
  const startPrice = tool.points[0].price || 0;
  const endPrice = tool.points[1].price || 0;
  const refPrice = currentPrice || Math.max(startPrice, endPrice);
  
  // Offset baseado no range atual
  const priceRange = Math.abs(endPrice - startPrice);
  offsetPrice = Math.max(priceRange * 0.1, refPrice * 0.005); // 10% do range ou 0.5% do preço
  
  // Aplicar offset mantendo a direção
  newPoints = tool.points.map((p, index) => ({
    ...p,
    price: p.price !== undefined 
      ? (startPrice < endPrice 
          ? p.price + offsetPrice 
          : p.price - offsetPrice)
      : p.price
  }));
}
```

---

## ✅ 9. CHECKLIST DE IMPLEMENTAÇÃO

### Para Linha e Trendline:
- [x] Entender estrutura de pontos (2 pontos)
- [x] Entender renderização (linha conectando pontos)
- [x] Entender recalcular coordenadas (price/time)
- [ ] Implementar duplicação com offset em price e time
- [ ] Testar visibilidade no viewport
- [ ] Testar arraste após duplicação

### Para Fibonacci:
- [x] Entender estrutura de pontos (2 pontos com price obrigatório)
- [x] Entender renderização (7 linhas horizontais)
- [x] Entender cálculo de níveis (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0)
- [ ] Implementar duplicação com offset em price
- [ ] Garantir que price seja preservado
- [ ] Testar recálculo de níveis após duplicação
- [ ] Testar visibilidade de todos os níveis

---

## 📚 10. REFERÊNCIAS

- **AnimatedCanvasChart.tsx**: Linhas 1077-1200 (renderização)
- **AnimatedCanvasChart.tsx**: Linhas 1800-1950 (interação e arraste)
- **TradingPage.tsx**: Linhas 154-167 (conversão de ferramentas)
- **TradingPage.tsx**: Linhas 169-265 (handlers de ferramentas)

---

## 🎯 11. PRÓXIMOS PASSOS

1. **Implementar duplicação para Linha e Trendline**
   - Aplicar offset em price e time
   - Garantir visibilidade no viewport

2. **Implementar duplicação para Fibonacci**
   - Aplicar offset apenas em price
   - Garantir que todos os níveis sejam visíveis
   - Manter direção do range

3. **Testes**
   - Testar duplicação de cada ferramenta
   - Verificar se aparecem no gráfico
   - Verificar se podem ser arrastadas após duplicação
   - Verificar se propriedades são preservadas








