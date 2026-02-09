#include "../include/indicators.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>

// ============================================================================
// Utility Functions
// ============================================================================

double calculateVariance(const double* values, size_t length, double mean) {
    if (length == 0) return 0.0;
    
    double sum = 0.0;
    for (size_t i = 0; i < length; i++) {
        double diff = values[i] - mean;
        sum += diff * diff;
    }
    
    return sum / length;
}

double calculateStdDev(const double* values, size_t length, double mean) {
    return sqrt(calculateVariance(values, length, mean));
}

// ============================================================================
// Moving Averages
// ============================================================================

int calculateSMA(const double* prices, size_t length, int period, double* result) {
    if (!prices || !result || period <= 0 || period > (int)length) {
        return -1;
    }
    
    // Preencher com NaN os primeiros period-1 elementos
    for (int i = 0; i < period - 1 && i < (int)length; i++) {
        result[i] = NAN;
    }
    
    // Calcular SMA para os elementos restantes
    for (int i = period - 1; i < (int)length; i++) {
        double sum = 0.0;
        for (int j = i - period + 1; j <= i; j++) {
            sum += prices[j];
        }
        result[i] = sum / period;
    }
    
    return 0;
}

int calculateEMA(const double* prices, size_t length, int period, double* result) {
    if (!prices || !result || period <= 0 || period > (int)length) {
        return -1;
    }
    
    // Calcular multiplicador (alpha)
    double alpha = 2.0 / (period + 1.0);
    
    // Preencher com NaN os primeiros period-1 elementos
    for (int i = 0; i < period - 1 && i < (int)length; i++) {
        result[i] = NAN;
    }
    
    // Primeiro valor EMA é a média dos primeiros 'period' valores
    if (period - 1 < (int)length) {
        double sum = 0.0;
        for (int i = 0; i < period; i++) {
            sum += prices[i];
        }
        result[period - 1] = sum / period;
    }
    
    // Calcular EMA para os elementos restantes
    for (int i = period; i < (int)length; i++) {
        result[i] = alpha * prices[i] + (1.0 - alpha) * result[i - 1];
    }
    
    return 0;
}

int calculateWMA(const double* prices, size_t length, int period, double* result) {
    if (!prices || !result || period <= 0 || period > (int)length) {
        return -1;
    }
    
    // Preencher com NaN os primeiros period-1 elementos
    for (int i = 0; i < period - 1 && i < (int)length; i++) {
        result[i] = NAN;
    }
    
    // Calcular WMA para os elementos restantes
    int weightSum = period * (period + 1) / 2; // Soma de 1 a period
    
    for (int i = period - 1; i < (int)length; i++) {
        double weightedSum = 0.0;
        for (int j = 0; j < period; j++) {
            int weight = j + 1; // Peso aumenta com a recência
            weightedSum += prices[i - period + 1 + j] * weight;
        }
        result[i] = weightedSum / weightSum;
    }
    
    return 0;
}

// ============================================================================
// Bollinger Bands
// ============================================================================

int calculateBollingerBands(
    const double* prices,
    size_t length,
    int period,
    double stdDev,
    double* upper,
    double* middle,
    double* lower
) {
    if (!prices || !upper || !middle || !lower ||
        period <= 0 || period > (int)length || stdDev <= 0) {
        return -1;
    }
    
    // Calcular SMA (middle band)
    if (calculateSMA(prices, length, period, middle) != 0) {
        return -1;
    }
    
    // Calcular upper e lower bands
    for (int i = period - 1; i < (int)length; i++) {
        // Calcular desvio padrão dos últimos 'period' valores
        double mean = middle[i];
        double std = calculateStdDev(&prices[i - period + 1], period, mean);
        
        upper[i] = mean + (stdDev * std);
        lower[i] = mean - (stdDev * std);
    }
    
    // Preencher com NaN os primeiros period-1 elementos
    for (int i = 0; i < period - 1 && i < (int)length; i++) {
        upper[i] = NAN;
        lower[i] = NAN;
    }
    
    return 0;
}

