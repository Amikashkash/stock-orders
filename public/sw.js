// This service worker replaces the old one and clears all caches
// so users automatically get the new Vue 3 app without manual intervention.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
  await clients.claim()
  await self.registration.unregister()
})
