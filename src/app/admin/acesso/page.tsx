'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const FALLBACK_NAME = 'Valoren';

export default function AdminAccessPage() {
  const router = useRouter();
  const { user, loading, login, logout } = useAuth();
  const [brokerName, setBrokerName] = useState(FALLBACK_NAME);
  const [favicon, setFavicon] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBrand = async () => {
      const cached = localStorage.getItem('platform_settings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.broker_name) setBrokerName(parsed.broker_name);
        } catch { /* ignore */ }
      }
      if (!supabase) return;
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['broker_name', 'broker_favicon']);
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      if (map.broker_name) setBrokerName(map.broker_name);
      setFavicon(map.broker_favicon?.trim() || '');
    };
    loadBrand();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user?.role === 'admin') router.replace('/admin');
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await login({ email: email.trim(), password });
      if (!result) return;

      let role: string | undefined;
      try {
        role = JSON.parse(localStorage.getItem('user_data') || '{}').role;
      } catch { /* ignore */ }

      if (role === 'admin') {
        router.replace('/admin');
        return;
      }

      setError('Esta conta não tem permissão de administrador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0b]">
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-white/[0.06]">
          {favicon && (
            <img src={favicon} alt="" className="w-7 h-7 rounded-md object-contain bg-white/[0.04]" />
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/90 truncate leading-tight">{brokerName}</p>
            <p className="text-[10px] text-white/25 leading-tight">Painel Admin</p>
          </div>
        </div>

        <div className="flex-1 px-3 py-4">
          <p className="px-2 mb-2 text-[9px] uppercase tracking-widest text-white/20">Acesso</p>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.08] text-white/90">
            <Lock size={14} className="shrink-0 text-white/70" />
            <span className="text-[12px]">Entrar no painel</span>
          </div>
          <p className="px-2 mt-4 text-[11px] leading-relaxed text-white/30">
            Somente contas com permissão de administrador entram nesta área.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/20">Admin Panel v1.0</p>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px]">
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            {favicon && (
              <img src={favicon} alt="" className="w-8 h-8 rounded-md object-contain bg-white/[0.04]" />
            )}
            <div>
              <p className="text-[14px] font-medium text-white/90 leading-tight">{brokerName}</p>
              <p className="text-[10px] text-white/25">Painel Admin</p>
            </div>
          </div>

          <p className="text-[9px] uppercase tracking-widest text-white/20 mb-2">Acesso</p>
          <h1 className="text-[18px] font-medium text-white/90">Entrar no painel</h1>
          <p className="mt-1.5 text-[12px] text-white/35 leading-relaxed">
            Use o email e a senha da conta com permissão de administrador.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <label className="block">
              <span className="block mb-1.5 text-[10px] uppercase tracking-widest text-white/25">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@empresa.com"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-[10px] uppercase tracking-widest text-white/25">Senha</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 pr-10 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-[12px] text-rose-400/90 leading-relaxed">{error}</p>
            )}

            {user && user.role !== 'admin' && (
              <button
                type="button"
                onClick={() => logout()}
                className="text-[11px] text-white/35 hover:text-white/60"
              >
                Sair desta conta e entrar com outra
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 bg-white text-black text-[13px] font-medium rounded-lg py-2.5 hover:bg-white/90 disabled:opacity-50"
            >
              {submitting ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
