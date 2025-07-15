const CACHE_NAME = 'stock-orders-v5-clean-production';
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

// Install event - cache resources
self.addEventListener('install', event => {
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

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
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

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
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
