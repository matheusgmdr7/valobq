'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navigation = [
    { name: 'PORTFÓLIO TOTAL', href: '/dashboard', active: true },
    { name: 'HISTÓRICO DE TRADING', href: '/history' },
    { name: 'TABELA DE LÍDERES', href: '/leaders' },
    { name: 'PROMOÇÃO', href: '/promotions', badge: 2, isNew: true }
  ];

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 h-screen overflow-y-auto">
      <div className="p-5 space-y-6">
        {/* Navigation */}
        <nav className="space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                item.active
                  ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center">
                <span className="font-medium">{item.name}</span>
              </div>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
              {item.isNew && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                  NEW
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Market Sentiment */}
        <div className="bg-gray-800 border border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Sentimento do Mercado</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-400">COMPRAR</span>
                <span className="text-white">53%</span>
              </div>
              <div className="w-full bg-gray-700 h-1.5">
                <div className="bg-green-500 h-1.5" style={{ width: '53%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400">VENDER</span>
                <span className="text-white">47%</span>
              </div>
              <div className="w-full bg-gray-700 h-1.5">
                <div className="bg-red-500 h-1.5" style={{ width: '47%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeframes */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Timeframes</h4>
          <div className="grid grid-cols-2 gap-2">
            {['1m', '5m', '15m', '30m', '1h', '4h'].map((timeframe) => (
              <button
                key={timeframe}
                className={`px-3 py-2 text-xs border transition-colors ${
                  timeframe === '1m'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                }`}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </div>

        {/* Price Info */}
        <div className="bg-gray-800 border border-gray-700 p-4">
          <div className="text-sm text-gray-300 space-y-2">
            <div className="flex justify-between">
              <span>Ask</span>
              <span className="text-white">1.222150</span>
            </div>
            <div className="flex justify-between">
              <span>Bid</span>
              <span className="text-white">1.222140</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;