'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { establishSessionFromUrl } from '@/lib/authSessionFromUrl';
import { Eye, EyeOff } from 'lucide-react';

const ResetPasswordContent: React.FC = () => {
  const router = useRouter();
  const { updatePassword, finalizePasswordResetLogin, forgotPassword, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [brokerName, setBrokerName] = useState('VALOREN');
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
        setErrorMessage(null);
        setChecking(false);
      }
    };

    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        markReady();
      }
    });

    const init = async () => {
      const storedName = localStorage.getItem('broker_name');
      const storedLogo = localStorage.getItem('broker_logo_light') || localStorage.getItem('broker_logo');
      if (storedName) setBrokerName(storedName);
      if (storedLogo) setBrokerLogo(storedLogo);

      if (!supabase) {
        if (!cancelled) {
          setReady(false);
          setErrorMessage('Serviço de autenticação indisponível');
          setChecking(false);
        }
        return;
      }

      // Troca ?code= ou #access_token= do link do email
      const result = await establishSessionFromUrl();
      if (cancelled) return;

      if (result.ok) {
        markReady();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        markReady();
      } else {
        setReady(false);
        setErrorMessage(result.error);
        setChecking(false);
      }
    };

    init();

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setChecking((c) => {
          if (c) {
            setReady((r) => {
              if (!r) {
                setErrorMessage((prev) => prev ?? 'Não foi possível validar o link. Solicite um novo email.');
              }
              return r;
            });
            return false;
          }
          return c;
        });
      }
    }, 8000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6 || password !== confirmPassword) return;

    const success = await updatePassword(password);
    if (success) {
      await finalizePasswordResetLogin();
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgotPassword(resendEmail);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-500 text-sm">Validando link de recuperação...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {brokerLogo && (
            <div className="flex justify-center mb-6">
              <img src={brokerLogo} alt={brokerName} className="h-12 object-contain" />
            </div>
          )}
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold">!</div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Link expirado ou inválido</h1>
            <p className="mt-2 text-gray-600 text-sm">
              {errorMessage || 'Solicite um novo email. Abra o link no mesmo navegador em que pediu a recuperação.'}
            </p>
          </div>
          <form onSubmit={handleResend} className="mt-6 space-y-3">
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
              placeholder="Seu email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Enviando...' : 'Enviar novo link'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-4 w-full text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {brokerLogo && (
          <div className="flex justify-center mb-6">
            <img src={brokerLogo} alt={brokerName} className="h-12 object-contain" />
          </div>
        )}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nova senha</h1>
          <p className="text-gray-600 mt-2">Escolha uma nova senha para sua conta {brokerName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Nova senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Confirmar nova senha"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-red-500 text-sm">As senhas não coincidem</p>
          )}

          <button
            type="submit"
            disabled={loading || password.length < 6 || password !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Salvando...' : 'Salvar e entrar na conta'}
          </button>
        </form>
      </div>
    </div>
  );
};

const ResetPasswordPage: React.FC = () => (
  <Suspense
    fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }
  >
    <ResetPasswordContent />
  </Suspense>
);

export default ResetPasswordPage;
