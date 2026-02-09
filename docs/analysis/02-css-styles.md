# 🎨 ANÁLISE CSS - ESTILOS E CORES

## 🎯 **O QUE COLETAR:**

### **1. CSS COMPUTADO DE ELEMENTOS PRINCIPAIS**
```javascript
// No Console, selecione cada elemento e copie o CSS computado
// Canvas principal
const canvas = document.querySelector('#glcanvas');
console.log(window.getComputedStyle(canvas));

// Body
console.log(window.getComputedStyle(document.body));

// HTML
console.log(window.getComputedStyle(document.documentElement));
```

### **2. CORES PRINCIPAIS**
```javascript
// Extrair paleta de cores
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

### **3. FONTES UTILIZADAS**
```javascript
// Extrair fontes
const fonts = new Set();
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.fontFamily) {
        fonts.add(style.fontFamily);
    }
});
console.log('Fonts:', Array.from(fonts));
```

### **4. DIMENSÕES E POSICIONAMENTO**
- `width`, `height` dos elementos principais
- `position` (absolute, fixed, relative)
- `z-index` dos layers
- `margin`, `padding` específicos
- `transform` e `transition`

### **5. GRADIENTES E BACKGROUNDS**
- Background gradients
- Box shadows
- Border radius
- Opacity values

---

## 📋 **CHECKLIST:**
- [ ] CSS computado do canvas
- [ ] CSS computado do body
- [ ] Paleta de cores extraída
- [ ] Fontes identificadas
- [ ] Dimensões anotadas
- [ ] Gradientes copiados
- [ ] Z-index layers mapeados
