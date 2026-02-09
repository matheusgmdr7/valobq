# ⚙️ ANÁLISE JAVASCRIPT - FUNCIONALIDADES

## 🎯 **O QUE COLETAR:**

### **1. VARIÁVEIS GLOBAIS**
```javascript
// Listar todas as variáveis globais
Object.keys(window).filter(key => 
    typeof window[key] === 'object' && 
    window[key] !== null &&
    !key.startsWith('_')
);

// Procurar especificamente por:
console.log('Chart data:', window.chartData);
console.log('Trading data:', window.tradingData);
console.log('Price data:', window.priceData);
console.log('User data:', window.userData);
```

### **2. FUNÇÕES DE TRADING**
```javascript
// Procurar por funções relacionadas ao trading
Object.keys(window).filter(key => 
    typeof window[key] === 'function' &&
    (key.includes('trade') || 
     key.includes('buy') || 
     key.includes('sell') ||
     key.includes('chart'))
);
```

### **3. EVENT LISTENERS**
```javascript
// Verificar event listeners no canvas
const canvas = document.querySelector('#glcanvas');
console.log('Canvas event listeners:', getEventListeners(canvas));

// Verificar event listeners nos botões
const buttons = document.querySelectorAll('button');
buttons.forEach((btn, index) => {
    console.log(`Button ${index} listeners:`, getEventListeners(btn));
});
```

### **4. WEBSOCKET CONNECTIONS**
```javascript
// Verificar conexões WebSocket
console.log('WebSocket connections:', window.WebSocket);
console.log('Active connections:', window.performance.getEntriesByType('navigation'));
```

### **5. DADOS EM TEMPO REAL**
```javascript
// Procurar por intervalos e timeouts
console.log('Active intervals:', window.setInterval);
console.log('Active timeouts:', window.setTimeout);

// Verificar se há dados sendo atualizados
let updateCount = 0;
const originalSetInterval = window.setInterval;
window.setInterval = function(...args) {
    updateCount++;
    console.log(`Interval ${updateCount}:`, args);
    return originalSetInterval.apply(this, args);
};
```

### **6. CONFIGURAÇÕES DA APLICAÇÃO**
```javascript
// Procurar por configurações
console.log('App config:', window.config);
console.log('Trading config:', window.tradingConfig);
console.log('Chart config:', window.chartConfig);
```

---

## 📋 **CHECKLIST:**
- [ ] Variáveis globais mapeadas
- [ ] Funções de trading identificadas
- [ ] Event listeners coletados
- [ ] WebSocket connections verificadas
- [ ] Dados em tempo real analisados
- [ ] Configurações da aplicação coletadas
- [ ] Animações e timers identificados
