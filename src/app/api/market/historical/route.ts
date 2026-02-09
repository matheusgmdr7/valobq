/**
 * API Route para buscar dados históricos de mercado
 * 
 * Busca dados históricos de:
 * - Binance (crypto) - sempre dados reais
 * - Twelve Data (forex/stocks/indices/commodities) - mercado aberto
 * - OTC Engine (sintético) - mercado fechado
 * 
 * A API key fica no servidor, não exposta no cliente
 */

import { NextRequest, NextResponse } from 'next/server';
import { shouldUseOTC, MarketCategory } from '@/utils/marketHours';
import { OTCEngineManager } from '@/engine/otcEngine';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1m';
    const limit = parseInt(searchParams.get('limit') || '500');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // Determinar qual API usar baseado no símbolo e status do mercado
    const { marketService } = await import('@/services/marketService');
    const pair = marketService.getPair(symbol);
    const isCrypto = pair?.category === 'crypto';
    const category = (pair?.category || 'forex') as MarketCategory;
    const useOTC = !isCrypto && shouldUseOTC(category);

    if (isCrypto) {
      // Buscar dados históricos de Binance para crypto
      return await fetchBinanceHistorical(symbol, timeframe, limit);
    } else if (useOTC) {
      // Mercado fechado: gerar candles OTC sintéticos
      return await generateOTCHistorical(symbol, category, timeframe, limit);
    } else {
      // Mercado aberto: buscar dados reais do Twelve Data
      return await fetchTwelveDataHistorical(symbol, timeframe, limit);
    }
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    
    // CRÍTICO: Se o erro for sobre símbolo não suportado, retornar array vazio em vez de erro 500
    // Isso permite que o gráfico funcione apenas com dados em tempo real
    const errorMessage = error.message || error.toString() || 'Internal server error';
    if (errorMessage.includes('symbol') || errorMessage.includes('invalid') || errorMessage.includes('missing') || errorMessage.includes('figi') || errorMessage.includes('404')) {
      return NextResponse.json({ candles: [] });
    }
    
    // Para outros erros, retornar erro 500
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Busca dados históricos de Binance
 */
async function fetchBinanceHistorical(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<NextResponse> {
  try {
    // Converter símbolo para formato Binance
    let binanceSymbol = symbol.replace('/', '').toUpperCase();
    
    // Mapear todos os pares crypto para formato Binance (sempre usar USDT como quote)
    if (symbol === 'BTC/USD' || symbol.includes('BTC')) {
      binanceSymbol = 'BTCUSDT';
    } else if (symbol === 'ETH/USD' || symbol.includes('ETH')) {
      binanceSymbol = 'ETHUSDT';
    } else if (symbol.includes('/USD')) {
      // Para outros pares crypto com USD, converter para USDT
      // Ex: SOL/USD -> SOLUSDT, XRP/USD -> XRPUSDT, etc.
      const baseCurrency = symbol.split('/')[0].toUpperCase();
      binanceSymbol = `${baseCurrency}USDT`;
    } else {
      // Se já está no formato correto (ex: BTCUSDT), usar diretamente
      binanceSymbol = symbol.replace('/', '').toUpperCase();
    }

    // Mapear timeframe para intervalo Binance
    // Nota: Binance não suporta intervalos menores que 1m, então usamos '1m' como fallback
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '2m': '1m',
      '5m': '5m',
      '10m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '2h': '1h',
      '4h': '4h',
      '8h': '4h',
      '12h': '4h',
      '1d': '1d',
      '1w': '1d',
      '1M': '1d',
    };
    const binanceInterval = intervalMap[timeframe] || '1m';

    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();

    // Formato Binance: [timestamp, open, high, low, close, volume, ...]
    const candles = data.map((kline: any[]) => ({
      time: Math.floor(kline[0] / 1000), // Converter para segundos
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
    }));

    return NextResponse.json({ candles });
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { error: error.message || 'Binance API error' },
      { status: 500 }
    );
  }
}

/**
 * Busca dados históricos de Twelve Data
 */
