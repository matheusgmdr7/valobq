'use client';

import React from 'react';

interface MarketLoadingProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Componente de carregamento com barra lateral simples
 * Design minimalista e profissional
 */
export const MarketLoading: React.FC<MarketLoadingProps> = ({ 
  message = 'Carregando dados do mercado...',
  className = '',
  size = 'md'
}) => {
  const barWidths = {
    sm: '200px',
    md: '300px',
    lg: '400px'
  };

  const barHeight = size === 'sm' ? '2px' : size === 'md' ? '3px' : '4px';

  return (
    <>
      <style>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(60%);
          }
        }
        
        @keyframes textFade {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
        
        .loading-bar-animation {
          animation: loadingBar 1.5s linear infinite;
        }
        
        .text-animation {
          animation: textFade 2s ease-in-out infinite;
        }
      `}</style>
      <div className={`flex flex-col items-center justify-center ${className}`}>
        {/* Barra de carregamento */}
        <div 
          className="relative overflow-hidden rounded-full bg-gray-700/30"
          style={{
            width: barWidths[size],
            height: barHeight,
          }}
        >
          {/* Barra animada - limitada ao espaço da barra de fundo */}
          <div
            className="absolute top-0 h-full loading-bar-animation"
            style={{
              width: '40%',
              background: 'linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.8), rgba(59, 130, 246, 0.3))',
            }}
          />
        </div>
        
        {/* Texto de carregamento */}
        <p className="text-center text-gray-500 text-xs mt-6 text-animation font-normal">
          {message}
        </p>
      </div>
    </>
  );
};

