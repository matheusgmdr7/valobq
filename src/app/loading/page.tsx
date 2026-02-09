'use client';

import React from 'react';
import { Download, Apple } from 'lucide-react';
import { MarketLoading } from '@/components/ui/MarketLoading';

const LoadingPage: React.FC = () => {

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Desktop App Promotion */}
      <div className="flex justify-between items-center p-6">
        <div className="text-white">
          <p className="text-sm">
            Desfrute de uma experiência de negociação mais rápida em nosso aplicativo para desktop
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-blue-600 border border-blue-500 px-4 py-2 rounded-lg">
          <Apple className="w-5 h-5 text-white" />
          <div className="text-white text-sm">
            <div>Baixar aplicativo para macOS</div>
            <div className="text-xs text-blue-200">.dmg, 39 Mb</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded"></div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">BINARY</h1>
          <h2 className="text-2xl font-bold text-white">TRADE</h2>
        </div>

        {/* Loading */}
        <div className="text-center">
          <MarketLoading 
            message="Conectando..." 
            size="lg"
            className="mb-4"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-gray-400 text-sm">
          Carregando sua plataforma de trading...
        </p>
      </div>
    </div>
  );
};

export default LoadingPage;
