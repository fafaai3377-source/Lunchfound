// Vercel 서버 함수: /api/place — 멤버 누구나 가게 "종류"와 "세부 종류"를 고칠 수 있게
// (보안 규칙상 멤버는 가게 정보를 직접 못 바꿔서, 로그인 확인 후 서버가 대신 저장해요. 이름·위치는 관리자만)
//
// 요청: POST, 헤더 Authorization: Bearer <로그인 토큰>
//   { op: "category", id, category, note }
//   { op: "hours", id, hours: { mon … sun } | null, note, src: "member" | "osm", osm, osmName }  ← 영업시간 (10/22, v66)
const { admin, firebaseApp, verifyMember } = require("./_firebase");

const CATS = ["한식", "중식", "일식", "양식", "브런치", "아시안", "분식", "고기", "카페", "기타"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 돼요" });
  const me = await verifyMember(req);
  if (!me) return res.status(401).json({ error: "로그인이 필요해요" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (b.op === "hours") return saveHours(b, me, res);
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

// 영업시간: 요일마다 "HH:MM-HH:MM"(쉼표로 최대 4구간) 또는 ""(쉬는 날). 멤버가 입력한 것은 오픈스트리트맵 자동 채우기가 덮어쓰지 않아요
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const okDay = (v) => v === "" || (/^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2}){0,3}$/.test(v)
  && v.split(/[,-]/).every((t) => +t.slice(0, 2) <= 30 && +t.slice(3) < 60));
async function saveHours(b, me, res) {
  const id = String(b.id || "");
  if (!id || id.includes("/")) return res.status(400).json({ error: "가게를 다시 골라주세요" });
  const src = b.src === "osm" ? "osm" : "member";
  const ref = admin.firestore(firebaseApp()).collection("places").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "가게를 찾지 못했어요" });
  const cur = snap.get("hours");
  if (b.hours === null) {
    if (src === "osm") return res.status(400).json({ error: "알 수 없는 요청이에요" });
    await ref.update({ hours: admin.firestore.FieldValue.delete() });
    return res.status(200).json({ ok: true });
  }
  const h = b.hours || {}, days = {};
  for (const d of DAYS) { const v = String(h[d] ?? ""); if (!okDay(v)) return res.status(400).json({ error: "영업시간 모양이 맞지 않아요" }); days[d] = v; }
  if (DAYS.every((d) => !days[d])) return res.status(400).json({ error: "모든 요일이 쉬는 날이에요" });
  if (src === "osm" && cur && cur.src === "member") return res.status(409).json({ error: "멤버가 입력한 영업시간이 있어요" });
  const hours = { ...days, note: String(b.note || "").replace(/\s+/g, " ").trim().slice(0, 40), src,
    by: src === "osm" ? "" : me.name, at: admin.firestore.FieldValue.serverTimestamp() };
  if (src === "osm") { hours.osm = String(b.osm || "").slice(0, 200); hours.osmName = String(b.osmName || "").slice(0, 60); }
  await ref.update({ hours });
  return res.status(200).json({ ok: true });
}
