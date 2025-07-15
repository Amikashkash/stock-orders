const CACHE_NAME = 'stock-orders-v6-network-first';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './DashboardView.js',
  './CreateOrderView.js',
  './PickingOrdersView.js',
  './PickOrderDetailsView.js',
  './SalesStatsView.js',
  './OrderHistoryView.js',
  './AddProductView.js',
  './EditProductView.js',
  './AuthView.js'
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
  const url = new URL(event.request.url);
  
  // For JavaScript files, always try network first
  if (event.request.url.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Add to cache
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For other files, use cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // If both cache and network fail, return a basic offline page
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
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
