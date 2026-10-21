// foundeat 서비스워커 — 앱으로 설치(PWA), 오프라인 대비, 알림 클릭 처리
// 앱 파일을 고치면 아래 VERSION 숫자만 올려주세요. 다음 접속 때 새 버전으로 바뀌어요.
const VERSION = "foundeat-v53";
const SHELL = ["./", "./index.html", "./styles.css", "./config.js", "./members.js", "./seeds.js", "./store.js", "./walk.js", "./map-kakao.js", "./map-libre.js", "./stores.js", "./guide.js", "./app.js", "./walk-graph.json", "./brand/logo-black.png", "./brand/logo-white.png", "./brand/mark-black.png"];

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
  // 홈 화면 아이콘·파비콘·앱 정보(manifest)·시작 화면 그림은 서비스워커가 건드리지 않고 휴대폰이 직접 받아가게
  // (예전엔 아이콘을 못 받으면 index.html을 대신 돌려줘서, 아이폰 홈 화면에 추가할 때 아이콘 대신 글자 F가 나왔음)
  if (/^\/(icons|splash)\/|^\/(apple-touch-icon|favicon|manifest)/.test(url.pathname)) return;
  // 지도 라이브러리(vendor/, 버전이 폴더 이름에 있어 바뀌지 않음)는 저장해둔 것 먼저 — 두 번째부터는 내려받지 않고 바로
  if (url.pathname.includes("/vendor/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; })
      // 저장해둔 것도 없으면: 페이지 이동일 때만 첫 화면(index.html), 그림·파일 요청엔 index.html을 주지 않고 실패로
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});

// 알림을 누르면: 열려 있는 foundeat 창이 있으면 그 창에서 약속 목록을 열고, 없으면 새로 열기
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const win = list.find((w) => w.url.startsWith(self.registration.scope));
    if (win) { if (url.includes("meet=")) win.postMessage({ type: "open-meet" }); return win.focus(); }
    return self.clients.openWindow(url);
  }));
});

// 서버(/api/push)가 보낸 알림 { title, body, tag, url } 표시
// 안드로이드·PC는 앱 화면을 보고 있는 중이면 화면 안 배너만 띄우고 알림은 생략 (아이폰은 규칙상 항상 표시)
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "foundeat", body: e.data && e.data.text() }; }
  const ios = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent) && /Safari/.test(self.navigator.userAgent) && !/Chrome|CriOS|Android/.test(self.navigator.userAgent);
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const looking = list.some((w) => w.visibilityState === "visible" && w.focused);
    if (looking && !ios && d.tag !== "test") return;
    return self.registration.showNotification(d.title || "foundeat", {
      body: d.body || "", tag: d.tag, renotify: !!d.tag, data: { url: d.url || "./" },
      icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", vibrate: [40, 60, 40],
    });
  }));
});
