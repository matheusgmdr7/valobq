#ifndef INDICATORS_H
#define INDICATORS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stddef.h>

// ============================================================================
// Moving Averages
// ============================================================================

/**
 * Calcula Simple Moving Average (SMA)
 * @param prices Array de preços
 * @param length Tamanho do array
 * @param period Período da média móvel
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateSMA(const double* prices, size_t length, int period, double* result);

/**
 * Calcula Exponential Moving Average (EMA)
 * @param prices Array de preços
 * @param length Tamanho do array
 * @param period Período da média móvel
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateEMA(const double* prices, size_t length, int period, double* result);

/**
 * Calcula Weighted Moving Average (WMA)
 * @param prices Array de preços
 * @param length Tamanho do array
 * @param period Período da média móvel
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateWMA(const double* prices, size_t length, int period, double* result);

// ============================================================================
// Bollinger Bands
// ============================================================================

/**
 * Estrutura para Bollinger Bands
 */
typedef struct {
    double* upper;  // Banda superior
    double* middle; // Banda média (SMA)
    double* lower;  // Banda inferior
} BollingerBands;

/**
 * Calcula Bollinger Bands
 * @param prices Array de preços
 * @param length Tamanho do array
 * @param period Período da média móvel
 * @param stdDev Multiplicador do desvio padrão (geralmente 2.0)
 * @param upper Array de saída para banda superior
 * @param middle Array de saída para banda média (SMA)
 * @param lower Array de saída para banda inferior
 * @return 0 em sucesso, -1 em erro
 */
int calculateBollingerBands(
    const double* prices,
    size_t length,
    int period,
    double stdDev,
    double* upper,
    double* middle,
    double* lower
);

// ============================================================================
// RSI (Relative Strength Index)
// ============================================================================

/**
 * Calcula RSI (Relative Strength Index)
 * @param prices Array de preços de fechamento
 * @param length Tamanho do array
 * @param period Período do RSI (geralmente 14)
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateRSI(const double* prices, size_t length, int period, double* result);

// ============================================================================
// MACD (Moving Average Convergence Divergence)
// ============================================================================

/**
 * Estrutura para MACD
 */
typedef struct {
    double* macd;      // Linha MACD
    double* signal;    // Linha de sinal (EMA do MACD)
    double* histogram; // Histograma (MACD - Signal)
} MACDResult;

/**
 * Calcula MACD
 * @param prices Array de preços de fechamento
 * @param length Tamanho do array
 * @param fastPeriod Período rápido (geralmente 12)
 * @param slowPeriod Período lento (geralmente 26)
 * @param signalPeriod Período do sinal (geralmente 9)
 * @param macd Array de saída para linha MACD
 * @param signal Array de saída para linha de sinal
 * @param histogram Array de saída para histograma
 * @return 0 em sucesso, -1 em erro
 */
int calculateMACD(
    const double* prices,
    size_t length,
    int fastPeriod,
    int slowPeriod,
    int signalPeriod,
    double* macd,
    double* signal,
    double* histogram
);

// ============================================================================
// Stochastic Oscillator
// ============================================================================

/**
 * Estrutura para Stochastic
 */
typedef struct {
    double* k; // %K line
    double* d; // %D line (SMA do %K)
} StochasticResult;

/**
 * Calcula Stochastic Oscillator
 * @param high Array de preços máximos
 * @param low Array de preços mínimos
 * @param close Array de preços de fechamento
 * @param length Tamanho dos arrays
 * @param kPeriod Período %K (geralmente 14)
 * @param dPeriod Período %D (geralmente 3)
 * @param k Array de saída para %K line
 * @param d Array de saída para %D line
 * @return 0 em sucesso, -1 em erro
 */
int calculateStochastic(
    const double* high,
    const double* low,
    const double* close,
    size_t length,
    int kPeriod,
    int dPeriod,
    double* k,
    double* d
);

// ============================================================================
// Volume Indicators
// ============================================================================

/**
 * Calcula Volume Weighted Average Price (VWAP)
 * @param high Array de preços máximos
 * @param low Array de preços mínimos
 * @param close Array de preços de fechamento
 * @param volume Array de volumes
 * @param length Tamanho dos arrays
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateVWAP(
    const double* high,
    const double* low,
    const double* close,
    const double* volume,
    size_t length,
    double* result
);

/**
 * Calcula On-Balance Volume (OBV)
 * @param close Array de preços de fechamento
 * @param volume Array de volumes
 * @param length Tamanho dos arrays
 * @param result Array de saída (deve ter tamanho length)
 * @return 0 em sucesso, -1 em erro
 */
int calculateOBV(
    const double* close,
    const double* volume,
    size_t length,
    double* result
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calcula desvio padrão
 * @param values Array de valores
 * @param length Tamanho do array
 * @param mean Média dos valores
 * @return Desvio padrão
 */
double calculateStdDev(const double* values, size_t length, double mean);

/**
 * Calcula variância
 * @param values Array de valores
 * @param length Tamanho do array
 * @param mean Média dos valores
 * @return Variância
 */
double calculateVariance(const double* values, size_t length, double mean);

#ifdef __cplusplus
}
#endif

#endif // INDICATORS_H

