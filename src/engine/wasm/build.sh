#!/bin/bash

# Script de build para WebAssembly
# Requer Emscripten SDK instalado e ativado

set -e

echo "🔨 Building WebAssembly module..."

# Verificar se Emscripten está disponível
if ! command -v emcc &> /dev/null; then
    echo "❌ Error: Emscripten not found!"
    echo "Please install and activate Emscripten SDK:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Criar diretório de build
mkdir -p build

# Compilar com Emscripten
echo "📦 Compiling C code to WebAssembly..."

emcc src/indicators.c \
    -I include \
    -o build/indicators.js \
    -s WASM=1 \
    -s SINGLE_FILE=1 \
    -s EXPORTED_FUNCTIONS='["_calculateSMA","_calculateEMA","_calculateWMA","_calculateBollingerBands","_calculateRSI","_calculateMACD","_calculateStochastic","_calculateVWAP","_calculateOBV","_calculateStdDev","_calculateVariance","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8","lengthBytesUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createModule' \
    -s ENVIRONMENT='web' \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=134217728 \
    -s STACK_SIZE=524288 \
    -s MALLOC='emmalloc' \
    -s FILESYSTEM=0 \
    -s ASSERTIONS=0 \
    -s DISABLE_EXCEPTION_THROWING=1 \
    -O3 \
    -flto \
    --closure 1 \
    --no-entry

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📁 Output files:"
    echo "   - build/indicators.js (WASM embedded)"
    echo ""
    echo "📊 File size:"
    ls -lh build/indicators.js | awk '{print "   " $9 ": " $5}'
    echo ""
    echo "ℹ️  Note: WASM is embedded in the JS file (SINGLE_FILE=1)"
else
    echo "❌ Build failed!"
    exit 1
fi

