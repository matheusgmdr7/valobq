'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterCredentials, AccountType } from '@/types';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accountType: AccountType;
  /** Saldo ativo (demo ou real, conforme accountType) */
  activeBalance: number;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
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
function rowToUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    email: data.email as string,
    name: data.name as string,
    balance: parseFloat(String(data.balance ?? 0)),
    demoBalance: parseFloat(String(data.demo_balance ?? 10000)),
    isDemo: (data.is_demo as boolean) || false,
    role: (data.role as 'user' | 'admin') || 'user',
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

  // --- Restaurar sessao ---
  // 1) Cache local instantâneo (0ms)  2) Validação Supabase em background
  useEffect(() => {
    // Mostrar usuario do cache imediatamente
    const cached = localStorage.getItem('user_data');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignorar cache corrompido */ }
    }
    setLoading(false);

    // Validar/atualizar em background
    const validateInBackground = async () => {
      if (!supabase) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.email) {
          const dbUser = await fetchUserFromDB(session.user.email);
          if (dbUser) {
            setUser(dbUser);
            localStorage.setItem('user_data', JSON.stringify(dbUser));
          } else {
            // Sessao orfã — limpar
            await supabase.auth.signOut();
            setUser(null);
            localStorage.removeItem('user_data');
          }
        } else if (cached) {
          // Sem sessao Auth mas tem cache — validar usuario no banco
          try {
            const cachedUser = JSON.parse(cached);
            if (cachedUser.email) {
              const dbUser = await fetchUserFromDB(cachedUser.email);
              if (dbUser) {
                setUser(dbUser);
                localStorage.setItem('user_data', JSON.stringify(dbUser));
              } else {
                setUser(null);
                localStorage.removeItem('user_data');
              }
            }
          } catch { /* ignore */ }
        }
      } catch {
        // Rede falhou — manter cache local
      }
    };

    validateInBackground();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            localStorage.removeItem('user_data');
          } else if (event === 'SIGNED_IN' && session?.user?.email) {
            const dbUser = await fetchUserFromDB(session.user.email);
            if (dbUser) {
              setUser(dbUser);
              localStorage.setItem('user_data', JSON.stringify(dbUser));
            }
          }
        }
      );
      return () => { subscription.unsubscribe(); };
    }
  }, []);

  // --- Login ---
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
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
          showErrorToast('Confirme seu email antes de fazer login');
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

      // Vincular auth_id se necessario
      if (authData.user.id) {
        await supabase.from('users').update({ auth_id: authData.user.id }).eq('email', authData.user.email);
      }

      setUser(dbUser);
      localStorage.setItem('user_data', JSON.stringify(dbUser));
      showSuccessToast('Login realizado com sucesso');
      window.location.href = '/dashboard/trading';
      return true;
    } catch (error) {
      console.error('Erro no login:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao fazer login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Registro ---
  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
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

      const { data: existingUser } = await supabase.from('users').select('id').eq('email', credentials.email).single();
      if (existingUser) {
        showErrorToast('Este email já está cadastrado');
        return false;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          showErrorToast('Este email já está cadastrado');
        } else {
          showErrorToast('Erro ao criar conta. Tente novamente.');
        }
        return false;
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: credentials.email,
          name: credentials.name,
          balance: 0,
          demo_balance: 10000,
          is_demo: false,
          role: 'user',
          auth_id: authData.user?.id || null,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Erro ao criar registro do usuário:', createError?.message);
        showErrorToast('Erro ao criar conta');
        return false;
      }

      const dbUser = rowToUser(newUser);
      setUser(dbUser);
      setAccountType('demo');
      localStorage.setItem(ACCOUNT_TYPE_KEY, 'demo');
      localStorage.setItem('user_data', JSON.stringify(dbUser));
      showSuccessToast('Conta criada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao criar conta:', error instanceof Error ? error.message : 'Unknown');
      showErrorToast('Erro ao criar conta');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // --- Logout ---
  const logout = async () => {
    if (supabase) { await supabase.auth.signOut(); }
    setUser(null);
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
          if (error) console.error('Erro ao persistir saldo:', error.message);
        });
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    accountType,
    activeBalance,
    login,
    register,
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
