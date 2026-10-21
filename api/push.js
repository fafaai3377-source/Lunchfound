// Vercel 서버 함수: /api/push — 앱을 닫아도 오는 알림 (Web Push)
//
// 알림 규칙
//   · 새 약속이 올라오면 → 알림을 켠 멤버 전원에게 (약속을 올린 사람은 빼고)
//   · 누가 약속에 참여하면 → 그 약속을 개설한 사람에게만 (정원이 차면 "마감" 표시)
//
// 요청 (모두 POST, 헤더 Authorization: Bearer <로그인 토큰>)
//   { op: "subscribe", sub }            이 기기를 알림 받는 기기로 등록
//   { op: "unsubscribe", endpoint }     이 기기 알림 끄기
//   { op: "meetup-new", meetupId }      방금 올린 약속을 멤버들에게 알림 (개설자 본인만 요청 가능, 약속당 1번)
//   { op: "meetup-join", meetupId }     방금 참여한 약속의 개설자에게 알림 (참여자 본인만 요청 가능)
//   { op: "test" }                      내 기기로 시험 알림
//
// 필요한 Vercel 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (+ 로그인에 쓰는 FIREBASE_SERVICE_ACCOUNT)
const crypto = require("crypto");
const webpush = require("web-push");
const { admin, firebaseApp, verifyMember } = require("./_firebase");

const LUNCH_START = "12:30";
const db = () => admin.firestore(firebaseApp());
const subId = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
const dayWord = (date) => {
  const now = new Date(Date.now() + 9 * 3600e3);                  // 한국 시간 기준
  const today = now.toISOString().slice(0, 10);
  const tm = new Date(now.getTime() + 864e5).toISOString().slice(0, 10);
  if (date === today) return "오늘";
  if (date === tm) return "내일";
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T12:00:00Z`).getUTCDay()] + "요일";
};

// 받는 사람 목록 → 각 기기로 발송. 기기가 사라졌으면(404/410) 등록 정리
async function sendTo(subDocs, payload) {
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subDocs.map(async (d) => {
    try { await webpush.sendNotification(d.data().sub, JSON.stringify(payload), { TTL: 60 * 60 * 3, urgency: "high" }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await d.ref.delete().catch(() => {}); removed++; }
      else { failed++; console.warn("push fail", e.statusCode, String(e.body || e.message).slice(0, 120)); }
    }
  }));
  return { sent, removed, failed };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST로 요청해 주세요" });
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(500).json({ error: "서버에 알림 키(VAPID)가 없어요" });
  webpush.setVapidDetails("mailto:fafaai3377@gmail.com", pub, priv);

  const me = await verifyMember(req);
  if (!me) return res.status(401).json({ error: "다시 로그인해 주세요" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const op = body?.op;

  try {
    if (op === "subscribe") {
      const sub = body.sub;
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: "알림 정보가 올바르지 않아요" });
      await db().collection("pushSubs").doc(subId(sub.endpoint)).set({
        uid: me.uid, name: me.name, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        ua: String(req.headers["user-agent"] || "").slice(0, 160), updatedAt: Date.now(),
      });
      return res.status(200).json({ ok: true });
    }
    if (op === "unsubscribe") {
      if (body.endpoint) await db().collection("pushSubs").doc(subId(String(body.endpoint))).delete().catch(() => {});
      return res.status(200).json({ ok: true });
    }
    if (op === "test") {
      const mine = await db().collection("pushSubs").where("uid", "==", me.uid).get();
      const r = await sendTo(mine.docs, { title: "foundeat 알림이 켜졌어요", body: "새 약속이 올라오면 이렇게 알려드릴게요", tag: "test", url: "./" });
      return res.status(200).json(r);
    }

    if (op === "meetup-new" || op === "meetup-join") {
      const ref = db().collection("meetups").doc(String(body.meetupId || "x"));
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "약속을 찾지 못했어요" });
      const m = snap.data();
      const joined = m.joined || {}, n = Object.keys(joined).length, full = n >= m.capacity;
      const when = `${dayWord(m.date)} ${m.time || LUNCH_START}`;
      const url = `./?meet=${encodeURIComponent(snap.id)}`;

      if (op === "meetup-new") {
        if (m.hostUid !== me.uid) return res.status(403).json({ error: "내가 올린 약속만 알릴 수 있어요" });
        // 약속 하나당 한 번만 (두 번 눌러도 중복 알림 없음)
        const first = await db().runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (s.data().notifiedAt) return false;
          tx.update(ref, { notifiedAt: Date.now() });
          return true;
        });
        if (!first) return res.status(200).json({ sent: 0, skipped: "already" });
        const all = await db().collection("pushSubs").get();
        const targets = all.docs.filter((d) => d.data().uid !== me.uid);
        const r = await sendTo(targets, {
          title: `🍽 ${m.hostName}님이 점심 약속을 올렸어요`,
          body: `${when} ${m.placeName} · 선착순 ${n}/${m.capacity}명${m.note ? ` · ${m.note}` : ""}`,
          tag: `meet-${snap.id}`, url,
        });
        return res.status(200).json(r);
      }

      // meetup-join: 참여한 본인만 요청 가능 → 개설자에게만
      if (!joined[me.uid]) return res.status(403).json({ error: "참여한 약속만 알릴 수 있어요" });
      if (m.hostUid === me.uid) return res.status(200).json({ sent: 0 });
      const host = await db().collection("pushSubs").where("uid", "==", m.hostUid).get();
      const r = await sendTo(host.docs, {
        title: `🙋 ${joined[me.uid].name || me.name}님이 식사에 참여했어요`,
        body: `${when} ${m.placeName} · ${n}/${m.capacity}명${full ? " · 정원이 다 찼어요" : ""}`,
        tag: `join-${snap.id}-${me.uid}`, url,
      });
      return res.status(200).json(r);
    }
    return res.status(400).json({ error: "알 수 없는 요청이에요" });
  } catch (e) {
    console.error("push error", e);
    return res.status(500).json({ error: "알림을 보내지 못했어요" });
  }
};