// ============================================================================
// RSI
// ============================================================================

int calculateRSI(const double* prices, size_t length, int period, double* result) {
    if (!prices || !result || period <= 0 || period >= (int)length) {
        return -1;
    }
    
    // Preencher com NaN os primeiros period elementos
    for (int i = 0; i < period && i < (int)length; i++) {
        result[i] = NAN;
    }
    
    if (period >= (int)length) {
        return 0;
    }
    
    // Calcular mudanças de preço
    double* gains = (double*)malloc(length * sizeof(double));
    double* losses = (double*)malloc(length * sizeof(double));
    
    if (!gains || !losses) {
        free(gains);
        free(losses);
        return -1;
    }
    
    for (int i = 1; i < (int)length; i++) {
        double change = prices[i] - prices[i - 1];
        gains[i] = change > 0 ? change : 0.0;
        losses[i] = change < 0 ? -change : 0.0;
    }
    
    // Calcular média inicial de gains e losses
    double avgGain = 0.0;
    double avgLoss = 0.0;
    
    for (int i = 1; i <= period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    // Primeiro valor RSI
    if (period < (int)length) {
        if (avgLoss == 0.0) {
            result[period] = 100.0;
        } else {
            double rs = avgGain / avgLoss;
            result[period] = 100.0 - (100.0 / (1.0 + rs));
        }
    }
    
    // Calcular RSI para os elementos restantes usando Wilder's smoothing
    for (int i = period + 1; i < (int)length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        
        if (avgLoss == 0.0) {
            result[i] = 100.0;
        } else {
            double rs = avgGain / avgLoss;
            result[i] = 100.0 - (100.0 / (1.0 + rs));
        }
    }
    
    free(gains);
    free(losses);
    
    return 0;
}

// ============================================================================
// MACD
// ============================================================================

int calculateMACD(
    const double* prices,
    size_t length,
    int fastPeriod,
    int slowPeriod,
    int signalPeriod,
    double* macd,
    double* signal,
    double* histogram
) {
    if (!prices || !macd || !signal || !histogram ||
        fastPeriod <= 0 || slowPeriod <= fastPeriod || signalPeriod <= 0 ||
        slowPeriod > (int)length || signalPeriod > (int)length) {
        return -1;
    }
    
    // Calcular EMAs rápida e lenta
    double* fastEMA = (double*)malloc(length * sizeof(double));
    double* slowEMA = (double*)malloc(length * sizeof(double));
    
    if (!fastEMA || !slowEMA) {
        free(fastEMA);
        free(slowEMA);
        return -1;
    }
    
    if (calculateEMA(prices, length, fastPeriod, fastEMA) != 0 ||
        calculateEMA(prices, length, slowPeriod, slowEMA) != 0) {
        free(fastEMA);
        free(slowEMA);
        return -1;
    }
    
    // Calcular MACD line (fastEMA - slowEMA)
    int startIdx = slowPeriod - 1;
    for (int i = 0; i < startIdx && i < (int)length; i++) {
        macd[i] = NAN;
    }
    
    for (int i = startIdx; i < (int)length; i++) {
        if (isnan(fastEMA[i]) || isnan(slowEMA[i])) {
            macd[i] = NAN;
        } else {
            macd[i] = fastEMA[i] - slowEMA[i];
        }
    }
    
    // Calcular Signal line (EMA do MACD)
    // Primeiro, precisamos encontrar o primeiro valor válido do MACD
    int firstValidMACD = startIdx;
    while (firstValidMACD < (int)length && isnan(macd[firstValidMACD])) {
        firstValidMACD++;
    }
    
    if (firstValidMACD < (int)length) {
        // Calcular EMA do MACD para signal line
        double* macdValues = &macd[firstValidMACD];
        size_t macdLength = length - firstValidMACD;
        double* signalValues = &signal[firstValidMACD];
        
        if (calculateEMA(macdValues, macdLength, signalPeriod, signalValues) != 0) {
            free(fastEMA);
            free(slowEMA);
            return -1;
        }
        
        // Preencher com NaN os elementos antes do primeiro válido
        for (int i = 0; i < firstValidMACD; i++) {
            signal[i] = NAN;
        }
        
        // Preencher com NaN os elementos antes do signal estar pronto
        int signalStart = firstValidMACD + signalPeriod - 1;
        for (int i = firstValidMACD; i < signalStart && i < (int)length; i++) {
            signal[i] = NAN;
        }
    } else {
        // Nenhum valor válido de MACD
        for (int i = 0; i < (int)length; i++) {
            signal[i] = NAN;
        }
    }
    
    // Calcular Histogram (MACD - Signal)
    for (int i = 0; i < (int)length; i++) {
        if (isnan(macd[i]) || isnan(signal[i])) {
            histogram[i] = NAN;
        } else {
            histogram[i] = macd[i] - signal[i];
        }
    }
    
    free(fastEMA);
    free(slowEMA);
    
    return 0;
}

// ============================================================================
// Stochastic
// ============================================================================

int calculateStochastic(
    const double* high,
    const double* low,
    const double* close,
    size_t length,
    int kPeriod,
    int dPeriod,
    double* k,
    double* d
) {
    if (!high || !low || !close || !k || !d ||
        kPeriod <= 0 || dPeriod <= 0 || kPeriod > (int)length || dPeriod > (int)length) {
        return -1;
    }
    
    // Calcular %K
    for (int i = 0; i < kPeriod - 1 && i < (int)length; i++) {
        k[i] = NAN;
    }
    
    for (int i = kPeriod - 1; i < (int)length; i++) {
        // Encontrar máximo e mínimo nos últimos kPeriod períodos
        double highest = high[i - kPeriod + 1];
        double lowest = low[i - kPeriod + 1];
        
        for (int j = i - kPeriod + 2; j <= i; j++) {
            if (high[j] > highest) highest = high[j];
            if (low[j] < lowest) lowest = low[j];
        }
        
        double range = highest - lowest;
        if (range == 0.0) {
            k[i] = 50.0; // Valor neutro quando não há variação
        } else {
            k[i] = 100.0 * ((close[i] - lowest) / range);
        }
    }
    
    // Calcular %D (SMA do %K)
    if (calculateSMA(k, length, dPeriod, d) != 0) {
        return -1;
    }
    
    return 0;
}

// ============================================================================
// Volume Indicators
// ============================================================================

int calculateVWAP(
    const double* high,
    const double* low,
    const double* close,
    const double* volume,
    size_t length,
    double* result
) {
    if (!high || !low || !close || !volume || !result) {
        return -1;
    }
    
    double cumulativePriceVolume = 0.0;
    double cumulativeVolume = 0.0;
    
    for (size_t i = 0; i < length; i++) {
        // Typical Price = (High + Low + Close) / 3
        double typicalPrice = (high[i] + low[i] + close[i]) / 3.0;
        double priceVolume = typicalPrice * volume[i];
        
        cumulativePriceVolume += priceVolume;
        cumulativeVolume += volume[i];
        
        if (cumulativeVolume == 0.0) {
            result[i] = NAN;
        } else {
            result[i] = cumulativePriceVolume / cumulativeVolume;
        }
    }
    
    return 0;
}

int calculateOBV(
    const double* close,
    const double* volume,
    size_t length,
    double* result
) {
    if (!close || !volume || !result || length == 0) {
        return -1;
    }
    
    result[0] = volume[0]; // Primeiro valor é o volume inicial
    
    for (size_t i = 1; i < length; i++) {
        if (close[i] > close[i - 1]) {
            // Preço subiu: adicionar volume
            result[i] = result[i - 1] + volume[i];
        } else if (close[i] < close[i - 1]) {
            // Preço caiu: subtrair volume
            result[i] = result[i - 1] - volume[i];
        } else {
            // Preço igual: manter OBV
            result[i] = result[i - 1];
        }
    }
    
    return 0;
}

