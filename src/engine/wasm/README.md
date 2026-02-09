# WebAssembly Module - Cálculos Avançados

Este módulo contém os cálculos de indicadores técnicos e processamento de dados em C/C++ compilados para WebAssembly para máxima performance.

## Estrutura

```
wasm/
├── src/           # Código fonte C/C++
├── include/       # Headers C/C++
├── build/         # Arquivos compilados
├── CMakeLists.txt # Configuração CMake
└── build.sh       # Script de build
```

## Requisitos

### Emscripten SDK
```bash
# Instalar Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### CMake (opcional, mas recomendado)
```bash
# macOS
brew install cmake

# Linux
sudo apt-get install cmake

# Windows
# Baixar de https://cmake.org/download/
```

## Build

### Build Manual
```bash
# Ativar Emscripten
source /path/to/emsdk/emsdk_env.sh

# Compilar
emcc src/indicators.c -o build/indicators.js \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_calculateSMA","_calculateEMA"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -O3
```

### Build com Script
```bash
chmod +x build.sh
./build.sh
```

## Uso

```javascript
import init, { calculateSMA, calculateEMA } from './build/indicators.js';

// Inicializar módulo
await init();

// Usar funções
const sma = calculateSMA(prices, period);
const ema = calculateEMA(prices, period, alpha);
```

## Performance

Meta: **10x mais rápido** que JavaScript puro para cálculos de indicadores.

