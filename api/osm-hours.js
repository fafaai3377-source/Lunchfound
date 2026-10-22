// Vercel 서버 함수: /api/osm-hours?lat=37.556&lng=126.919 — 사옥 주변 2km에서 오픈스트리트맵에 영업시간(opening_hours)이 적힌 곳 목록
// 공개 데이터(© OpenStreetMap 기여자, ODbL)라 로그인 없이 받고, Vercel이 하루 동안 저장해 둬요(같은 주소면 Overpass에 다시 묻지 않음).
// 가게 이름 맞추기·저장은 앱(hours.js)과 /api/place(op: "hours")가 해요.
const EPS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

module.exports = async (req, res) => {
  const lat = +(+req.query.lat).toFixed(3), lng = +(+req.query.lng).toFixed(3);
  if (!(lat > 33 && lat < 39.5 && lng > 124 && lng < 132)) return res.status(400).json({ error: "좌표를 확인해 주세요" });
  const q = `[out:json][timeout:25];nwr["opening_hours"]["name"](around:2000,${lat},${lng});out center tags;`;
  for (const ep of EPS) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(ep, { method: "POST", signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "foundeat/1.0 (team lunch map)" },
        body: "data=" + encodeURIComponent(q) });
      if (!r.ok) continue;
      const j = await r.json();
      const items = (j.elements || []).map((e) => {
        const t = e.tags || {}, la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
        if (la == null || lo == null || !t.name || !t.opening_hours) return null;
        return { n: t.name, ko: t["name:ko"] || "", lat: +(+la).toFixed(6), lng: +(+lo).toFixed(6), oh: String(t.opening_hours).slice(0, 200), k: t.amenity || t.shop || "" };
      }).filter(Boolean);
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).json({ at: Date.now(), src: "© OpenStreetMap contributors (ODbL)", items });
    } catch { /* 다음 서버로 */ } finally { clearTimeout(timer); }
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(502).json({ error: "오픈스트리트맵에 연결하지 못했어요" });
};
