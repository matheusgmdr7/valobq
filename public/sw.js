/**
 * Service Worker para cache de assets e dados
 * 
 * Estratégias de cache:
 * - CacheFirst: Assets estáticos (JS, CSS, imagens, WASM)
 * - NetworkFirst: Dados de API (com fallback para cache)
 * - StaleWhileRevalidate: Recursos que podem ser atualizados em background
 */

const CACHE_VERSION = 'v1.0.3'; // Atualizado para forçar refresh e corrigir CORS definitivamente
const CACHE_NAME = `valoren-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'valoren-runtime';
const DATA_CACHE = 'valoren-data-cache';

// Assets para cachear na instalação
const PRECACHE_ASSETS = [
  '/',
  '/dashboard/trading',
  // WebAssembly e assets críticos serão adicionados dinamicamente
];

// Cache de dados de mercado (com TTL)
const MARKET_DATA_TTL = 5 * 60 * 1000; // 5 minutos

// Estratégias de cache
const CACHE_STRATEGIES = {
  // CacheFirst: Assets estáticos
  CACHE_FIRST: [
    /\.js$/,
    /\.css$/,
    /\.wasm$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.webp$/,
    /\/_next\/static\//,
    /\/engine\/wasm\/build\//,
    /indicators\.js$/,
    /indicators\.wasm$/,
  ],
  
  // NetworkFirst: Dados de API
  NETWORK_FIRST: [
    /\/api\//,
    /\/api\/candles/,
    /\/api\/market/,
  ],
  
  // StaleWhileRevalidate: Recursos que podem ser atualizados
  STALE_WHILE_REVALIDATE: [
    /\/_next\/data\//,
  ],
};

/**
 * Instalação do Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service Worker installed');
        return self.skipWaiting(); // Ativar imediatamente
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Ativação do Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remover caches antigos (manter DATA_CACHE e RUNTIME_CACHE)
            if (cacheName !== CACHE_NAME && 
                cacheName !== RUNTIME_CACHE && 
                cacheName !== DATA_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim(); // Controlar todas as páginas imediatamente
      })
  );
});

/**
 * Determina estratégia de cache baseada na URL
 */
function getCacheStrategy(url) {
  const urlString = url.toString();
  
  // CacheFirst para assets estáticos
  if (CACHE_STRATEGIES.CACHE_FIRST.some(pattern => pattern.test(urlString))) {
    return 'CACHE_FIRST';
  }
  
  // NetworkFirst para APIs
  if (CACHE_STRATEGIES.NETWORK_FIRST.some(pattern => pattern.test(urlString))) {
    // Dados de mercado usam TTL
    if (urlString.includes('/api/candles') || urlString.includes('/api/market')) {
      return 'NETWORK_FIRST_TTL';
    }
    return 'NETWORK_FIRST';
  }
  
  // StaleWhileRevalidate para dados Next.js
  if (CACHE_STRATEGIES.STALE_WHILE_REVALIDATE.some(pattern => pattern.test(urlString))) {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  // Default: NetworkFirst
  return 'NETWORK_FIRST';
}

/**
 * CacheFirst: Tenta cache primeiro, depois rede
 */
async function cacheFirst(request, cache) {
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] CacheFirst fetch failed:', error);
    // Retornar cache mesmo se expirado em caso de erro de rede
    const staleCache = await cache.match(request);
    if (staleCache) {
      return staleCache;
    }
    throw error;
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
    console.warn('[SW] NetworkFirst fetch failed, trying cache:', error);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * NetworkFirst com TTL para dados de mercado
 */
async function networkFirstWithTTL(request, cache, ttl = MARKET_DATA_TTL) {
  const url = request.url;
  const cacheKey = new Request(url);
  
  // Verificar cache primeiro
  const cached = await cache.match(cacheKey);
  if (cached) {
    const cachedDate = cached.headers.get('sw-cached-date');
    if (cachedDate) {
      const age = Date.now() - parseInt(cachedDate, 10);
      if (age < ttl) {
        // Cache ainda válido
        return cached;
      }
    }
  }
  
  // Cache expirado ou não existe, buscar da rede
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Adicionar timestamp ao header
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(cacheKey, cachedResponse);
    }
    return response;
  } catch (error) {
    console.warn('[SW] NetworkFirstWithTTL fetch failed, trying stale cache:', error);
    // Retornar cache mesmo se expirado em caso de erro
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * StaleWhileRevalidate: Retorna cache imediatamente e atualiza em background
 */
async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request);
  
  // Atualizar em background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.warn('[SW] Background update failed:', error);
    });
  
  // Retornar cache imediatamente se disponível
  if (cached) {
    return cached;
  }
  
  // Se não houver cache, aguardar fetch
  return fetchPromise;
}

/**
 * Intercepta requisições
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições não-GET (retornar sem interceptar)
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignorar requisições de WebSocket
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Ignorar requisições de extensões do Chrome
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Ignorar requisições para domínios externos PRIMEIRO (evitar CORS)
  // Isso inclui requisições que a API route faz para serviços externos
  // IMPORTANTE: Verificar isso ANTES de verificar pathname para garantir bypass
  if (url.origin !== self.location.origin) {
    return; // Não interceptar requisições externas (incluindo Yahoo Finance, etc)
  }
  
  // Ignorar requisições para APIs de Forex (deixar passar direto, sem cache)
  // Essas APIs fazem proxy para serviços externos e não devem ser cacheadas
  if (url.pathname.startsWith('/api/forex/')) {
    return; // Deixar passar direto, sem interceptação
  }
  
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
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    // Cachear URLs adicionais enviadas pelo cliente
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Limpar cache
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        return caches.delete(RUNTIME_CACHE);
      })
    );
  }
});

