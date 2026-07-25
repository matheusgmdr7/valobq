'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { establishSessionFromUrl, isRecoveryFromUrl } from '@/lib/authSessionFromUrl';
import { markEmailVerifiedInDb } from '@/lib/emailVerification';
import { logger } from '@/utils/logger';

type CallbackStatus = 'loading' | 'success' | 'error';

const AuthCallbackContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('Processando...');

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        setStatus('error');
        setMessage('Serviço de autenticação indisponível');
        return;
      }

      try {
        const isRecovery = isRecoveryFromUrl();
        setMessage(isRecovery ? 'Validando link de recuperação...' : 'Confirmando seu email...');

        const result = await establishSessionFromUrl();
        if (!result.ok) {
          setStatus('error');
          setMessage(result.error);
          return;
        }

        // Recuperação de senha — NUNCA fazer signOut aqui
        if (isRecovery || isRecoveryFromUrl()) {
          router.replace('/auth/reset-password');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (session.user.email) {
            await markEmailVerifiedInDb(session.user.email);
          }
          await supabase.auth.signOut();
          setStatus('success');
          setMessage('Email confirmado com sucesso! Você já pode entrar.');
          setTimeout(() => router.replace('/login?confirmed=1'), 1500);
          return;
        }

        setStatus('error');
        setMessage('Não foi possível confirmar o email. Tente novamente.');
      } catch (error) {
        logger.error('Erro no callback de auth:', error instanceof Error ? error.message : 'Unknown');
        setStatus('error');
        setMessage('Erro ao processar confirmação');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-gray-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl font-bold">✓</div>
            <p className="mt-4 text-gray-800 font-medium">{message}</p>
            <p className="mt-2 text-sm text-gray-500">Redirecionando para o login...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold">!</div>
            <p className="mt-4 text-gray-800 font-medium">{message}</p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="mt-6 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Voltar ao login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const AuthCallbackPage: React.FC = () => (
  <Suspense
    fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }
  >
    <AuthCallbackContent />
  </Suspense>
);

export default AuthCallbackPage;
