'use client';

/**
 * Componente para registrar Service Worker
 * Deve ser usado no layout principal
 */

import { useEffect } from 'react';
import { registerServiceWorker, updateServiceWorker, clearServiceWorkerCache } from '@/utils/serviceWorker';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Registrar Service Worker apenas no cliente
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const initializeServiceWorker = async () => {
        try {
          // Desregistrar todos os Service Workers antigos
          const registrations = await navigator.serviceWorker.getRegistrations();
          
          await Promise.all(
            registrations.map(async (registration) => {
              await registration.unregister();
            })
          );

          // Limpar todos os caches
          await clearServiceWorkerCache();

          // Aguardar um pouco para garantir que tudo foi limpo
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Registrar novo Service Worker
          const registration = await registerServiceWorker();
          
          if (registration) {
            // Forçar atualização imediatamente
            await updateServiceWorker();
            
            // Verificar se há atualização disponível
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // Novo Service Worker instalado, forçar ativação
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      // Recarregar página após ativação
                      setTimeout(() => {
                        window.location.reload();
                      }, 100);
                    }
                  }
                });
              }
            });
          }
        } catch {
          // Service Worker initialization failed silently
        }
      };

      initializeServiceWorker();
    }
  }, []);

  return null; // Componente não renderiza nada
}
