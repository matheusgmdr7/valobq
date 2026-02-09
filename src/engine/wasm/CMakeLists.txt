cmake_minimum_required(VERSION 3.10)
project(ChartIndicators)

# Configurar para Emscripten
set(CMAKE_SYSTEM_NAME Emscripten)
set(CMAKE_C_COMPILER emcc)
set(CMAKE_CXX_COMPILER em++)

# Flags de compilação
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O3 -s WASM=1")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -s WASM=1")

# Funções exportadas
set(EXPORTED_FUNCTIONS
    "_calculateSMA"
    "_calculateEMA"
    "_calculateWMA"
    "_calculateBollingerBands"
    "_calculateRSI"
    "_calculateMACD"
    "_calculateStochastic"
    "_calculateVWAP"
    "_calculateOBV"
    "_calculateStdDev"
    "_calculateVariance"
    "_malloc"
    "_free"
)

# Métodos runtime exportados
set(EXPORTED_RUNTIME_METHODS
    "ccall"
    "cwrap"
    "UTF8ToString"
    "stringToUTF8"
    "lengthBytesUTF8"
)

# Converter listas para formato de string
string(REPLACE ";" "," EXPORTED_FUNCTIONS_STR "${EXPORTED_FUNCTIONS}")
string(REPLACE ";" "," EXPORTED_RUNTIME_METHODS_STR "${EXPORTED_RUNTIME_METHODS}")

# Flags de link
set(CMAKE_EXE_LINKER_FLAGS
    "${CMAKE_EXE_LINKER_FLAGS} "
    "-s EXPORTED_FUNCTIONS='[${EXPORTED_FUNCTIONS_STR}]' "
    "-s EXPORTED_RUNTIME_METHODS='[${EXPORTED_RUNTIME_METHODS_STR}]' "
    "-s ALLOW_MEMORY_GROWTH=1 "
    "-s MODULARIZE=1 "
    "-s EXPORT_NAME='createModule' "
    "-s USE_ES6_IMPORT_META=0 "
    "-s ENVIRONMENT='web' "
    "-O3"
)

# Incluir diretórios
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Arquivos fonte
set(SOURCES
    src/indicators.c
)

# Criar biblioteca
add_library(indicators STATIC ${SOURCES})

# Criar executável (módulo WebAssembly)
add_executable(indicators.js ${SOURCES})

# Configurar saída
set_target_properties(indicators.js PROPERTIES
    SUFFIX ".js"
    OUTPUT_NAME "indicators"
)

