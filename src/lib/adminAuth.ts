import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(request: NextRequest): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!url || !anonKey || !token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const service = getServiceSupabase();
  const { data: byAuth } = await service
    .from('users')
    .select('id, role')
    .eq('auth_id', data.user.id)
    .maybeSingle();
  const { data: byId } = byAuth
    ? { data: null }
    : await service.from('users').select('id, role').eq('id', data.user.id).maybeSingle();

  const row = byAuth || byId;
  if (!row || row.role !== 'admin') return null;
  return service;
}
