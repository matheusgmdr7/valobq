# Correção: Linha Horizontal Duplicada Não Aparece no Gráfico

## 🐛 Problema Identificado

Quando uma linha horizontal era duplicada, a notificação aparecia (indicando sucesso), mas a linha duplicada não aparecia no gráfico ou aparecia fora da área visível.

## 🔍 Causa Raiz

O problema estava no cálculo do **offset de preço** aplicado à linha duplicada:

1. **Offset muito grande**: O offset original era `Math.max(basePrice * 0.01, 50)` (1% do preço ou mínimo 50), o que podia colocar a linha muito longe do viewport visível
2. **Sempre positivo**: O offset sempre adicionava ao preço, então se a linha original estava no topo do gráfico, a duplicada saía completamente do viewport
3. **Não considerava o range visível**: O offset não levava em conta o range de preços visível no gráfico

## ✅ Correções Aplicadas

### 1. Cálculo de Offset Mais Inteligente

**Antes:**
```typescript
offsetPrice = Math.max(basePrice * 0.01, 50); // 1% ou mínimo 50
```

**Depois:**
```typescript
const refPrice = currentPrice || marketPrice || basePrice;
const calculatedOffset = refPrice * 0.002; // 0.2% do preço de referência
offsetPrice = Math.min(calculatedOffset, basePrice * 0.005); // Máximo 0.5% do preço base
offsetPrice = Math.max(offsetPrice, basePrice * 0.001); // Mínimo 0.1% do preço base
```

**Melhorias:**
- Offset reduzido de 1% para 0.2-0.5% do preço
- Usa preço atual do mercado como referência
- Limita o offset máximo para não sair do viewport
- Garante offset mínimo visível

### 2. Validação e Logs Melhorados

Adicionados logs detalhados para debug:
- Log do offset calculado
- Log do preço original vs duplicado
- Validação se o price foi preservado
- Toast de confirmação quando duplicação é bem-sucedida

### 3. Garantia de Visibilidade

Garantido que `visible` seja `true` por padrão:
```typescript
visible: tool.visible !== undefined ? tool.visible : true
```

## 📊 Exemplo de Cálculo

Para uma linha horizontal com preço de **50,000** (ex: BTC):

**Antes:**
- Offset: `Math.max(50000 * 0.01, 50) = 500`
- Preço duplicado: `50000 + 500 = 50500`
- Problema: Pode estar fora do viewport se o range visível for menor

**Depois:**
- Offset calculado: `50000 * 0.002 = 100` (0.2% do preço)
- Offset limitado: `Math.min(100, 50000 * 0.005) = 100` (máximo 0.5%)
- Offset mínimo: `Math.max(100, 50000 * 0.001) = 100` (mínimo 0.1%)
- Preço duplicado: `50000 + 100 = 50100`
- Resultado: Linha fica visível no viewport

## 🧪 Como Testar

1. Criar uma linha horizontal no gráfico
2. Clicar no botão "Duplicar" no painel de propriedades
3. Verificar:
   - ✅ Toast de confirmação aparece
   - ✅ Linha duplicada aparece no gráfico
   - ✅ Linha duplicada está visível (não fora do viewport)
   - ✅ Console mostra logs detalhados do offset

## 📝 Arquivos Modificados

- `src/app/dashboard/trading/page.tsx` (linhas 2363-2458)

## 🔄 Próximos Passos (Opcional)

1. **Offset configurável**: Permitir que o usuário configure o offset desejado
2. **Offset baseado em volatilidade**: Calcular offset baseado na volatilidade do ativo
3. **Alternância de direção**: Alternar entre offset positivo e negativo para garantir visibilidade
4. **Validação de viewport**: Verificar se o preço resultante está dentro do range visível antes de aplicar