async function fetchTwelveDataHistorical(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<NextResponse> {
  try {
    const apiKey = process.env.TWELVEDATA_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ candles: [] });
    }

    // Formato de símbolo para Twelve Data:
    // Forex: EUR/USD (com barra - formato nativo)
    // Commodities: XAU/USD (com barra)
    // Ações: AAPL (sem barra)
    // Índices: SPX (sem barra)
    // Usar o símbolo original - Twelve Data aceita o formato com barra
    const twelvedataSymbol = symbol;
    
    // Mapear timeframe para intervalo Twelve Data
    const intervalMap: Record<string, string> = {
      '1m': '1min',
      '2m': '1min',
      '5m': '5min',
      '10m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1h',
      '2h': '1h',
      '4h': '4h',
      '8h': '4h',
      '12h': '4h',
      '1d': '1day',
      '1w': '1week',
      '1M': '1month',
    };
    const twelvedataInterval = intervalMap[timeframe] || '1min';

    // Buscar dados históricos do Twelve Data
    // CRÍTICO: Usar timezone=UTC para garantir que os timestamps sejam consistentes com Date.now()
    let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(twelvedataSymbol)}&interval=${twelvedataInterval}&outputsize=${limit}&timezone=UTC&apikey=${apiKey}&format=json`;
    
    let response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    let data: any;
    
    // Ler resposta para verificar se há erro
    if (response.ok) {
      data = await response.json();
      
      // Se houver erro na resposta (mesmo com status 200), tentar formato alternativo
      if (data.code || data.status === 'error') {
        // Tentar sem barra para forex/commodities
        const altSymbol = symbol.replace('/', '');
        url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(altSymbol)}&interval=${twelvedataInterval}&outputsize=${limit}&timezone=UTC&apikey=${apiKey}&format=json`;
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) {
          data = await response.json();
        }
      }
    }

    // Se a segunda tentativa também falhou, ler a resposta de erro
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      const errorMessage = errorData.message || errorData.error || `Twelve Data API error: ${response.status}`;
      console.error('[API] Error:', errorMessage.includes('symbol') || errorMessage.includes('invalid') ? 'Twelve Data symbol error' : 'Twelve Data API error');
      
      // Se o erro for sobre símbolo inválido, retornar array vazio em vez de erro
      if (errorMessage.includes('symbol') || errorMessage.includes('invalid') || errorMessage.includes('missing') || errorMessage.includes('figi')) {
        return NextResponse.json({ candles: [] });
      }
      
      throw new Error(errorMessage);
    }

    // Se não temos dados ainda (segunda tentativa), ler a resposta
    if (!data) {
      data = await response.json();
    }

    // Verificar se há erro na resposta (mesmo com status 200)
    if (data.code || data.status === 'error') {
      const errorMessage = data.message || 'Twelve Data API error';
      console.error('[API] Error:', errorMessage.includes('symbol') || errorMessage.includes('invalid') ? 'Twelve Data symbol error' : 'Twelve Data API error');
      if (errorMessage.includes('symbol') || errorMessage.includes('invalid') || errorMessage.includes('missing') || errorMessage.includes('figi')) {
        return NextResponse.json({ candles: [] });
      }
      throw new Error(errorMessage);
    }
    
    // Verificar se há dados
    if (!data.values || data.values.length === 0) {
      return NextResponse.json({ candles: [] });
    }

    // Formato Twelve Data: { values: [{ datetime, open, high, low, close, volume }, ...] }
    const values = data.values || [];
    
    const candles = values
      .map((item: any) => {
        // CRÍTICO: Twelve Data retorna datetime como "2026-02-06 16:39:00"
        // Com timezone=UTC na request, os valores estão em UTC
        // Adicionar 'Z' para garantir que new Date() interprete como UTC (não local time)
        const datetimeStr = item.datetime.includes('Z') || item.datetime.includes('+') 
          ? item.datetime 
          : item.datetime.replace(' ', 'T') + 'Z';
        const timestampMs = new Date(datetimeStr).getTime();
        
        if (isNaN(timestampMs)) {
          return null;
        }
        
        return {
          time: Math.floor(timestampMs / 1000), // Converter para segundos
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
        };
      })
      .filter(Boolean)
      .reverse(); // Twelve Data retorna do mais recente para o mais antigo, inverter

    return NextResponse.json({ candles });
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    
    // Se o erro for sobre símbolo inválido, retornar array vazio em vez de erro
    const errorMessage = error.message || 'Twelve Data API error';
    if (errorMessage.includes('symbol') || errorMessage.includes('invalid') || errorMessage.includes('missing') || errorMessage.includes('figi')) {
      return NextResponse.json({ candles: [] });
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Gera candles históricos OTC (sintéticos) quando o mercado está fechado
 */
async function generateOTCHistorical(
  symbol: string,
  category: string,
  timeframe: string,
  limit: number
): Promise<NextResponse> {
  try {
    const intervalMsMap: Record<string, number> = {
      '1m': 60000, '2m': 120000, '5m': 300000, '10m': 600000,
      '15m': 900000, '30m': 1800000, '1h': 3600000, '2h': 7200000,
      '4h': 14400000, '8h': 28800000, '12h': 43200000,
      '1d': 86400000, '1w': 604800000, '1M': 2592000000,
    };
    const intervalMs = intervalMsMap[timeframe] || 60000;
    
    // Buscar último preço real para usar como base do OTC
    let basePrice = 0;
    const apiKey = process.env.TWELVEDATA_API_KEY || '';
    if (apiKey) {
      try {
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=1&timezone=UTC&apikey=${apiKey}&format=json`;
        const response = await fetch(url);
        if (response.ok) {
          const data: any = await response.json();
          if (data.values && data.values.length > 0) {
            basePrice = parseFloat(data.values[0].close);
          }
        }
      } catch (e) {
        // Fallback to defaults below
      }
    }
    
    // Fallback: preços padrão
    if (!basePrice || !isFinite(basePrice)) {
      const defaults: Record<string, number> = {
        'EUR/USD': 1.0850, 'GBP/USD': 1.2700, 'USD/JPY': 149.50,
        'AUD/CAD': 0.8950, 'AUD/USD': 0.6550, 'USD/CAD': 1.3600,
        'EUR/GBP': 0.8550, 'EUR/JPY': 162.50, 'GBP/JPY': 190.00,
        'USD/BRL': 4.9500, 'XAU/USD': 2050.00, 'XAG/USD': 23.50,
        'WTI/USD': 78.50, 'XBR/USD': 82.00, 'NG/USD': 2.85,
        'XPT/USD': 920.00, 'AAPL': 185.00, 'GOOGL': 142.00,
        'MSFT': 415.00, 'AMZN': 178.00, 'TSLA': 195.00,
        'META': 485.00, 'NVDA': 720.00, 'SPX': 5050.00,
        'IXIC': 15900.00, 'DJI': 38900.00, 'FTSE': 7650.00,
        'DAX': 17100.00, 'N225': 36500.00,
      };
      basePrice = defaults[symbol] || 100;
    }
    
    // Gerar candles OTC sintéticos
    const otcMgr = new OTCEngineManager(() => {});
    const otcCandles = otcMgr.generateHistorical(symbol, category, basePrice, limit, intervalMs);
    
    const candles = otcCandles.map(c => ({
      time: Math.floor(c.time / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    
    return NextResponse.json({ candles, isOTC: true });
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ candles: [], isOTC: true });
  }
}