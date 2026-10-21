// 진단용 서버 함수: 아이폰이 "홈 화면에 추가"할 때 실제로 어떤 아이콘 주소를 받아가는지 기록 (원인 찾으면 지울 것)
//   GET /api/hit?f=<이름>   → 아이콘(또는 테스트 페이지)을 돌려주고, 요청 시각·주소·브라우저 정보(User-Agent)를 Firestore _iconlog에 기록
//   GET /api/hit?log=1      → 최근 기록 60개 (시각·주소·브라우저 정보만, 이름·IP는 남기지 않음)
const { admin, firebaseApp } = require("./_firebase");
const B = require("./_iconbytes");

// 아이폰·맥 Safari에는 빨강 꽉 찬 //, 그 밖에는 빨간 동그라미
const isApple = (ua) => /iPhone|iPad|iPod|CFNetwork|Darwin/i.test(ua) || (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua));

const TEST_PAGE = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" sizes="64x64" href="/api/hit?f=t-favicon" />
    <link rel="manifest" href="/api/manifest?from=t" />
    <meta name="theme-color" content="#DA2C23" />
    <link rel="apple-touch-icon" sizes="180x180" href="data:image/png;base64,${B.touch180.b64}" />
    <meta name="apple-mobile-web-app-title" content="foundeat 테스트" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>foundeat 테스트</title>
    <style>body{font:16px/1.6 -apple-system,system-ui,sans-serif;margin:0;padding:48px 24px;color:#1d1d1f}b{color:#DA2C23}</style>
  </head>
  <body>
    <h2>홈 화면 아이콘 테스트 페이지</h2>
    <p>공유 → <b>홈 화면에 추가</b>를 눌러서, 추가 화면 왼쪽 아이콘이 <b>빨강 //</b> 인지 F 글자인지 캡처해 주세요.</p>
    <p>확인만 하고 추가는 안 해도 돼요.</p>
  </body>
</html>`;

async function log(req, f) {
  try {
    const h = req.headers;
    await admin.firestore(firebaseApp()).collection("_iconlog").add({
      t: Date.now(), f: String(f).slice(0, 40),
      ua: String(h["user-agent"] || "").slice(0, 300),
      accept: String(h["accept"] || "").slice(0, 120),
      dest: String(h["sec-fetch-dest"] || ""), mode: String(h["sec-fetch-mode"] || ""),
      ref: String(h["referer"] || "").slice(0, 120),
    });
  } catch (e) { console.error("iconlog", e && e.message); }
}

module.exports = async (req, res) => {
  if (req.query.purge === "iconlog") {   // 진단 끝: 기록 전부 지우기
    const db = admin.firestore(firebaseApp()); let n = 0;
    for (;;) { const snap = await db.collection("_iconlog").limit(300).get(); if (snap.empty) break; const b = db.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit(); n += snap.size; }
    return res.status(200).json({ deleted: n });
  }
  if (req.query.log) {
    try {
      const snap = await admin.firestore(firebaseApp()).collection("_iconlog").orderBy("t", "desc").limit(60).get();
      const rows = snap.docs.map((d) => d.data()).map((x) => ({ ...x, kst: new Date(x.t + 9 * 3600e3).toISOString().slice(5, 19).replace("T", " ") }));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(rows);
    } catch (e) { return res.status(500).json({ error: String(e && e.message) }); }
  }
  const f = String(req.query.f || "");
  const ua = String(req.headers["user-agent"] || "");
  await log(req, f);
  if (f === "page-t") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.status(200).send(TEST_PAGE);
  }
  let key;
  if (f === "root-ico") key = isApple(ua) ? "touch180" : "ico";
  else if (/favicon/.test(f)) key = isApple(ua) ? "touch180" : "circle32";
  else if (/512/.test(f)) key = "red512";
  else if (/192/.test(f)) key = "red192";
  else key = "touch180";
  const b = B[key];
  res.setHeader("Content-Type", b.type);
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  return res.status(200).send(Buffer.from(b.b64, "base64"));
};
