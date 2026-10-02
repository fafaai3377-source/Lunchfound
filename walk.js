// 도보 길찾기: 사옥 주변 보행 도로망(walk-graph.json, OpenStreetMap)에서 사옥 → 가게 최단 경로를 계산해요.
// 사옥에서 모든 교차점까지의 거리를 처음 한 번만 계산(다익스트라)해 두고, 가게마다 경로를 바로 꺼내 써요.
window.Walk = (function () {
  const SPEED = 67; // 분당 67m = 시속 4km (카카오맵 · 네이버 지도 도보 기준과 같게)
  let ready = false, lat = [], lng = [], dist, prev, startSnap = 0, src = -1;
  const cache = new Map();
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const meters = (a1, o1, a2, o2) => { const x = rad(o2 - o1) * Math.cos(rad((a1 + a2) / 2)), y = rad(a2 - a1); return Math.sqrt(x * x + y * y) * R; };

  function build(g, office) {
    const n = g.n.length / 2;
    lat = new Float64Array(n); lng = new Float64Array(n);
    for (let i = 0; i < n; i++) { lat[i] = g.base[0] + g.n[2 * i] / 1e6; lng[i] = g.base[1] + g.n[2 * i + 1] / 1e6; }
    const adj = Array.from({ length: n }, () => []);
    for (let k = 0; k < g.e.length; k += 2) {
      const a = g.e[k], b = g.e[k + 1], w = meters(lat[a], lng[a], lat[b], lng[b]);
      adj[a].push(b, w); adj[b].push(a, w);
    }
    const s = nearest(office.lat, office.lng);
    if (s.i < 0) return;
    src = s.i; startSnap = s.d;
    dist = new Float64Array(n).fill(Infinity); prev = new Int32Array(n).fill(-1);
    dist[src] = 0;
    const heap = [[0, src]];
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      const a = adj[u];
      for (let k = 0; k < a.length; k += 2) { const v = a[k], nd = d + a[k + 1]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); } }
    }
    ready = true;
  }
  function nearest(a, o) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < lat.length; i++) { const d = meters(a, o, lat[i], lng[i]); if (d < bd) { bd = d; best = i; } }
    return { i: best, d: bd };
  }

  async function init(office) {
    try {
      const g = window.WALK_GRAPH || (await (await fetch("./walk-graph.json")).json());
      build(g, office);
    } catch (e) { console.warn("도보 길찾기 데이터를 불러오지 못했어요", e); }
  }

  // { meters, minutes, path: [[lat,lng], ...] } 또는 null(도로망 밖)
  function route(a, o) {
    if (!ready) return null;
    const key = `${a.toFixed(6)},${o.toFixed(6)}`;
    if (cache.has(key)) return cache.get(key);
    const t = nearest(a, o);
    let res = null;
    if (t.i >= 0 && t.d < 120 && isFinite(dist[t.i])) {
      const path = [[a, o]];
      for (let v = t.i; v !== -1; v = prev[v]) path.push([lat[v], lng[v]]);
      path.push([window.CONFIG.office.lat, window.CONFIG.office.lng]);
      path.reverse();
      const m = dist[t.i] + t.d + startSnap;
      res = { meters: Math.round(m), minutes: Math.max(1, Math.round(m / SPEED)), path };
    }
    cache.set(key, res);
    return res;
  }

  return { init, route, get ready() { return ready; } };
})();
