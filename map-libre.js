// 카카오 JavaScript 키가 아직 없을 때 쓰는 대체 지도 (MapLibre + OpenFreeMap, 무료·키 없음)
// config.js에 kakaoJsKey를 넣으면 자동으로 카카오맵(map-kakao.js)이 쓰여요.
(function () {
  if (window.CONFIG && window.CONFIG.kakaoJsKey) return;   // 카카오 키가 있으면 아무것도 안 함
  // 지도 라이브러리: 우리 사이트(vendor/)에 둔 파일을 먼저 쓰고, 안 되면 외부 CDN 두 곳에서 차례로 시도
  // (외부 CDN 하나가 느리거나 막혀도 지도가 안 뜨는 일이 없게)
  const VER = "4.7.1";
  const BASES = [`./vendor/maplibre-gl-${VER}/`, `https://cdn.jsdelivr.net/npm/maplibre-gl@${VER}/dist/`, `https://unpkg.com/maplibre-gl@${VER}/dist/`];
  const STYLE = "https://tiles.openfreemap.org/styles/liberty";
  let map, office, routeAnim = 0, libP = null;

  const script = (src, ms) => new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = src;
    const t = setTimeout(() => { s.onload = s.onerror = null; reject(new Error("TIMEOUT")); }, ms);
    s.onload = () => { clearTimeout(t); window.maplibregl ? resolve() : reject(new Error("NO_LIB")); };
    s.onerror = () => { clearTimeout(t); s.remove(); reject(new Error("ERR")); };
    document.head.appendChild(s);
  });
  const load = () => libP || (libP = (async () => {
    for (const base of BASES) {
      if (window.maplibregl) break;
      try { await script(base + "maplibre-gl.js", 12000); } catch { continue; }
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "maplibre-gl.css"; document.head.appendChild(l);
    }
    if (!window.maplibregl) { libP = null; throw new Error("MAP_LOAD_FAIL"); }
  })());

  // 이 브라우저에서 지도 그래픽(WebGL)을 켤 수 있는지 미리 확인 — 그래픽 가속이 멈춘 상태면 지도를 그릴 수 없음
  function webglOK() {
    try {
      const c = document.createElement("canvas"), gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();   // 확인용으로 만든 건 바로 반납
      return true;
    } catch { return false; }
  }

  // ───────── 지도 종류: 그래픽(기본) · 일반 · 위성 ─────────
  // 그래픽 = 카카오맵과 비슷한 차분한 색(밝은 바탕 · 베이지 회색 건물 · 흰 도로) + 식당 아이콘 숨김(우리 핀과 겹치지 않게)
  // 일반 = 같은 지도 데이터를 원래 색 그대로 (상점 아이콘·이름까지) — 추가로 받는 데이터 없음
  // 위성 = 항공사진 위에 길·장소 이름 글자만 (config.js의 vworldKey가 있을 때만)
  const orig = new Map();   // 그래픽 색을 입히기 전 원래 값 (일반 지도로 돌릴 때 씀)
  const keep = (key, get) => { if (!orig.has(key)) { try { orig.set(key, get()); } catch { orig.set(key, undefined); } } };
  function tint() {
    const P = (id, k, v) => { keep(`${id}|p|${k}`, () => map.getPaintProperty(id, k)); try { map.setPaintProperty(id, k, v); } catch {} };
    const V = (id, v) => { keep(`${id}|v`, () => map.getLayoutProperty(id, "visibility") || "visible"); try { map.setLayoutProperty(id, "visibility", v); } catch {} };
    for (const l of map.getStyle().layers) {
      const id = l.id;
      try {
        if (/^poi_r/.test(id) || id === "building-3d") { V(id, "none"); continue; }
        if (id === "building") { const L = map.getLayer(id); keep(`${id}|z`, () => [L.minzoom ?? 0, L.maxzoom ?? 24]); map.setLayerZoomRange(id, 13, 24); P(id, "fill-color", "#EAE7E1"); P(id, "fill-outline-color", "#DAD6CE"); }
        if (l.type === "background" || id === "landuse_residential") P(id, l.type === "background" ? "background-color" : "fill-color", "#F5F4F1");
        if (/park|grass|wood|pitch/.test(id) && l.type === "fill") P(id, "fill-color", "#D9ECCF");
        if (id === "water") P(id, "fill-color", "#BFDDF5");
        if (l.type === "line" && /^(road|bridge)_.*casing/.test(id)) P(id, "line-color", "#DEDBD5");
        // 글자는 어느 지도든 한국어 이름 먼저
        if (l.type === "symbol" && l.layout && l.layout["text-field"] && JSON.stringify(l.layout["text-field"]).includes("name"))
          map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:ko"], ["get", "name"]]);
      } catch {}
    }
  }
  function untint() {
    for (const [key, v] of orig) {
      const [id, kind, prop] = key.split("|");
      if (!map.getLayer(id) || id === "building-3d") continue;   // 입체 건물은 위에서 내려다보는 지도에선 회색 덩어리로만 보여서 항상 숨김
      try {
        if (kind === "p") map.setPaintProperty(id, prop, v === undefined ? null : v);
        else if (kind === "v") map.setLayoutProperty(id, "visibility", v || "visible");
        // 건물 표시 범위(z)는 되돌리지 않음: 원래 스타일은 가까이 보면 입체 건물로 바뀌는데, 입체 건물은 숨겨 두므로 납작한 건물을 계속 보여줌
      } catch {}
    }
  }

  async function init(el, center, onTap, onLost) {
    office = center;   // 검색·주소 찾기는 지도가 안 떠도 쓸 수 있게 먼저
    await load();
    if (!webglOK()) throw new Error("NO_WEBGL");
    let m;
    try {
      m = new maplibregl.Map({ container: el, style: STYLE, center: [center.lng, center.lat], zoom: 16.5, minZoom: 13, maxZoom: 19.5,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    } catch (e) { throw new Error(/webgl/i.test(String(e?.message || e)) ? "NO_WEBGL" : "MAP_INIT_FAIL"); }
    // 지도 스타일·타일 서버가 15초 안에 응답하지 않으면 멈춰 있지 말고 실패로 알림 (다시 시도 버튼이 뜸)
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error("MAP_TIMEOUT")), 15000);
        // 지도 스타일 자체를 못 받으면 15초 기다리지 않고 바로 실패 (스타일을 받은 뒤의 타일 한두 장 실패는 무시)
        let gotStyle = false;
        m.once("styledata", () => (gotStyle = true));
        const onErr = (ev) => { if (gotStyle && !String(ev?.error?.url || "").includes("/styles/")) return; clearTimeout(t); m.off("error", onErr); rej(new Error("MAP_STYLE_FAIL")); };
        m.on("error", onErr);
        m.once("load", () => { clearTimeout(t); m.off("error", onErr); res(); });
      });
    } catch (e) { try { m.remove(); } catch {} throw e; }
    map = m;
    map.touchZoomRotate.disableRotation();
    // 쓰는 중에 그래픽이 끊기면(다른 탭이 그래픽을 많이 쓰거나 드라이버가 재시작) 지도가 스스로 복구를 시도 — 4초 안에 못 돌아오면 알림
    let lostT = 0;
    map.on("webglcontextlost", () => { clearTimeout(lostT); lostT = setTimeout(() => onLost?.(), 4000); });
    map.on("webglcontextrestored", () => clearTimeout(lostT));
    tint();
    // PC: 왼쪽 목록(400px)이 가리지 않도록 지도 중심을 오른쪽 영역 가운데로
    const pad = () => map.setPadding({ left: matchMedia("(min-width: 900px)").matches ? 412 : 0, top: 0, right: 0, bottom: 0 });
    pad(); map.jumpTo({ center: [center.lng, center.lat] }); addEventListener("resize", pad);
    map.on("click", (e) => {
      // 장소 추가 중 식당 점(또는 이름)을 누르면 그 가게를 고른 것으로 — 빈 곳을 누르면 지금처럼 그 자리에 찍기
      if (storePick && map.getLayer("stores-dot")) {
        const p = e.point, r = 12;
        const hits = map.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers: ["stores-dot", "stores-label"] });
        if (hits.length) {
          const best = hits.map((f) => { const q = map.project(f.geometry.coordinates); return [Math.hypot(q.x - p.x, q.y - p.y), f]; }).sort((a, b) => a[0] - b[0])[0][1];
          return storePick(best.properties.g);
        }
      }
      onTap(e.lngLat.lat, e.lngLat.lng);
    });
    const far = () => el.classList.toggle("far", map.getZoom() < 15.6);
    map.on("zoom", far); far();
  }
  // ───────── 위성 지도 (실제 항공사진) ─────────
  // 사진: 브이월드(국토교통부 공간정보 오픈플랫폼) 항공사진 — config.js의 vworldKey(무료 인증키, 사이트 주소 등록 필요)가 있어야 켜짐
  // 위에 길 이름·장소 이름 글자와 큰길만 반투명하게 겹쳐서 보여줌
  function satSource() {
    const C = window.CONFIG || {};
    if (C.vworldKey) return { type: "raster", tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${C.vworldKey}/Satellite/{z}/{y}/{x}.jpeg`], tileSize: 256, maxzoom: 19, attribution: "항공사진 © 국토교통부 브이월드" };
    if (C.satelliteTiles) return { type: "raster", tiles: [C.satelliteTiles], tileSize: 256, maxzoom: 19, attribution: C.satelliteAttribution || "" };
    return null;
  }
  const SAT_ROADS = /^(road|bridge)_(minor|street|secondary_tertiary|trunk_primary|link|motorway)$/;
  let satOn = false, satSaved = null;
  function setSatellite(on) {
    if (!map) return false;
    on = !!on;
    if (on === satOn) return true;
    if (on && !satSource()) return false;
    satOn = on;
    if (on) {
      if (!map.getSource("sat")) map.addSource("sat", satSource());
      if (!map.getLayer("sat")) {
        const firstAbove = map.getStyle().layers.find((l) => l.type !== "background")?.id;   // 바탕색 바로 위 = 모든 지도 그림 아래
        map.addLayer({ id: "sat", type: "raster", source: "sat", paint: { "raster-fade-duration": 200 } }, firstAbove);
      }
      map.setLayoutProperty("sat", "visibility", "visible");
      // 지도 그림(면·선)은 숨기고 글자만 남김. 큰길은 흰 선을 반투명하게 → 사진 위에서도 길이 보이게
      satSaved = [];
      for (const l of map.getStyle().layers) {
        if (l.id === "sat" || l.id.startsWith("route") || l.id.startsWith("stores") || l.type === "symbol" || l.type === "background") continue;
        const vis = map.getLayoutProperty(l.id, "visibility") || "visible";
        if (l.type === "line" && SAT_ROADS.test(l.id)) { satSaved.push({ id: l.id, op: map.getPaintProperty(l.id, "line-opacity") }); map.setPaintProperty(l.id, "line-opacity", 0.35); continue; }
        if (vis !== "none") { satSaved.push({ id: l.id, vis }); map.setLayoutProperty(l.id, "visibility", "none"); }
      }
    } else {
      if (map.getLayer("sat")) map.setLayoutProperty("sat", "visibility", "none");
      for (const s of satSaved || []) {
        if ("op" in s) map.setPaintProperty(s.id, "line-opacity", s.op ?? null);
        else map.setLayoutProperty(s.id, "visibility", s.vis);
      }
      satSaved = null;
    }
    return true;
  }
  // 지도 종류 바꾸기: "graphic" | "normal" | "satellite" (위성 키가 없으면 false)
  let mode = "graphic";
  function setMode(next) {
    if (!map) return false;
    if (next === "satellite" && !satSource()) return false;
    setSatellite(false);
    if (next === "normal") untint(); else tint();
    if (next === "satellite") setSatellite(true);
    mode = next;
    return true;
  }
  const satelliteReady = () => !!satSource();

  // 아래 함수들은 지도가 아직 준비 전이거나 못 떴을 때 아무 일도 하지 않음 (목록·기록은 지도와 상관없이 먼저 쓸 수 있음)
  function add(node, lat, lng, anchor = "bottom") {
    if (!map) return { remove() {}, front() {} };
    const m = new maplibregl.Marker({ element: node, anchor: anchor === "center" ? "center" : "bottom" }).setLngLat([lng, lat]).addTo(map);
    return { remove: () => m.remove(), front: (on) => (node.style.zIndex = on ? 10 : "") };
  }
  const focus = (lat, lng, offX = 0, offY = 0) => map?.easeTo({ center: [lng, lat], offset: [offX, offY], duration: 450 });
  const zoom = (dir) => map?.easeTo({ zoom: map.getZoom() + (dir > 0 ? 1 : -1), duration: 250 });
  const home = (offY = 0, instant) => map?.easeTo({ center: [office.lng, office.lat], zoom: 16.5, offset: [0, offY], duration: instant ? 0 : 600 });   // jumpTo는 offset을 무시해서 easeTo(0초)
  const setAdding = (on) => { if (map) map.getCanvas().style.cursor = on ? "crosshair" : ""; };

  // ───────── 장소 추가 중에만: 주변 식당(공공데이터 상가정보)을 점 + 이름으로 ─────────
  // 건물마다 점 하나, 가까이 보면 이름. 누르면 storePick(그룹 번호)
  let storePick = null;
  function showStores(fc, onPick) {
    if (!map) return false;
    const ids = ["stores-label", "stores-dot"];
    if (!fc) { storePick = null; for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none"); return true; }
    storePick = onPick;
    if (map.getSource("stores")) map.getSource("stores").setData(fc);
    else map.addSource("stores", { type: "geojson", data: fc });
    if (!map.getLayer("stores-dot")) {
      const font = map.getStyle().layers.find((l) => l.type === "symbol" && l.layout?.["text-font"])?.layout["text-font"] || ["Noto Sans Regular"];
      map.addLayer({ id: "stores-dot", type: "circle", source: "stores", minzoom: 15,
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 2.5, 17, 4.5, 19, 6], "circle-color": "#DA2C23", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5, "circle-opacity": 0.9 } });
      map.addLayer({ id: "stores-label", type: "symbol", source: "stores", minzoom: 16.6,
        layout: { "text-field": ["get", "label"], "text-font": font, "text-size": 11.5, "text-offset": [0, 0.75], "text-anchor": "top", "text-max-width": 8, "text-optional": true, "symbol-sort-key": ["-", 0, ["get", "n"]] },
        paint: { "text-color": "#3A2A28", "text-halo-color": "#fff", "text-halo-width": 1.6 } });
    }
    for (const id of ids) map.setLayoutProperty(id, "visibility", "visible");
    return true;
  }

  // 도보 경로: 흰 테두리 + 포인트 색 선, 사옥에서부터 그려짐
  // ───────── 도보 경로: 모션그래픽처럼 천천히 그려지는 그라데이션 선 ─────────
  // 1) 카메라가 경로로 부드럽게 이동 → 2) 사옥에서 가게까지 거리 기준으로 일정하게, ease-in-out으로 그림
  // 색: 사옥(연한 포인트 색) → 가게(진한 포인트 색) 그라데이션 + 뒤에 은은한 빛 번짐 → 3) 도착지에 물결 한 번
  // 색은 styles.css의 포인트 색 변수에서 읽음 (레드 #F5ADA8 → #DA2C23, 블루 #9FD0FF → #007AFF, 흑백 #B4B4B9 → #1D1D1F). 내 정보에서 바꾸면 바로 다시 칠함
  let C_FROM = "#F5ADA8", C_TO = "#DA2C23", NONE = "rgba(218,44,35,0)";
  const readAccent = () => {
    const cs = getComputedStyle(document.documentElement), v = (k, d) => cs.getPropertyValue(k).trim() || d;
    C_FROM = v("--accent-soft", "#F5ADA8"); C_TO = v("--accent-map", "#DA2C23"); NONE = `rgba(${v("--accent-map-rgb", "218, 44, 35")}, 0)`;
  };
  let routeP = 0;
  document.addEventListener("accentchange", () => {
    readAccent();
    if (!map || !map.getLayer("route-line")) return;
    map.setPaintProperty("route-line", "line-gradient", grad(routeP, C_FROM, C_TO));
    map.setPaintProperty("route-glow", "line-gradient", grad(routeP, C_FROM, C_TO));
  });
  let arrive = null;
  function clearRoute() {
    if (!map) return;
    cancelAnimationFrame(routeAnim);
    for (const id of ["route-glow", "route-line", "route-casing"]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource("route")) map.removeSource("route");
    arrive?.remove(); arrive = null;
  }
  const mix = (a, b, t) => { const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); const x = h(a), y = h(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; };
  // 지금까지 그린 비율 p만큼만 보이게: 0 → 연한색, p → (연한색~파랑 사이 그 지점 색), p 직후부터 투명
  const grad = (p, from, to) => p <= 0.0005 ? ["interpolate", ["linear"], ["line-progress"], 0, NONE, 1, NONE]
    : p >= 0.9995 ? ["interpolate", ["linear"], ["line-progress"], 0, from, 1, to]
    : ["interpolate", ["linear"], ["line-progress"], 0, from, p, to === "#fff" ? "#fff" : mix(from, to, p), Math.min(0.9999, p + 0.0005), NONE, 1, NONE];
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  let lastCoords = null;
  // 이미 그린 경로를 다시 그리지 않고 화면만 맞춤 (모바일: 카드 → 자세히 보기로 시트가 올라올 때)
  function fitRoute(pad = {}) {
    if (!map || !lastCoords || !map.getLayer("route-line")) return;
    const b = lastCoords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(lastCoords[0], lastCoords[0]));
    map.fitBounds(b, { padding: { top: pad.top || 60, right: pad.right || 40, bottom: pad.bottom || 60, left: pad.left || 40 }, maxZoom: 18, duration: 500 });
  }
  function showRoute(path, pad = {}) {
    if (!map) return;
    clearRoute();
    readAccent(); routeP = 0;
    const coords = path.map(([a, o]) => [o, a]);
    lastCoords = coords;
    if (coords.length < 2) return;
    map.addSource("route", { type: "geojson", lineMetrics: true, data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } } });
    const L = { "line-cap": "round", "line-join": "round" };
    map.addLayer({ id: "route-glow", type: "line", source: "route", layout: L, paint: { "line-width": 18, "line-blur": 10, "line-opacity": 0.35, "line-gradient": grad(0, C_FROM, C_TO) } });
    map.addLayer({ id: "route-casing", type: "line", source: "route", layout: L, paint: { "line-width": 10, "line-gradient": grad(0, "#fff", "#fff") } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: L, paint: { "line-width": 5.5, "line-gradient": grad(0, C_FROM, C_TO) } });
    const set = (p) => {
      if (!map.getLayer("route-line")) return;
      routeP = p;
      map.setPaintProperty("route-line", "line-gradient", grad(p, C_FROM, C_TO));
      map.setPaintProperty("route-glow", "line-gradient", grad(p, C_FROM, C_TO));
      map.setPaintProperty("route-casing", "line-gradient", grad(p, "#fff", "#fff"));
    };
    // 거리(m)에 비례해서 1.6~2.6초 — 가까운 곳도 너무 빨리 끝나지 않게
    let meters = 0;
    for (let i = 1; i < coords.length; i++) meters += new maplibregl.LngLat(...coords[i - 1]).distanceTo(new maplibregl.LngLat(...coords[i]));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const D = reduce ? 1 : Math.min(2600, 1600 + meters * 1.5), DELAY = reduce ? 0 : 480;
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(b, { padding: { top: pad.top || 60, right: pad.right || 40, bottom: pad.bottom || 60, left: pad.left || 40 }, maxZoom: 18, duration: reduce ? 0 : 700, essential: true });
    const t0 = performance.now() + DELAY;
    const step = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / D));
      set(easeInOut(k));
      if (k < 1) { routeAnim = requestAnimationFrame(step); return; }
      // 도착: 가게 위치에 포인트 색 물결 한 번
      const el = document.createElement("div"); el.className = "route-arrive";
      arrive = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(coords[coords.length - 1]).addTo(map);
      setTimeout(() => { arrive?.remove(); arrive = null; }, 1400);
    };
    routeAnim = requestAnimationFrame(step);
  }

  // 가게 이름 검색: OpenStreetMap(Nominatim)에서 사옥 주변 2km 안
  async function search(q) {
    const d = 0.018, vb = [office.lng - d, office.lat + d, office.lng + d, office.lat - d].join(",");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ko&countrycodes=kr&limit=12&bounded=1&viewbox=${vb}&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      return j.map((x) => ({ kakaoId: "osm-" + x.osm_type + x.osm_id, name: x.name || String(x.display_name).split(",")[0], categoryRaw: [x.type, x.category].join(" "),
        address: String(x.display_name).split(",").slice(1, 3).join(" ").trim(), lat: +x.lat, lng: +x.lon, placeUrl: "" }));
    } catch { return []; }
  }

  // 주소 → 좌표 (OpenStreetMap, 키 없음)
  // 네이버·카카오에서 복사한 주소("서울 마포구 와우산로29가길 4 1층 (서교동)")에서 도로명+건물번호만 뽑아 찾고,
  // 도로명이 같은 결과만 인정 — 엉뚱한 곳으로 튀지 않게. 결과: { lat, lng, exact, label } 또는 null
  function parseAddr(raw) {
    const s = String(raw).replace(/\([^)]*\)/g, " ").replace(/[,·]/g, " ")
      .replace(/(지하\s*)?\d+\s*층|B\d+|\d+\s*호|\d+\s*번지?\s*$/gi, " ").replace(/\s+/g, " ").trim();
    const road = s.match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/);
    if (road) return { road: road[1], num: road[2], text: `${road[1]} ${road[2]}` };
    const lot = s.match(/([가-힣]+동)\s*(\d+(?:-\d+)?)/);
    if (lot) return { dong: lot[1], num: lot[2], text: `${lot[1]} ${lot[2]}` };
    return { text: s };
  }
  const distM = (lat, lng) => { const R = 6371000, r = (x) => (x * Math.PI) / 180, a = Math.sin(r(lat - office.lat) / 2) ** 2 + Math.cos(r(office.lat)) * Math.cos(r(lat)) * Math.sin(r(lng - office.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
  async function nom(params) {
    const d = 0.03, vb = [office.lng - d, office.lat + d, office.lng + d, office.lat - d].join(",");
    const q = new URLSearchParams({ format: "jsonv2", addressdetails: "1", "accept-language": "ko", countrycodes: "kr", limit: "10", viewbox: vb, ...params });
    try { const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`); return (await r.json()).filter((x) => distM(+x.lat, +x.lon) < 3000); } catch { return []; }
  }
  async function geocode(raw) {
    const a = parseAddr(raw);
    const pick = (x, exact) => ({ lat: +x.lat, lng: +x.lon, exact, label: [x.address?.road, x.address?.house_number].filter(Boolean).join(" ") || a.text });
    if (a.road) {
      let list = await nom({ street: `${a.num} ${a.road}`, city: "서울" });
      if (!list.length) list = await nom({ q: `서울 ${a.road} ${a.num}` });
      const same = list.filter((x) => (x.address?.road || "").replace(/\s/g, "") === a.road);
      const hit = same.find((x) => x.address?.house_number === a.num);
      if (hit) return pick(hit, true);
      // 본번이 같은 바로 옆 건물(예: 32 → 32-15)까지만 "근처"로 인정
      const main = a.num.split("-")[0];
      const near = same.find((x) => String(x.address?.house_number || "").split("-")[0] === main);
      if (near) return pick(near, false);
      // 그 밖엔 자동으로 찍지 않음 — 길 위치만 알려줘서 지도를 그 근처로 옮겨주는 용도
      const roadPt = same[0] || (await nom({ street: a.road, city: "서울" })).find((x) => (x.address?.road || "").replace(/\s/g, "") === a.road);
      return roadPt ? { roadOnly: true, lat: +roadPt.lat, lng: +roadPt.lon, label: a.road } : null;
    }
    if (a.dong) {   // 지번 주소: 지도 데이터에 거의 없음 → 정확히 맞을 때만
      const list = await nom({ q: `서울 ${a.text}` });
      const hit = list.find((x) => x.address?.house_number === a.num);
      return hit ? pick(hit, true) : null;
    }
    return null;
  }

  // 좌표 → 가까운 도로명 주소 (지도에서 직접 찍었을 때 주소칸 자동 채우기)
  async function reverse(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ko&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
      const a = (await r.json()).address || {};
      return [a.road, a.house_number].filter(Boolean).join(" ") || "";
    } catch { return ""; }
  }

  const project = (lat, lng) => (map ? map.project([lng, lat]) : null);   // 위경도 → 화면 좌표 (확인용)
  const setZoom = (z) => map?.jumpTo({ zoom: z });
  window.MapKit = { init, add, focus, zoom, home, setAdding, showStores, project, setZoom, search, geocode, reverse, showRoute, clearRoute, fitRoute, setSatellite, setMode, satelliteReady, getMode: () => mode, attribution: "" };
})();
