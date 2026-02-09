'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
    } else if (user.role !== 'admin') {
      router.replace('/dashboard/trading');
    }
  }, [user, loading, router]);

  // Enquanto carrega auth
  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Nao autenticado ou nao admin — useEffect acima redireciona
  if (!user || user.role !== 'admin') {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      <AdminSidebar />
      <div 
        className="flex-1 ml-64 overflow-y-auto custom-scrollbar h-full" 
        style={{ 
          scrollbarWidth: 'thin', 
          scrollbarColor: 'rgba(75, 85, 99, 0.3) rgba(17, 24, 39, 0.1)' 
        }}
      >
        {children}
      </div>
    </div>
  );
}
