# Guia: Como Acessar o DevTools no Chrome

## Métodos para Abrir o DevTools

### Método 1: Atalho de Teclado (Mais Rápido)
- **Windows/Linux:** `F12` ou `Ctrl + Shift + I` (ou `Ctrl + Shift + J` para abrir direto no Console)
- **Mac:** `Cmd + Option + I` (ou `Cmd + Option + J` para abrir direto no Console)

### Método 2: Menu do Chrome
1. Clique nos **três pontos** (⋮) no canto superior direito
2. Vá em **Mais ferramentas** → **Ferramentas do desenvolvedor**

### Método 3: Clique com Botão Direito
1. Clique com o botão direito em qualquer elemento da página
2. Selecione **Inspecionar** ou **Inspecionar elemento**

## Abas do DevTools

### 1. **Console** (onde você vê os erros)
- Mostra erros, avisos e logs do JavaScript
- É onde você está vendo os erros de CORS

### 2. **Network** (Rede)
- Mostra todas as requisições HTTP/WebSocket
- Útil para ver se as requisições estão sendo interceptadas pelo Service Worker

### 3. **Application** (Aplicação)
- **Service Workers:** Ver e gerenciar Service Workers
- **Cache Storage:** Ver e limpar caches
- **Local Storage:** Dados armazenados localmente

## Como Verificar/Remover Service Worker Antigo

### Passo 1: Abrir DevTools
Use `F12` ou `Cmd + Option + I` (Mac)

### Passo 2: Ir para a Aba "Application"
1. Clique na aba **Application** (ou **Aplicação** em português)
2. No menu lateral esquerdo, expanda **Service Workers**

### Passo 3: Verificar Service Workers Ativos
- Você verá uma lista de Service Workers registrados
- Se houver um Service Worker antigo, você verá:
  - Status: "activated and is running"
  - URL: `http://localhost:3000/sw.js`

### Passo 4: Desregistrar Service Worker Antigo
1. Clique em **Unregister** (Desregistrar) ao lado do Service Worker antigo
2. Isso remove o Service Worker e força o navegador a usar o novo

### Passo 5: Limpar Cache
1. Ainda na aba **Application**
2. No menu lateral, expanda **Cache Storage**
3. Clique com botão direito em cada cache e selecione **Delete** (ou delete todos)
4. Você pode ver caches como:
   - `binpro-cache-v1.0.1` (antigo)
   - `binpro-cache-v1.0.2` (novo)

### Passo 6: Recarregar a Página
- Pressione `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac) para fazer um **hard refresh** (limpa cache e recarrega)

## Verificar Requisições na Aba Network

### Passo 1: Abrir Aba Network
1. No DevTools, clique na aba **Network** (Rede)

### Passo 2: Filtrar Requisições
- Digite `forex` no filtro para ver apenas requisições relacionadas a Forex
- Ou digite `api` para ver todas as requisições de API

### Passo 3: Verificar Requisições
- Você deve ver requisições para `/api/forex/price?symbol=GBP/USD`
- Clique em uma requisição para ver detalhes:
  - **Headers:** Cabeçalhos da requisição
  - **Response:** Resposta da API
  - **Initiator:** O que iniciou a requisição

### Passo 4: Verificar se Service Worker Está Interceptando
- Na coluna **Size**, se você ver `(from ServiceWorker)`, significa que o Service Worker interceptou
- Se você ver um tamanho normal (ex: `1.2 KB`), a requisição passou direto

## Dica: Desabilitar Service Worker Temporariamente

Se você quiser testar sem Service Worker:

1. Abra DevTools (`F12`)
2. Vá para **Application** → **Service Workers**
3. Marque a opção **Bypass for network** (Ignorar para rede)
4. Isso faz o navegador ignorar o Service Worker para requisições de rede

## Resumo dos Atalhos Úteis

| Ação | Windows/Linux | Mac |
|------|---------------|-----|
| Abrir DevTools | `F12` ou `Ctrl + Shift + I` | `Cmd + Option + I` |
| Abrir Console | `Ctrl + Shift + J` | `Cmd + Option + J` |
| Hard Refresh | `Ctrl + Shift + R` | `Cmd + Shift + R` |
| Limpar Console | `Ctrl + L` | `Cmd + K` |

