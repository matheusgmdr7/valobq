import { NextResponse } from 'next/server';
import { marketService } from '@/services/marketService';

/**
 * GET /api/market/price
 * Retorna preço atual de um par
 * 
 * Query params:
 * - symbol: Símbolo do par (ex: GBP/USD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error: 'Symbol parameter is required'
        },
        { status: 400 }
      );
    }

    const pair = marketService.getPair(symbol);
    if (!pair) {
      return NextResponse.json(
        {
          success: false,
          error: `Pair ${symbol} not found`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: pair.symbol,
        price: pair.currentPrice,
        change24h: pair.change24h,
        changePercent24h: pair.changePercent24h,
        high24h: pair.high24h,
        low24h: pair.low24h,
        volume24h: pair.volume24h,
        timestamp: pair.lastUpdate
      }
    });
  } catch (error) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch price'
      },
      { status: 500 }
    );
  }
}

