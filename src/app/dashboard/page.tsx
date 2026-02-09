'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

const DashboardPage: React.FC = () => {
  useEffect(() => {
    // Redirecionar automaticamente para a página de trading
    redirect('/dashboard/trading');
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-400">Redirecionando para o dashboard...</p>
      </div>
    </div>
  );
};

export default DashboardPage;
