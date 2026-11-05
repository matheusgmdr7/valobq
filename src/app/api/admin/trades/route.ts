import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';

const HISTORY_PAGE_SIZE = 50;

function expirationMs(expiration: number, createdAt: string): number {
  if (expiration > 1_000_000_000_000) return expiration;
  if (expiration > 1_000_000_000) return expiration * 1000;
  return new Date(createdAt).getTime() + expiration * 1000;
}

type TradeRow = {
  id: string;
  user_id: string;
  expiration: number;
  created_at: string;
};

async function attachUsers<T extends { user_id: string }>(service: SupabaseClient, rows: T[]) {
  const ids = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const usersById = new Map<string, { name: string; email: string }>();
  if (ids.length > 0) {
    const { data: users } = await service.from('users').select('id, name, email').in('id', ids);
    for (const user of users || []) {
      usersById.set(user.id, { name: user.name, email: user.email });
    }
  }
  return rows.map((row) => ({ ...row, user: usersById.get(row.user_id) || null }));
}

export async function GET(request: NextRequest) {
  try {
    const service = await requireAdmin(request);
    if (!service) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const scope = request.nextUrl.searchParams.get('scope') || 'active';
    const columns =
      'id, user_id, symbol, type, amount, entry_price, exit_price, expiration, result, profit, created_at';

    if (scope === 'history') {
      const page = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get('page') || '0', 10) || 0);
      const from = page * HISTORY_PAGE_SIZE;
      const to = from + HISTORY_PAGE_SIZE - 1;
      const { data, error } = await service
        .from('trades')
        .select(columns)
        .not('result', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const trades = await attachUsers(service, data || []);
      return NextResponse.json({ trades });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const { data, error } = await service
      .from('trades')
      .select(columns)
      .is('result', null)
      .gt('expiration', nowSec)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nowMs = Date.now();
    const open = ((data || []) as TradeRow[]).filter(
      (trade) => expirationMs(Number(trade.expiration), trade.created_at) > nowMs
    );
    const trades = await attachUsers(service, open);
    return NextResponse.json({ trades });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar operações';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
