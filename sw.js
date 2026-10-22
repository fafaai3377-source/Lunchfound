// foundeat 서비스워커 — 앱으로 설치(PWA), 알림 받기·알림 클릭 처리
// 앱 파일을 고치면 아래 VERSION 숫자만 올려주세요. 다음 접속 때 새 버전으로 바뀌어요.
const VERSION = "foundeat-v62";
// foundfoundedmeet처럼 파일 요청은 가로채지 않아요 (fetch 처리 없음) — 아이폰이 홈 화면 아이콘·앱 정보를 직접 받아가게.
// 예전 버전이 저장해 둔 파일(오프라인 대비용)은 새 버전이 켜질 때 전부 지워요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
