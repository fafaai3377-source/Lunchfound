// 서버 함수 공용: Firebase 관리자 연결 + 로그인 토큰 확인 (파일 이름이 _로 시작하면 주소로 열리지 않아요)
const admin = require("firebase-admin");

function firebaseApp() {
  if (admin.apps.length) return admin.app();
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "").trim();
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(text);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return admin.initializeApp({ credential: admin.credential.cert(sa) });
}

// Authorization: Bearer <Firebase ID 토큰> → { uid, name, admin }
async function verifyMember(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const t = await admin.auth(firebaseApp()).verifyIdToken(m[1]);
    if (!t.member) return null;
    return { uid: t.uid, name: t.member, admin: t.admin === true };
  } catch { return null; }
}

module.exports = { admin, firebaseApp, verifyMember };
