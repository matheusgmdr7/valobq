import { NextResponse } from 'next/server';
import { marketService } from '@/services/marketService';

/**
 * GET /api/market/candles
 * Retorna dados históricos de candles
 * 
 * Query params:
 * - symbol: Símbolo do par (ex: GBP/USD)
 * - timeframe: 1m, 5m, 15m, 1h, 4h, 1d
 * - limit: Número de candles (padrão: 100)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = (searchParams.get('timeframe') || '1m') as '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbol parameter is required'
        },
        { status: 400 }
      );
    }

    const candles = await marketService.getHistoricalCandles(symbol, timeframe, limit);

    return NextResponse.json({
      success: true,
      data: candles,
      symbol,
      timeframe,
      count: candles.length
    });
  } catch (error) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch candles'
      },
      { status: 500 }
    );
  }
}

