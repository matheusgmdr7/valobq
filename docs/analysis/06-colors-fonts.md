# 🎨 ANÁLISE DE CORES E FONTES

## 🎯 **BASEADO NA IMAGEM DE REFERÊNCIA:**

### **1. PALETA DE CORES PRINCIPAIS**
**Cores identificadas na imagem:**
- **Background principal:** #111827 (cinza muito escuro)
- **Background secundário:** #1f2937 (cinza escuro)
- **Background terciário:** #2d3748 (cinza médio)
- **Texto principal:** #ffffff (branco)
- **Texto secundário:** #9ca3af (cinza claro)
- **Texto terciário:** #6b7280 (cinza médio)
- **Azul ativo:** #3b82f6 (azul)
- **Verde positivo:** #10b981 (verde)
- **Vermelho negativo:** #ef4444 (vermelho)

### **2. COMANDOS PARA COLETAR CORES**
```javascript
// Extrair todas as cores usadas
const colors = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor', 'boxShadow'].forEach(prop => {
        if (style[prop] && style[prop] !== 'rgba(0, 0, 0, 0)') {
            colors.add(style[prop]);
        }
    });
});
console.log('Color Palette:', Array.from(colors));
```

### **3. FONTES IDENTIFICADAS**
**Fontes observadas na imagem:**
- **Título principal:** Sans-serif, bold
- **Texto do menu:** Sans-serif, regular
- **Números/preços:** Sans-serif, bold
- **Texto secundário:** Sans-serif, light

### **4. COMANDOS PARA COLETAR FONTES**
```javascript
// Extrair todas as fontes
const fonts = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.fontFamily) {
        fonts.add(style.fontFamily);
    }
});
console.log('Fonts used:', Array.from(fonts));

// Verificar fontes específicas
console.log('Body font:', window.getComputedStyle(document.body).fontFamily);
console.log('H1 font:', window.getComputedStyle(document.querySelector('h1')).fontFamily);
```

### **5. TAMANHOS DE FONTE**
```javascript
// Coletar tamanhos de fonte
const fontSizes = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.fontSize) {
        fontSizes.add(style.fontSize);
    }
});
console.log('Font sizes:', Array.from(fontSizes));
```

### **6. ESPAÇAMENTOS E MARGENS**
```javascript
// Coletar espaçamentos
const spacing = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    ['margin', 'padding', 'gap'].forEach(prop => {
        if (style[prop]) {
            spacing.add(`${prop}: ${style[prop]}`);
        }
    });
});
console.log('Spacing:', Array.from(spacing));
```

---

## 📋 **CHECKLIST:**
- [ ] Paleta de cores extraída
- [ ] Fontes identificadas
- [ ] Tamanhos de fonte coletados
- [ ] Espaçamentos mapeados
- [ ] Cores de estado (hover, active) coletadas
- [ ] Gradientes identificados
- [ ] Sombras e bordas analisadas
