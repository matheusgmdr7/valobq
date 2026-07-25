import { supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/siteUrl';
import { isAuthEmailConfirmed } from '@/lib/authEmailConfirmed';

export type SendVerificationEmailResult =
  | { ok: true; method: 'signup_resend' | 'magic_link' }
  | { ok: false; message: string };

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('seconds') || m.includes('after')) {
    return 'Aguarde cerca de 1 minuto antes de solicitar outro email.';
  }
  if (m.includes('signup') && m.includes('disabled')) {
    return 'Cadastro por email desabilitado no servidor de autenticação.';
  }
  if (m.includes('otp') && m.includes('disabled')) {
    return 'Magic Link desabilitado no Supabase. Ative em Authentication → Email.';
  }
  return 'Não foi possível enviar o email de verificação. Tente novamente em instantes.';
}

/**
 * Reenvia verificação de email.
 * - Auth ainda não confirmou → resend signup (Supabase).
 * - Auth já confirmado mas app usa email_verified → magic link (signInWithOtp).
 */
export async function sendVerificationEmail(email: string): Promise<SendVerificationEmailResult> {
  if (!supabase) {
    return { ok: false, message: 'Serviço de autenticação indisponível' };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, message: 'Informe um email válido' };
  }

  const redirectTo = `${getSiteUrl()}/auth/callback`;

  const { data: { user: authUser } } = await supabase.auth.getUser();
  const authAlreadyConfirmed =
    authUser?.email === trimmed && isAuthEmailConfirmed(authUser);

  if (!authAlreadyConfirmed) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    if (!error) {
      return { ok: true, method: 'signup_resend' };
    }

    const fallbackMsg = error.message.toLowerCase();
    const tryMagicLink =
      fallbackMsg.includes('already') ||
      fallbackMsg.includes('confirmed') ||
      fallbackMsg.includes('verified');

    if (!tryMagicLink) {
      return { ok: false, message: friendlyAuthError(error.message) };
    }
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (otpError) {
    return { ok: false, message: friendlyAuthError(otpError.message) };
  }

  return { ok: true, method: 'magic_link' };
}
