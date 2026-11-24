/* 여행 총무 — 오프라인 캐시 */
const CACHE = 'trip-treasurer-1.3-test';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  /* 설치할 때는 브라우저 캐시를 거치지 않고 항상 새 파일을 받아요 */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(req) {
  return fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);

  if (isPage) {
    /* 화면: 인터넷이 되면 새 버전, 안 되거나 3초 안에 답이 없으면 저장된 화면 */
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./index.html'))
        .then(hit => { if (!done && hit) { done = true; resolve(hit); } });
      const timer = setTimeout(fallback, 3000);
      fromNetwork(req)
        .then(res => { clearTimeout(timer); if (!done) { done = true; resolve(res); } })
        .catch(() => { clearTimeout(timer); fallback().then(() => { if (!done) { done = true; resolve(Response.error()); } }); });
    }));
    return;
  }

  /* 아이콘 같은 파일: 저장된 걸 바로 쓰고 뒤에서 새로 받아 둬요 */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fromNetwork(req).catch(() => hit);
      return hit || net;
    })
  );
});
