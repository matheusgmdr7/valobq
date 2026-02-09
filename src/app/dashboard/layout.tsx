'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Não renderizar Sidebar na página de trading, withdrawal, transactions e trading-history (elas têm seus próprios menus)
  const hideSidebar = pathname === '/dashboard/trading' || pathname === '/dashboard/withdrawal' || pathname === '/dashboard/transactions' || pathname === '/dashboard/trading-history';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen message="Carregando..." />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {!hideSidebar && <Sidebar />}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}