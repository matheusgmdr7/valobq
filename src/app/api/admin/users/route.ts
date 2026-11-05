import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

const COLUMNS = 'id, email, name, balance, is_demo, created_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function quoteFilter(value: string) {
  return `"${value.replace(/"/g, '')}"`;
}

function toUser(row: {
  id: string;
  email: string;
  name: string | null;
  balance: number | string | null;
  is_demo: boolean | null;
  created_at: string;
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    balance: Number(row.balance || 0),
    is_demo: Boolean(row.is_demo),
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const service = await requireAdmin(request);
    if (!service) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const term = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
    let query = service.from('users').select(COLUMNS).order('created_at', { ascending: false }).limit(100);

    if (term) {
      if (UUID_RE.test(term)) {
        query = query.eq('id', term);
      } else {
        const pattern = `%${term.replace(/[%_\\]/g, '')}%`;
        query = query.or(`email.ilike.${quoteFilter(pattern)},name.ilike.${quoteFilter(pattern)}`);
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data || []).map(toUser);
    const idFragment = /^[0-9a-f]{8,32}$/i.test(term);
    if (idFragment && !UUID_RE.test(term)) {
      const { data: pool, error: poolError } = await service
        .from('users')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .limit(300);
      if (poolError) {
        return NextResponse.json({ error: poolError.message }, { status: 500 });
      }
      const lower = term.toLowerCase();
      const seen = new Set(users.map((user) => user.id));
      for (const row of pool || []) {
        if (seen.has(row.id) || !row.id.toLowerCase().includes(lower)) continue;
        users.push(toUser(row));
      }
    }

    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar usuários';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
