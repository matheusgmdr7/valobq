/**
 * API Route para buscar preço de Forex
 * 
 * Faz proxy para Yahoo Finance, evitando problemas de CORS
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }

  try {
    // Converter símbolo para formato Yahoo Finance (ex: GBP/USD -> GBPUSD=X)
    const yfSymbol = symbol.includes('/') 
      ? `${symbol.replace('/', '')}=X`
      : symbol;
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Erros específicos
      if (response.status === 429) {
        throw new Error(`Yahoo Finance API: Rate limit exceeded (429). Too many requests.`);
      } else if (response.status === 403) {
        throw new Error(`Yahoo Finance API: Forbidden (403). Access denied.`);
      } else if (response.status === 404) {
        throw new Error(`Yahoo Finance API: Not found (404). Symbol may be invalid: ${yfSymbol}`);
      } else {
        throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      throw new Error('Invalid response from Yahoo Finance');
    }

    const quote = result.meta;
    const price = quote.regularMarketPrice;
    const previousClose = quote.previousClose;
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return NextResponse.json({
      symbol,
      price,
      timestamp: Date.now(),
      bid: quote.bid,
      ask: quote.ask,
      change,
      changePercent,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume
    });
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    
    const errorDetails = {
      errorMessage: error?.message || 'Failed to fetch price',
      errorType: error?.constructor?.name || typeof error,
      isRateLimit: error?.message?.includes('429') || error?.message?.includes('Rate limit'),
      isForbidden: error?.message?.includes('403') || error?.message?.includes('Forbidden'),
      isNotFound: error?.message?.includes('404') || error?.message?.includes('Not found'),
    };
    
    // Sempre retornar preço simulado como fallback (mesmo em caso de erro)
    // Isso garante que o cliente sempre receba dados válidos
    const simulatedPrice = getSimulatedPrice(symbol);
    
    return NextResponse.json(
      { 
        error: errorDetails.errorMessage,
        errorDetails: {
          type: errorDetails.errorType,
          isRateLimit: errorDetails.isRateLimit,
          isForbidden: errorDetails.isForbidden,
          isNotFound: errorDetails.isNotFound,
        },
        symbol,
        price: simulatedPrice,
        timestamp: Date.now(),
        // Marcar como simulado para o cliente saber
        simulated: true
      },
      { status: 200 } // Retornar 200 mesmo com erro para não quebrar o cliente
    );
  }
}

/**
 * Gera preço simulado (fallback)
 */
function getSimulatedPrice(symbol: string): number {
  const basePrices: Record<string, number> = {
    'GBP/USD': 1.2650,
    'EUR/USD': 1.0850,
    'USD/JPY': 149.50,
    'AUD/CAD': 0.8950,
    'USD/CHF': 0.8750,
    'NZD/USD': 0.6250
  };

  const basePrice = basePrices[symbol] || 1.0;
  const variation = (Math.random() - 0.5) * 0.001;
  return basePrice * (1 + variation);
}

