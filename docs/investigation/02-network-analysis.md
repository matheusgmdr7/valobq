# 🔍 Investigação do Broker de Referência - Aba Network

## 📋 Checklist de Investigação - Aba Network

### **1. WebSockets (WS) - Dados em Tempo Real**
- [ ] **Conexões WebSocket identificadas:**
  - URL: `wss://...`
  - Frequência de atualização: `Xms`
  - Formato dos dados: `JSON/Binary`
  - Headers de autenticação: `Sim/Não`
  - Status: `Conectado/Desconectado`

### **2. APIs REST (XHR) - Dados Históricos**
- [ ] **Endpoints de dados identificados:**
  - `/api/candles` - Dados históricos de candlesticks
  - `/api/price` - Preços em tempo real
  - `/api/symbols` - Lista de símbolos disponíveis
  - `/api/market-data` - Dados de mercado
  - Outros endpoints relevantes

### **3. Scripts JavaScript (JS) - Recursos**
- [ ] **Scripts relacionados a gráficos:**
  - `glengineeb433f38.js` - Motor gráfico principal
  - `glengineeb433f38.wasm` - Módulo WebAssembly
  - `glengineeb433f38.data` - Dados binários
  - Outros scripts de gráficos
  - Bibliotecas externas (Chart.js, D3.js, etc.)

### **4. Recursos Estáticos**
- [ ] **Arquivos de recursos:**
  - Imagens de gráficos
  - Fontes customizadas
  - CSS específico para gráficos
  - Ícones e assets

### **5. Análise de Performance**
- [ ] **Tempo de carregamento:**
  - Scripts principais: `Xms`
  - WebAssembly: `Xms`
  - Dados iniciais: `Xms`
- [ ] **Tamanho dos arquivos:**
  - Scripts: `X KB`
  - WebAssembly: `X KB`
  - Dados: `X KB`

## 📊 Dados Coletados

### **WebSockets Ativos:**
```
URL: NÃO ENCONTRADO - Aguardando filtro WS
Frequência: 
Formato: 
Headers: 
Status: 
```

### **APIs REST:**
```
Endpoint: NÃO ENCONTRADO - Aguardando filtro XHR
Método: 
Headers: 
Resposta: 
Frequência: 
```

### **Scripts Principais (Filtro JS):**
```
Nome: main.tsx-CdIPJLhc.js
Tamanho: 138 kB
Tempo de carregamento: 6 ms
Dependências: main.tsx-loader-DAV5MfjH.js:8

Nome: toLoad.js?v=391a9c50bb75ddcb7890db3564b4732a?v=1754397635
Tamanho: 0.5 kB
Tempo de carregamento: 231 ms
Dependências: traderoom:93

Nome: webfont.js?v=1754397635
Tamanho: 0.5 kB (cache)
Tempo de carregamento: 373 ms
Dependências: toLoad.js

Nome: Scripts de rastreamento Google Analytics/Ads (8x)
Tamanho: 123-163 kB cada
Tempo de carregamento: 353-357 ms cada
Dependências: gtm.js?id=GTM-NHVFKN5R:240
Status: 6 sucessos, 2 falhas (bloqueados por ad-blocker)

Nome: glengineeb433f38.js?v=1754397635
Tamanho: 0.5 kB (wrapper pequeno)
Tempo de carregamento: 683 ms
Dependências: bundle.js?v=1754397635:740
Status: 304 Not Modified (carregado do cache)
Tipo: script
```

### **Recursos WebAssembly (Filtro Wasm):**
```
Arquivo: glengineeb433f38.wasm?v=1754397635
Tamanho: 7,469 kB (7.47 MB)
Tempo de carregamento: 24.92 s
Status: 200 OK
Iniciador: bundle.js?v=1754397635:740
Tipo: wasm
Impacto: 65.5% dos dados transferidos, 88.4% dos recursos
```

### **Arquivo de Dados Binários (Filtro All):**
```
Arquivo: glengineeb433f38.data?v=1754397635
Tamanho: 1,107 kB (1.1 MB)
Tempo de carregamento: 2.15 s
Status: 200 OK
Iniciador: bundle.js?v=1754397635:740
Tipo: octet-stream (dados binários)
```

