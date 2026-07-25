import { supabase } from '@/lib/supabase';

export function isVerifiedFlag(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1;
}

function isExplicitlyUnverified(value: unknown): boolean {
  return value === false || value === 'f' || value === 'false' || value === 0;
}

/** Resolve se o email foi confirmado pelo link (coluna users.email_verified). */
export async function resolveEmailVerified(email: string, userId?: string): Promise<boolean> {
  if (!supabase || !email) return false;

  const fetchRow = async (by: 'id' | 'email') => {
    let q = supabase.from('users').select('email_verified');
    if (by === 'id' && userId) return q.eq('id', userId).maybeSingle();
    return q.eq('email', email).maybeSingle();
  };

  let { data: row, error } = await fetchRow(userId ? 'id' : 'email');
  if ((error || !row) && userId) {
    ({ data: row, error } = await fetchRow('email'));
  }

  if (!error && row && 'email_verified' in row) {
    if (isVerifiedFlag(row.email_verified)) return true;
    if (isExplicitlyUnverified(row.email_verified)) return false;
  }

  return false;
}

export async function markEmailVerifiedInDb(email: string): Promise<void> {
  if (!supabase || !email) return;
  await supabase.from('users').update({ email_verified: true }).eq('email', email);
}
