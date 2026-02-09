'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  DollarSign,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  Megaphone,
  Trophy,
  Newspaper,
  Calendar,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Activity,
  Building2
} from 'lucide-react';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

export const AdminSidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [brokerName, setBrokerName] = useState<string>('BINARY');
  const [favicon, setFavicon] = useState<string | null>(null);

  // Carregar nome da broker e favicon
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        if (supabase) {
          // Buscar nome da broker
          const { data: nameData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'broker_name')
            .single();
          
          if (nameData?.value) {
            const name = nameData.value as string;
            setBrokerName(name);
            localStorage.setItem('broker_name', name);
          } else {
            const savedName = localStorage.getItem('broker_name');
            if (savedName) {
              setBrokerName(savedName);
            }
          }

          // Buscar favicon
          const { data: faviconData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'broker_favicon')
            .single();
          
          if (faviconData?.value) {
            const faviconUrl = faviconData.value as string;
            setFavicon(faviconUrl);
            localStorage.setItem('broker_favicon', faviconUrl);
          } else {
            const savedFavicon = localStorage.getItem('broker_favicon');
            if (savedFavicon) {
              setFavicon(savedFavicon);
            }
          }
        } else {
          // Fallback para localStorage
          const savedName = localStorage.getItem('broker_name');
          if (savedName) {
            setBrokerName(savedName);
          }
          const savedFavicon = localStorage.getItem('broker_favicon');
          if (savedFavicon) {
            setFavicon(savedFavicon);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados da broker:', error);
        // Fallback para localStorage
        const savedName = localStorage.getItem('broker_name');
        if (savedName) {
          setBrokerName(savedName);
        }
        const savedFavicon = localStorage.getItem('broker_favicon');
        if (savedFavicon) {
          setFavicon(savedFavicon);
        }
      }
    };

    loadBrokerData();

    // Verificar mudanças periodicamente
    const interval = setInterval(() => {
      loadBrokerData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: LayoutDashboard,
      path: '/admin'
    },
    {
      id: 'finance',
      title: 'Gestão Financeira',
      icon: DollarSign,
      path: '/admin/finance'
    },
    {
      id: 'payment-gateways',
      title: 'Gateways',
      icon: CreditCard,
      path: '/admin/payment-gateways'
    },
    {
      id: 'users',
      title: 'Usuários',
      icon: Users,
      path: '/admin/users'
    },
    {
      id: 'trading-monitor',
      title: 'Monitor Trading',
      icon: Activity,
      path: '/admin/trading-monitor'
    },
    {
      id: 'trading-config',
      title: 'Config Trading',
      icon: Settings,
      path: '/admin/trading-config'
    },
    {
      id: 'promotions',
      title: 'Promoções',
      icon: Megaphone,
      path: '/admin/promotions'
    },
    {
      id: 'leaderboard',
      title: 'Líderes',
      icon: Trophy,
      path: '/admin/leaderboard'
    },
    {
      id: 'news',
      title: 'Notícias',
      icon: Newspaper,
      path: '/admin/news'
    },
    {
      id: 'calendar',
      title: 'Calendário',
      icon: Calendar,
      path: '/admin/calendar'
    },
    {
      id: 'chats',
      title: 'Chats',
      icon: MessageSquare,
      path: '/admin/chats'
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      path: '/admin/analytics'
    },
    {
      id: 'broker-data',
      title: 'Dados da Broker',
      icon: Building2,
      path: '/admin/broker-data'
    }
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(path);
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 h-screen fixed left-0 top-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center space-x-2.5">
          {favicon ? (
            <div className="w-7 h-7 rounded flex items-center justify-center overflow-hidden">
              <img 
                src={favicon} 
                alt="Favicon" 
                className="w-full h-full object-contain"
                onError={() => setFavicon(null)}
              />
            </div>
          ) : (
            <div className="w-7 h-7 bg-gray-700 rounded flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-gray-300 rounded-sm"></div>
            </div>
          )}
          <div>
            <div className="text-gray-300 font-semibold text-xs tracking-wide">{brokerName}</div>
            <div className="text-gray-400 font-medium text-[10px] tracking-wider">ADMIN</div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="p-3 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all text-sm ${
                active
                  ? 'bg-gray-800 text-white border-l-2 border-gray-300'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-gray-300' : 'text-gray-500'}`} />
              <span className="font-medium">{item.title}</span>
              {item.badge && (
                <span className="ml-auto px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[10px] rounded font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

