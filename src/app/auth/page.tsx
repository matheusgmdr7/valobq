'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthPage: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirecionar para /login
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
};

export default AuthPage;
