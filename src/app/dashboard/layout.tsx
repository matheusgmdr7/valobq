'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { LoadingScreen } from '@/components/LoadingScreen';
import { showEmailVerificationRequiredToast } from '@/lib/emailVerificationToast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, emailVerified, emailVerificationReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectingRef = useRef(false);

  const hideSidebar = pathname === '/dashboard/trading' || pathname === '/dashboard/withdrawal' || pathname === '/dashboard/transactions' || pathname === '/dashboard/trading-history';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || !emailVerificationReady) {
      redirectingRef.current = false;
      return;
    }
    if (emailVerified) {
      redirectingRef.current = false;
      return;
    }
    if (!pathname.startsWith('/dashboard')) return;
    if (redirectingRef.current) return;

    redirectingRef.current = true;
    localStorage.setItem('profile_active_section', 'personal-data');
    showEmailVerificationRequiredToast();
    router.replace('/profile');
  }, [user, loading, emailVerified, emailVerificationReady, pathname, router]);

  if (loading) {
    return <LoadingScreen message="Carregando..." />;
  }

  if (!user) {
    return null;
  }

  if (!emailVerified) {
    return <LoadingScreen message="Redirecionando..." />;
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