### **Resumo do Motor Gráfico Completo:**
```
Componente: glengineeb433f38.js (wrapper)
Tamanho: 0.5 kB
Tempo: 683 ms
Status: 304 (cache)

Componente: glengineeb433f38.wasm (motor principal)
Tamanho: 7,469 kB (7.47 MB)
Tempo: 24.92 s
Status: 200 OK

Componente: glengineeb433f38.data (dados binários)
Tamanho: 1,107 kB (1.1 MB)
Tempo: 2.15 s
Status: 200 OK

TOTAL DO MOTOR GRÁFICO: 8,576 kB (8.58 MB)
TEMPO TOTAL: ~27.75 segundos

### **🔍 ANÁLISE DETALHADA DO WEBASSEMBLY**

#### **Arquivo Principal: `glengineeb433f38.wasm`**
- **Tamanho Real:** 80.2 MB (vs 7.47 MB reportado no Network)
- **Versão:** WebAssembly MVP (0x1)
- **Tipo:** Módulo binário WebAssembly
- **Header:** `00 61 73 6d 01 00 00 00` (assinatura WASM válida)

#### **Características Técnicas:**
- **Compilado com Emscripten** - Evidenciado pelo wrapper JS
- **Otimizado para Performance** - Tamanho significativo indica código complexo
- **Integração WebGL** - Motor gráfico de alta performance
- **Sistema de Arquivos Virtual** - Assets embarcados no .data
```

### **Requisições de Monitoramento (Sentry) - ENCONTRADAS:**
```
Nome: envelope/?sentry_key=2fdcda31d554515dfd35e605f5fe4...sentry_client=s
Status: 200 OK (todas bem-sucedidas)
Tipo: fetch
Iniciador: bundle.js?v=1754397635:740
Tamanho: 0.6 kB
Tempo: 214ms - 342ms
Quantidade: 4 requisições idênticas
```

### **Bundle Principal Identificado:**
```
Nome: bundle.js?v=1754397635:740
Função: Script principal da aplicação
Versão: 1754397635 (cache-buster)
Linha: 740 (iniciador das requisições Sentry)
```

## 🎯 **Instruções para o Usuário**

### **Como Capturar a Aba Network:**

1. **Abra o DevTools** (F12)
2. **Vá para a aba Network**
3. **Limpe a rede** (botão 🚫 ou Ctrl+Shift+R)
4. **Recarregue a página** (F5)
5. **Aguarde o gráfico carregar completamente**
6. **Filtre por tipo:**
   - **WS** (WebSocket) - para conexões em tempo real
   - **XHR** (APIs REST) - para dados históricos
   - **JS** (JavaScript) - para scripts
7. **Capture o print** mostrando as requisições ativas

### **O que Procurar Especificamente:**

#### **WebSockets (WS):**
- Conexões `wss://` ativas
- Frequência de mensagens
- Formato dos dados (JSON/binary)
- Headers de autenticação

#### **APIs REST (XHR):**
- Endpoints como `/api/candles`, `/api/price`
- Métodos GET/POST
- Headers de autorização
- Respostas com dados de preços

#### **Scripts (JS):**
- `glengineeb433f38.js` e arquivos relacionados
- Tamanho e tempo de carregamento
- Dependências entre scripts

## 🎯 Próximos Passos
1. [x] **CONCLUÍDO:** Print da aba Network do usuário recebido
2. [x] **CONCLUÍDO:** Identificado bundle.js principal e requisições Sentry
3. [x] **CONCLUÍDO:** Filtro WS (WebSockets) - Nenhuma conexão encontrada
4. [x] **CONCLUÍDO:** Filtro XHR (APIs REST) - Apenas requisições de monitoramento encontradas
5. [x] **CONCLUÍDO:** Filtro JS - Scripts de aplicação e rastreamento identificados, mas glengineeb433f38.js AUSENTE
6. [x] **CONCLUÍDO:** Filtro Wasm (WebAssembly) - glengineeb433f38.wasm encontrado (7.47 MB, 24.92s)
7. [x] **CONCLUÍDO:** Filtro "All" - Motor gráfico completo mapeado (js + wasm + data = 8.58 MB)
8. [x] **CONCLUÍDO:** Investigação da aba Network finalizada
9. [ ] **PRÓXIMO:** Avançar para aba Sources para análise do código

---
**Data da Investigação:** [Data]
**Investigador:** [Nome]
**Status:** Aguardando print da aba Network
