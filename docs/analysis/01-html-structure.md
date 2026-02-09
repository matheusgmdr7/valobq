# 📄 ANÁLISE HTML - ESTRUTURA PRINCIPAL

## 🎯 **O QUE COLETAR:**

### **1. ESTRUTURA HTML COMPLETA**
```javascript
// No Console do navegador, execute:
console.log(document.documentElement.outerHTML);
```
**📝 Salvar em:** `html-structure.txt`

### **2. ELEMENTOS PRINCIPAIS**
```javascript
// Canvas principal
document.querySelector('#glcanvas');

// Input hidden
document.querySelector('#input');

// Container principal
document.querySelector('#traderoom');

// Todos os elementos com classes específicas
document.querySelectorAll('[class*="svelte"]');
document.querySelectorAll('[class*="topleft"]');
document.querySelectorAll('[class*="active"]');
```

### **3. ESTRUTURA DE LAYERS**
- Canvas WebGL (fundo)
- Overlays de interface
- Painéis de trading
- Barras superior/inferior
- Elementos de regulação

### **4. ATRIBUTOS IMPORTANTES**
- `width` e `height` do canvas
- `style` inline dos elementos
- `class` names específicos
- `id` dos elementos principais

---

## 📋 **CHECKLIST:**
- [ ] HTML completo copiado
- [ ] Canvas identificado
- [ ] Input hidden localizado
- [ ] Estrutura de layers mapeada
- [ ] Classes CSS específicas coletadas
- [ ] Atributos importantes anotados
