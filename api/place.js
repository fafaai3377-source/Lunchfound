// Vercel 서버 함수: /api/place — 멤버 누구나 가게 "종류"와 "세부 종류"를 고칠 수 있게
// (보안 규칙상 멤버는 가게 정보를 직접 못 바꿔서, 로그인 확인 후 서버가 대신 저장해요. 이름·위치는 관리자만)
//
// 요청: POST, 헤더 Authorization: Bearer <로그인 토큰>
//   { op: "category", id, category, note }
const { admin, firebaseApp, verifyMember } = require("./_firebase");

const CATS = ["한식", "중식", "일식", "양식", "브런치", "아시안", "분식", "고기", "카페", "기타"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 돼요" });
  const me = await verifyMember(req);
  if (!me) return res.status(401).json({ error: "로그인이 필요해요" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (b.op !== "category") return res.status(400).json({ error: "알 수 없는 요청이에요" });
  const id = String(b.id || "");
  const category = String(b.category || "");
  const note = String(b.note || "").replace(/\s+/g, " ").trim().slice(0, 12);
  if (!id || id.includes("/") || !CATS.includes(category)) return res.status(400).json({ error: "종류를 다시 골라주세요" });
  const ref = admin.firestore(firebaseApp()).collection("places").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "가게를 찾지 못했어요" });
  await ref.update({ category, note, emoji: "", catBy: me.name, catAt: admin.firestore.FieldValue.serverTimestamp() });
  return res.status(200).json({ ok: true });
};
