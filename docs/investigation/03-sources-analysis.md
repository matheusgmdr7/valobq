# 🔍 Investigação do Broker de Referência - Aba Sources

## 📋 Checklist de Investigação - Aba Sources

### **1. Estrutura de Arquivos**
- [ ] **Localizar arquivos principais:**
  - `glengineeb433f38.js` - Wrapper Emscripten
  - `glengineeb433f38.wasm` - Módulo WebAssembly
  - `bundle.js` - Aplicação principal
  - `service-worker.js` - Service Worker

### **2. Análise do Wrapper Emscripten**
- [ ] **Estrutura do Module object:**
  - Configurações de inicialização
  - Funções de carregamento
  - Sistema de arquivos virtual
  - Integração WebGL

### **3. Sistema de Carregamento**
- [ ] **Função loadPackage:**
  - Carregamento do .data file
  - Criação de diretórios virtuais
  - Processamento de assets
  - Dependências de execução

### **4. Integração WebAssembly**
- [ ] **Funções expostas (ASM_CONSTS):**
  - WebSocket communication
  - XHR requests
  - Image loading
  - Screenshot functionality
  - WebGL context management

### **5. Sistema de Assets**
- [ ] **Arquivos embarcados no .data:**
  - Fontes (.ttf)
  - Shaders (.fshader, .vshader)
  - Layouts (.vui)
  - Configurações (.json)
  - Scripts (.lua)

## 📊 Dados Coletados

### **Arquivo Principal: `glengineeb433f38.js`**

#### **Estrutura do Module Object:**
```javascript
var Module = typeof GLEngineModule != 'undefined' ? GLEngineModule : {};
```

#### **Sistema de Carregamento de Pacotes:**
```javascript
var loadPackage = function(metadata) {
  var PACKAGE_NAME = 'glengineeb433f38.data';
  var REMOTE_PACKAGE_BASE = 'glengineeb433f38.data';
  // ... XHR request para fetch glengineeb433f38.data
}
```

#### **Sistema de Arquivos Virtual:**
```javascript
Module['FS_createPath']("/", "ani_cashback", true, true);
Module['FS_createPath']("/", "shaders", true, true);
Module['FS_createPath']("/", "styles", true, true);
// ... muitos outros diretórios
```

#### **Funções Expostas para WebAssembly (ASM_CONSTS):**
```javascript
var ASM_CONSTS = {
  5273352: () => { GLEngineModule.Automator.onFrame(); },
  5278852: ($0, $1) => { /* WebSocket implementation */ },
  // ... muitas outras funções
};
```

### **Assets Embarcados no .data (Exemplos):**
```
/FiraCode-Regular.ttf (225,332 bytes)
/NotoMono-Regular.ttf (107,848 bytes)
/shaders/glsl100es/alpha_set.fshader
/shaders/glsl100es/blur.fshader
/layout_templates_common.vui
/effects_runtime.lua
/atlasses.json
/countries_list.json
```

### **Características Técnicas Identificadas:**

#### **1. Emscripten Integration:**
- Wrapper JavaScript gerado automaticamente
- Sistema de dependências de execução
- Gerenciamento de memória WebAssembly
- Interface bidirecional JS ↔ Wasm

#### **2. Sistema de Arquivos Virtual:**
- Criação de diretórios em tempo de execução
- Carregamento de assets do .data file
- Suporte a múltiplos tipos de arquivo
- Organização hierárquica de recursos

#### **3. Funcionalidades WebGL:**
- Shaders GLSL embarcados
- Gerenciamento de contextos WebGL
- Sistema de texturas e materiais
- Pipeline de renderização otimizado

#### **4. Comunicação em Tempo Real:**
- WebSocket implementation
- XHR requests para APIs
- Sistema de notificações
- Clipboard integration

## 🎯 **Instruções para o Usuário**

### **Como Navegar na Aba Sources:**

1. **Abra o DevTools** (F12)
2. **Vá para a aba Sources**
3. **Expanda a estrutura de arquivos** (lado esquerdo)
4. **Localize os arquivos principais:**
   - `glengineeb433f38.js`
   - `glengineeb433f38.wasm`
   - `bundle.js`
   - `service-worker.js`

### **O que Examinar Especificamente:**

#### **1. Estrutura de Arquivos:**
- Organização hierárquica
- Dependências entre arquivos
- Tamanhos dos arquivos

#### **2. Código do Wrapper:**
- Função `loadPackage`
- Sistema `FS_createPath`
- Funções `ASM_CONSTS`
- Configurações do Module

#### **3. Integração WebAssembly:**
- Funções de inicialização
- Interface JS ↔ Wasm
- Gerenciamento de memória
- Event handlers

## 🎯 Próximos Passos
1. [x] **CONCLUÍDO:** Análise inicial do wrapper Emscripten
2. [ ] **PRÓXIMO:** Examinar código completo do glengineeb433f38.js
3. [ ] **PRÓXIMO:** Analisar bundle.js principal
4. [ ] **PRÓXIMO:** Investigar service-worker.js
5. [ ] **PRÓXIMO:** Mapear sistema completo de assets

---
**Data da Investigação:** [Data]
**Investigador:** [Nome]
**Status:** Aguardando análise detalhada da aba Sources

