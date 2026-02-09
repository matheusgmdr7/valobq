# 🔍 Investigação do Broker de Referência - Aba Elements

## 📋 Checklist de Investigação - Aba Elements

### **1. Estrutura HTML da Página (`<head>` e `<body>`)**
- [x] **Tags `<script>` do Google Tag Manager:** Identificadas.
- [x] **Meta Tags essenciais:** `charset`, `X-UA-Compatible`, `expires` identificadas.
- [x] **Título da Página:** `PolariumBroker` identificado.
- [x] **Configurações PWA:** `manifest.json`, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `application-name`, `apple-mobile-web-app-title`, `msapplication-starturl`, `viewport` identificadas.
- [x] **Apple Touch Icons:** Vários tamanhos identificados.
- [x] **Estilos do `body`:** `overflow: hidden`, `position: absolute`, `height: 100%`, `width: 100%`, `font-family: 'platformdefault'`, `background-color: #2e3851` identificados.

### **2. Elemento `<canvas id="glcanvas">`**
- [x] **ID:** `glcanvas`.
- [x] **Classes:** `topleft svelte-dpf2o4 active`.
- [x] **Estilos Inline:** `cursor: default`, `width: 625px`, `height: 594px` (dimensões visíveis).
- [x] **Estilos de Folha de Estilo:** `margin: 0`, `padding: 0`, `position: absolute`, `left: 0`, `top: 0`, `width: 100%`, `height: 100%`, `outline: none`.
- [x] **Atributos de Estilo (User Agent/Calculado):** `aspect-ratio: auto 1250 / 1188` (resolução interna).
- [x] **Estilos de Visibilidade:** `.active.svelte-dpf2o4` com `visibility: visible`.
- [x] **Reset CSS Global:** `* { margin: 0; padding: 0; font: inherit; box-sizing: border-box; }`.
- [x] **User Agent Stylesheet:** `overflow-clip-margin: content-box; overflow: clip;`.
- [ ] **Elementos filhos do canvas:** `Aguardando print expandido`.
- [ ] **Elementos adjacentes ao canvas:** `Aguardando print expandido`.

### **3. Script do Motor Gráfico**
- [x] **URL:** `/traderoom/glengineeb433f38.js?v=1754397635`.
- [x] **Tipo:** JavaScript.
- [ ] **Localização no HTML:** `Aguardando print expandido`.

### **4. Estrutura HTML Completa do Body**
- [x] **Canvas principal:** `<canvas id="glcanvas">` diretamente no body
- [x] **Input field:** `<input type="text" id="input">` ao lado do canvas
- [x] **Iframes ocultos:** 3 iframes para rastreamento/comunicação
- [x] **Scripts de rastreamento:** Google Tag Manager, Facebook Pixel, GCLID
- [x] **Script do motor gráfico:** `/traderoom/glengineeb433f38.js?v=1754397635`

### **5. Outros Elementos Relevantes**
- [x] **Estrutura do contêiner:** Canvas está diretamente no body (sem div wrapper)
- [x] **Elementos irmãos:** Input field e scripts
- [ ] **Elementos de controle (zoom, pan, etc.):** Não identificados na estrutura HTML
- [ ] **Elementos de dados (preços, volumes):** Provavelmente renderizados pelo WebAssembly

## 📊 **Dados Coletados**

### **Informações Gerais da Página:**
```
Título: PolariumBroker
Framework Frontend (provável): Svelte (devido à classe svelte-dpf2o4)
Tipo de Aplicação: Progressive Web App (PWA)
Tema: Escuro (background-color: #2e3851)
```

### **Detalhes do Canvas WebGL Principal:**
```
ID: glcanvas
Classes: topleft svelte-dpf2o4 active
Dimensões internas (renderização): 1250x1188 pixels
Dimensões visíveis (display): 625px x 594px
Device Pixel Ratio: 2.0 (HiDPI/Retina)
Posicionamento: Absolute, preenchendo o contêiner
Cursor: default
```

### **Script do Motor Gráfico:**
```
Nome: glengineeb433f38.js
URL: /traderoom/glengineeb433f38.js?v=1754397635
Função: Motor gráfico principal (provável)
```

