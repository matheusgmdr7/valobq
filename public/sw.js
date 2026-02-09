/**
 * Service Worker para cache de assets e dados
 * 
 * Estratégias de cache:
 * - StaleWhileRevalidate: Assets estáticos (JS, CSS) - serve cache mas atualiza em background
 * - NetworkFirst: Dados de API e páginas HTML
 * - CacheFirst: Apenas fonts e imagens (que raramente mudam)
 */

const CACHE_VERSION = 'v2.0.0'; // Forçar refresh de todos os caches
const CACHE_NAME = `valoren-cache-${CACHE_VERSION}`;
const DATA_CACHE = `valoren-data-${CACHE_VERSION}`;

// NÃO pre-cachear páginas HTML - sempre buscar da rede
const PRECACHE_ASSETS = [];

// Cache de dados de mercado (com TTL)
const MARKET_DATA_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Instalação do Service Worker
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(() => self.skipWaiting()) // Ativar imediatamente
  );
});

/**
 * Ativação do Service Worker - limpar TODOS os caches antigos
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Deletar TODOS os caches que não são da versão atual
            if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Controlar todas as páginas imediatamente
  );
});

/**
 * Determina estratégia de cache baseada na URL
 */
function getCacheStrategy(url) {
  const urlString = url.toString();
  const pathname = url.pathname;
  
  // CacheFirst APENAS para fonts e imagens estáticas (raramente mudam)
  if (/\.(woff2?|ttf|eot)$/.test(pathname)) {
    return 'CACHE_FIRST';
  }
  
  // Imagens estáticas locais - CacheFirst
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(pathname) && url.origin === self.location.origin) {
    return 'CACHE_FIRST';
  }
  
  // JS/CSS do Next.js - StaleWhileRevalidate (serve rápido, atualiza em background)
  if (/\/_next\/static\//.test(pathname) || /\.(js|css)$/.test(pathname)) {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  // Dados de mercado com TTL
  if (pathname.includes('/api/candles') || pathname.includes('/api/market')) {
    return 'NETWORK_FIRST_TTL';
  }
  
  // Tudo mais: NetworkFirst (páginas HTML, APIs, etc)
  return 'NETWORK_FIRST';
}

/**
 * CacheFirst: Tenta cache primeiro, depois rede (apenas fonts/imagens)
 */
async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 408 });
  }
}

/**
 * NetworkFirst: Tenta rede primeiro, depois cache
 */
async function networkFirst(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/**
 * NetworkFirst com TTL para dados de mercado
 */
async function networkFirstWithTTL(request, cache, ttl = MARKET_DATA_TTL) {
  const cacheKey = new Request(request.url);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cached-date', Date.now().toString());
      const cachedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      cache.put(cacheKey, cachedResponse);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

/**
 * StaleWhileRevalidate: Retorna cache imediatamente e atualiza em background
 */
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  
  // Atualizar em background (não bloqueia)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {});
  
  // Retornar cache imediatamente se disponível
  if (cached) return cached;
  
  // Se não houver cache, aguardar fetch
  return fetchPromise;
}

/**
 * Intercepta requisições
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições não-GET
  if (request.method !== 'GET') return;
  
  // Ignorar WebSocket e extensões
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (url.protocol === 'chrome-extension:') return;
  
  // Ignorar requisições externas (Supabase, APIs de terceiros, etc)
  if (url.origin !== self.location.origin) return;
  
  // Ignorar APIs de Forex
  if (url.pathname.startsWith('/api/forex/')) return;
  
  event.respondWith(
    (async () => {
      const strategy = getCacheStrategy(url);
      const cache = await caches.open(CACHE_NAME);
      
      switch (strategy) {
        case 'CACHE_FIRST':
          return cacheFirst(request, cache);
        case 'NETWORK_FIRST':
          return networkFirst(request, cache);
        case 'NETWORK_FIRST_TTL':
          const dataCache = await caches.open(DATA_CACHE);
          return networkFirstWithTTL(request, dataCache, MARKET_DATA_TTL);
        case 'STALE_WHILE_REVALIDATE':
          return staleWhileRevalidate(request, cache);
        default:
          return networkFirst(request, cache);
      }
    })()
  );
});

/**
 * Mensagens do cliente
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});
