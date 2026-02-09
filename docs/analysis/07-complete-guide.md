# 📋 GUIA COMPLETO DE COLETA - PLATAFORMA DE TRADING

## 🎯 **INSTRUÇÕES PASSO A PASSO:**

### **PASSO 1: ABRIR FERRAMENTAS DE DESENVOLVEDOR**
1. Acesse a página de referência
2. Pressione **F12** ou **Ctrl+Shift+I** (Windows) / **Cmd+Option+I** (Mac)
3. Ou clique com botão direito → "Inspecionar elemento"

### **PASSO 2: EXECUTAR COMANDOS NO CONSOLE**
**Execute os comandos abaixo UM POR VEZ no console:**

#### **2.1 ESTRUTURA HTML COMPLETA**
```javascript
console.log(document.documentElement.outerHTML);
```
**📝 Salvar em:** `html-structure.txt`

#### **2.2 ELEMENTOS PRINCIPAIS**
```javascript
// Canvas principal
const canvas = document.querySelector('#glcanvas');
console.log('Canvas:', canvas);
console.log('Canvas dimensions:', canvas?.width, canvas?.height);
console.log('Canvas style:', canvas?.style.cssText);

// Input hidden
const input = document.querySelector('#input');
console.log('Input:', input);

// Container principal
const container = document.querySelector('#traderoom');
console.log('Container:', container);
```

#### **2.3 PALETA DE CORES**
```javascript
const colors = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
        if (style[prop] && style[prop] !== 'rgba(0, 0, 0, 0)') {
            colors.add(style[prop]);
        }
    });
});
console.log('Color Palette:', Array.from(colors));
```

#### **2.4 FONTES UTILIZADAS**
```javascript
const fonts = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.fontFamily) {
        fonts.add(style.fontFamily);
    }
});
console.log('Fonts:', Array.from(fonts));
```

#### **2.5 DADOS DO GRÁFICO**
```javascript
// Procurar por variáveis globais
Object.keys(window).filter(key => 
    key.includes('chart') || 
    key.includes('candle') || 
    key.includes('price') ||
    key.includes('data')
);
```

#### **2.6 ESTRUTURA DE LAYOUT**
```javascript
// Top bar
const topBar = document.querySelector('header') || document.querySelector('[class*="top"]');
console.log('Top bar:', topBar);

// Sidebar
const sidebar = document.querySelector('aside') || document.querySelector('[class*="sidebar"]');
console.log('Sidebar:', sidebar);

// Chart area
const chartArea = document.querySelector('main') || document.querySelector('[class*="chart"]');
console.log('Chart area:', chartArea);

// Trading panel
const tradingPanel = document.querySelector('[class*="trading"]') || document.querySelector('[class*="panel"]');
console.log('Trading panel:', tradingPanel);

// Bottom bar
const bottomBar = document.querySelector('footer') || document.querySelector('[class*="bottom"]');
console.log('Bottom bar:', bottomBar);
```

### **PASSO 3: COPIAR DADOS**
1. **Copie cada resultado** do console
2. **Cole em arquivos separados:**
   - `html-structure.txt`
   - `css-styles.txt`
   - `javascript-data.txt`
   - `layout-elements.txt`

### **PASSO 4: SCREENSHOTS**
1. **Layout completo** da página
2. **Detalhes do gráfico** (zoom)
3. **Painel de trading** (detalhado)
4. **Sidebar** (completa)
5. **Top bar** e **bottom bar**

---

## 📁 **ESTRUTURA DE ARQUIVOS PARA SALVAR:**

```
docs/collected-data/
├── html-structure.txt
├── css-styles.txt
├── javascript-data.txt
├── layout-elements.txt
├── screenshots/
│   ├── full-layout.png
│   ├── chart-detail.png
│   ├── trading-panel.png
│   ├── sidebar.png
│   └── bars.png
└── analysis-notes.md
```

---

## ⚠️ **IMPORTANTE:**
- Execute **UM comando por vez**
- **Copie cada resultado** antes de executar o próximo
- **Salve tudo** em arquivos organizados
- **Tire screenshots** de cada seção
- **Anote observações** importantes

---

## 🎯 **OBJETIVO FINAL:**
Criar uma plataforma de trading binário com **marca própria** que replique **EXATAMENTE** a funcionalidade e design da página de referência.
