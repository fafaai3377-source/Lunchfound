// ─────────────────────────────────────────────
//  사옥 주변 식당 목록 (공공데이터) — 장소 추가 검색·지도에서 찍기·주소 찾기에 써요
//  · 출처: 소상공인시장진흥공단 상가(상권)정보 (공공데이터포털, 이용허락범위 제한 없음, 분기마다 갱신)
//  · 사옥 반경 안 음식점·카페만 골라 stores.json 하나로 넣어둠 → 키 없음, 외부 호출 없음
//  · 갱신: tools/build-stores.py 로 새 분기 파일에서 다시 만들기
//  · 장소 추가 화면을 열 때 처음 한 번만 불러와요 (앱 첫 화면은 그대로 가벼움)
// ─────────────────────────────────────────────
(() => {
  let data = null, loading = null, list = [], groups = [];

  const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-_.·,()[\]'"!&@#/+:~]/g, "");
  // 초성 검색 (예: ㅇㅅㅇㅋㄱㅅ → 어서와칼국수)
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const cho = (s) => [...String(s || "")].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join("");
  const isCho = (s) => /^[ㄱ-ㅎ]+$/.test(s);

  // 도로명주소에서 "길 이름 + 건물번호"만 (예: "서울 마포구 와우산로29가길 4 1층 (서교동)" → 와우산로29가길 4)
  function parseAddr(raw) {
    const s = String(raw || "").replace(/\([^)]*\)/g, " ").replace(/[,·]/g, " ")
      .replace(/(지하\s*)?\d+\s*층|B\d+|\d+\s*호|\d+\s*번지?\s*$/gi, " ").replace(/\s+/g, " ").trim();
    const road = s.match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/);
    if (road) return { key: norm(`${road[1]}${road[2]}`), text: `${road[1]} ${road[2]}` };
    const lot = s.match(/([가-힣0-9]+동)\s*(\d+(?:-\d+)?)/);
    if (lot) return { key: norm(`${lot[1]}${lot[2]}`), text: `${lot[1]} ${lot[2]}`, lot: true };
    return null;
  }

  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dist = (a, b, c, d) => { const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

  function build(j) {
    const [oy, ox] = j.o, K = j.k.map((x) => x.split("|"));
    list = j.s.map(([name, k, dy, dx, road, lot, floor]) => {
      const [mid, sub] = K[k] || ["", ""];
      const lat = +(oy + dy / 1e5).toFixed(6), lng = +(ox + dx / 1e5).toFixed(6);
      return { name, mid, sub, road, lot, floor: floor || "", lat, lng, n: norm(name), c: cho(name.replace(/\s/g, "")), rk: norm(road), lk: norm(lot) };
    });
    // 같은 건물(같은 좌표)에 있는 가게끼리 묶음 → 지도에는 건물마다 점 하나
    const by = new Map();
    list.forEach((s, i) => { const key = `${s.lat},${s.lng}`; if (!by.has(key)) by.set(key, []); by.get(key).push(i); });
    const fl = (f) => (f === "1" ? 0 : /^(지|B|반)/i.test(f) ? 2 : f ? 1 : 3);   // 1층 먼저, 그다음 위층, 지하, 모름
    groups = [...by.values()].map((ids) => ids.sort((a, b) => fl(list[a].floor) - fl(list[b].floor)));
    groups.forEach((ids, g) => ids.forEach((i) => (list[i].g = g)));
  }

  function load() {
    if (data) return Promise.resolve(true);
    if (loading) return loading;
    loading = fetch("./stores.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((j) => { build(j); data = j; return true; })
      .catch((e) => { console.warn("stores.json", e); loading = null; return false; });
    return loading;
  }

  // 검색·주소 결과를 장소 추가 화면이 쓰는 모양으로 (MapKit.search 결과와 같은 모양)
  const out = (s) => ({ kakaoId: "", src: "sg", name: s.name, categoryRaw: `${s.mid} ${s.sub}`, sub: s.sub, address: s.road || s.lot, floor: s.floor, lat: s.lat, lng: s.lng, placeUrl: "", g: s.g });
  const fromOffice = (s) => dist(data.o[0], data.o[1], s.lat, s.lng);

  // 가게 이름 검색: 띄어쓰기 무시 · 부분 일치 · 초성 · "망원 칼국수"처럼 여러 단어(이름·종류·주소 어디든)
  function search(q, limit = 12) {
    if (!data) return [];
    const qn = norm(q), toks = String(q).trim().split(/\s+/).map(norm).filter(Boolean);
    if (!qn) return [];
    const ch = isCho(qn);
    const hits = [];
    for (const s of list) {
      let sc = 0;
      if (ch) { const at = s.c.indexOf(qn); if (at >= 0) sc = at === 0 ? 70 : 50; }
      else if (s.n === qn) sc = 100;
      else if (s.n.startsWith(qn)) sc = 85;
      else if (s.n.includes(qn)) sc = 70;
      else if (toks.length) {
        const hay = s.n + norm(s.sub) + norm(s.mid) + s.rk + s.lk;
        if (toks.every((t) => hay.includes(t))) sc = toks.some((t) => s.n.includes(t)) ? 55 : 30;
      }
      if (sc) hits.push([sc, fromOffice(s), s]);
    }
    hits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return hits.slice(0, limit).map((h) => out(h[2]));
  }

  // 붙여넣은 주소(도로명·지번)가 목록에 있는 건물이면 그 건물 위치 + 그 건물 가게들
  function atAddress(raw) {
    if (!data) return null;
    const a = parseAddr(raw);
    if (!a) return null;
    const ss = list.filter((s) => (a.lot ? s.lk : s.rk) === a.key);
    if (!ss.length) return null;
    return { lat: ss[0].lat, lng: ss[0].lng, exact: true, label: a.text, stores: groups[ss[0].g].map((i) => out(list[i])) };
  }

  // 찍은 자리 가까운 가게 (가까운 순)
  function near(lat, lng, m = 30, limit = 6) {
    if (!data) return [];
    return list.map((s) => [dist(lat, lng, s.lat, s.lng), s]).filter((x) => x[0] <= m).sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => out(x[1]));
  }
  const group = (g) => (groups[g] || []).map((i) => out(list[i]));

  // 지도에 띄울 점 (건물마다 하나, 이름은 1층 가게 + "외 N"). skip(가게)이 true인 곳(이미 등록된 곳 등)은 빼고
  function geojson(skip) {
    if (!data) return null;
    const features = [];
    groups.forEach((ids, g) => {
      const left = skip ? ids.filter((i) => !skip(out(list[i]))) : ids;
      if (!left.length) return;
      const s = list[left[0]];
      features.push({ type: "Feature", id: g, properties: { g, n: left.length, label: left.length > 1 ? `${s.name} 외 ${left.length - 1}` : s.name }, geometry: { type: "Point", coordinates: [s.lng, s.lat] } });
    });
    return { type: "FeatureCollection", features };
  }

  window.Stores = { load, ready: () => !!data, search, atAddress, near, group, geojson, norm, info: () => data && { asof: data.asof, src: data.src, count: list.length } };
})();
