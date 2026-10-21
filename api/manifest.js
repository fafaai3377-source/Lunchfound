// Vercel 서버 함수: /api/manifest — 앱 정보(웹 앱 매니페스트)를 기기에 맞춰 내려줌
// 아이폰(iOS 26 "웹 앱으로 열기")은 홈 화면 아이콘을 매니페스트의 아이콘에서 가져와서,
// 데스크탑용 빨간 동그라미(투명 바탕)를 주면 흰 칸 안에 작은 동그라미로 붙어요.
//   · 아이폰·아이패드·맥 Safari → 빨강 꽉 찬 바탕 + 흰 //  (아이폰이 모서리를 둥글게 깎음)
//   · 그 밖(데스크탑 크롬·안드로이드) → 빨간 동그라미 + 안드로이드용 빨강 꽉 찬 바탕(maskable)
const base = {
  name: "foundeat",
  short_name: "foundeat",
  description: "같이 먹고, 같이 찾는 우리 팀 맛집 지도",
  lang: "ko",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#DA2C23",
  theme_color: "#F5F5F7",
};
const png = (src, n, purpose) => ({ src, sizes: `${n}x${n}`, type: "image/png", ...(purpose ? { purpose } : {}) });
const APPLE = [png("/api/hit?f=m-touch180", 180), png("/api/hit?f=m-red192", 192), png("/api/hit?f=m-red512", 512)];
const OTHERS = [
  png("/icons/icon-192.png", 192, "any"), png("/icons/icon-512.png", 512, "any"),
  png("/icons/fe-home-maskable-192.png", 192, "maskable"), png("/icons/fe-home-maskable-512.png", 512, "maskable"),
];

function isApple(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;                 // 아이폰·아이패드 (Safari·크롬 모두)
  if (/CFNetwork|Darwin/i.test(ua)) return true;                  // 아이폰이 앱 정보를 따로 받아갈 때
  return /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);   // 맥·아이패드 Safari
}

const { admin, firebaseApp } = require("./_firebase");
async function log(req) {   // 진단용: 누가 앱 정보를 받아갔는지 (api/hit.js와 같은 _iconlog에)
  try {
    const h = req.headers;
    await admin.firestore(firebaseApp()).collection("_iconlog").add({ t: Date.now(), f: "manifest" + (req.query.from ? "-" + String(req.query.from).slice(0, 10) : ""),
      ua: String(h["user-agent"] || "").slice(0, 300), accept: String(h["accept"] || "").slice(0, 120), dest: String(h["sec-fetch-dest"] || ""), mode: String(h["sec-fetch-mode"] || ""), ref: String(h["referer"] || "").slice(0, 120) });
  } catch (e) { console.error("iconlog", e && e.message); }
}

module.exports = async (req, res) => {
  await log(req);
  const ua = String(req.headers["user-agent"] || "");
  const apple = isApple(ua);
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader("Vary", "User-Agent");
  res.status(200).send(JSON.stringify({ ...base, icons: apple ? APPLE : OTHERS }));
};
