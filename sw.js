self.addEventListener('install', (e) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (e) => {
  // Этот код позволяет приложению работать быстрее
  e.respondWith(fetch(e.request));
});
