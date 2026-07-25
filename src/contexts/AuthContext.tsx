'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginCredentials, RegisterCredentials, AccountType, OutcomeControl } from '@/types';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/siteUrl';
import { resolveEmailVerified, isVerifiedFlag } from '@/lib/emailVerification';
import { parseUserFromStorage } from '@/lib/parseUserCache';
import { sendVerificationEmail } from '@/lib/sendVerificationEmail';
import { showVerificationEmailSentToast } from '@/lib/emailVerificationToast';
import { isAuthFlowPath, markPendingRecoveryFlow, clearPendingAuthFlow } from '@/lib/authSessionFromUrl';
import { logger } from '@/utils/logger';

export type RegisterResult = 'logged_in' | 'confirmation_sent' | false;

export type LoginResult = false | 'dashboard' | 'profile';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Email confirmado pelo link de verificação (permite trading) */
  emailVerified: boolean;
  /** Primeira leitura de email_verified concluída (evita falso “não verificado”) */
  emailVerificationReady: boolean;
  accountType: AccountType;
  /** Saldo ativo (demo ou real, conforme accountType) */
  activeBalance: number;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  register: (credentials: RegisterCredentials) => Promise<RegisterResult>;
  forgotPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  finalizePasswordResetLogin: () => Promise<boolean>;
  resendConfirmationEmail: (email: string) => Promise<boolean>;
  refreshEmailVerified: () => Promise<void>;
  logout: () => void;
  switchAccount: (type: AccountType) => void;
  updateBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Monta objeto User a partir de row do banco */
function parseOutcomeControl(value: unknown): OutcomeControl {
  if (value === 'ima_win' || value === 'ima_loss') return value;
  return 'off';
}

function rowToUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    email: data.email as string,
    name: data.name as string,
    balance: parseFloat(String(data.balance ?? 0)),
    demoBalance: parseFloat(String(data.demo_balance ?? 10000)),
    isDemo: (data.is_demo as boolean) || false,
    role: (data.role as 'user' | 'admin') || 'user',
    outcomeControl: parseOutcomeControl(data.outcome_control),
    emailVerified: isVerifiedFlag(data.email_verified),
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

/** Busca usuario na tabela users pelo email */
async function fetchUserFromDB(email: string): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
  if (error || !data) return null;
  return rowToUser(data);
}

const ACCOUNT_TYPE_KEY = 'account_type';

/** Toast de sucesso minimalista */
function showSuccessToast(message: string) {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto`}
      style={{ background: 'linear-gradient(135deg, #052e16 0%, #064e3b 100%)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: '200px' }}>
      <p style={{ color: '#d1fae5', fontSize: '13px', fontWeight: 500, margin: 0 }}>{message}</p>
    </div>
  ), { duration: 2000, position: 'top-right' });
}

/** Toast de erro minimalista */
function showErrorToast(message: string) {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto`}
      style={{ background: 'linear-gradient(135deg, #300a0a 0%, #450a0a 100%)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: '200px' }}>
      <p style={{ color: '#fecaca', fontSize: '13px', fontWeight: 500, margin: 0 }}>{message}</p>
    </div>
  ), { duration: 3000, position: 'top-right' });
}

