// Lunchfound 서비스워커 — 앱으로 설치(PWA), 오프라인 대비, 알림 클릭 처리
// 앱 파일을 고치면 아래 VERSION 숫자만 올려주세요. 다음 접속 때 새 버전으로 바뀌어요.
const VERSION = "lunchfound-v6";
const SHELL = ["./", "./index.html", "./styles.css", "./config.js", "./members.js", "./seeds.js", "./store.js", "./walk.js", "./map-kakao.js", "./map-libre.js", "./app.js", "./walk-graph.json", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/favicon.svg", "./brand/logo-black.png", "./brand/logo-white.png", "./brand/mark-black.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 같은 사이트의 앱 파일만: 네트워크 먼저(항상 최신), 안 되면 저장해둔 것. 카카오·Firebase·/api 요청은 건드리지 않음
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});

// 알림을 누르면 열려 있는 Lunchfound 창으로, 없으면 새로 열기
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const win = list.find((w) => w.url.startsWith(self.registration.scope));
    return win ? win.focus() : self.clients.openWindow("./");
  }));
});

// 다음 단계(앱을 닫아도 오는 푸시)를 위한 자리: 서버가 보낸 { title, body } 를 알림으로 표시
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Lunchfound", body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Lunchfound", { body: d.body || "", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: d.tag }));
});
