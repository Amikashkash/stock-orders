const CACHE_NAME = 'stock-orders-v9-mobile-edit-fix';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './DashboardView.js',
  './CreateOrderView.js',
  './EditOrderView.js',
  './PickingOrdersView.js',
  './PickOrderDetailsView.js',
  './SalesStatsView.js',
  './OrderHistoryView.js',
  './AddProductView.js',
  './EditProductView.js',
  './AuthView.js',
  './utils.js',
  './StateManager.js',
  './NotificationSystem.js'
];

// Install event - cache resources and skip waiting
self.addEventListener('install', event => {
  // Skip waiting to immediately take control
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache resources:', err);
      })
  );
});

// Fetch event - network first for JS files, cache first for others
self.addEventListener('fetch', event => {
  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Skip external domains that cause CORS issues
  const url = new URL(event.request.url);
  if (url.hostname !== location.hostname && url.hostname !== 'www.gstatic.com' && url.hostname !== 'cdn.tailwindcss.com') {
    return;
  }
  
  // For JavaScript files, always try network first
  if (event.request.url.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(error => {
                console.log('Cache put failed:', error);
              });
          }
          return response;
        })
        .catch(error => {
          console.log('Network failed, trying cache:', error);
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For other files, use cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Only cache successful responses
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                })
                .catch(error => {
                  console.log('Cache put failed:', error);
                });
            }
            return response;
          })
          .catch(error => {
            console.log('Both cache and network failed:', error);
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            throw error;
          });
      })
  );
});

// Activate event - claim clients immediately and clean up old caches
self.addEventListener('activate', event => {
  // Claim all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Background sync for offline orders (optional)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Sync any pending orders when connection is restored
  console.log('Syncing orders...');
  // Implementation depends on your offline storage strategy
}
