// 영업시간 (10/22, v66) — 오픈스트리트맵 opening_hours 읽기 · 지금 영업 상태 · 가게 이름 맞추기 (window.Hours)
// 저장 모양: place.hours = { mon: "11:00-15:00,17:00-21:00", tue: …, sun: "" (쉬는 날), note, src: "member" | "osm", by, at }
(function () {
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const KO = ["월", "화", "수", "목", "금", "토", "일"];
  const OSMD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const pad = (n) => String(n).padStart(2, "0");
  const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
  const fmt = (m) => (m === 1440 ? "24:00" : `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`);
  // "11:00-15:00,17:00-21:00" → [[660, 900], [1020, 1260]] (닫는 시간이 여는 시간보다 이르면 다음날 새벽까지)
  const ranges = (v) => String(v || "").split(",").map((r) => r.split("-").map(mins))
    .filter(([o, c]) => Number.isFinite(o) && Number.isFinite(c)).map(([o, c]) => [o, c <= o ? c + 1440 : c]);
  const has = (h) => !!h && DAYS.some((d) => typeof h[d] === "string");
  const dayIdx = (d) => (d.getDay() + 6) % 7;   // 월 = 0
  const pretty = (v) => (v ? String(v).split(",").map((r) => r.replace("-", " – ")).join(", ") : "쉬는 날");

  const left = (kind, c) => kind === "soon" ? { kind, short: "곧 마감", text: `곧 마감 · ${fmt(c)}까지` } : { kind, short: "영업 중", text: `영업 중 · ${fmt(c)}까지` };
  // 지금 상태: open(영업 중) / soon(30분 안에 마감) / before(영업 전) / break(브레이크타임) / closed(영업 종료) / off(오늘 쉬는 날)
  function status(h, now = new Date()) {
    if (!has(h)) return null;
    const di = dayIdx(now), t = now.getHours() * 60 + now.getMinutes();
    for (const [, c] of ranges(h[DAYS[(di + 6) % 7]])) if (c > 1440 && t < c - 1440) return left(c - 1440 - t <= 30 ? "soon" : "open", c - 1440);
    const td = ranges(h[DAYS[di]]);
    if (!td.length) return { kind: "off", short: "오늘 휴무", text: "오늘 쉬는 날" };
    if (td.some(([o, c]) => o === 0 && c >= 1440)) return { kind: "open", short: "영업 중", text: "24시간 영업" };
    for (const [o, c] of td) if (t >= o && t < c) {
      if (c - t <= 30 && td.some(([o2]) => o2 >= c)) return { kind: "soon", short: "곧 브레이크", text: `곧 브레이크타임 · ${fmt(c)}부터` };
      return left(c - t <= 30 ? "soon" : "open", c);
    }
    const nx = td.find(([o]) => o > t);
    if (nx) return t < td[0][0] ? { kind: "before", short: "영업 전", text: `영업 전 · ${fmt(nx[0])} 오픈` } : { kind: "break", short: "브레이크타임", text: `브레이크타임 · ${fmt(nx[0])} 다시 열어요` };
    return { kind: "closed", short: "영업 종료", text: "영업 종료" };
  }
  // 그 요일 점심시간(start~end, 분)에 계속 열려 있나: true / false / null(정보 없음)
  function lunchOK(h, di, s, e) {
    if (!has(h)) return null;
    return ranges(h[DAYS[di]]).some(([o, c]) => o <= s && c >= e);
  }

  // 오픈스트리트맵 opening_hours → 요일별 값. 못 읽는 규칙(공휴일·월·해 뜨는 시각 등)은 건너뛰고, 하나도 못 읽으면 null
  function parseOSM(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    if (/^24\/7$/.test(s)) return Object.fromEntries(DAYS.map((d) => [d, "00:00-24:00"]));
    s = s.replace(/"[^"]*"/g, "").replace(/\|\|/g, ";").replace(/(\d)\s*,\s*(?=(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, "$1;");
    const D = "(?:Mo|Tu|We|Th|Fr|Sa|Su)", DR = `${D}(?:\\s*-\\s*${D})?`;
    const reDays = new RegExp(`^(${DR}(?:\\s*,\\s*${DR})*)(?:\\s*,\\s*PH)?\\s*:?\\s*(.*)$`);
    const out = {}; let any = false, first = true;
    for (let rule of s.split(";")) {
      rule = rule.trim();
      if (!rule || /^(PH|SH)\b/.test(rule) || /\[|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|easter|sunrise|sunset|dawn|dusk)\b/.test(rule)) continue;
      const m = reDays.exec(rule);
      let days = [0, 1, 2, 3, 4, 5, 6], rest = rule, ok = true;
      if (m) {
        days = [];
        for (const part of m[1].split(",")) {
          const [a, b] = part.split("-").map((x) => OSMD.indexOf(x.trim()));
          if (a < 0 || (b !== undefined && b < 0)) { ok = false; break; }
          if (b === undefined) days.push(a); else for (let i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { days.push(i); if (i === b) break; }
        }
        rest = m[2];
      }
      if (!ok) continue;
      rest = rest.trim();
      let val;
      if (/^(off|closed)$/i.test(rest)) val = "";
      else {
        const rs = rest.split(/\s*,\s*/).map((r) => { const x = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/.exec(r); return x && +x[1] <= 30 && +x[3] <= 30 ? `${pad(+x[1])}:${x[2]}-${pad(+x[3])}:${x[4]}` : null; });
        if (!rs.length || rs.some((r) => !r)) continue;
        val = rs.slice(0, 4).join(",");
      }
      // 첫 규칙에 요일이 있으면 나머지 요일은 쉬는 날 (오픈스트리트맵 규칙), 뒤 규칙이 앞 규칙을 덮어씀
      if (first) { first = false; if (m) DAYS.forEach((d) => (out[d] = "")); }
      days.forEach((i) => (out[DAYS[i]] = val)); any = true;
    }
    if (!any) return null;
    DAYS.forEach((d) => { if (!(d in out)) out[d] = ""; });
    return out;
  }

  // 가게 이름 비교용: 괄호·띄어쓰기·기호 빼고, 맨 끝 "○○점"(지점 이름) 빼기
  const norm = (s) => {
    const w = String(s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").trim().split(/\s+/);
    if (w.length > 1 && /점$/.test(w[w.length - 1])) w.pop();
    return w.join("").replace(/[^0-9a-z가-힣]/g, "");
  };
  const dist = (a, b, c, d) => { const R = 6371000, r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.hypot(x, y) * R; };
  // 우리 가게 ↔ 오픈스트리트맵 항목: 이름이 같으면 150m 안, 한쪽 이름이 다른 쪽을 품으면(3글자 이상) 80m 안
  function match(place, items) {
    const a = norm(place.name);
    if (a.length < 2) return null;
    let best = null;
    for (const it of items || []) {
      const d = dist(+place.lat, +place.lng, +it.lat, +it.lng);
      if (!(d <= 150)) continue;
      let sc = 0;
      for (const nm of [it.n, it.ko]) {
        const b = norm(nm); if (!b) continue;
        if (a === b) sc = Math.max(sc, 3);
        else if (d <= 80 && Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))) sc = Math.max(sc, 2);
      }
      if (sc && (!best || sc > best.sc || (sc === best.sc && d < best.d))) best = { it, sc, d: Math.round(d) };
    }
    return best;
  }

  const api = { DAYS, KO, mins, fmt, ranges, has, pretty, status, lunchOK, parseOSM, norm, match, dayIdx };
  if (typeof window !== "undefined") window.Hours = api;
  if (typeof module !== "undefined") module.exports = api;
})();
