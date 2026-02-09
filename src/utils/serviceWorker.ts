/**
 * Utilitários para gerenciar Service Worker
 */

export interface ServiceWorkerRegistration {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  updateError: Error | null;
}

/**
 * Registra Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    // Verificar atualizações
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nova versão disponível
          }
        });
      }
    });

    return registration;
  } catch {
    return null;
  }
}

/**
 * Desregistra Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.unregister();
  } catch {
    return false;
  }
}

/**
 * Solicita atualização do Service Worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  } catch {
    // Update failed silently
  }
}

/**
 * Cacheia URLs adicionais
 */
export async function cacheUrls(urls: string[]): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'CACHE_URLS',
        urls
      });
    }
  } catch {
    // Cache failed silently
  }
}

/**
 * Limpa cache do Service Worker
 */
export async function clearServiceWorkerCache(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    // Limpar todos os caches manualmente
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );

    // Também enviar mensagem para o Service Worker ativo
    try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: 'CLEAR_CACHE'
      });
      }
    } catch {
      // Ignorar erro se não houver Service Worker ativo
    }
  } catch {
    // Clear cache failed silently
  }
}

/**
 * Verifica se Service Worker está ativo
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  } catch {
    return false;
  }
}
