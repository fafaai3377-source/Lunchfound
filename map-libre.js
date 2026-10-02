// 카카오 JavaScript 키가 아직 없을 때 쓰는 대체 지도 (MapLibre + OpenFreeMap, 무료·키 없음)
// config.js에 kakaoJsKey를 넣으면 자동으로 카카오맵(map-kakao.js)이 쓰여요.
(function () {
  if (window.CONFIG && window.CONFIG.kakaoJsKey) return;   // 카카오 키가 있으면 아무것도 안 함
  const CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css";
  const JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js";
  const STYLE = "https://tiles.openfreemap.org/styles/liberty";
  let map, office, routeAnim = 0;

  const load = () => new Promise((resolve, reject) => {
    if (window.maplibregl) return resolve();
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS; document.head.appendChild(l);
    const s = document.createElement("script"); s.src = JS; s.onload = resolve; s.onerror = () => reject(new Error("MAP_LOAD_FAIL")); document.head.appendChild(s);
  });

  // 카카오맵과 비슷한 차분한 색 (밝은 바탕 · 베이지 회색 건물 · 흰 도로), 식당 아이콘은 숨김(우리 핀과 겹치지 않게)
  function tint() {
    const P = (id, k, v) => { try { map.setPaintProperty(id, k, v); } catch {} };
    for (const l of map.getStyle().layers) {
      const id = l.id;
      try {
        if (/^poi_r/.test(id) || id === "building-3d") { map.setLayoutProperty(id, "visibility", "none"); continue; }
        if (id === "building") { map.setLayerZoomRange(id, 13, 24); P(id, "fill-color", "#EAE7E1"); P(id, "fill-outline-color", "#DAD6CE"); }
        if (l.type === "background" || id === "landuse_residential") P(id, l.type === "background" ? "background-color" : "fill-color", "#F5F4F1");
        if (/park|grass|wood|pitch/.test(id) && l.type === "fill") P(id, "fill-color", "#D9ECCF");
        if (id === "water") P(id, "fill-color", "#BFDDF5");
        if (l.type === "line" && /^(road|bridge)_.*casing/.test(id)) P(id, "line-color", "#DEDBD5");
        if (l.type === "symbol" && l.layout && l.layout["text-field"] && JSON.stringify(l.layout["text-field"]).includes("name"))
          map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:ko"], ["get", "name"]]);
      } catch {}
    }
  }

  async function init(el, center, onTap) {
    await load();
    office = center;
    map = new maplibregl.Map({ container: el, style: STYLE, center: [center.lng, center.lat], zoom: 16.5, minZoom: 13, maxZoom: 19.5,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    map.touchZoomRotate.disableRotation();
    await new Promise((r) => map.once("load", r));
    tint();
    // PC: 왼쪽 목록(400px)이 가리지 않도록 지도 중심을 오른쪽 영역 가운데로
    const pad = () => map.setPadding({ left: matchMedia("(min-width: 900px)").matches ? 412 : 0, top: 0, right: 0, bottom: 0 });
    pad(); map.jumpTo({ center: [center.lng, center.lat] }); addEventListener("resize", pad);
    map.on("click", (e) => onTap(e.lngLat.lat, e.lngLat.lng));
    const far = () => el.classList.toggle("far", map.getZoom() < 15.6);
    map.on("zoom", far); far();
  }
  function add(node, lat, lng, anchor = "bottom") {
    const m = new maplibregl.Marker({ element: node, anchor: anchor === "center" ? "center" : "bottom" }).setLngLat([lng, lat]).addTo(map);
    return { remove: () => m.remove(), front: (on) => (node.style.zIndex = on ? 10 : "") };
  }
  const focus = (lat, lng, offX = 0, offY = 0) => map.easeTo({ center: [lng, lat], offset: [offX, offY], duration: 450 });
  const zoom = (dir) => map.easeTo({ zoom: map.getZoom() + (dir > 0 ? 1 : -1), duration: 250 });
  const home = () => map.easeTo({ center: [office.lng, office.lat], zoom: 16.5, duration: 450 });
  const setAdding = (on) => (map.getCanvas().style.cursor = on ? "crosshair" : "");

  // 도보 경로: 흰 테두리 + 파란 선, 사옥에서부터 그려짐
  function clearRoute() {
    cancelAnimationFrame(routeAnim);
    for (const id of ["route-line", "route-casing"]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource("route")) map.removeSource("route");
  }
  function showRoute(path, pad = {}) {
    clearRoute();
    const coords = path.map(([a, o]) => [o, a]);
    const data = (n) => ({ type: "Feature", geometry: { type: "LineString", coordinates: coords.slice(0, Math.max(2, n)) } });
    map.addSource("route", { type: "geojson", data: data(2) });
    map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#007AFF", "line-width": 5 } });
    const t0 = performance.now(), D = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 600;
    const step = (now) => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); map.getSource("route")?.setData(data(Math.ceil(e * coords.length))); if (k < 1) routeAnim = requestAnimationFrame(step); };
    routeAnim = requestAnimationFrame(step);
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(b, { padding: { top: pad.top || 60, right: pad.right || 40, bottom: pad.bottom || 60, left: pad.left || 40 }, maxZoom: 18, duration: 520 });
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

  window.MapKit = { init, add, focus, zoom, home, setAdding, search, showRoute, clearRoute, attribution: "" };
})();
