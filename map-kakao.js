// 카카오맵 어댑터 — 앱은 MapKit의 함수만 사용해요 (미리보기 버전은 같은 이름의 이미지 지도 어댑터를 씀)
window.MapKit = (function () {
  let map, office;

  function load(key) {
    return new Promise((resolve, reject) => {
      if (window.kakao?.maps?.load) return kakao.maps.load(resolve);
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
      s.onload = () => kakao.maps.load(resolve);
      s.onerror = () => reject(new Error("KAKAO_LOAD_FAIL"));
      document.head.appendChild(s);
    });
  }

  async function init(el, center, onTap) {
    if (!CONFIG.kakaoJsKey) throw new Error("NO_KAKAO_KEY");
    await load(CONFIG.kakaoJsKey);
    office = center;
    map = new kakao.maps.Map(el, { center: new kakao.maps.LatLng(center.lat, center.lng), level: 3 });
    kakao.maps.event.addListener(map, "click", (e) => onTap(e.latLng.getLat(), e.latLng.getLng()));
    // 멀리 볼 때(레벨 5 이상)는 핀 이름표를 숨겨서 겹치지 않게
    const far = () => el.classList.toggle("far", map.getLevel() >= 5);
    kakao.maps.event.addListener(map, "zoom_changed", far); far();
  }

  // anchor: "bottom" = 요소의 아래 가운데가 좌표 / "center" = 요소 중앙이 좌표
  function add(el, lat, lng, anchor = "bottom") {
    const ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(lat, lng), content: el, clickable: true,
      xAnchor: 0.5, yAnchor: anchor === "center" ? 0.5 : 1, zIndex: anchor === "center" ? 5 : 3,
    });
    ov.setMap(map);
    return { remove: () => ov.setMap(null), front: (on) => ov.setZIndex(on ? 10 : 3) };
  }

  // 좌표가 화면 중앙에서 (offX, offY)만큼 떨어진 곳에 오도록 이동
  function focus(lat, lng, offX = 0, offY = 0) {
    const proj = map.getProjection();
    const pt = proj.containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
    map.panTo(proj.coordsFromContainerPoint(new kakao.maps.Point(pt.x - offX, pt.y - offY)));
  }
  const zoom = (dir) => map.setLevel(map.getLevel() + (dir > 0 ? -1 : 1), { animate: true });
  function home() { map.setLevel(3); map.panTo(new kakao.maps.LatLng(office.lat, office.lng)); }
  const setAdding = (on) => map.setCursor(on ? "crosshair" : "");

  // 가게 이름 검색 (사옥 반경 2km 우선)
  function search(query) {
    const ps = new kakao.maps.services.Places();
    return new Promise((resolve) => {
      ps.keywordSearch(query, (data, status) => {
        if (status !== kakao.maps.services.Status.OK) return resolve([]);
        resolve(data.map((d) => ({
          kakaoId: d.id, name: d.place_name, categoryRaw: d.category_name,
          address: d.road_address_name || d.address_name, lat: +d.y, lng: +d.x,
          placeUrl: d.place_url, distance: +d.distance || null,
        })));
      }, { location: new kakao.maps.LatLng(office.lat, office.lng), radius: 2000 });
    });
  }

  // 도보 경로: 흰 테두리 + 코랄 선, 화면 여백(pad)을 피해서 경로 전체가 보이도록 맞춤
  let lines = [];
  function clearRoute() { lines.forEach((l) => l.setMap(null)); lines = []; }
  function showRoute(path, pad = {}) {
    clearRoute();
    const pts = path.map(([a, o]) => new kakao.maps.LatLng(a, o));
    lines = [
      new kakao.maps.Polyline({ path: pts, strokeWeight: 9, strokeColor: "#FFFFFF", strokeOpacity: 1, strokeStyle: "solid" }),
      new kakao.maps.Polyline({ path: pts, strokeWeight: 5, strokeColor: "#007AFF", strokeOpacity: 1, strokeStyle: "solid" }),
    ];
    lines.forEach((l) => l.setMap(map));
    // 경로가 사옥에서부터 그려지는 모션 (0.6초, ease-out)
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && pts.length > 2) {
      const t0 = performance.now(), D = 600;
      const step = (now) => {
        const k2 = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k2, 3), n = Math.max(2, Math.ceil(e * pts.length));
        lines.forEach((l) => l.setPath(pts.slice(0, n)));
        if (k2 < 1 && lines.length) requestAnimationFrame(step);
      };
      lines.forEach((l) => l.setPath(pts.slice(0, 2)));
      requestAnimationFrame(step);
    }
    const b = new kakao.maps.LatLngBounds();
    pts.forEach((p) => b.extend(p));
    map.setBounds(b, pad.top || 60, pad.right || 40, pad.bottom || 60, pad.left || 40);
  }

  return { init, add, focus, zoom, home, setAdding, search, showRoute, clearRoute, attribution: "" };
})();