/** Toast neutro minimalista */
function showNeutralToast(message: string) {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto`}
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: '200px' }}>
      <p style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, margin: 0 }}>{message}</p>
    </div>
  ), { duration: 2000, position: 'top-right' });
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationReady, setEmailVerificationReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(ACCOUNT_TYPE_KEY) as AccountType) || 'demo';
    }
    return 'demo';
  });

  // Saldo ativo baseado no tipo de conta selecionado
  const activeBalance = user
    ? accountType === 'demo'
      ? user.demoBalance
      : user.balance
    : 0;

  const applyEmailVerified = useCallback((verified: boolean, email?: string) => {
    setEmailVerified(verified);
    if (email) {
      setUser(prev => {
        if (!prev || prev.email !== email) return prev;
        const next = { ...prev, emailVerified: verified };
        localStorage.setItem('user_data', JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const refreshEmailVerified = useCallback(async (email?: string) => {
    const target = email ?? user?.email;
    if (!target) {
      setEmailVerified(false);
      setEmailVerificationReady(true);
      return;
    }
    const userId = user?.email === target ? user.id : undefined;
    try {
      if (user?.email === target && user.emailVerified === true) {
        setEmailVerified(true);
      }
      const verified = await resolveEmailVerified(target, userId);
      applyEmailVerified(verified, target);
    } catch (error) {
      logger.error('Erro ao verificar email:', error instanceof Error ? error.message : 'Unknown');
      if (user?.email === target && user.emailVerified === true) {
        setEmailVerified(true);
      } else {
        setEmailVerified(false);
      }
    } finally {
      setEmailVerificationReady(true);
    }
  }, [user?.email, user?.id, user?.emailVerified, applyEmailVerified]);

  // --- Restaurar sessao ---
  // 1) Cache local instantâneo (UI)  2) Sessão Supabase obrigatória em background
  useEffect(() => {
    let cachedUser: User | null = null;
    const cached = localStorage.getItem('user_data');
    if (cached) {
      try {
        cachedUser = parseUserFromStorage(JSON.parse(cached));
        if (cachedUser) {
          setUser(cachedUser);
          setEmailVerified(cachedUser.emailVerified === true);
        }
      } catch {
        localStorage.removeItem('user_data');
      }
    }
    setEmailVerificationReady(true);
    setLoading(false);

    const validateInBackground = async () => {
      if (!supabase) return;
      if (isAuthFlowPath()) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user?.email) {
          if (cachedUser) {
            setUser(null);
            setEmailVerified(false);
            localStorage.removeItem('user_data');
          }
          return;
        }

        const dbUser = await fetchUserFromDB(session.user.email);
        if (!dbUser) {
          await supabase.auth.signOut();
          setUser(null);
          setEmailVerified(false);
          localStorage.removeItem('user_data');
          return;
        }

        applyEmailVerified(dbUser.emailVerified === true, dbUser.email);
        setUser(dbUser);
        localStorage.setItem('user_data', JSON.stringify(dbUser));
      } catch {
        // Rede falhou: manter cache só se já havia sessão válida antes (getSession falhou)
      }
    };

    void validateInBackground();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setEmailVerified(false);
            setEmailVerificationReady(false);
            localStorage.removeItem('user_data');
          } else if (event === 'PASSWORD_RECOVERY') {
            // Fluxo de reset — não carregar perfil do app ainda
            return;
          } else if (event === 'SIGNED_IN' && session?.user?.email) {
            if (isAuthFlowPath()) return;
            const dbUser = await fetchUserFromDB(session.user.email);
            if (dbUser) {
              applyEmailVerified(dbUser.emailVerified === true, dbUser.email);
              setUser(dbUser);
              localStorage.setItem('user_data', JSON.stringify(dbUser));
              setEmailVerificationReady(true);
            }
          }
        }
      );
      return () => { subscription.unsubscribe(); };
    }
  }, []);

  // Sincronizar IMA WIN/LOSS definido no admin (sem sobrescrever saldo local)
  useEffect(() => {
    if (!user?.email) return;
    const syncOutcomeControl = async () => {
      const fresh = await fetchUserFromDB(user.email);
      if (!fresh) return;
      setUser(prev => {
        if (!prev || prev.outcomeControl === fresh.outcomeControl) return prev;
        const next = { ...prev, outcomeControl: fresh.outcomeControl };
        localStorage.setItem('user_data', JSON.stringify(next));
        return next;
      });
    };
    const intervalId = setInterval(syncOutcomeControl, 30000);
    return () => clearInterval(intervalId);
  }, [user?.email]);

  // --- Login ---
  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      setLoading(true);

      if (!supabase) {
        showErrorToast('Serviço de autenticação indisponível');
        return false;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          showErrorToast('Email ou senha inválidos');
        } else if (authError.message.includes('Email not confirmed')) {
          showErrorToast(
            'O Supabase ainda exige confirmação antes do login. Desative essa exigência em Authentication → Email ou confirme o email.'
          );
        } else {
          showErrorToast('Erro ao fazer login. Tente novamente.');
        }
        return false;
      }

      if (!authData.user?.email) {
        showErrorToast('Erro ao fazer login');
        return false;
      }

      const dbUser = await fetchUserFromDB(authData.user.email);
      if (!dbUser) {
        showErrorToast('Conta não encontrada. Entre em contato com o suporte.');
        await supabase.auth.signOut();
        return false;
      }

      if (authData.user.id) {
        void supabase
          .from('users')
          .update({ auth_id: authData.user.id })
          .eq('email', authData.user.email);
      }

      const verified = dbUser.emailVerified === true;
      applyEmailVerified(verified, authData.user.email);
      const enrichedUser = { ...dbUser, emailVerified: verified };
      setUser(enrichedUser);
      localStorage.setItem('user_data', JSON.stringify(enrichedUser));
      setEmailVerificationReady(true);
      showSuccessToast('Login realizado com sucesso');
      return verified ? 'dashboard' : 'profile';
    } catch (error) {
      logger.error('Erro no login:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao fazer login');
      return false;
    } finally {
      setLoading(false);
    }
  };

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

  // --- Registro ---
  const register = async (credentials: RegisterCredentials): Promise<RegisterResult> => {
    try {
      setLoading(true);

      if (credentials.password !== credentials.confirmPassword) {
        showErrorToast('As senhas não coincidem');
        return false;
      }
      if (credentials.password.length < 6) {
        showErrorToast('A senha deve ter pelo menos 6 caracteres');
        return false;
      }
      if (!supabase) {
        showErrorToast('Serviço de autenticação indisponível');
        return false;
      }

      const { data: existingUser } = await withTimeout(
        supabase.from('users').select('id').eq('email', credentials.email).maybeSingle(),
        15000,
        'Timeout ao verificar email'
      );
      if (existingUser) {
        showErrorToast('Este email já está cadastrado');
        return false;
      }

      const emailRedirectTo = `${getSiteUrl()}/auth/callback`;

      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signUp({
          email: credentials.email,
          password: credentials.password,
          options: {
            emailRedirectTo,
            data: { name: credentials.name, full_name: credentials.name },
          },
        }),
        25000,
        'Timeout ao criar conta'
      );

      if (authError) {
        if (authError.message.includes('already registered')) {
          showErrorToast('Este email já está cadastrado');
        } else {
          showErrorToast('Erro ao criar conta. Tente novamente.');
        }
        return false;
      }

      if (!authData?.user) {
        showErrorToast('Erro ao criar conta');
        return false;
      }

      let newUser = null;
      let createError: { message?: string } | null = null;

      const insertPayload = {
        email: credentials.email,
        name: credentials.name,
        balance: 0,
        demo_balance: 10000,
        is_demo: false,
        role: 'user',
        auth_id: authData.user.id || null,
        email_verified: false,
      };

      const insertResult = await withTimeout(
        supabase.from('users').insert(insertPayload).select().single(),
        15000,
        'Timeout ao salvar perfil'
      );
      newUser = insertResult.data;
      createError = insertResult.error;

      if (createError?.message?.includes('email_verified')) {
        const { email_verified: _omit, ...withoutFlag } = insertPayload;
        const retry = await withTimeout(
          supabase.from('users').insert(withoutFlag).select().single(),
          15000,
          'Timeout ao salvar perfil'
        );
        newUser = retry.data;
        createError = retry.error;
      }

      if (createError || !newUser) {
        logger.error('Erro ao criar registro do usuário:', createError?.message);
        if (!authData.session) {
          showNeutralToast('Enviamos um email de confirmação. Verifique sua caixa de entrada.');
          return 'confirmation_sent';
        }
        showErrorToast('Erro ao criar conta');
        return false;
      }

      setEmailVerified(false);
      const dbUser = { ...rowToUser(newUser), emailVerified: false };

      if (authData.session) {
        setUser(dbUser);
        setAccountType('demo');
        localStorage.setItem(ACCOUNT_TYPE_KEY, 'demo');
        localStorage.setItem('user_data', JSON.stringify(dbUser));
        showNeutralToast('Conta criada. Confirme seu email para acessar o trading.');
        return 'logged_in';
      }

      showNeutralToast('Enviamos um email de confirmação. Verifique sua caixa de entrada.');
      return 'confirmation_sent';
    } catch (error) {
      logger.error('Erro ao criar conta:', error instanceof Error ? error.message : 'Unknown');
      if (error instanceof Error && error.message.includes('Timeout')) {
        showErrorToast('Operação demorou demais. Verifique sua conexão e tente novamente.');
      } else {
        showErrorToast('Erro ao criar conta');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Esqueceu a senha ---
  const forgotPassword = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);

      if (!email.trim()) {
        showErrorToast('Informe seu email');
        return false;
      }
      if (!supabase) {
        showErrorToast('Serviço de autenticação indisponível');
        return false;
      }

      markPendingRecoveryFlow();

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getSiteUrl()}/auth/reset-password`,
      });

      if (error) {
        logger.error('Erro ao enviar reset de senha:', error.message);
        if (error.message.includes('seconds')) {
          showErrorToast('Aguarde 1 minuto antes de solicitar outro email');
        } else {
          showErrorToast('Não foi possível enviar o email. Tente novamente.');
        }
        return false;
      }

      showNeutralToast('Se o email existir, você receberá instruções para redefinir sua senha.');
      return true;
    } catch (error) {
      logger.error('Erro ao enviar reset de senha:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao enviar email de recuperação');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Redefinir senha (após link de recuperação) ---
  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      setLoading(true);

      if (newPassword.length < 6) {
        showErrorToast('A senha deve ter pelo menos 6 caracteres');
        return false;
      }
      if (!supabase) {
        showErrorToast('Serviço de autenticação indisponível');
        return false;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        logger.error('Erro ao atualizar senha:', error.message);
        showErrorToast('Link expirado ou inválido. Solicite um novo email.');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Erro ao atualizar senha:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao atualizar senha');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Entrar automaticamente após redefinir senha ---
  const finalizePasswordResetLogin = async (): Promise<boolean> => {
    try {
      if (!supabase) return false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        showErrorToast('Sessão expirada. Faça login com sua nova senha.');
        return false;
      }

      const dbUser = await fetchUserFromDB(session.user.email);
      if (!dbUser) {
        showErrorToast('Conta não encontrada. Entre em contato com o suporte.');
        await supabase.auth.signOut();
        return false;
      }

      if (session.user.id) {
        await supabase.from('users').update({ auth_id: session.user.id }).eq('email', session.user.email);
      }

      setUser(dbUser);
      setAccountType('demo');
      localStorage.setItem(ACCOUNT_TYPE_KEY, 'demo');
      localStorage.setItem('user_data', JSON.stringify(dbUser));
      applyEmailVerified(dbUser.emailVerified === true, dbUser.email);
      setEmailVerificationReady(true);
      clearPendingAuthFlow();
      showSuccessToast('Senha atualizada! Bem-vindo de volta.');
      window.location.href = '/dashboard/trading';
      return true;
    } catch (error) {
      logger.error('Erro ao finalizar login após reset:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Senha salva. Faça login manualmente.');
      return false;
    }
  };

  // --- Reenviar confirmação de email ---
  const resendConfirmationEmail = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);

      const result = await sendVerificationEmail(email);
      if (!result.ok) {
        showErrorToast(result.message);
        return false;
      }

      showVerificationEmailSentToast(result.method === 'magic_link');

      if (user?.email === email.trim()) {
        await refreshEmailVerified(email.trim());
      }
      return true;
    } catch (error) {
      logger.error('Erro ao reenviar confirmação:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao reenviar email');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Logout ---
  const logout = async () => {
    if (supabase) { await supabase.auth.signOut(); }
    setUser(null);
    setEmailVerified(false);
    setEmailVerificationReady(false);
    localStorage.removeItem('user_data');
    showNeutralToast('Sessão encerrada');
  };

  // --- Trocar conta demo/real ---
  const switchAccount = (type: AccountType) => {
    setAccountType(type);
    localStorage.setItem(ACCOUNT_TYPE_KEY, type);
  };

  // --- Atualizar saldo (respeita accountType) ---
  const updateBalance = (newBalance: number) => {
    if (!user) return;

    const isDemoAccount = accountType === 'demo';
    const updatedUser: User = isDemoAccount
      ? { ...user, demoBalance: newBalance, updatedAt: new Date() }
      : { ...user, balance: newBalance, updatedAt: new Date() };

    setUser(updatedUser);
    localStorage.setItem('user_data', JSON.stringify(updatedUser));

    // Persistir no banco
    if (supabase && user.id) {
      const dbField = isDemoAccount ? 'demo_balance' : 'balance';
      supabase
        .from('users')
        .update({ [dbField]: newBalance, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) logger.error('Erro ao persistir saldo:', error.message);
        });
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    emailVerified,
    emailVerificationReady,
    accountType,
    activeBalance,
    login,
    register,
    forgotPassword,
    updatePassword,
    finalizePasswordResetLogin,
    resendConfirmationEmail,
    refreshEmailVerified,
    logout,
    switchAccount,
    updateBalance,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
