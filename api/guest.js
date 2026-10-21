// Vercel 서버 함수: /api/guest — 게스트(둘러보기 전용)에게 이름을 뺀 데이터만 내려줌
//   GET /api/guest                → { places, reviews }   가게 + 기록 (누가 남겼는지 이름·계정 번호는 지움)
//   GET /api/guest?photos=<가게ID> → { photos }            그 가게 사진 (올린 사람 이름 지움)
// 게스트 로그인 토큰(guest: true)에는 member가 없어서 보안 규칙상 Firestore를 직접 볼 수 없어요.
// 그래서 서버가 관리자 권한으로 읽은 뒤, 이름을 지우고 보여줄 것만 골라서 보내요. 오늘 약속은 보내지 않아요.
const { admin, firebaseApp } = require("./_firebase");

const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0);

async function viewer(req) {
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const t = await admin.auth(firebaseApp()).verifyIdToken(m[1]);
    return t.guest === true || t.member ? t : null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET으로 요청해 주세요" });
  if (!(await viewer(req))) return res.status(401).json({ error: "다시 로그인해 주세요" });
  const db = admin.firestore(firebaseApp());
  try {
    const pid = String(req.query?.photos || "");
    if (pid) {
      const snap = await db.collection("photos").where("placeId", "==", pid).get();
      // 응답 크기 한도(약 4.5MB) 안에서 최근 사진부터
      let size = 0;
      const photos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
        .filter((x) => (size += String(x.data || "").length) < 3_800_000)
        .map((x) => ({ id: x.id, placeId: x.placeId, kind: x.kind || "", reviewId: x.reviewId || "", menu: x.menu || "", data: x.data || "", createdAt: ms(x.createdAt), uid: "", userName: "" }));
      return res.status(200).json({ photos });
    }
    const [ps, rs] = await Promise.all([db.collection("places").get(), db.collection("reviews").get()]);
    // 멤버마다 이 응답 안에서만 쓰는 익명 번호 (한 사람의 재방문을 한 카드로 묶을 수 있게)
    const anon = new Map(), aid = (uid) => { if (!anon.has(uid)) anon.set(uid, "g" + (anon.size + 1)); return anon.get(uid); };
    const reviews = rs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.createdAt) - ms(b.createdAt)).map((r) => {
      const { uid, userName, updatedAt, ...rest } = r;
      return { ...rest, uid: aid(uid), userName: "", createdAt: ms(r.createdAt) };
    });
    const places = ps.docs.map((d) => {
      const p = d.data(), views = {};
      Object.keys(p.views || {}).forEach((k, i) => (views["v" + i] = true));   // 본 멤버 수만 남김
      return { ...p, id: d.id, createdAt: ms(p.createdAt), createdBy: "", createdByName: "", catBy: "", catAt: 0, views,
        images: (p.images || []).map((im) => ({ ...im, by: "", uid: "" })) };
    });
    return res.status(200).json({ places, reviews });
  } catch (e) {
    return res.status(500).json({ error: e.message === "NO_SERVICE_ACCOUNT" ? "서버에 Firebase 서비스 계정 설정이 없어요" : "목록을 불러오지 못했어요" });
  }
};
