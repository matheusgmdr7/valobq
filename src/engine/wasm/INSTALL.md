# 📦 Guia de Instalação - Emscripten SDK

Este guia explica como instalar e configurar o Emscripten SDK para compilar o módulo WebAssembly.

## 🎯 Requisitos

- **Sistema Operacional:** macOS, Linux ou Windows (WSL)
- **Git:** Para clonar o repositório Emscripten
- **Python 3.6+:** Requerido pelo Emscripten
- **Node.js:** Já instalado no projeto

## 📥 Instalação

### **macOS / Linux**

```bash
# 1. Clonar o repositório Emscripten
cd ~
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# 2. Instalar a versão mais recente
./emsdk install latest

# 3. Ativar a versão instalada
./emsdk activate latest

# 4. Configurar variáveis de ambiente (para esta sessão)
source ./emsdk_env.sh

# 5. Verificar instalação
emcc --version
```

### **Windows (WSL)**

Siga os mesmos passos do macOS/Linux dentro do WSL.

### **Windows (PowerShell)**

```powershell
# 1. Clonar o repositório Emscripten
cd $HOME
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# 2. Instalar a versão mais recente
.\emsdk install latest

# 3. Ativar a versão instalada
.\emsdk activate latest

# 4. Configurar variáveis de ambiente
.\emsdk_env.bat

# 5. Verificar instalação
emcc --version
```

## ⚙️ Configuração Permanente

### **macOS / Linux**

Adicione ao seu `~/.bashrc` ou `~/.zshrc`:

```bash
# Emscripten SDK
export EMSDK="$HOME/emsdk"
export PATH="$EMSDK:$EMSDK/upstream/emscripten:$PATH"
source "$EMSDK/emsdk_env.sh" > /dev/null 2>&1
```

Depois, recarregue o shell:
```bash
source ~/.bashrc  # ou source ~/.zshrc
```

### **Windows**

Adicione ao seu `PATH` do sistema:
- `C:\Users\SeuUsuario\emsdk`
- `C:\Users\SeuUsuario\emsdk\upstream\emscripten`

## 🔨 Compilar o Módulo

Após instalar o Emscripten, você pode compilar o módulo WebAssembly:

```bash
# Navegar para o diretório wasm
cd src/engine/wasm

# Executar script de build
./build.sh
```

Ou manualmente:

```bash
# Ativar Emscripten (se não estiver no PATH)
source ~/emsdk/emsdk_env.sh

# Compilar
emcc src/indicators.c \
    -I include \
    -o build/indicators.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_calculateSMA","_calculateEMA",...]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createModule' \
    -O3
```

## ✅ Verificação

Após a compilação, você deve ter os seguintes arquivos:

```
src/engine/wasm/build/
├── indicators.js    # Módulo JavaScript
└── indicators.wasm  # Módulo WebAssembly
```

## 🐛 Troubleshooting

### **Erro: "emcc: command not found"**

**Solução:** Ative o Emscripten na sessão atual:
```bash
source ~/emsdk/emsdk_env.sh
```

Ou adicione ao seu `.bashrc`/`.zshrc` (veja seção "Configuração Permanente").

### **Erro: "Python not found"**

**Solução:** Instale Python 3.6+:
```bash
# macOS
brew install python3

# Linux
sudo apt-get install python3
```

### **Erro: "WASM file not found"**

**Solução:** Verifique se o build foi executado corretamente:
```bash
cd src/engine/wasm
./build.sh
ls -la build/
```

### **Erro: "Module initialization failed"**

**Solução:** Verifique se os arquivos `.wasm` e `.js` estão no diretório `build/` e se o Next.js está configurado para servir arquivos `.wasm`.

## 📚 Recursos Adicionais

- [Documentação Emscripten](https://emscripten.org/docs/getting_started/index.html)
- [WebAssembly Guide](https://webassembly.org/getting-started/developers-guide/)
- [Emscripten GitHub](https://github.com/emscripten-core/emsdk)

## 🎉 Próximos Passos

Após instalar o Emscripten e compilar o módulo:

1. ✅ Verificar que `build/indicators.js` e `build/indicators.wasm` existem
2. ✅ Testar o módulo no navegador
3. ✅ Integrar com o ChartManager existente
4. ✅ Comparar performance com JavaScript puro

