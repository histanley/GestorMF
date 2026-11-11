// ==============================================================================
// GestorMF - Service Worker (PWA & Notificações de Pauta/Missão)
// Versão 6.6.3 - Força atualização imediata de cache
// ==============================================================================
const CACHE_NAME = 'gestormf-cache-v6-6-3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/logo.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

// Ativação e limpeza imediata de TODOS os caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[GestorMF SW] Removendo cache legado:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de requisições:
// 1. APIs: Sempre rede direta
// 2. Navegação / HTML: Network-first (sempre busca o mais novo)
// 3. Demais ativos: Network-first com fallback no cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Requisições para API são sempre diretas à rede sem cache estático
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, error: 'Dispositivo sem conexão com a internet.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navegação principal (HTML): Sempre prioriza a rede para carregar novos deploys
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Ativos estáticos: tenta a rede, com fallback no cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Recepção de Notificações Web Push
self.addEventListener('push', (event) => {
  let data = { title: 'MegaGestão', body: 'Nova notificação operacional recebida.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'MegaGestão', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Abrir no Sistema' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

