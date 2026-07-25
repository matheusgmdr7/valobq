import { supabase } from '@/lib/supabase';

export type AuthSessionResult =
  | { ok: true }
  | { ok: false; error: string };

const AUTH_OP_TIMEOUT_MS = 8_000;

let exchangeInFlight: Promise<AuthSessionResult> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('code verifier') || lower.includes('pkce')) {
    return 'Abra o link no mesmo navegador em que solicitou a recuperação, ou peça um novo email.';
  }
  if (lower.includes('expired') || lower.includes('invalid') || lower.includes('already been used')) {
    return 'Link expirado ou já utilizado. Solicite um novo email de recuperação.';
  }
  if (lower.includes('timeout') || lower.includes('tempo')) {
    return 'Não foi possível validar o link. Tente novamente ou solicite um novo email.';
  }
  return message;
}

async function doEstablishSessionFromUrl(): Promise<AuthSessionResult> {
  if (!supabase || typeof window === 'undefined') {
    return { ok: false, error: 'Serviço de autenticação indisponível' };
  }

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const errorDescription = query.get('error_description') || hash.get('error_description');
  if (errorDescription) {
    return { ok: false, error: decodeURIComponent(errorDescription.replace(/\+/g, ' ')) };
  }

  const code = query.get('code');
  if (code) {
    try {
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        AUTH_OP_TIMEOUT_MS,
        'Timeout ao validar link'
      );
      if (error) return { ok: false, error: mapAuthError(error.message) };
      const clean = new URL(window.location.href);
      clean.searchParams.delete('code');
      window.history.replaceState({}, '', clean.pathname + clean.search);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: mapAuthError(err instanceof Error ? err.message : 'Erro ao validar link'),
      };
    }
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    try {
      const { error } = await withTimeout(
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
        AUTH_OP_TIMEOUT_MS,
        'Timeout ao validar link'
      );
      if (error) return { ok: false, error: mapAuthError(error.message) };
      window.history.replaceState({}, '', window.location.pathname);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: mapAuthError(err instanceof Error ? err.message : 'Erro ao validar link'),
      };
    }
  }

  try {
    const { data: { session } } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_OP_TIMEOUT_MS,
      'Timeout ao verificar sessão'
    );
    if (session) return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: mapAuthError(err instanceof Error ? err.message : 'Erro ao verificar sessão'),
    };
  }

  return { ok: false, error: 'Link inválido ou expirado. Solicite um novo email.' };
}

/** Estabelece sessão a partir de ?code= ou #access_token= (links do Supabase Auth). */
export async function establishSessionFromUrl(): Promise<AuthSessionResult> {
  if (!exchangeInFlight) {
    exchangeInFlight = doEstablishSessionFromUrl().finally(() => {
      exchangeInFlight = null;
    });
  }
  return exchangeInFlight;
}

export const PENDING_AUTH_FLOW_KEY = 'pending_auth_flow';

export function markPendingRecoveryFlow(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PENDING_AUTH_FLOW_KEY, 'recovery');
  }
}

export function clearPendingAuthFlow(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_AUTH_FLOW_KEY);
  }
}

/** Detecta se o link/sessão atual é recuperação de senha (não confirmação de email). */
export function isRecoveryFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    query.get('flow') === 'recovery' ||
    query.get('type') === 'recovery' ||
    hash.get('type') === 'recovery' ||
    sessionStorage.getItem(PENDING_AUTH_FLOW_KEY) === 'recovery'
  );
}

/** Página de auth em andamento — evita AuthProvider competir com troca de código. */
export function isAuthFlowPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return path.startsWith('/auth/');
}
