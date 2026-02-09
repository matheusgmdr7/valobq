'use client';

import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Componente de tela de carregamento com spinner discreto
 * Design minimalista e profissional
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Carregando...'
}) => {
  return (
    <>
      <style>{`
        @keyframes spinner {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        @keyframes textFade {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        .spinner {
          animation: spinner 1s linear infinite;
        }
        
        .text-fade {
          animation: textFade 2s ease-in-out infinite;
        }
      `}</style>
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Spinner discreto */}
          <div className="spinner">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full"></div>
          </div>
          
          {/* Texto de carregamento */}
          <p className="text-center text-gray-500 text-xs text-fade font-normal">
            {message}
          </p>
        </div>
      </div>
    </>
  );
};

