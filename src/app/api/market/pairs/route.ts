import { NextResponse } from 'next/server';
import { marketService } from '@/services/marketService';

/**
 * GET /api/market/pairs
 * Retorna lista de pares de moedas disponíveis
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices' | null;

    const pairs = marketService.getPairs(category || undefined);

    return NextResponse.json({
      success: true,
      data: pairs,
      count: pairs.length
    });
  } catch (error) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pairs'
      },
      { status: 500 }
    );
  }
}

