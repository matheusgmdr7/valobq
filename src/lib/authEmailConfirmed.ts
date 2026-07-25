import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

/** Indica se o Supabase Auth considera o email verificado (link de confirmação). */
export function isAuthEmailConfirmed(
  authUser: Pick<SupabaseAuthUser, 'email_confirmed_at' | 'confirmed_at'> | null | undefined
): boolean {
  if (!authUser) return false;
  return Boolean(authUser.email_confirmed_at ?? authUser.confirmed_at);
}
