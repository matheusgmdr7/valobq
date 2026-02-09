# 🏗️ ANÁLISE DE LAYOUT - ESTRUTURA DA INTERFACE

## 🎯 **BASEADO NA IMAGEM DE REFERÊNCIA:**

### **1. TOP BAR (Barra Superior)**
**Elementos a coletar:**
- Logo da marca (esquerda)
- Abas de ativos (AUD/CAD, GBP/USD)
- Botão "+" para adicionar ativos
- Saldo do usuário (direita)
- Botão "Depositar"

**Comandos para coletar:**
```javascript
// Top bar elements
const topBar = document.querySelector('[class*="top"]') || document.querySelector('header');
console.log('Top bar:', topBar);
console.log('Top bar children:', topBar?.children);
```

### **2. LEFT SIDEBAR (Barra Lateral Esquerda)**
**Elementos a coletar:**
- Logo da marca
- Menu de navegação (PORTFÓLIO TOTAL, HISTÓRICO, etc.)
- Badges de notificação
- Sentimento do mercado (COMPRAR 52%, VENDER 48%)
- Timeframes (1m, 5m, 15m, etc.)
- Informações de preço (ask/bid)

**Comandos para coletar:**
```javascript
// Sidebar elements
const sidebar = document.querySelector('[class*="sidebar"]') || document.querySelector('aside');
console.log('Sidebar:', sidebar);
console.log('Navigation items:', sidebar?.querySelectorAll('[class*="nav"]'));
console.log('Market sentiment:', sidebar?.querySelector('[class*="sentiment"]'));
```

### **3. MAIN CHART AREA (Área Principal do Gráfico)**
**Elementos a coletar:**
- Header do gráfico (nome do ativo, botões de ação)
- Preço atual
- Horário de compra
- Canvas do gráfico
- Watermark

**Comandos para coletar:**
```javascript
// Chart area
const chartArea = document.querySelector('[class*="chart"]') || document.querySelector('main');
console.log('Chart area:', chartArea);
console.log('Chart header:', chartArea?.querySelector('[class*="header"]'));
console.log('Chart canvas:', chartArea?.querySelector('canvas'));
```

### **4. RIGHT TRADING PANEL (Painel de Trading Direito)**
**Elementos a coletar:**
- Input de valor (R$ 540)
- Input de expiração (02:22)
- Display de lucro (+88%, +R$ 475.20)
- Botões COMPRAR/VENDER

**Comandos para coletar:**
```javascript
// Trading panel
const tradingPanel = document.querySelector('[class*="trading"]') || document.querySelector('[class*="panel"]');
console.log('Trading panel:', tradingPanel);
console.log('Value input:', tradingPanel?.querySelector('[class*="value"]'));
console.log('Trade buttons:', tradingPanel?.querySelectorAll('button'));
```

### **5. BOTTOM BAR (Barra Inferior)**
**Elementos a coletar:**
- Botão "Portfólio total"
- Botão "SUPORTE"
- Email de suporte
- Horário atual
- Botão "Exibir posições"

**Comandos para coletar:**
```javascript
// Bottom bar
const bottomBar = document.querySelector('[class*="bottom"]') || document.querySelector('footer');
console.log('Bottom bar:', bottomBar);
console.log('Support info:', bottomBar?.querySelector('[class*="support"]'));
console.log('Time display:', bottomBar?.querySelector('[class*="time"]'));
```

---

## 📋 **CHECKLIST:**
- [ ] Top bar mapeada
- [ ] Sidebar analisada
- [ ] Chart area identificada
- [ ] Trading panel mapeado
- [ ] Bottom bar coletada
- [ ] Responsividade verificada
- [ ] Z-index layers organizados
