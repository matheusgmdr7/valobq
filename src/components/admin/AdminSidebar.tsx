'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, DollarSign, CreditCard, Users, BarChart3, Settings,
  Megaphone, Trophy, Newspaper, Calendar, MessageSquare, Activity, Building2
} from 'lucide-react';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  section?: string;
}

const SECTIONS: Record<string, string> = {
  main: 'Principal',
  finance: 'Financeiro',
  trading: 'Trading',
  content: 'Conteúdo',
  system: 'Sistema',
};

export const AdminSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [brokerName, setBrokerName] = useState<string>('BINARY');
  const [favicon, setFavicon] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (supabase) {
          const { data: nameData } = await supabase.from('platform_settings').select('value').eq('key', 'broker_name').single();
          if (nameData?.value) { setBrokerName(nameData.value as string); localStorage.setItem('broker_name', nameData.value as string); }
          else { const s = localStorage.getItem('broker_name'); if (s) setBrokerName(s); }
          const { data: favData } = await supabase.from('platform_settings').select('value').eq('key', 'broker_favicon').single();
          if (favData?.value) { setFavicon(favData.value as string); localStorage.setItem('broker_favicon', favData.value as string); }
          else { const s = localStorage.getItem('broker_favicon'); if (s) setFavicon(s); }
        } else {
          const n = localStorage.getItem('broker_name'); if (n) setBrokerName(n);
          const f = localStorage.getItem('broker_favicon'); if (f) setFavicon(f);
        }
      } catch { 
        const n = localStorage.getItem('broker_name'); if (n) setBrokerName(n);
        const f = localStorage.getItem('broker_favicon'); if (f) setFavicon(f);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const menuItems: MenuItem[] = [
    { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, path: '/admin', section: 'main' },
    { id: 'users', title: 'Usuários', icon: Users, path: '/admin/users', section: 'main' },
    { id: 'finance', title: 'Financeiro', icon: DollarSign, path: '/admin/finance', section: 'finance' },
    { id: 'payment-gateways', title: 'Gateways', icon: CreditCard, path: '/admin/payment-gateways', section: 'finance' },
    { id: 'trading-monitor', title: 'Monitor', icon: Activity, path: '/admin/trading-monitor', section: 'trading' },
    { id: 'trading-config', title: 'Configuração', icon: Settings, path: '/admin/trading-config', section: 'trading' },
    { id: 'chats', title: 'Suporte', icon: MessageSquare, path: '/admin/chats', section: 'content' },
    { id: 'promotions', title: 'Promoções', icon: Megaphone, path: '/admin/promotions', section: 'content' },
    { id: 'leaderboard', title: 'Líderes', icon: Trophy, path: '/admin/leaderboard', section: 'content' },
    { id: 'news', title: 'Notícias', icon: Newspaper, path: '/admin/news', section: 'content' },
    { id: 'calendar', title: 'Calendário', icon: Calendar, path: '/admin/calendar', section: 'content' },
    { id: 'analytics', title: 'Analytics', icon: BarChart3, path: '/admin/analytics', section: 'system' },
    { id: 'broker-data', title: 'Dados Broker', icon: Building2, path: '/admin/broker-data', section: 'system' },
  ];

  const isActive = (path: string) => path === '/admin' ? pathname === '/admin' : pathname?.startsWith(path);

  const groupedItems = Object.keys(SECTIONS).map(section => ({
    section,
    label: SECTIONS[section],
    items: menuItems.filter(i => i.section === section),
  }));

  return (
    <div className="w-60 bg-[#0a0a0b] border-r border-white/[0.06] h-screen fixed left-0 top-0 overflow-y-auto flex flex-col" style={{ scrollbarWidth: 'none' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {favicon ? (
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <img src={favicon} alt="" className="w-full h-full object-contain" onError={() => setFavicon(null)} />
            </div>
          ) : (
            <div className="w-7 h-7 bg-white/[0.06] rounded-lg flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 bg-white/20 rounded-sm" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-white/90 font-semibold text-xs tracking-wide truncate">{brokerName}</div>
            <div className="text-white/25 font-medium text-[9px] tracking-widest uppercase">Painel Admin</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4">
        {groupedItems.map(group => (
          <div key={group.section}>
            <p className="px-3 mb-1.5 text-[9px] font-semibold text-white/20 uppercase tracking-widest">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[12px] ${
                      active
                        ? 'bg-white/[0.08] text-white font-medium'
                        : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-white/80' : 'text-white/25'}`} />
                    <span>{item.title}</span>
                    {active && <div className="ml-auto w-1 h-1 rounded-full bg-white/60" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <p className="text-[9px] text-white/15 text-center">Admin Panel v1.0</p>
      </div>
    </div>
  );
};
