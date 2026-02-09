# 📊 ANÁLISE DO GRÁFICO - CANDLESTICK CHART

## 🎯 **O QUE COLETAR:**

### **1. ESTRUTURA DO GRÁFICO**
```javascript
// Canvas principal do gráfico
const canvas = document.querySelector('#glcanvas');
console.log('Canvas dimensions:', canvas.width, canvas.height);
console.log('Canvas style:', canvas.style.cssText);
console.log('Canvas classes:', canvas.className);
```

### **2. DADOS DO GRÁFICO**
```javascript
// Procurar por variáveis globais com dados
Object.keys(window).filter(key => 
    key.includes('chart') || 
    key.includes('candle') || 
    key.includes('price') ||
    key.includes('data')
);

// Verificar se há dados em localStorage/sessionStorage
console.log('LocalStorage:', localStorage);
console.log('SessionStorage:', sessionStorage);
```

### **3. ELEMENTOS DO GRÁFICO**
- **Grid lines** (linhas de grade)
- **Candlesticks** (velas)
- **Price levels** (níveis de preço)
- **Time labels** (rótulos de tempo)
- **Price labels** (rótulos de preço)
- **Watermark** (marca d'água)

### **4. INTERAÇÕES DO GRÁFICO**
- **Zoom** e **pan**
- **Hover effects**
- **Click events**
- **Touch gestures** (mobile)

### **5. ANIMAÇÕES**
- **Transitions** entre velas
- **Real-time updates**
- **Loading states**

---

## 📋 **CHECKLIST:**
- [ ] Canvas identificado e analisado
- [ ] Dados do gráfico localizados
- [ ] Estrutura de velas mapeada
- [ ] Grid lines identificadas
- [ ] Labels de tempo/preço coletados
- [ ] Watermark localizada
- [ ] Interações mapeadas
- [ ] Animações identificadas
