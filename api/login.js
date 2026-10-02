// Vercel 서버 함수: /api/login  (POST { name, password })
// 멤버 이름 + 공용 비밀번호를 확인하고, 맞으면 Firebase 로그인 토큰(custom token)을 돌려줘요.
// 비밀번호 원문은 어디에도 저장하지 않고, Vercel 환경변수에는 SHA-256 해시만 둬요.
//
// 필요한 Vercel 환경변수 (이미 등록된 이름을 그대로 사용)
//   LOGIN_PASSWORD_HASH       공용 비밀번호 해시 — SHA-256(16진수 64자 또는 base64) · bcrypt($2a$/$2b$) 모두 인식
//   FIREBASE_SERVICE_ACCOUNT  Firebase 서비스 계정 키 — JSON 원문 또는 base64 모두 인식
//   (예전 이름 LUNCH_PASSWORD_HASH, FIREBASE_SERVICE_ACCOUNT_B64도 계속 읽어요)
const crypto = require("crypto");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const MEMBERS = require("../members.js");

function firebaseApp() {
  if (admin.apps.length) return admin.app();
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "").trim();
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  // JSON 원문이면 그대로, 아니면 base64로 보고 풀기
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(text);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");   // 환경변수에 줄바꿈이 \n 글자로 들어간 경우
  return admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const sha256 = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

// 저장된 값 형식을 알아보고 비교: true(맞음) / false(틀림) / null(설정 없음)
// 인식 순서: bcrypt → SHA-256(16진수) → SHA-256(base64/base64url) → 그 외에는 비밀번호 원문으로 보고 비교
function storedSecret() {
  let v = String(process.env.LOGIN_PASSWORD_HASH || process.env.LUNCH_PASSWORD_HASH || "").trim();
  v = v.replace(/^["'`]+|["'`]+$/g, "").trim();          // 실수로 들어간 따옴표 제거
  return v;
}
async function checkPassword(password) {
  const want = storedSecret();
  if (!want) return null;
  if (/^\$2[aby]\$\d{2}\$/.test(want)) return bcrypt.compare(password, want);                                   // bcrypt
  const hex = want.replace(/^(sha-?256[:$=]|0x)/i, "").replace(/\s+/g, "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(hex)) return same(Buffer.from(sha256(password), "hex"), Buffer.from(hex, "hex"));       // SHA-256 16진수
  const b64 = want.replace(/-/g, "+").replace(/_/g, "/");
  if (/^[A-Za-z0-9+/]{43}=?$/.test(b64)) return same(crypto.createHash("sha256").update(password, "utf8").digest(), Buffer.from(b64.padEnd(44, "="), "base64")); // SHA-256 base64(url)
  // 해시가 아닌 값(비밀번호 원문)으로 보이는 경우: 길이를 맞춘 해시끼리 비교해서 타이밍 차이 없이 확인
  return same(Buffer.from(sha256(password), "hex"), Buffer.from(sha256(want), "hex"));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST로 요청해 주세요" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const name = String(body?.name || "").trim(), password = String(body?.password || "");
  const member = MEMBERS.find((m) => m.name === name);
  if (!member) return res.status(400).json({ error: "명단에 없는 이름이에요" });

  const ok = await checkPassword(password);
  if (ok === null) return res.status(500).json({ error: "서버에 비밀번호 설정(LOGIN_PASSWORD_HASH)이 없거나 형식을 알 수 없어요" });
  if (!ok) { await sleep(600); return res.status(401).json({ error: "비밀번호가 달라요" }); }   // 연속 대입을 늦추기 위한 지연

  try {
    // 같은 이름은 항상 같은 계정 번호(uid) → 기록·약속이 그 멤버에게 계속 연결돼요
    const uid = "m_" + sha256("lunchfound:" + name).slice(0, 24);
    const token = await admin.auth(firebaseApp()).createCustomToken(uid, { member: name, team: member.team });
    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: e.message === "NO_SERVICE_ACCOUNT" ? "서버에 Firebase 서비스 계정 설정이 없어요" : "로그인 토큰을 만들지 못했어요" });
  }
};
