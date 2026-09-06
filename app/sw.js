/* 컴투스 팝업 쿠지 — Service Worker
   앱 자산을 사전 캐싱해 오프라인에서도 동작하게 한다.
   ※ 앱을 수정·재배포할 때는 CACHE 버전을 올려야 태블릿이 새 버전을 받는다. */
const CACHE = 'figure-draw-v31';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/com2us-store-logo-white.svg',
  './assets/com2us-store-lockup-white.svg',
  './assets/fonts/Pretendard-Light.otf',
  './assets/fonts/Pretendard-Regular.otf',
  './assets/fonts/Pretendard-Medium.otf',
  './assets/fonts/Pretendard-SemiBold.otf',
  './assets/fonts/Pretendard-Bold.otf',
  './assets/fonts/Pretendard-ExtraBold.otf',
  './assets/fonts/Pretendard-Black.otf',
  './assets/fonts/Gyoza-Black.otf',
  './assets/fonts/CookieRun-Regular.ttf',
  './assets/fonts/CookieRun-Bold.ttf',
  './assets/fonts/CookieRun-Black.ttf',
  './assets/badges/badge-a.png',
  './assets/badges/badge-b.png',
  './assets/badges/badge-c.png',
  './assets/badges/badge-d.png',
  './assets/badges/badge-e.png',
  './assets/badges/badge-f.png',
  './assets/badges/badge-special.png',
  './assets/badges/badge-lucky.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('figure-draw-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 캐시 우선(cache-first): 캐시에 있으면 즉시 반환, 없으면 네트워크 후 캐시에 저장.
   업로드한 이미지·영상·BGM은 IndexedDB에 있으므로 SW 캐싱 대상이 아니다. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