### **Estrutura de Estilos CSS:**
```
Reset Global: * { margin: 0; padding: 0; font: inherit; box-sizing: border-box; }
Canvas Principal: position: absolute; left: 0; top: 0; width: 100%; height: 100%
Visibilidade: .active.svelte-dpf2o4 { visibility: visible; }
Body: overflow: hidden; position: absolute; height: 100%; width: 100%
Fonte: 'platformdefault', sans-serif
Background: #2e3851
```

## 🎯 **Descobertas Importantes**

### **1. Configuração HiDPI/Retina:**
- **Resolução interna:** 1250x1188 pixels
- **Resolução visível:** 625x594 pixels  
- **Device Pixel Ratio:** 2.0
- **Técnica:** Canvas renderizado em 2x e escalado para 1x para nitidez

### **2. Framework Svelte:**
- **Classe identificada:** `svelte-dpf2o4`
- **Implicação:** Frontend construído com Svelte
- **Estado:** `.active` controla visibilidade

### **3. Layout de Tela Cheia:**
- **Body:** `position: absolute; height: 100%; width: 100%`
- **Canvas:** `position: absolute; width: 100%; height: 100%`
- **Overflow:** `hidden` para evitar scrollbars

### **4. Otimizações de Performance:**
- **Reset CSS global** para consistência
- **Box-sizing: border-box** para cálculos precisos
- **Outline: none** para remover focos visuais
- **Cursor: default** para interação padrão

## 🎯 **Descobertas Críticas Adicionais**

### **WebAssembly (.wasm) - Descoberta Principal:**
```
Arquivos WebAssembly identificados:
- glengineeb433f38.data (dados binários)
- glengineeb433f38.wasm (módulo WebAssembly)
- glengineeb433f38.js (wrapper JavaScript)
```

**Significado:** O broker usa WebAssembly para renderização de gráficos, não apenas WebGL. Isso explica a fluidez extrema!

### **Carregamento Dinâmico:**
```
Função load(host) identificada:
- Carregamento dinâmico de scripts
- Versionamento com cache-busting (v=1754397635)
- Cross-origin com credenciais
```

### **Service Workers:**
```
Service Worker registration identificado:
- Cache avançado para performance
- Comunicação cross-frame via postMessage
- Possível iframe para isolamento do gráfico
```

## 🎯 **Estrutura HTML Completa Descoberta**

### **Body HTML Structure:**
```html
<body>
  <!-- Google Tag Manager -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NHVFKN5R"...></noscript>
  
  <!-- Facebook Pixel -->
  <script>fbq("init","1509917339990768");fbq("track","PageView");</script>
  <noscript><img src="https://www.facebook.com/tr?id=1509917339990768..."></noscript>
  
  <!-- Iframes ocultos (3x) -->
  <iframe height="0" width="0" style="display: none; visibility: hidden;"></iframe>
  
  <!-- Script GCLID -->
  <script>(function(){...gclid...})();</script>
  
  <!-- CANVAS PRINCIPAL -->
  <canvas class="topleft svelte-dpf2o4 active" id="glcanvas" tabindex="1" 
          width="220" height="1188" 
          style="cursor: default; width: 110px; height: 594px;"></canvas>
  
  <!-- Input field -->
  <input type="text" id="input">
  
  <!-- Script do motor gráfico -->
  <script crossorigin="use-credentials" src="/traderoom/glengineeb433f38.js?v=1754397635"></script>
</body>
```

### **Descobertas Importantes:**
- ✅ **Canvas está diretamente no body** (sem div wrapper)
- ✅ **Input field** para possível interação
- ✅ **3 iframes ocultos** para rastreamento/comunicação
- ✅ **Scripts de rastreamento** completos
- ✅ **Estrutura simples e direta**

## 🎯 Próximos Passos
1. [x] **CONCLUÍDO:** Estrutura HTML completa identificada
2. [x] **CONCLUÍDO:** Contêiner principal identificado (body direto)
3. [ ] **AGUARDANDO:** Aba Network para APIs de dados
4. [ ] **AGUARDANDO:** Aba Sources para análise do WebAssembly
5. [ ] **AGUARDANDO:** Aba Console para performance

---
**Data da Investigação:** [Data]
**Investigador:** [Nome]
**Status:** Em andamento - Aguardando mais detalhes da aba Elements
