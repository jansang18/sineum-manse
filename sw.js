// 잔상 만세력 서비스워커 종료용 파일.
// 캐시는 영구 비활성화하며, 과거 jansang-manse-* 캐시와 등록만 정리한다.
const APP_CACHE_PREFIX = 'jansang-manse-';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(APP_CACHE_PREFIX))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
