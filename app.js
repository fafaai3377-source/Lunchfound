// Lunchfound — 앱 로직. 지도는 MapKit(카카오 또는 미리보기 이미지), 데이터는 createStore()를 씀
(function () {
  const C = window.CONFIG, MEMBERS = window.MEMBERS;

  // ───────── 도구 ─────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;
  const ago = (t) => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "오늘" : d === 1 ? "어제" : d < 30 ? `${d}일 전` : new Date(t).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }); };
  const desk = () => matchMedia("(min-width: 900px)").matches;
  const PALETTE = ["#FF9F0A", "#30B0C7", "#5E5CE6", "#34C759", "#FF375F", "#AC8E68", "#0A84FF", "#BF5AF2", "#FF6B3D", "#64A36F"];
  const hue = () => "#48484A"; // 아바타는 진한 회색 하나로 (강조색은 코랄만)
  // 프로필: 예약 서비스와 같은 {이름}.png 파일을 avatars/ 폴더에서 불러오고, 없으면 첫 글자로
  const photoOf = (name) => (C.avatarBase && member(name) ? `${C.avatarBase}${encodeURIComponent(name)}.png` : "");
  const avatar = (name, sm) => { const src = photoOf(name);
    return `<span class="avatar${sm ? " sm" : ""}" style="background:${hue(name)}">${esc(String(name).charAt(0))}${src ? `<img src="${src}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}</span>`; };
  const member = (name) => MEMBERS.find((m) => m.name === name);
  // 관리자(이름 "admin" + 관리자 비밀번호): 누가 등록했든 장소·기록 삭제, 장소 정보 수정, 모든 약속 취소 가능
  const isAdmin = () => !!state.user?.admin;

  const WAIT = { none: "웨이팅 없음", ten: "10분 안팎", twenty: "20분 이상" };
  const WAIT_S = { none: "없음", ten: "10분", twenty: "20분+" };
  const SOLO = { ok: "혼자 OK", meh: "혼자 애매", no: "혼자 어려움" };
  const SOLO_S = { ok: "OK", meh: "애매", no: "어려움" };
  // 추천 포인트: 기록할 때 여러 개 고르는 한 단어 태그 (가게 화면·핀 카드에 많이 고른 순으로 표시)
  const PICKS = { value: "💰 가성비", amount: "🍚 양 많아요", fast: "⚡ 빨리 나와요", taste: "😋 맛 보장", quiet: "🤫 조용해요", group: "👥 여럿이 좋아요", spicy: "🌶 매워요", hangover: "🍲 해장 추천" };
  const MAX_PICKS = 3;
  // 대표 카테고리와 이모지 (핀·칩·썸네일에 같이 씀)
  // 등록할 때 고르는 큰 분류 (순서 = 칩 순서)
  const CAT_EMOJI = { 한식: "🍚", 중식: "🥟", 일식: "🍣", 양식: "🍝", 브런치: "🥞", 아시안: "🍛", 분식: "🍢", 고기: "🥩", 카페: "☕", 기타: "🍴" };
  const CAT_ALIAS = { 동남아: "아시안", 면: "한식" };   // 예전 분류 이름으로 저장된 가게도 지금 분류로 보이게 (면 → 칼국수·냉면은 한식, 라멘은 일식)
  // 세부 종류: 큰 분류를 고르면 아래에 뜨는 한 단어 (예: 한식 · 국밥, 일식 · 라멘). 목록에 없으면 직접 입력
  const SUBS = {
    한식: ["국밥", "순대국", "해장국", "감자탕", "찌개", "백반", "칼국수", "냉면", "국수", "비빔밥", "보쌈", "덮밥"],
    중식: ["짜장·짬뽕", "짬뽕", "마라탕", "탕수육", "볶음밥", "딤섬", "우육면"],
    일식: ["라멘", "돈카츠", "초밥", "덮밥", "우동", "소바", "카레", "오마카세"],
    양식: ["파스타", "피자", "버거", "스테이크", "샐러드", "리조또"],
    브런치: ["샌드위치", "베이글", "토스트", "팬케이크", "샐러드"],
    아시안: ["쌀국수", "반미", "분짜", "태국", "인도 커리", "마라"],
    분식: ["떡볶이", "김밥", "라면", "튀김"],
    고기: ["삼겹살", "갈비", "제육", "곱창", "숯불구이"],
    카페: ["커피", "디저트", "베이커리"],
    기타: [],
  };
  const subGuess = (cat, name = "") => (SUBS[cat] || []).find((x) => name.includes(x)) || "";
  const CATS = Object.keys(CAT_EMOJI);
  const catLabel = (c) => `${CAT_EMOJI[c] || "🍴"} ${c}`;
  function catFrom(raw, name = "") {
    const s = `${raw || ""} ${name}`;
    if (/브런치|팬케이크|에그베네딕트|프렌치토스트|베이글|샌드위치|토스트/.test(s)) return "브런치";
    if (/카페|커피|제과|베이커리|디저트|케이크|빵/.test(s)) return "카페";
    if (/라멘|라면|초밥|스시|일식|일본|돈까스|돈카츠|카츠|우동|소바|이자카야/.test(s)) return "일식";
    if (/중식|중국|짜장|짬뽕|마라|딤섬|훠궈|반점/.test(s)) return "중식";
    if (/아시아|동남아|베트남|태국|타이|인도|쌀국수|커리|카레|분짜|팟타이|나시고랭/.test(s)) return "아시안";
    if (/양식|이탈리|파스타|피자|햄버거|버거|스테이크|멕시|패스트푸드/.test(s)) return "양식";
    if (/고기|구이|갈비|삼겹|곱창|육류|숯불|정육/.test(s)) return "고기";
    if (/분식|떡볶이|김밥|치킨/.test(s)) return "분식";
    if (/한식|국밥|해장국|찌개|백반|감자탕|곰탕|설렁탕|순대|국수|냉면|칼국수|막국수|수제비/.test(s)) return "한식";
    return "기타";
  }
  function emojiFor(p) {
    if (p.emoji) return p.emoji;
    const s = p.name || "";
    if (/라멘|우동|소바|국수|냉면|쌀국수/.test(s)) return "🍜";
    if (/초밥|스시/.test(s)) return "🍣";
    if (/카츠|돈까스/.test(s)) return "🍱";
    if (/국밥|해장국|감자탕|곰탕|순대국|탕/.test(s)) return "🍲";
    if (/피자/.test(s)) return "🍕";
    if (/버거/.test(s)) return "🍔";
    if (/치킨/.test(s)) return "🍗";
    if (/마라|훠궈/.test(s)) return "🌶️";
    if (/빵|베이커리|케이크/.test(s)) return "🥐";
    return CAT_EMOJI[p.category] || "🍴";
  }

  const state = {
    store: null, user: null, places: [], reviews: [], meetups: [], pending: null,
    seenMeet: new Set(), meetInit: false, mf: null,
    filters: { solo: false, wait: false, cheap: false },
    sort: "rating",   // 전체 목록 정렬: rating(별점 높은 순) / near(가까운 순) / price(낮은 가격 순)
    tab: "list", cats: [], sheet: null, selected: null, adding: false, ghost: null, form: null,
    markers: new Map(), mapReady: false,
    rl: { want: [], avoid: [], off: new Set(), skipYesterday: true, includeWish: true, spinning: false },
  };

  // ───────── 계산 ─────────
  // 기본 가게는 카카오맵 도보 길찾기 결과(분 · m)를 그대로 사용 — 길찾기 버튼 숫자와 같게
  const VERIFIED = new Map((window.SEED_PLACES || []).filter((s) => s.walkM).map((s) => [`${(+s.lat).toFixed(6)},${(+s.lng).toFixed(6)}`, s]));
  const verifiedAt = (lat, lng) => VERIFIED.get(`${(+lat).toFixed(6)},${(+lng).toFixed(6)}`);
  function walkInfo(lat, lng) {
    const v = verifiedAt(lat, lng), rt0 = window.Walk?.route(lat, lng);
    if (v) return { min: v.walkMin, m: v.walkM, path: rt0 ? rt0.path : null, src: "kakao" };
    const rt = rt0;
    if (rt) return { min: rt.minutes, m: rt.meters, path: rt.path };
    return { min: walkMin(lat, lng, true), m: null, path: null };
  }
  function walkMin(lat, lng, est) {
    if (!est) { const v = verifiedAt(lat, lng); if (v) return v.walkMin; const rt = window.Walk?.route(lat, lng); if (rt) return rt.minutes; }
    const o = C.office, R = 6371000, r = (x) => (x * Math.PI) / 180;
    const a = Math.sin(r(lat - o.lat) / 2) ** 2 + Math.cos(r(o.lat)) * Math.cos(r(lat)) * Math.sin(r(lng - o.lng) / 2) ** 2;
    return Math.max(1, Math.round((2 * R * Math.asin(Math.sqrt(a)) * 1.3) / 75));
  }
  function most(arr) { const c = {}; let b = null, n = 0; arr.forEach((v) => v && (c[v] = (c[v] || 0) + 1)); for (const k in c) if (c[k] > n) { b = k; n = c[k]; } return b; }
  // 재방문 기록: 이미 기록을 남긴 곳에 또 갔을 때 남기는 간단한 기록 (별점 없이 먹은 메뉴 · 추천 포인트 · 메모)
  // 데이터는 기록(reviews)과 같은 곳에 kind: "revisit", rating: 0으로 저장 → 방문 횟수·추천 메뉴·추천 포인트엔 들어가고 별점 평균엔 안 들어감
  const isRevisit = (r) => r.kind === "revisit";
  const AGAIN = 3;   // 또간집: 멤버들이 합쳐서 3번 이상 다녀온 곳
  // 추천 메뉴: 멤버들이 다녀와서 적은 메뉴를 많이 적은 순으로 (별점이 높은 기록의 메뉴에 살짝 가산). "제육, 된장"처럼 여러 개면 나눠서 셈
  const menuKey = (s) => s.replace(/\s+/g, "").toLowerCase();
  function topMenus(rs, n = 2) {
    const c = new Map();
    for (const r of rs) for (const raw of String(r.menu || "").split(/[,，·\/]/)) {
      const name = raw.trim().replace(/\s+/g, " "); if (!name) continue;
      const k = menuKey(name), o = c.get(k) || { name, score: 0 };
      o.score += 1 + (r.rating || 0) / 10; c.set(k, o);
    }
    return [...c.values()].sort((a, b) => b.score - a.score).slice(0, n).map((o) => o.name);
  }
  function stats(p) {
    const rs = state.reviews.filter((r) => r.placeId === p.id).sort((a, b) => b.createdAt - a.createdAt);
    const visited = rs.filter((r) => r.status === "visited"), first = visited.filter((r) => !isRevisit(r));
    const rated = first.filter((r) => r.rating > 0), priced = visited.filter((r) => r.price > 0);
    return {
      // count = 별점 기록 수(처음 다녀온 기록) · visits = 재방문까지 합친 전체 방문 수
      rs, visited, first, wish: rs.filter((r) => r.status === "wish"), count: first.length, visits: visited.length, revisits: visited.length - first.length,
      menus: topMenus(visited),
      avg: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0,
      wait: most(visited.map((r) => r.wait)), solo: most(visited.map((r) => r.solo)),
      price: priced.length ? Math.round(priced.reduce((s, r) => s + r.price, 0) / priced.length / 500) * 500 : 0,
      minPrice: priced.length ? Math.min(...priced.map((r) => r.price)) : 0,
      week: visited.filter((r) => Date.now() - r.createdAt < 7 * 864e5).length,   // 지난 7일 동안 다녀온 기록 수
      walk: walkMin(p.lat, p.lng),
      picks: Object.entries(visited.flatMap((r) => r.picks || []).reduce((c, k) => (PICKS[k] && (c[k] = (c[k] || 0) + 1), c), {})).sort((a, b) => b[1] - a[1]),
      memo: rs.find((r) => r.memo)?.memo || "",
    };
  }
  // 별점 표시(반 별 포함): ★★★★ + 반쪽 ★ + 회색 ★
  function starsTxt(v) {
    const full = Math.floor(v), half = v - full >= 0.5 ? 1 : 0;
    return "★".repeat(full) + (half ? `<span class="half-star">★</span>` : "") + `<span style="color:var(--fill-2)">${"★".repeat(5 - full - half)}</span>`;
  }
  // 멤버 보기: 멤버를 고르면 지도 핀도 그 멤버가 다녀온 곳(또는 가고 싶은 곳)만
  const whoOn = () => (state.tab === "member" && state.who ? state.who : null);
  let whoMemo = { key: "", set: new Set() };
  function whoPlaceIds() {
    const who = whoOn(), st = state.whoTab === "wish" ? "wish" : "visited", key = `${who}|${st}|${state.reviews.length}|${state.reviews[0]?.id || ""}`;
    if (whoMemo.key !== key || whoMemo.src !== state.reviews) whoMemo = { key, src: state.reviews, set: new Set(state.reviews.filter((r) => r.userName === who && r.status === st).map((r) => r.placeId)) };
    return whoMemo.set;
  }
  const anyFilter = () => state.cats.length > 0 || !!whoOn();
  // 특별 카테고리 — 혼밥: 멤버 기록이 대부분 "혼자 OK" / 거지맵: 멤버가 만원 미만으로 먹은 기록이 있는 곳
  const SPECIAL = {
    "@solo": { label: "🍙 혼밥", test: (st) => st.solo === "ok" },
    "@cheap": { label: "💸 거지맵", test: (st, p) => (p?.category || "") !== "카페" && st.minPrice > 0 && st.minPrice < (C.cheapPrice || 10000) },   // 카페는 밥이 아니라서 거지맵에서 제외
    // 또간집: 멤버들 방문(재방문 포함)이 합쳐서 3번 이상인 밥집 — 카페는 제외
    "@again": { label: "🔁 또간집", test: (st, p) => (p?.category || "") !== "카페" && st.visits >= AGAIN },
  };
  const inCat = (x, cat) => (SPECIAL[cat] ? SPECIAL[cat].test(x.st, x.p) : (x.p.category || "기타") === cat);
  // 정렬: 인기(멤버가 다녀온 기록 수 + 가고 싶어요 수) → 별점 → 가까운 순으로 동점 처리
  const SORTS = { rating: "별점 높은 순", near: "가까운 순", price: "낮은 가격 순" };
  const byNear = (x, y) => x.st.walk - y.st.walk;
  const byRating = (x, y) => y.st.avg - x.st.avg || y.st.count - x.st.count || byNear(x, y);
  const pop = (st) => st.count * 2 + st.wish.length;   // 다녀온 기록이 가고 싶어요보다 2배 무게
  const byPopular = (x, y) => pop(y.st) - pop(x.st) || byRating(x, y);
  // 낮은 가격 순: 멤버가 낸 가장 싼 가격 기준, 가격 기록이 없는 곳은 맨 뒤 (같으면 가까운 순)
  const byPrice = (x, y) => (x.st.minPrice || Infinity) - (y.st.minPrice || Infinity) || byNear(x, y);
  const sorter = (k) => (k === "near" ? byNear : k === "price" ? byPrice : k === "popular" ? byPopular : byRating);
  function passes(st, p) {
    const f = state.filters;
    // 공통 필터(상단 칩): 고른 것 중 하나라도 맞으면 보여줌 — 지도 핀·추천·전체 목록에 똑같이 적용
    if (p && state.cats.length && !state.cats.some((c) => inCat({ p, st }, c))) return false;
    if (p && whoOn() && !whoPlaceIds().has(p.id)) return false;
    if (f.solo && st.solo !== "ok") return false;
    if (f.wait && st.wait !== "none") return false;
    if (f.cheap && !(st.price > 0 && st.price <= C.cheapPrice)) return false;
    return true;
  }
  const placeById = (id) => state.places.find((p) => p.id === id) || (state.pending?.id === id ? state.pending : null);
  // ───────── 길찾기: 출발지는 항상 파운드파운디드, 도보 ─────────
  // 네이버 웹 길찾기 좌표 표기 = (좌표 × 10,000,000 + 2,000,000,000)을 62진법(0-9a-zA-Z)으로
  const N62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nEnc = (v) => { let n = Math.round(v * 1e7) + 2e9, s = ""; while (n > 0) { s = N62[n % 62] + s; n = Math.floor(n / 62); } return s; };
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isMobileOS = () => isAndroid() || /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function dirLinks(p) {
    const o = C.office, on = o.mapName || o.name, E = encodeURIComponent, app = E(location.hostname || "lunchfound");
    const naverWeb = `https://map.naver.com/p/directions/${nEnc(o.lng)},${nEnc(o.lat)},${E(on)},${o.naverPlaceId || ""},PLACE_POI/${nEnc(p.lng)},${nEnc(p.lat)},${E(p.name)},${p.naverPlaceId || ""},PLACE_POI/-/walk?c=18.00,0,0,0,dh`;
    const kakaoWeb = `https://map.kakao.com/link/by/walk/${E(on)},${o.lat},${o.lng}/${E(p.name)},${p.lat},${p.lng}`;
    const naverQ = `route/walk?slat=${o.lat}&slng=${o.lng}&sname=${E(on)}&dlat=${p.lat}&dlng=${p.lng}&dname=${E(p.name)}&appname=${app}`;
    const kakaoQ = `route?sp=${o.lat},${o.lng}&ep=${p.lat},${p.lng}&by=FOOT`;
    return {
      naver: { web: naverWeb, ios: `nmap://${naverQ}`, android: `intent://${naverQ}#Intent;scheme=nmap;package=com.nhn.android.nmap;S.browser_fallback_url=${E(naverWeb)};end` },
      kakao: { web: kakaoWeb, ios: `kakaomap://${kakaoQ}`, android: `intent://${kakaoQ}#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${E(kakaoWeb)};end` },
    };
  }
  // PC는 웹 길찾기를 새 탭으로, 휴대폰은 지도 앱으로 (앱이 없으면 웹 길찾기로 자동 전환)
  function openDir(kind, p) {
    const l = dirLinks(p)[kind];
    if (!isMobileOS()) { window.open(l.web, "_blank", "noopener"); return; }
    if (isAndroid()) { location.href = l.android; return; }   // 안드로이드는 앱이 없으면 browser_fallback_url로
    let left = false;
    const onHide = () => { if (document.hidden) left = true; };
    document.addEventListener("visibilitychange", onHide);
    setTimeout(() => { document.removeEventListener("visibilitychange", onHide); if (!left && !document.hidden) location.href = l.web; }, 1600);
    location.href = l.ios;
  }
  const links = (p) => ({
    naver: dirLinks(p).naver.web,
    kakao: dirLinks(p).kakao.web,
  });
  const curImage = (p) => (p.images && p.images.length ? p.images[(p.imageIdx || 0) % p.images.length] : null);
  // 대표 이미지 우선순위: 멤버가 기록에 올린 메뉴 사진(가장 최근) → 블로그 사진 → 카테고리 아이콘
  const memberThumb = (p) => state.reviews.filter((r) => r.placeId === p.id && r.thumb).sort((a, b) => b.createdAt - a.createdAt)[0]?.thumb || "";
  function thumbHTML(p, cls = "thumb") {
    const src = curImage(p)?.image || memberThumb(p) || "";
    return `<div class="${cls}"><div class="ph">${emojiFor(p)}</div>${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" style="position:relative">` : ""}</div>`;
  }

  // ───────── 사진: 고르자마자 휴대폰에서 줄여서 올림 (원본은 최대 1200px, 목록용 썸네일은 200px) ─────────
  async function shrinkImage(file, max, quality) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("IMG")); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", quality);
    } finally { URL.revokeObjectURL(url); }
  }
  async function preparePhoto(file) {
    let full = await shrinkImage(file, 1200, 0.72);
    if (full.length > 850000) full = await shrinkImage(file, 900, 0.6);   // 데이터베이스 한 칸 크기 제한(1MB) 안으로
    const thumb = await shrinkImage(file, 200, 0.6);
    return { full, thumb };
  }
  // 사진 크게 보기: 여러 장이면 좌우 버튼·밀기·방향키로 넘김 (메뉴판은 여러 장인 경우가 많음)
  function openLightbox(srcs, start = 0, caption = "") {
    const list = Array.isArray(srcs) ? srcs : [srcs];
    let i = start;
    const d = document.createElement("div");
    d.className = "lightbox";
    const draw = () => {
      d.innerHTML = `<img src="${esc(list[i])}" alt="${esc(caption || "사진")}" />
        ${list.length > 1 ? `<button class="lb-prev" aria-label="이전">‹</button><button class="lb-next" aria-label="다음">›</button><span class="lb-n">${caption ? `${esc(caption)} · ` : ""}${i + 1} / ${list.length}</span>` : caption ? `<span class="lb-n">${esc(caption)}</span>` : ""}
        <button class="lb-x" aria-label="닫기">✕</button>`;
      const pv = $(".lb-prev", d), nx = $(".lb-next", d);
      if (pv) pv.onclick = (e) => { e.stopPropagation(); i = (i - 1 + list.length) % list.length; draw(); };
      if (nx) nx.onclick = (e) => { e.stopPropagation(); i = (i + 1) % list.length; draw(); };
      $("img", d).onclick = (e) => e.stopPropagation();
    };
    const close = () => { d.remove(); document.removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && list.length > 1) { i = (i + 1) % list.length; draw(); } else if (e.key === "ArrowLeft" && list.length > 1) { i = (i - 1 + list.length) % list.length; draw(); } };
    let sx = null;
    d.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
    d.addEventListener("touchend", (e) => { if (sx == null || list.length < 2) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) { i = (i + (dx < 0 ? 1 : -1) + list.length) % list.length; draw(); } });
    d.onclick = close; document.addEventListener("keydown", key);
    draw(); document.body.appendChild(d);
  }
  // 메뉴판 사진: 글씨가 읽히게 크게 (최대 1600px), 저장 한도(1MB) 안으로
  async function prepareMenuPhoto(file) {
    let full = await shrinkImage(file, 1600, 0.8);
    if (full.length > 900000) full = await shrinkImage(file, 1280, 0.72);
    if (full.length > 900000) full = await shrinkImage(file, 1100, 0.62);
    return full;
  }

  // ───────── 대표 이미지 (블로그) ─────────
  async function loadImages(p) {
    if (!C.imageApi) return;
    const dong = (String(p.address || "").match(/(\S+동)(\s|$)/) || [, "홍대"])[1];
    try {
      const r = await fetch(`${C.imageApi}?q=${encodeURIComponent(`${p.name} ${dong}`)}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.results?.length) await state.store.updatePlace(p.id, { images: j.results.slice(0, 5), imageIdx: 0 });
    } catch (e) { /* 미리보기나 함수 미설정이면 조용히 넘어감 */ }
  }

  // ───────── 지도 ─────────
  // 지도가 못 떴을 때: 이유별 안내 + 다시 시도. 목록·기록·오늘 뭐 먹지는 지도와 상관없이 계속 쓸 수 있음
  function mapNotice(kind) {
    $("#map .map-msg")?.remove();
    const gpu = kind === "NO_WEBGL" || kind === "LOST";
    // 그래픽 가속이 멈춘 상태에선 화면 흐림(blur) 효과도 매우 느려짐 → 흐림을 끄고 불투명 배경으로 (사이트가 버벅이지 않게)
    if (gpu) document.documentElement.classList.add("lite");
    if (kind !== "NO_KAKAO_KEY") document.documentElement.classList.add("map-off");
    const m = document.createElement("div");
    m.className = "map-msg";
    if (kind === "NO_KAKAO_KEY") m.innerHTML = "지도를 띄우려면 <b>config.js</b>에 카카오 JavaScript 키를 넣어주세요.";
    else {
      const title = kind === "LOST" ? "지도 그래픽이 잠시 멈췄어요" : gpu ? "지도 그래픽을 켜지 못했어요" : "지도를 불러오지 못했어요";
      const body = gpu ? "브라우저의 그래픽 가속이 잠깐 멈춘 것 같아요. 새로고침해도 그대로면 Chrome을 완전히 껐다가 다시 켜 주세요."
        : "지도 서버 연결이 느리거나 잠깐 끊겼어요. 잠시 뒤 다시 시도해 주세요.";
      m.innerHTML = `<div class="map-err"><b>${title}</b><p>${body}</p><p class="map-err-sub">목록 · 기록 · 오늘 뭐 먹지는 그대로 쓸 수 있어요.</p>
        <div class="btns">${kind === "LOST" ? "" : `<button class="btn btn-primary" data-map-retry>다시 시도</button>`}<button class="btn btn-plain" data-map-reload>새로고침</button></div></div>`;
      const rt = $("[data-map-retry]", m); if (rt) rt.onclick = () => { rt.disabled = true; rt.textContent = "불러오는 중…"; initMap(1); };
      $("[data-map-reload]", m).onclick = () => location.reload();
    }
    $("#map").appendChild(m);
  }
  // attempt 0: 처음 — 실패하면 1.2초 뒤 한 번 더 자동으로 시도 / attempt 1: 다시 시도 버튼
  async function initMap(attempt = 0) {
    try {
      await MapKit.init($("#map"), C.office, onMapTap, () => mapNotice("LOST"));
    } catch (e) {
      const why = e?.message || "";
      console.warn("[Lunchfound] 지도 실패:", why);
      if (why !== "NO_KAKAO_KEY" && attempt === 0) { await new Promise((r) => setTimeout(r, 1200)); return initMap(1); }
      mapNotice(why);
      return;
    }
    $("#map .map-msg")?.remove();
    document.documentElement.classList.remove("lite", "map-off");
    state.mapReady = true;
    homeView(true);   // 처음 열 때도 사옥이 보이는 영역 가운데
    if (MapKit.attribution) { const a = $("#attrib"); a.textContent = MapKit.attribution; a.hidden = false; }
    const el = document.createElement("div");
    el.className = "office";
    el.innerHTML = `<div class="pin-b">◉ ${esc(C.office.name)}</div><div class="pin-t"></div>`;
    MapKit.add(el, C.office.lat, C.office.lng, "bottom");
    // 핀 누르기 → 가게 정보 열기. 마우스로 누르면 지도 라이브러리가 "끌기"로 먼저 잡아채서 click이 핀에 안 오므로,
    // 누른 곳과 뗀 곳의 핀을 직접 찾아 같은 핀이고 거의 안 움직였으면 연다.
    let down = null;
    const pinAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".pin");
    const mapEl = $("#map");
    mapEl.addEventListener("pointerdown", (e) => { const pin = pinAt(e.clientX, e.clientY); down = pin ? { id: pin.dataset.pid, x: e.clientX, y: e.clientY } : null; }, true);
    // 지도를 누른 채 끌거나(이동) 두 손가락으로 확대한 건 "빈 곳 한 번 탭"이 아님 → 가게 카드·선택을 유지
    const touching = new Map();
    mapEl.addEventListener("pointerdown", (e) => { touching.set(e.pointerId, { x: e.clientX, y: e.clientY }); gesture = { moved: touching.size > 1, t: performance.now() }; }, true);
    mapEl.addEventListener("pointermove", (e) => { const s0 = touching.get(e.pointerId); if (s0 && gesture && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 10) gesture.moved = true; }, true);
    const lift = (e) => { touching.delete(e.pointerId); if (gesture && performance.now() - gesture.t > 600) gesture.moved = true; };
    mapEl.addEventListener("pointerup", lift, true); mapEl.addEventListener("pointercancel", (e) => { touching.delete(e.pointerId); if (gesture) gesture.moved = true; }, true);
    mapEl.addEventListener("pointerup", (e) => {
      if (!down) return;
      const d = down; down = null;
      // 누를 때 잡은 핀 기준 (실시간 지도는 누르는 동안 핀을 잠깐 클릭 불가로 바꿔서, 뗄 때 다시 찾으면 못 찾음)
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || state.adding) return;
      // 뒤따라오는 click이 방금 열린 시트의 바깥 배경에 닿아 바로 닫히지 않게, 0.5초 안의 click 한 번은 무시
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallow, true), 500);
      lastPinTap = Date.now();
      const p = placeById(d.id), pin = state.markers.get(d.id) && document.querySelector(`.pin[data-pid="${CSS.escape(d.id)}"]`);
      // PC: 바로 오른쪽 상세 메뉴로 / 모바일: 작은 카드 → "자세히 보기"로 아래에서 올라옴
      if (desk() || !p || !pin) { hideTip(true); openPlace(d.id); } else previewPlace(p, pin);
    }, true);
    renderMarkers();
  }

  let lastPinTap = 0, gesture = null;
  // 모바일: 핀을 누르면 바로 도보 경로 모션 + 위쪽 정보 카드 (상세는 "자세히 보기"로)
  function previewPlace(p, pin) {
    collapsePanel(true);
    showTip(p, pin, true);
    state.selected = p.id;
    renderMarkers();
    const wi = walkInfo(p.lat, p.lng);
    if (wi.path && MapKit.showRoute) {
      const top = Math.round(($("#tip").getBoundingClientRect().bottom || 220) + 24);
      MapKit.showRoute(wi.path, { top, right: 44, bottom: 70, left: 44 });
      state.routeFor = p.id;
    } else focusPlace(p);
  }
  // 휴대폰: 지도에 집중할 때 아래 목록을 손잡이만 남기고 내림 (손잡이·탭을 누르면 다시 올라옴)
  // 목록 높이 2단계: min(내림 — 손잡이 + 전체/내 기록 탭) · open(올림). 누르든 밀든 항상 같은 두 위치
  function setPanel(stage) {
    if (desk()) return;
    if (stage !== "open") stage = "min";
    const app = $("#app"), panel = $("#panel");
    panel.style.height = ""; panel.style.transition = "";
    app.classList.toggle("panel-min", stage === "min");
    panel.dataset.open = stage === "open" ? "true" : "false";
  }
  const panelStage = () => ($("#panel").dataset.open === "true" ? "open" : "min");
  function collapsePanel(on) { setPanel(on ? "min" : "open"); }
  // 쓸어 올리기·내리기: 손잡이·탭 줄, 또는 목록 맨 위에서 아래로 당길 때
  function initPanelSwipe() {
    const panel = $("#panel"), body = $("#panelBody");
    // 아이폰 아래 홈 바 높이(safe area)를 실제 px로 재서 CSS의 내림 높이(88px + safe area)와 똑같이 맞춤
    const probe = document.createElement("div"); probe.style.cssText = "position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)"; document.body.appendChild(probe);
    const heights = () => ({ min: 88 + (parseFloat(getComputedStyle(probe).paddingBottom) || 0), open: innerHeight * 0.74 });
    let drag = null;
    const start = (e, fromBody) => {
      if (desk() || e.pointerType === "mouse" && e.button !== 0) return;
      drag = { y: e.clientY, h: panel.getBoundingClientRect().height, t: performance.now(), moved: false, fromBody, id: e.pointerId };
    };
    panel.addEventListener("pointerdown", (e) => { if (e.target.closest("#grab, #tabs")) start(e, false); });
    body.addEventListener("pointerdown", (e) => { if (body.scrollTop <= 0) start(e, true); });
    addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dy) < 8) return;
        if (drag.fromBody && (dy < 0 || body.scrollTop > 0)) { drag = null; return; }   // 목록 안에서 위로 밀면 그냥 스크롤
        drag.moved = true; panel.style.transition = "none"; hideTip();
      }
      const H = heights();
      panel.style.height = `${Math.max(H.min, Math.min(H.open, drag.h - dy))}px`;
    }, { passive: true });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.moved) return;
      // 드래그 직후 따라오는 click(탭 전환·가게 열기)은 무시
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallow, true), 400);
      const H = heights(), h = panel.getBoundingClientRect().height;
      const v = (d.y - e.clientY) / Math.max(1, performance.now() - d.t);   // 위로 빠르게 = +
      // 두 위치 중 하나로: 튕긴 방향이 있으면 그 방향, 아니면 1/3 이상 끌었는지로 결정
      const from = d.h > (H.min + H.open) / 2 ? "open" : "min";
      let stage = from;
      if (Math.abs(v) > 0.35) stage = v > 0 ? "open" : "min";
      else if (Math.abs(h - d.h) > (H.open - H.min) / 3) stage = h > d.h ? "open" : "min";
      panel.style.transition = ""; panel.style.height = "";
      setPanel(stage);
    };
    addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }
  const popped = new Set();
  function renderMarkers() {
    if (!state.mapReady) return;
    let order = 0;
    state.markers.forEach((m) => m.remove());
    state.markers.clear();
    for (const p of state.places) {
      const st = stats(p), fresh = st.count === 0;
      const el = document.createElement("div");
      el.className = ["pin", fresh && "wish", anyFilter() && !passes(st, p) && state.selected !== p.id && "hide", state.selected === p.id && "on"].filter(Boolean).join(" ");
      const label = fresh ? (st.wish.length ? ` <span class="pin-n">♡${st.wish.length}</span>` : "") : ` <span class="pin-r">${st.avg.toFixed(1)}</span>`;
      el.innerHTML = `<div class="pin-b"><span class="pin-e">${emojiFor(p)}</span>${label}</div><div class="pin-t"></div><div class="pin-l">${esc(p.name)}</div>`;
      if (!popped.has(p.id)) { popped.add(p.id); el.classList.add("pop"); el.style.setProperty("--d", `${Math.min(order++ * 35, 700)}ms`); }
      el.dataset.pid = p.id;   // 클릭은 initMap의 pinTap에서 처리 (PC 마우스에서도 확실히 열리게)
      el.addEventListener("mouseenter", () => { if (!tipPinned) showTip(p, el); });
      el.addEventListener("mouseleave", () => { if (!tipPinned) hideTip(); });
      const m = MapKit.add(el, p.lat, p.lng, "bottom");
      if (state.selected === p.id) m.front?.(true);
      state.markers.set(p.id, m);
    }
  }

  // ───────── 마우스 올리면 뜨는 정보 카드 (메뉴 · 도보 시간 · 카테고리) ─────────
  const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  let tipShownAt = 0, tipPinned = null;
  // 정보 카드 — 왼쪽 대표 음식 사진 썸네일 + 오른쪽 정보 (PC 호버·모바일 탭 공통 디자인)
  // pinned=false: PC 마우스 호버 미리보기(핀 근처) / pinned=true: 모바일 탭 → 화면 위쪽에 가로로 꽉 차게 + "자세히 보기"
  function showTip(p, el, pinned = false) {
    if ((!pinned && !canHover()) || state.adding) return;
    const st = stats(p), wi = walkInfo(p.lat, p.lng), tip = $("#tip");
    const dist = wi.m ? ` · ${wi.m >= 1000 ? (wi.m / 1000).toFixed(1) + "km" : wi.m + "m"}` : "";
    const photo = curImage(p)?.image || memberThumb(p) || "";
    tipPinned = pinned ? p.id : null;
    tip.classList.toggle("pinned", pinned);
    tip.innerHTML = `<div class="tc">
        <div class="tc-ph">${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()" />` : ""}<span>${emojiFor(p)}</span></div>
        <div class="tc-body">
          <div class="tc-name">${esc(p.name)}</div>
          <div class="tc-line">${esc(p.category || "기타")} · <b>도보 ${wi.min}분</b>${dist}</div>
          <div class="tc-line">${st.count ? `<i class="star">★</i> <b>${st.avg.toFixed(1)}</b> (${st.count})` : "아직 기록 없음"}${st.visits >= 2 ? ` · 🔁 방문 ${st.visits}번` : ""}</div>
          ${st.menus.length ? `<div class="tc-line tc-menu"><span class="k">추천 메뉴</span> ${st.menus.map((m) => `<b>${esc(m)}</b>`).join(" · ")}</div>` : ""}
          ${st.picks.length ? `<div class="tc-picks">${st.picks.slice(0, 3).map(([k]) => `<span>${PICKS[k]}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      ${st.memo ? `<div class="tc-memo">“${esc(st.memo)}”</div>` : ""}
      ${pinned ? `<div class="tc-act"><button class="tip-more" data-tip-more>자세히 보기 ›</button></div>` : ""}`;
    if (pinned) $("[data-tip-more]", tip).onclick = (e) => { e.stopPropagation(); hideTip(true); openPlace(p.id); };
    tip.hidden = false;
    if (pinned && !desk()) {
      // 모바일: 상단 버튼·필터 아래에 가로로 꽉 차게
      const top = ($(".topbar")?.getBoundingClientRect().bottom || 100) + 6;
      tip.style.left = "12px"; tip.style.right = "12px"; tip.style.top = `${top}px`; tip.style.width = "auto";
      tip.classList.add("below");
    } else {
      tip.style.right = ""; tip.style.width = "";
      const r = el.querySelector(".pin-b").getBoundingClientRect();
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = r.left + r.width / 2 - w / 2, y = r.top - h - 10, below = false;
      if (y < 110) { y = r.bottom + 30; below = true; }
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
      tip.classList.toggle("below", below);
    }
    // 첫 카드만 등장 모션, 이어서 다른 핀으로 옮길 땐 바로 (애니메이션 반복으로 굼떠 보이지 않게)
    tip.classList.toggle("instant", Date.now() - tipShownAt < 400);
    tip.classList.remove("show"); void tip.offsetWidth; tip.classList.add("show");
    tipShownAt = Date.now();
  }
  function hideTip(keepRoute) {
    const wasPinned = tipPinned; tipPinned = null;
    const t = $("#tip"); if (t) { t.classList.remove("show", "pinned"); t.hidden = true; tipShownAt = Date.now(); }
    // 모바일에서 핀만 눌러 경로를 보여주던 중이면, 카드를 닫을 때 경로·선택도 같이 정리
    if (wasPinned && !keepRoute && !state.sheet) { state.selected = null; state.routeFor = null; MapKit.clearRoute?.(); renderMarkers(); }
  }

  function onMapTap(lat, lng) {
    if (!state.adding) {
      if (Date.now() - lastPinTap < 600) return;   // 핀을 누른 직후 따라오는 지도 클릭은 무시
      if (gesture?.moved) return;   // 끌기·확대·길게 누르기는 무시 — 짧게 한 번 탭했을 때만 선택 해제
      // 가게를 보고 있다가 지도 빈 곳을 누르면 ✕를 누른 것처럼 선택 해제 (상세 닫기 + 경로 지우기)
      if (state.sheet === "place") closeSheet();
      else if (state.selected || state.routeFor) { state.selected = null; MapKit.clearRoute?.(); state.routeFor = null; renderMarkers(); }
      hideTip(); collapsePanel(true); return;
    }
    placeGhost(lat, lng);
  }
  // 사옥을 "보이는 지도 영역" 가운데로: 모바일은 위 버튼줄과 아래 목록 사이 가운데
  function homeView(instant) {
    if (desk()) return MapKit.home(0, instant);
    const top = ($("#filterbar")?.getBoundingClientRect().bottom || 100);
    const pr = $("#panel")?.getBoundingClientRect(), bottom = pr ? Math.max(0, innerHeight - pr.top) : 0;
    MapKit.home(Math.round((top - bottom) / 2), instant);
  }
  function routePad() {
    return desk() ? { top: 90, right: 490, bottom: 50, left: 440 } : { top: 120, right: 50, bottom: Math.round(innerHeight * 0.55) + 20, left: 50 };
  }
  function focusPlace(p) { if (desk()) MapKit.focus(p.lat, p.lng, -20, 0); else MapKit.focus(p.lat, p.lng, 0, -190); }

  // ───────── 패널 ─────────
  // ───────── 찜(♥) = 내 "가고 싶어요" 기록. 하트 한 번으로 넣고 빼기 ─────────
  const myWishes = (pid) => state.reviews.filter((r) => r.placeId === pid && r.uid === state.user.uid && r.status === "wish");
  const isFav = (pid) => myWishes(pid).length > 0;
  const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>`;
  const heartHTML = (pid, cls = "") => `<span class="fav ${cls}" role="button" tabindex="0" data-fav="${esc(pid)}" aria-pressed="${isFav(pid)}" aria-label="${isFav(pid) ? "찜 빼기" : "찜하기"}">${HEART}</span>`;
  let favBusy = false;
  async function toggleFav(pid) {
    if (favBusy) return; favBusy = true;
    try {
      const mine = myWishes(pid);
      if (mine.length) {
        if (mine.some((r) => r.memo || r.menu) && !confirm("찜을 빼면 같이 남긴 메모도 지워져요. 뺄까요?")) return;
        for (const r of mine) await state.store.deleteReview(r.id);
        toast("찜에서 뺐어요");
      } else {
        await state.store.addReview({ placeId: pid, uid: state.user.uid, userName: state.user.name, status: "wish", rating: 0, wait: "", solo: "", menu: "", price: 0, picks: [], memo: "", thumb: "", photoCount: 0 });
        navigator.vibrate?.(10);
        toast("♥ 찜했어요 · 내 기록에 모아둘게요");
      }
    } catch (e) { console.error(e); toast("저장하지 못했어요"); }
    finally { favBusy = false; }
  }
  function bindFav(root) {
    $$("[data-fav]", root).forEach((b) => {
      const go = (e) => { e.preventDefault(); e.stopPropagation(); b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); b.classList.add("bump"); toggleFav(b.dataset.fav); };
      b.onclick = go; b.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") go(e); };
    });
  }
  function rowHTML({ p, st }, rank) {
    const meta = [];
    meta.push(st.count ? `<span class="rate"><i>★</i> ${st.avg.toFixed(1)} <span style="color:var(--ink-2);font-weight:400">(${st.count})</span></span>` : st.wish.length ? `<span>♡ 가고 싶은 멤버 ${st.wish.length}</span>` : `<span>아직 기록 없음</span>`);
    if (st.visits >= 2) meta.push(`<span class="again">🔁 방문 ${st.visits}번</span>`);
    meta.push(`<span>${esc(p.category || "기타")}${p.note ? ` · ${esc(p.note)}` : ""}</span>`);
    if (st.wait) meta.push(`<span>웨이팅 ${WAIT_S[st.wait]}</span>`);
    if (st.count && st.wish.length) meta.push(`<span>♡ ${st.wish.length}</span>`);   // 기록 없는 곳은 앞에 "가고 싶은 멤버 N"이 이미 있음
    if (st.solo === "ok") meta.push(`<span>혼밥 OK</span>`);
    if (st.minPrice) meta.push(`<span>${st.minPrice < (C.cheapPrice || 10000) && p.category !== "카페" ? "💸 " : ""}${won(st.minPrice)}부터</span>`);
    return `<button class="row" data-place="${esc(p.id)}">${rank ? `<span class="rank">${rank}</span>` : ""}${thumbHTML(p)}
      <div class="row-main"><div class="row-name">${esc(p.name)}</div><div class="row-meta">${meta.join("")}</div></div>
      <span class="row-side"><span class="row-walk">도보 ${st.walk}분</span>${heartHTML(p.id)}</span></button>`;
  }
  function renderPanel() {
    const body = $("#panelBody"), all = state.places.map((p) => ({ p, st: stats(p) }));
    let html = "";
    if (state.tab === "list") {
      // 정렬(인기 / 별점 / 가까운 순) + 카테고리 칩(혼밥·거지맵 포함) / 전체일 때는 카테고리별로 묶어서
      const base = all.filter((x) => passes(x.st, x.p));
      const cats = CATS.filter((c) => base.some((x) => (x.p.category || "기타") === c));
      const sortFn = sorter(state.sort);
      const sortBar = `<div class="seg sortbar" role="group" aria-label="정렬">${Object.entries(SORTS).map(([k, v]) => `<button data-sort="${k}" aria-pressed="${state.sort === k}">${v}</button>`).join("")}</div>`;
      let body2;
      if (!base.length) {
        body2 = `<p class="empty">${anyFilter() ? "필터에 맞는 곳이 없어요. 위쪽 필터를 바꿔보세요." : "아직 등록된 곳이 없어요. + 장소 추가로 첫 가게를 등록해 주세요."}</p>`;
      } else if (state.sort !== "near") {
        // 인기·별점 순은 카테고리 구분 없이 한 줄로 (순위가 잘 보이게)
        const list = [...base].sort(sortFn);
        body2 = list.map((x, i) => rowHTML(x, (state.sort === "price" ? x.st.minPrice : x.st.count) ? i + 1 : 0)).join("");
      } else {
        body2 = cats.map((c) => { const list = base.filter((x) => (x.p.category || "기타") === c).sort(sortFn);
          return `<div class="group-h">${catLabel(c)}<span class="n">${list.length}곳</span></div>` + list.map((x) => rowHTML(x)).join(""); }).join("");
      }
      const sub = state.sort === "price" ? "멤버가 낸 가격이 낮은 순" : state.sort === "rating" ? "멤버 별점이 높은 순" : "카테고리별 · 사옥에서 가까운 순";
      html = `<div class="section-h">${anyFilter() ? `${esc(filterLabel())} ` : "전체 "}${base.length}곳</div><div class="section-sub">${sub}</div>${sortBar}${body2}`;
    } else if (state.tab === "member") {
      html = state.who ? whoHTML(state.who) : membersHTML();
    } else {
      // 내 기록: 내가 등록한(다녀온 기록) / 내가 찜한(♥)
      const all2 = state.places.map((p) => ({ p, st: stats(p) }));
      const mine = state.reviews.filter((r) => r.uid === state.user.uid && r.status === "visited").sort((a, b) => b.createdAt - a.createdAt);
      const favs = all2.filter((x) => isFav(x.p.id)).sort((a, b) => Math.max(...myWishes(b.p.id).map((r) => r.createdAt)) - Math.max(...myWishes(a.p.id).map((r) => r.createdAt)));
      const mt = state.mineTab || "mine";
      const seg = `<div class="seg sortbar" role="group" aria-label="내 기록 보기"><button data-mt="mine" aria-pressed="${mt === "mine"}">내가 등록한 ${mine.length}</button><button data-mt="fav" aria-pressed="${mt === "fav"}">♥ 내가 찜한 ${favs.length}</button></div>`;
      if (mt === "fav") {
        html = `<div class="section-h">내가 찜한 ${favs.length}곳</div><div class="section-sub">하트를 누른 곳 · 최근에 찜한 순</div>${seg}` +
          (favs.length ? favs.map((x) => rowHTML(x)).join("") : `<p class="empty">아직 찜한 곳이 없어요. 가게 이름 옆 ♡를 누르면 여기 모여요.</p>`);
      } else {
        const im = myImpact();
        html = `<div class="section-h">내 기록 ${mine.length}</div><div class="section-sub">${esc(state.user.name)}님이 다녀와서 남긴 기록</div>${seg}` +
          (im.places ? `<div class="impact"><span class="impact-n">${im.viewers}</span><span>${im.viewers ? `내 기록 ${im.places}곳 · 멤버 <b>${im.viewers}명</b>이 봤어요` : `내 기록 ${im.places}곳 · 아직 본 멤버 없음`}</span></div>` : "") +
          (mine.length ? mine.map((r) => { const p = placeById(r.placeId); if (!p) return "";
            return `<button class="row" data-place="${esc(p.id)}">${thumbHTML(p)}<div class="row-main"><div class="row-name">${esc(p.name)}</div>
              <div class="row-meta">${isRevisit(r) ? `<span class="again">🔁 재방문</span>` : `<span class="rate"><i>★</i> ${r.rating}</span>`}${r.menu ? `<span>${esc(r.menu)}</span>` : ""}<span>${ago(r.createdAt)}</span></div></div><span class="row-side">${heartHTML(p.id)}</span></button>`; }).join("")
            : `<p class="empty">아직 남긴 기록이 없어요.</p>`);
      }
    }
    body.innerHTML = html;
    $$("[data-place]", body).forEach((b) => (b.onclick = () => openPlace(b.dataset.place)));
    $$("[data-sort]", body).forEach((b) => (b.onclick = () => { state.sort = b.dataset.sort; renderPanel(); }));
    $$("[data-mt]", body).forEach((b) => (b.onclick = () => { state.mineTab = b.dataset.mt; renderPanel(); }));
    $$("[data-who]", body).forEach((b) => (b.onclick = () => showWho(b.dataset.who || null)));
    $$("[data-wt]", body).forEach((b) => (b.onclick = () => { state.whoTab = b.dataset.wt; renderPanel(); stagger(); renderMarkers(); }));
    bindFav(body);
    syncWhoBadge();
  }

  // ───────── 멤버 보기: 멤버별로 다녀온 곳 · 자주 간 곳 · 가고 싶은 곳 ─────────
  function memberSummary(name) {
    const rs = state.reviews.filter((r) => r.userName === name && placeById(r.placeId));
    const vis = rs.filter((r) => r.status === "visited"), wish = rs.filter((r) => r.status === "wish");
    const per = new Map();   // 가게별 방문 횟수 · 마지막 방문 · 별점(처음 기록) · 최근 메뉴
    for (const r of vis.sort((a, b) => b.createdAt - a.createdAt)) {
      const o = per.get(r.placeId) || { id: r.placeId, n: 0, last: r.createdAt, rating: 0, menu: "" };
      o.n++; if (!isRevisit(r) && r.rating) o.rating = r.rating; if (!o.menu && r.menu) o.menu = r.menu;
      per.set(r.placeId, o);
    }
    const places = [...per.values()].sort((a, b) => b.n - a.n || b.last - a.last);
    const rated = vis.filter((r) => !isRevisit(r) && r.rating > 0);
    return {
      vis, wish, places, visits: vis.length, last: vis[0]?.createdAt || 0,
      avg: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0,
      cat: most(vis.map((r) => placeById(r.placeId)?.category).filter((c) => c && c !== "기타")),
      fav: places[0] && places[0].n >= 2 ? placeById(places[0].id) : null,
    };
  }
  function membersHTML() {
    const me = state.user.name;
    const list = MEMBERS.map((m) => ({ m, s: memberSummary(m.name) })).sort((a, b) => b.s.visits - a.s.visits || b.s.places.length - a.s.places.length || b.s.last - a.s.last);
    return `<div class="section-h">멤버 ${list.length}명</div><div class="section-sub">다녀온 기록이 많은 순 · 누르면 그 멤버가 간 곳을 지도와 목록으로 보여줘요</div>` +
      list.map(({ m, s }) => `<button class="row member-row" data-who="${esc(m.name)}">${avatar(m.name)}
        <div class="row-main"><div class="row-name">${esc(m.name)}${m.name === me ? ` <span class="me-tag">나</span>` : ""} <span class="team">${esc(m.team || "")}</span></div>
          <div class="row-meta">${s.visits ? `<span><b>${s.places.length}</b>곳</span><span>방문 ${s.visits}번</span>${s.fav ? `<span class="again">🔁 ${esc(s.fav.name)} ${s.places[0].n}번</span>` : s.cat ? `<span>${esc(catLabel(s.cat))}</span>` : ""}` : `<span>아직 다녀온 기록 없음</span>`}${s.wish.length ? `<span>♡ ${s.wish.length}</span>` : ""}</div></div>
        <span class="row-side"><span class="row-walk">${s.last ? ago(s.last) : ""}</span></span></button>`).join("");
  }
  function whoHTML(name) {
    const s = memberSummary(name), m = member(name), wt = state.whoTab === "wish" ? "wish" : "visited", nim = name === state.user.name ? "내가" : `${esc(name)}님이`;
    const head = `<button class="link who-back" data-who="">‹ 멤버 목록</button>
      <div class="who-head">${avatar(name)}<div><div class="section-h">${esc(name)}님</div><div class="section-sub">${esc([m?.team, m?.role].filter(Boolean).join(" · "))}</div></div></div>
      <div class="stats who-stats">
        <div class="stat"><div class="k">다녀온 곳</div><div class="v">${s.places.length}곳</div></div>
        <div class="stat"><div class="k">방문</div><div class="v">${s.visits}번</div></div>
        <div class="stat"><div class="k">준 별점</div><div class="v">${s.avg ? `★ ${s.avg.toFixed(1)}` : "–"}</div></div>
        <div class="stat"><div class="k">자주 먹는</div><div class="v">${s.cat ? esc(s.cat) : "–"}</div></div>
      </div>
      <div class="seg sortbar" role="group" aria-label="멤버 기록 보기"><button data-wt="visited" aria-pressed="${wt === "visited"}">자주 간 곳 ${s.places.length}</button><button data-wt="wish" aria-pressed="${wt === "wish"}">♡ 가고 싶은 곳 ${s.wish.length}</button></div>`;
    if (wt === "wish") {
      const rows = s.wish.sort((a, b) => b.createdAt - a.createdAt).map((r) => { const p = placeById(r.placeId), st = stats(p);
        return `<button class="row" data-place="${esc(p.id)}">${thumbHTML(p)}<div class="row-main"><div class="row-name">${esc(p.name)}</div>
          <div class="row-meta">${st.count ? `<span class="rate"><i>★</i> ${st.avg.toFixed(1)}</span>` : ""}<span>${esc(p.category || "기타")}</span>${r.menu ? `<span>${esc(r.menu)}</span>` : ""}${r.memo ? `<span>“${esc(r.memo)}”</span>` : ""}</div></div>
          <span class="row-side"><span class="row-walk">도보 ${st.walk}분</span>${heartHTML(p.id)}</span></button>`; }).join("");
      return head + `<p class="who-note">🗺 지도에도 ${nim} 가고 싶은 곳만 보여요</p>` + (rows || `<p class="empty">아직 찜한 곳이 없어요.</p>`);
    }
    const rows = s.places.map((o, i) => { const p = placeById(o.id), st = stats(p);
      return `<button class="row" data-place="${esc(p.id)}"><span class="rank">${i + 1}</span>${thumbHTML(p)}<div class="row-main"><div class="row-name">${esc(p.name)}</div>
        <div class="row-meta">${o.n >= 2 ? `<span class="again">🔁 ${o.n}번</span>` : `<span>1번</span>`}${o.rating ? `<span class="rate"><i>★</i> ${(+o.rating).toFixed(1)}</span>` : ""}${o.menu ? `<span>${esc(o.menu)}</span>` : ""}<span>${ago(o.last)}</span></div></div>
        <span class="row-side"><span class="row-walk">도보 ${st.walk}분</span>${heartHTML(p.id)}</span></button>`; }).join("");
    return head + (s.places.length ? `<p class="who-note">🗺 지도에도 ${nim} 다녀온 곳만 보여요 · 많이 간 순</p>` : "") + (rows || `<p class="empty">아직 다녀온 기록이 없어요.</p>`);
  }
  // 멤버 고르기(이름 null이면 멤버 목록으로). 가게 기록의 이름을 눌러서 올 때는 탭도 멤버로 바꿈
  function showWho(name) {
    state.who = name; state.whoTab = "visited";
    if (state.tab !== "member") { state.tab = "member"; $$("#tabs button").forEach((x) => x.setAttribute("aria-selected", x.dataset.tab === "member")); }
    hideTip(true);
    renderMarkers(); renderPanel(); stagger();
    $("#panelBody").scrollTop = 0;
  }
  // 지도 위 안내: "태영님이 다녀온 곳만 보는 중 ✕"
  function syncWhoBadge() {
    const b = $("#whoBadge"); if (!b) return;
    const who = whoOn();
    b.hidden = !who;
    if (!who) return;
    b.innerHTML = `${avatar(who, true)}<span>${who === state.user.name ? "내가" : `${esc(who)}님이`} ${state.whoTab === "wish" ? "가고 싶은 곳" : "다녀온 곳"}만 보는 중</span><button aria-label="모든 가게 보기">✕</button>`;
    $("button", b).onclick = () => showWho(null);
  }
  function stagger() {
    const body = $("#panelBody");
    $$(".row, .group-h, .impact", body).slice(0, 14).forEach((r, i) => r.style.setProperty("--i", i));
    body.classList.remove("stagger"); void body.offsetWidth; body.classList.add("stagger");
    setTimeout(() => body.classList.remove("stagger"), 700);
  }
  // ───────── 공통 필터 바 (상단, 웹·앱 공통) ─────────
  const catName = (c) => (SPECIAL[c] ? SPECIAL[c].label : catLabel(c));
  const filterLabel = () => state.cats.map((c) => (SPECIAL[c] ? SPECIAL[c].label : c)).join(" · ");
  // PC 툴바: 칩 시작점을 지도 영역 왼쪽에 맞추려고 로고 너비를 CSS 변수로
  const syncBrandW = () => { const b = $("#brand"); if (b?.offsetWidth) document.documentElement.style.setProperty("--brandW", b.offsetWidth + "px"); };
  addEventListener("resize", syncBrandW);
  function renderFilterBar() {
    const bar = $("#filterbar"); if (!bar) return;
    requestAnimationFrame(syncBrandW);
    const all = state.places.map((p) => ({ p, st: stats(p) }));
    const cnt = (c) => all.filter((x) => inCat(x, c)).length;
    const keys = [...Object.keys(SPECIAL), ...CATS.filter((c) => cnt(c))];
    const keep = bar.scrollLeft;
    bar.innerHTML = `<button class="chip glass" data-f="" aria-pressed="${!state.cats.length}">전체 <span class="n">${all.length}</span></button>` +
      keys.map((c) => `<button class="chip glass${SPECIAL[c] ? " special" : ""}" data-f="${c}" aria-pressed="${state.cats.includes(c)}">${catName(c)} <span class="n">${cnt(c)}</span></button>`).join("");
    bar.scrollLeft = keep;
    $$("[data-f]", bar).forEach((b) => (b.onclick = () => {
      const c = b.dataset.f;
      state.cats = !c ? [] : state.cats.includes(c) ? state.cats.filter((x) => x !== c) : [...state.cats, c];
      hideTip(); renderAll();
      // 필터를 바꾸면 결과 목록을 바로 보여줌 (모바일은 목록을 중간 높이로)
      if (state.cats.length) {
        const n = state.places.filter((p) => passes(stats(p), p)).length;
        toast(n ? `${filterLabel()} · ${n}곳` : "조건에 맞는 곳이 없어요");
      }
    }));
  }
  function renderAll() {
    renderFilterBar();
    renderMarkers();
    renderPanel();
    if (state.sheet === "place" && state.selected) renderPlace(state.selected);
  }

  // ───────── 시트 공통 ─────────
  let closeTimer;
  function showSheet(html, kind) {
    // 가게 상세가 아닌 다른 창(룰렛·약속·내 정보 등)을 열면 지도 위 가게 카드와 경로는 정리
    if (kind !== "place" && !["review", "editplace"].includes(kind) && !$("#tip")?.hidden) { state.sheet = null; hideTip(); }
    state.sheet = kind;
    const s = $("#sheet");
    clearTimeout(closeTimer); s.classList.remove("closing"); $("#scrim").classList.remove("closing");
    s.dataset.kind = kind;
    s.innerHTML = `<div class="grabber"><span></span></div>${html}`;
    s.hidden = false; $("#scrim").hidden = false; s.scrollTop = 0;
    $$("[data-close]", s).forEach((b) => (b.onclick = closeSheet));
    return s;
  }
  function closeSheet() {
    if (state.sheet === "pin" || state.adding) stopAdding();
    // 닫힘 모션: 아래로 살짝 내려가며 사라진 뒤 숨김 (0.2초)
    const s = $("#sheet"), sc = $("#scrim");
    if (!s.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.classList.add("closing"); sc.classList.add("closing");
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => { s.hidden = true; sc.hidden = true; s.classList.remove("closing"); sc.classList.remove("closing"); }, 200);
    } else { s.hidden = true; sc.hidden = true; }
    state.sheet = null; state.selected = null; state.form = null; state.rl.spinning = false;
    MapKit.clearRoute?.(); state.routeFor = null;
    renderMarkers();
  }
  const head = (title, sub) => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div><button class="close" data-close aria-label="닫기">✕</button></div>`;

  // ───────── 장소 상세 ─────────
  function openPlace(id) {
    const p = placeById(id); if (!p) return;
    state.selected = id;
    markView(p);
    // 모바일에서 핀을 눌러 이미 경로를 그린 가게면 다시 그리지 않음 (자세히 보기로 넘어갈 때 모션 반복 방지)
    if (state.mapReady && state.routeFor === id) MapKit.fitRoute?.(routePad());
    else if (state.mapReady) {
      const wi = walkInfo(p.lat, p.lng);
      if (wi.path && MapKit.showRoute) { MapKit.showRoute(wi.path, routePad()); state.routeFor = id; } else { MapKit.clearRoute?.(); focusPlace(p); state.routeFor = null; }
    }
    renderMarkers();
    renderPlace(id);
  }
  function renderPlace(id) {
    const p = placeById(id); if (!p) return closeSheet();
    const st = stats(p), l = links(p), me = state.user.uid, img = curImage(p);
    const mineAny = st.rs.some((r) => r.uid === me), others = st.rs.some((r) => r.uid !== me);
    const myFirst = st.first.some((r) => r.uid === me);   // 이미 처음 기록을 남긴 곳이면 → 재방문 기록
    // 그 멤버의 몇 번째 방문인지 (오래된 기록부터 1, 2, 3…)
    const nth = (r) => st.visited.filter((x) => x.uid === r.uid && x.createdAt <= r.createdAt).length;
    const whoBtn = (r) => member(r.userName) ? `<button class="who who-link" data-who-go="${esc(r.userName)}">${esc(r.userName)}님</button>` : `<span class="who">${esc(r.userName)}님</span>`;
    const reviews = st.visited.map((r) => `<div class="review${isRevisit(r) ? " revisit" : ""}">${avatar(r.userName, true)}<div class="review-body">
        <div class="review-top">${whoBtn(r)}<span class="when">${ago(r.createdAt)}</span></div>
        ${isRevisit(r) ? `<div class="tags"><span class="tag again">🔁 재방문 · ${nth(r)}번째</span></div>`
          : `<div class="stars-s">${starsTxt(r.rating)}</div>
        <div class="tags">${r.wait ? `<span class="tag">${WAIT[r.wait]}</span>` : ""}${r.solo ? `<span class="tag">${SOLO[r.solo]}</span>` : ""}${r.price ? `<span class="tag">${won(r.price)}</span>` : ""}</div>`}
        ${r.menu ? `<div class="review-menu">${isRevisit(r) ? "먹은 메뉴" : "추천 메뉴"} <b>${esc(r.menu)}</b></div>` : ""}
        ${(r.picks || []).length ? `<div class="tags">${r.picks.filter((k) => PICKS[k]).map((k) => `<span class="tag pick">${PICKS[k]}</span>`).join("")}</div>` : ""}
        ${r.memo ? `<p class="review-memo">${esc(r.memo)}</p>` : ""}
        ${r.thumb ? `<button class="review-ph" data-rph="${esc(r.id)}" aria-label="사진 크게 보기"><img src="${r.thumb}" alt="" />${r.photoCount > 1 ? `<span>+${r.photoCount - 1}</span>` : ""}</button>` : ""}
        ${r.uid === me ? `<div class="mine-acts"><button class="del" data-edit="${esc(r.id)}">수정</button><span aria-hidden="true">·</span><button class="del" data-del="${esc(r.id)}">삭제</button></div>` : isAdmin() ? `<button class="del" data-del="${esc(r.id)}">기록 삭제 (관리자)</button>` : ""}</div></div>`).join("");
    const wishers = st.wish.length ? `<p class="wishers">♡ 가고 싶은 멤버 ${st.wish.map((r) => `<b>${esc(r.userName)}님</b>${r.menu ? ` (${esc(r.menu)})` : ""}${r.memo ? ` · <span class="wish-memo">“${esc(r.memo)}”</span>` : ""}${r.uid === me ? ` <button class="link" data-edit="${esc(r.id)}">수정</button> <button class="link" data-del="${esc(r.id)}">취소</button>` : isAdmin() ? ` <button class="link" data-del="${esc(r.id)}">취소</button>` : ""}`).join(", ")}</p>` : "";
    const canDelCover = img && isAdmin();   // 대표 사진 올리기·빼기는 관리자만 (멤버는 기록 사진이 자동으로 대표 사진이 됨)
    const hero = `<div class="hero">${thumbHTML(p, "thumb").replace('class="thumb"', 'style="position:absolute;inset:0"')}
        <div class="hero-cap">${img ? `<span class="hero-who">📷 ${img.by ? `${esc(img.by)}님 사진` : `${esc(img.from || "대표")} 사진`}</span>` : (() => { const r = state.reviews.filter((x) => x.placeId === p.id && x.thumb).sort((a, b) => b.createdAt - a.createdAt)[0];
          return `<span class="hero-who">${r ? `📷 ${esc(r.userName || "멤버")}님 사진${r.menu ? ` · ${esc(r.menu)}` : ""}` : isAdmin() ? "아직 대표 사진이 없어요" : "기록에 사진을 남기면 여기 보여요"}</span>`; })()}
          <span class="hero-btns">${p.images?.length > 1 ? `<button data-act="nextimg">다른 사진</button>` : ""}${canDelCover ? `<button data-act="delcover">빼기</button>` : ""}${isAdmin() ? `<label class="hero-up"><input type="file" accept="image/*" hidden id="coverIn" />📷 ${img ? "사진 추가" : "대표 사진 올리기"}</label>` : ""}</span></div></div>`;
    const s = showSheet(`
      ${head(`${esc(p.name)}${heartHTML(p.id, "big")}`, `<span class="cat-line">${emojiFor(p)} ${esc(p.category || "기타")}${p.note ? ` · ${esc(p.note)}` : ""}<button class="link cat-edit" data-act="editcat">종류 수정</button></span>${(() => { const wi = walkInfo(p.lat, p.lng); return wi.m ? `<b>사옥에서 걸어서 ${wi.min}분 · ${wi.m >= 1000 ? (wi.m / 1000).toFixed(1) + "km" : wi.m + "m"}</b>` : `<b>사옥에서 도보 약 ${wi.min}분</b>`; })()}${p.address && /\d/.test(p.address) ? `<span class="addr-line">📍 ${esc(p.address)}</span>` : ""}${p.createdByName ? `<span>${p.createdByName === "기본 등록" ? "기본 등록" : `${esc(p.createdByName)}님이 등록`}</span>` : ""}${st.visits >= 2 ? `<span class="again">🔁 멤버들이 ${st.visits}번 다녀왔어요${st.visits >= AGAIN && p.category !== "카페" ? " · 또간집" : ""}</span>` : ""}${viewersOf(p).length ? `<span>👀 멤버 ${viewersOf(p).length}명이 봤어요</span>` : ""}`)}
      ${hero}
      <div class="stats">
        <div class="stat"><div class="k">별점</div><div class="v">${st.count ? `★ ${st.avg.toFixed(1)}` : "–"}</div></div>
        <div class="stat"><div class="k">웨이팅</div><div class="v">${st.wait ? WAIT_S[st.wait] : "–"}</div></div>
        <div class="stat"><div class="k">혼밥</div><div class="v">${st.solo ? SOLO_S[st.solo] : "–"}</div></div>
        <div class="stat"><div class="k">평균</div><div class="v">${st.price ? `${(st.price / 1000).toFixed(st.price % 1000 ? 1 : 0)}천원` : "–"}</div></div>
      </div>
      <div class="stack">
        <button class="btn btn-primary btn-block" data-act="review">${myFirst ? "🔁 재방문 기록 남기기" : "기록 남기기"}</button>
        ${mineAny ? "" : `<button class="btn btn-secondary btn-block" data-act="wish">♡ 찜하고 메모 남기기</button>`}
        <button class="btn btn-plain btn-block" data-act="meet">🍽 여기로 오늘 약속 만들기</button>
        <div class="btns"><a class="btn btn-plain" href="${l.naver}" data-dir="naver" target="_blank" rel="noopener">네이버 길찾기</a><a class="btn btn-plain" href="${l.kakao}" data-dir="kakao" target="_blank" rel="noopener">카카오 길찾기</a></div>
        <p class="dir-note">출발 ${esc(C.office.mapName || C.office.name)} · 도보 경로로 열려요</p>
      </div>
      ${st.picks.length ? `<div class="h3">멤버 추천 포인트</div><div class="picks">${st.picks.map(([k, n]) => `<span class="pick-agg">${PICKS[k]}<b>${n}</b></span>`).join("")}</div>` : ""}
      ${wishers}
      <div class="h3 menu-h">메뉴판<label class="link menu-add"><input type="file" accept="image/*" multiple hidden id="menuIn" />＋ 메뉴판 사진 올리기</label></div>
      <div class="menu-board" id="menuBoard"><p class="empty" style="padding:4px 0">아직 메뉴판 사진이 없어요. 가게에서 찍어두면 다음 사람이 메뉴 고르기 쉬워요.</p></div>
      <div class="gallery" id="gallery" hidden></div>
      <div class="h3">멤버 기록 ${st.visits}${st.revisits ? `<span class="h3-n">재방문 ${st.revisits}</span>` : ""}</div>
      ${reviews || `<p class="empty" style="padding:8px 0">아직 가본 멤버의 기록이 없어요. 다녀왔다면 첫 기록을 남겨주세요.</p>`}
      ${isAdmin() ? `<div class="admin-tools"><span class="admin-tag">관리자</span><button class="link" data-act="editplace">장소 정보 수정</button><button class="link danger" data-act="delplace">장소와 기록 모두 삭제</button></div>`
        : p.createdBy === me && !others ? `<button class="del" data-act="delplace" style="margin-top:18px">이 장소 삭제</button>` : ""}
    `, "place");
    $$("[data-dir]", s).forEach((b) => (b.onclick = (e) => { e.preventDefault(); openDir(b.dataset.dir, p); }));
    $("[data-act=review]", s).onclick = () => openReviewForm(p.id, myFirst ? "revisit" : "visited");
    // 기록 쓴 멤버 이름 → 그 멤버가 다녀온 곳 (모바일은 상세를 닫고 목록을 올려서 보여줌)
    $$("[data-who-go]", s).forEach((b) => (b.onclick = () => { const n = b.dataset.whoGo; if (!desk()) { closeSheet(); setPanel("open"); } showWho(n); }));
    const w = $("[data-act=wish]", s); if (w) w.onclick = () => openReviewForm(p.id, "wish");
    bindFav(s);
    $("[data-act=meet]", s).onclick = () => openMeetForm(p.id);
    const ci = $("#coverIn", s);
    if (ci) ci.onchange = async () => {
      const file = ci.files[0]; if (!file) return;
      toast("대표 사진을 올리는 중이에요");
      try {
        const ph = await preparePhoto(file);
        const pid = await state.store.addPhoto({ placeId: p.id, kind: "cover", reviewId: "", uid: me, userName: state.user.name, menu: "", data: ph.full });
        const cur = placeById(p.id), list = [...(cur.images || []), { image: ph.thumb, photoId: pid || "", by: state.user.name, uid: me, from: "멤버" }].slice(-5);
        await state.store.updatePlace(p.id, { images: list, imageIdx: list.length - 1 });
        toast("대표 사진을 올렸어요. 목록에도 바로 보여요");
      } catch (e) { console.error(e); toast("사진을 올리지 못했어요"); }
      ci.value = "";
    };
    const dc = $("[data-act=delcover]", s);
    if (dc) dc.onclick = async () => {
      if (!confirm("이 대표 사진을 뺄까요?")) return;
      const cur = placeById(p.id), it = curImage(cur), list = (cur.images || []).filter((x) => x !== it);
      await state.store.updatePlace(p.id, { images: list, imageIdx: 0 });
      if (it?.photoId) state.store.deletePhoto?.(it.photoId).catch(() => {});
      toast("뺐어요");
    };
    const ni = $("[data-act=nextimg]", s); if (ni) ni.onclick = () => state.store.updatePlace(p.id, { imageIdx: ((p.imageIdx || 0) + 1) % p.images.length });
    $$("[data-edit]", s).forEach((b) => (b.onclick = () => { const r = state.reviews.find((x) => x.id === b.dataset.edit); if (r) openReviewForm(r.placeId, r.status, r.id); }));
    $$("[data-del]", s).forEach((b) => (b.onclick = async () => { if (!confirm("이 기록을 삭제할까요?")) return; await state.store.deleteReview(b.dataset.del); state.store.deletePhotosOf?.("reviewId", b.dataset.del); toast("삭제했어요"); }));
    // 멤버 사진: 가게를 열 때만 원본을 불러와서 사진 모음 + 상단 대표 사진으로
    const loadPhotos = () => state.store.listPhotos ? state.store.listPhotos(p.id).then((all) => {
        if (state.selected !== p.id || state.sheet !== "place") return;
        // 기록을 수정해 메뉴가 바뀌었으면 사진 설명도 지금 기록의 메뉴로
        all = all.map((x) => { const r = x.reviewId && state.reviews.find((y) => y.id === x.reviewId); return r ? { ...x, menu: r.menu || "" } : x; });
        const menus = all.filter((x) => x.kind === "menu"), list = all.filter((x) => x.kind !== "menu");
        const mb = $("#menuBoard", s);
        if (mb && menus.length) {
          mb.innerHTML = `<div class="gallery-row">${menus.map((ph, i) => `<div class="menu-ph"><button class="gal menu" data-mb="${i}"><img src="${ph.data}" alt="메뉴판 ${i + 1}" /></button><div class="menu-by">${esc(ph.userName || "멤버")}님 · ${ago(ph.createdAt)}${ph.uid === me || isAdmin() ? ` · <button class="link danger" data-mb-del="${esc(ph.id)}">삭제</button>` : ""}</div></div>`).join("")}</div>`;
          $$("[data-mb]", mb).forEach((b) => (b.onclick = () => openLightbox(menus.map((x) => x.data), +b.dataset.mb, `${p.name} 메뉴판`)));
          $$("[data-mb-del]", mb).forEach((b) => (b.onclick = async () => { if (!confirm("이 메뉴판 사진을 삭제할까요?")) return; await state.store.deletePhoto(b.dataset.mbDel); toast("삭제했어요"); loadPhotos(); }));
        }
        const g = $("#gallery", s);
        if (!list.length) return;
        if (g) g.innerHTML = `<div class="h3" style="margin-top:0">멤버 사진 ${list.length}</div><div class="gallery-row">${list.map((ph, i) => `<button class="gal" data-gal="${i}"><img src="${ph.data}" alt="" />${ph.menu ? `<span>${esc(ph.menu)}</span>` : ""}</button>`).join("")}</div>`;
        if (g) g.hidden = false;
        if (g) $$("[data-gal]", g).forEach((b) => (b.onclick = () => openLightbox(list.map((x) => x.data), +b.dataset.gal)));
        $$("[data-rph]", s).forEach((b) => (b.onclick = () => { const mine = list.filter((x) => x.reviewId === b.dataset.rph); if (mine.length) openLightbox(mine.map((x) => x.data)); }));
        const hi = $(".hero img", s), hero = $(".hero", s), cov = curImage(p);
        if (hero && cov) { const full = all.find((x) => x.id === cov.photoId); if (full && hi) hi.src = full.data; }
        else if (hero) {
          if (hi) hi.src = list[0].data; else hero.insertAdjacentHTML("afterbegin", `<img src="${list[0].data}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`);
          const who = $(".hero-who", hero); if (who) who.textContent = `📷 ${list[0].userName || "멤버"}님 사진${list[0].menu ? ` · ${list[0].menu}` : ""}`;
        }
      }).catch(() => {}) : null;
    loadPhotos();
    // 메뉴판 사진 올리기 (누구나, 여러 장)
    const mi = $("#menuIn", s);
    if (mi) mi.onchange = async () => {
      const files = [...mi.files].filter((x) => x.type.startsWith("image/")).slice(0, 6);
      if (!files.length) return;
      if (state.store.demo && files.length) toast("미리보기에서는 이 브라우저에만 저장돼요");
      let ok = 0;
      for (const file of files) {
        toast(`메뉴판 올리는 중 ${ok + 1}/${files.length}`);
        try { await state.store.addPhoto({ placeId: p.id, kind: "menu", reviewId: "", uid: state.user.uid, userName: state.user.name, menu: "", data: await prepareMenuPhoto(file) }); ok++; }
        catch (e) { console.error(e); toast("이 사진은 올리지 못했어요"); }
      }
      if (ok) { toast(`메뉴판 사진 ${ok}장을 올렸어요`); loadPhotos(); }
      mi.value = "";
    };
    const ep = $("[data-act=editplace]", s); if (ep) ep.onclick = () => openEditPlace(p);
    const ec = $("[data-act=editcat]", s); if (ec) ec.onclick = () => openEditPlace(p);
    const dp = $("[data-act=delplace]", s);
    if (dp) dp.onclick = async () => { if (!confirm("이 장소와 내 기록을 삭제할까요?")) return; for (const r of st.rs) await state.store.deleteReview(r.id); await state.store.deletePhotosOf?.("placeId", p.id); await state.store.deletePlace(p.id); closeSheet(); toast("장소를 삭제했어요"); };
  }

  // ───────── 장소 추가: 검색 ─────────
  function openAdd() {
    const s = showSheet(`
      ${head("장소 추가", "<span>가게 이름으로 찾아보세요</span>")}
      <div class="field"><input class="input" id="q" placeholder="예: 어서와칼국수" autocomplete="off" enterkeyhint="search" /></div>
      <div class="results" id="results"></div>
      <div class="add-alt"><span>검색에 안 나오나요?</span><button class="btn btn-plain" id="addrMode">📍 주소로 등록</button><button class="btn btn-plain" id="pinMode">🗺 지도에서 찍기</button></div>
    `, "add");
    const q = $("#q", s);
    let t;
    q.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(q.value.trim()), 250); };
    $("#pinMode", s).onclick = startPinMode;
    $("#addrMode", s).onclick = () => openAddrForm(q.value.trim());
    setTimeout(() => q.focus(), 60);
  }
  async function runSearch(query) {
    const box = $("#results");
    if (!box) return;
    if (!query) { box.innerHTML = ""; return; }
    const list = await MapKit.search(query);
    if (state.sheet !== "add") return;
    box.innerHTML = list.length ? list.slice(0, 12).map((r, i) => {
      const exists = state.places.find((p) => (r.kakaoId && p.kakaoId === r.kakaoId) || p.name.replace(/\s/g, "") === r.name.replace(/\s/g, ""));
      return `<button class="result" data-i="${i}"><div style="flex:1;min-width:0"><div class="nm">${esc(r.name)}${exists ? ` <span class="tag">이미 있음</span>` : ""}</div><div class="ad">${emojiFor({ name: r.name, category: catFrom(r.categoryRaw, r.name) })} ${esc(catFrom(r.categoryRaw, r.name))} · ${esc(r.address || "")}</div></div><span class="ds">도보 ${walkMin(r.lat, r.lng)}분</span></button>`;
    }).join("") : `<p class="empty">검색 결과가 없어요. 이름을 줄여서 찾거나, 아래 <b>주소로 등록</b>을 눌러주세요.</p>`;
    $$("[data-i]", box).forEach((b) => (b.onclick = () => pickResult(list[+b.dataset.i])));
  }
  async function pickResult(r) {
    const exists = state.places.find((p) => (r.kakaoId && p.kakaoId === r.kakaoId) || p.name.replace(/\s/g, "") === r.name.replace(/\s/g, ""));
    if (exists) return openPlace(exists.id);
    // 검색 결과로 등록할 때도 종류를 한 번 고르게 (자동으로 추측한 종류를 미리 골라둠)
    const guess = catFrom(r.categoryRaw, r.name);
    const f = { category: guess === "기타" ? "" : guess, note: "" };
    f.note = subGuess(f.category, r.name);
    const render = () => {
      const s = showSheet(`
        ${head(esc(r.name), `<b>사옥에서 도보 ${walkMin(r.lat, r.lng)}분</b>${r.address ? `<span>${esc(r.address)}</span>` : ""}`)}
        <div class="field"><span class="flabel">어떤 종류인가요? <span class="opt">${guess !== "기타" ? "자동으로 골라뒀어요 · 다르면 바꿔주세요" : "하나 골라주세요"}</span></span>${catPickHTML(f.category, f.note)}<p class="err" id="cerr"></p></div>
        <div class="stack" style="margin-top:24px"><button class="btn btn-primary btn-block" id="csave">저장하고 기록 남기기</button></div>
      `, "add");
      bindCatPick(s, f, render);
      $("#csave", s).onclick = async () => {
        if (!f.category) { $("#cerr", s).textContent = "종류를 하나 골라주세요."; return; }
        $("#csave", s).disabled = true;
        await createPlace({ name: r.name, category: f.category, note: f.note.slice(0, 12), lat: r.lat, lng: r.lng, address: r.address || "", kakaoId: r.kakaoId || "", placeUrl: r.placeUrl || "" });
      };
    };
    render();
  }
  // 종류 고르기 칩 (등록·수정 공통): 한 줄에 큰 분류만, 하나만 선택
  const catChipsHTML = (cur, key = "cat") => `<div class="chips cat-pick">${CATS.map((c) => `<button class="chip" data-${key}="${c}" aria-pressed="${cur === c}">${catLabel(c)}</button>`).join("")}</div>`;
  // 큰 분류 + 세부 종류(선택). f[catKey] / f[subKey]를 바꾸고 render로 다시 그림
  function catPickHTML(cat, sub) {
    const subs = SUBS[cat] || [], own = sub && !subs.includes(sub) ? sub : "";
    return catChipsHTML(cat, "cp") + (cat ? `<div class="sub-pick"><span class="sub-l">세부 종류 <span class="opt">선택 · 목록에 보여요</span></span>
      <div class="chips sub">${subs.map((x) => `<button class="chip" data-cp-sub="${esc(x)}" aria-pressed="${sub === x}">${esc(x)}</button>`).join("")}<input class="input sub-in" data-cp-own maxlength="12" placeholder="직접 입력" value="${esc(own)}" /></div></div>` : "");
  }
  function bindCatPick(s, f, render, catKey = "category", subKey = "note") {
    $$("[data-cp]", s).forEach((b) => (b.onclick = () => { if (f[catKey] !== b.dataset.cp) { f[catKey] = b.dataset.cp; f[subKey] = ""; } render(); }));
    $$("[data-cp-sub]", s).forEach((b) => (b.onclick = () => { f[subKey] = f[subKey] === b.dataset.cpSub ? "" : b.dataset.cpSub; render(); }));
    const own = $("[data-cp-own]", s);
    if (own) { own.oninput = () => { f[subKey] = own.value.trim(); $$("[data-cp-sub]", s).forEach((b) => b.setAttribute("aria-pressed", "false")); }; }
  }
  async function createPlace(d) {
    try {
      const data = { ...d, images: [], imageIdx: 0, createdBy: state.user.uid, createdByName: state.user.name };
      const id = await state.store.addPlace(data);
      state.pending = { id, ...data, createdAt: Date.now() };
      toast("장소를 저장했어요");
      loadImages(state.pending);
      if (state.mapReady) focusPlace(state.pending);
      openReviewForm(id, "visited");
    } catch (e) { console.error(e); toast("저장하지 못했어요. 로그인 상태를 확인해 주세요"); }
  }

  // ───────── 장소 추가: 지도에서 직접 찍기 ─────────
  function startPinMode() {
    if (!state.mapReady) return toast("지도가 아직 준비되지 않았어요");
    $("#sheet").hidden = true; $("#scrim").hidden = true; state.sheet = null;
    state.adding = true; $("#addbar").hidden = false; $("#fab").hidden = true; MapKit.setAdding(true);
  }
  function stopAdding() {
    state.adding = false; $("#addbar").hidden = true; $("#fab").hidden = false; MapKit.setAdding?.(false);
    state.ghost?.remove(); state.ghost = null;
  }
  // ───────── 장소 추가: 주소로 찾기 → 지도에 핀 → 위치 확인 후 저장 ─────────
  function openAddrForm(nameHint = "") {
    let addr = "", busy = false, msg = "", hint = null;
    const render = () => {
      const s = showSheet(`
        ${head("주소로 등록", "<span>도로명 주소가 가장 정확해요</span>")}
        <div class="field"><label class="flabel" for="addrQ">가게 주소</label><input class="input" id="addrQ" placeholder="예: 동교로 194, 와우산로29가길 4" value="${esc(addr)}" autocomplete="off" enterkeyhint="search" /><p class="err" id="aerr" style="line-height:1.5">${msg}</p></div>
        <div class="stack"><button class="btn btn-primary btn-block" id="addrGo" ${busy ? "disabled" : ""}>${busy ? "찾는 중…" : "지도에서 위치 찾기"}</button>
          ${msg ? `<button class="btn btn-secondary btn-block" id="addrPin">${hint ? `${esc(hint.label)} 근처에서 직접 찍기` : "이 주소로 지도에서 직접 찍기"}</button>` : ""}</div>
        <p class="hint">네이버·카카오 지도에서 가게를 찾아 <b>도로명 주소</b>를 복사해 붙여넣으면 편해요. 찾은 뒤 위치가 조금 다르면 지도를 눌러 옮길 수 있어요.</p>
      `, "add");
      const i = $("#addrQ", s); i.oninput = () => (addr = i.value);
      i.onkeydown = (e) => { if (e.key === "Enter") go(); };
      $("#addrGo", s).onclick = go;
      const ap = $("#addrPin", s); if (ap) ap.onclick = () => { state.form = { pinDraft: true, name: nameHint, category: "", note: "", address: addr.trim().replace(/\s+/g, " ") }; startPinMode(); if (hint) MapKit.focus(hint.lat, hint.lng, 0, 0); toast("가게 위치를 지도에서 눌러주세요"); };
      if (!addr) setTimeout(() => i.focus(), 60);
    };
    const go = async () => {
      if (busy) return;
      if (!addr.trim()) { msg = ""; $("#aerr").textContent = "주소를 적어주세요."; return; }
      busy = true; msg = ""; render();
      const r = await MapKit.geocode?.(addr.trim());
      busy = false;
      hint = r?.roadOnly ? r : null;
      if (!r || r.roadOnly) { msg = r?.roadOnly ? `지도 데이터에 이 건물 번호가 없어서 정확한 위치를 못 찾았어요. 아래 버튼을 누르면 ${esc(r.label)} 근처로 지도를 옮겨드릴게요. 가게 위치를 직접 눌러주세요.` : "이 주소를 지도에서 찾지 못했어요. 지번(○○동 123-4) 말고 도로명 주소(예: 동교로 194)로 넣거나, 지도에서 직접 찍어주세요."; return render(); }
      if (walkMin(r.lat, r.lng, true) > 40) { msg = "찾은 위치가 사옥에서 너무 멀어요. 주소를 다시 확인하거나 지도에서 직접 찍어주세요."; return render(); }
      state.form = { pinDraft: true, name: nameHint, category: "", note: "", address: addr.trim().replace(/\s+/g, " "), approx: !r.exact, found: r.label };
      startPinMode();
      placeGhost(r.lat, r.lng);
      // 모바일: 찾은 위치가 아래 입력창에 가리지 않게, 위 버튼줄과 입력창 사이 가운데로
      if (desk()) MapKit.focus(r.lat, r.lng, 0, 0);
      else { const sh = $("#sheet"), top = $("#filterbar").getBoundingClientRect().bottom, bottom = innerHeight - sh.offsetHeight;
        MapKit.focus(r.lat, r.lng, 0, Math.round((top + Math.max(top + 80, bottom)) / 2 - innerHeight / 2)); }
    };
    render();
  }
  function placeGhost(lat, lng) {
    state.ghost?.remove();
    const g = document.createElement("div");
    g.className = "ghost";
    state.ghost = MapKit.add(g, lat, lng, "center");
    openPinForm(lat, lng);
  }
  function openPinForm(lat, lng) {
    // 이름·종류·주소를 적다가 지도를 다시 눌러 위치를 옮겨도 적은 내용은 그대로
    const prev = state.form?.pinDraft ? state.form : {};
    state.form = { pinDraft: true, name: prev.name || "", category: prev.category || "", note: prev.note || "", address: prev.address || "", addrAuto: !!prev.addrAuto, approx: !!prev.approx && prev.lat == null, found: prev.lat == null ? prev.found || "" : "", lat, lng };
    // 지도에서 찍은 곳: 주소칸이 비었거나 자동으로 채운 값이면, 찍은 위치의 도로명 주소로 채움 (직접 적은 주소는 그대로)
    if ((!state.form.address || state.form.addrAuto) && MapKit.reverse) {
      const f0 = state.form;
      MapKit.reverse(lat, lng).then((a) => {
        if (!a || state.form !== f0 || (f0.address && !f0.addrAuto)) return;
        f0.address = a; f0.addrAuto = true;
        const el = $("#paddr"); if (el && document.activeElement !== el) el.value = a;
      });
    }
    const render = () => {
      const f = state.form;
      const s = showSheet(`
        ${head("새 장소", `<b>사옥에서 도보 ${walkMin(lat, lng)}분</b><span>위치가 다르면 지도를 다시 눌러주세요</span>`)}
        ${f.approx ? `<p class="addr-warn">📍 지도 데이터에 이 건물 번호가 없어서 <b>같은 길 가까운 곳(${esc(f.found || "")})</b>에 찍었어요. 네이버·카카오 지도와 비교해서 지도를 눌러 가게 위치로 옮겨주세요.</p>` : f.found ? `<p class="addr-ok">📍 ${esc(f.found)} 위치로 찍었어요</p>` : ""}
        <div class="field"><label class="flabel" for="pname">가게 이름</label><input class="input" id="pname" maxlength="30" placeholder="간판에 적힌 이름 그대로" value="${esc(f.name)}" autocomplete="off" /><p class="err" id="perr"></p></div>
        <div class="field"><span class="flabel">종류</span>${catPickHTML(f.category, f.note)}<p class="err" id="cerr"></p></div>
        <div class="field"><label class="flabel" for="paddr">주소 <span class="opt">찍은 위치로 자동 입력 · 고쳐도 돼요</span></label><input class="input" id="paddr" maxlength="60" placeholder="예: 동교로 194" value="${esc(f.address)}" autocomplete="off" /></div>
        <div class="stack" style="margin-top:24px"><button class="btn btn-primary btn-block" id="psave">저장하고 기록 남기기</button></div>
      `, "pin");
      $("#scrim").hidden = true;
      const i = $("#pname", s); i.oninput = () => { f.name = i.value; $("#perr", s).textContent = ""; };
      const ad = $("#paddr", s); ad.oninput = () => { f.address = ad.value; f.addrAuto = false; };
      bindCatPick(s, f, render);
      $("#psave", s).onclick = async () => {
        const name = f.name.trim();
        if (!name) { $("#perr", s).textContent = "가게 이름을 적어주세요."; return; }
        if (!f.category) { $("#cerr", s).textContent = "종류를 하나 골라주세요."; return; }
        const dup = state.places.find((p) => p.name.replace(/\s/g, "") === name.replace(/\s/g, ""));
        if (dup) { stopAdding(); return openPlace(dup.id); }
        $("#psave", s).disabled = true;
        stopAdding();
        await createPlace({ name, category: f.category, note: f.note.slice(0, 12), lat, lng, address: f.address.trim().slice(0, 60), kakaoId: "", placeUrl: "" });
      };
      if (!f.name) setTimeout(() => i.focus(), 60);
    };
    render();
  }

  // ───────── 기록 남기기 ─────────
  function openReviewForm(placeId, status, editId) {
    const p = placeById(placeId); if (!p) return;
    state.selected = placeId;
    const old = editId ? state.reviews.find((r) => r.id === editId && r.uid === state.user.uid) : null;
    if (editId && !old) return toast("내가 남긴 기록만 수정할 수 있어요");
    // status "revisit" = 재방문 기록 (저장은 다녀온 기록 + kind: "revisit", 별점 없음)
    const revisit = old ? isRevisit(old) : status === "revisit";
    state.form = old
      ? { editId, revisit, status: old.status, rating: +old.rating || 0, wait: old.wait || "", solo: old.solo || "", menu: old.menu || "", price: old.price ? String(old.price) : "", picks: [...(old.picks || [])].filter((k) => PICKS[k]), memo: old.memo || "", photos: [], removed: [], busy: !!old.photoCount }
      : { revisit, status: revisit ? "visited" : status, rating: 0, wait: "", solo: "", menu: "", price: "", picks: [], memo: "", photos: [], busy: false };
    if (revisit) return renderRevisitForm(p);
    // 수정: 이 기록에 붙은 사진을 불러와서 빼거나 더할 수 있게
    if (old?.photoCount && state.store.listPhotos) state.store.listPhotos(placeId).then((all) => {
      const f = state.form; if (!f || f.editId !== editId) return;
      f.photos = all.filter((x) => x.reviewId === editId).sort((a, b) => a.createdAt - b.createdAt).map((x) => ({ id: x.id, thumb: x.data, full: x.data, existing: true }));
      f.busy = false; if (state.sheet === "review") render();
    }).catch(() => { state.form.busy = false; render(); });
    else state.form.busy = false;
    const render = () => {
      const f = state.form, v = f.status === "visited";
      const chips = (k, m) => Object.entries(m).map(([key, label]) => `<button class="chip" data-${k}="${key}" aria-pressed="${f[k] === key}">${label}</button>`).join("");
      const s = showSheet(`
        ${head(esc(p.name), f.editId ? "<span>내 기록 수정</span>" : "<span>30초면 끝나요</span>")}
        <div class="field"><div class="seg"><button data-status="visited" aria-pressed="${v}">가봤어요</button><button data-status="wish" aria-pressed="${!v}">♡ 가고 싶어요</button></div></div>
        ${v ? `
          <div class="field"><span class="flabel">별점</span><div class="stars half" role="group" aria-label="별점 (0.5점 단위)">${[1, 2, 3, 4, 5].map((n) => `<span class="st" data-fill="${f.rating >= n ? "full" : f.rating >= n - 0.5 ? "half" : ""}"><button data-star="${n - 0.5}" aria-label="${n - 0.5}점" aria-pressed="${f.rating === n - 0.5}"></button><button data-star="${n}" aria-label="${n}점" aria-pressed="${f.rating === n}"></button></span>`).join("")}<span class="star-v">${f.rating ? `${f.rating.toFixed(1)}점` : "0.5점 단위"}</span></div><p class="err" id="rerr"></p></div>
          <div class="field"><span class="flabel">점심시간 웨이팅</span><div class="chips">${chips("wait", WAIT)}</div></div>
          <div class="field"><span class="flabel">혼밥</span><div class="chips">${chips("solo", SOLO)}</div></div>
          <div class="field"><label class="flabel" for="rmenu">추천 메뉴</label><input class="input" id="rmenu" maxlength="40" placeholder="제육 정식" value="${esc(f.menu)}" /></div>
          <div class="field"><label class="flabel" for="rprice">내가 낸 가격 <span class="opt">만원 미만이면 💸 거지맵에 들어가요</span></label><input class="input" id="rprice" inputmode="numeric" maxlength="7" placeholder="9000" value="${esc(f.price)}" /></div>
          <div class="field"><span class="flabel">추천 포인트 <span class="opt">최대 ${MAX_PICKS}개</span></span><div class="chips wrap">${Object.entries(PICKS).map(([k, l]) => `<button class="chip" data-pick="${k}" aria-pressed="${f.picks.includes(k)}">${l}</button>`).join("")}</div></div>
          <div class="field"><label class="flabel" for="rmemo">한 줄 메모 <span class="opt">선택 · 팁, 추천, 주의할 점</span></label><textarea class="input memo" id="rmemo" maxlength="100" rows="2" placeholder="2층 창가 자리가 넓어요 · 점심 세트에 음료 포함">${esc(f.memo)}</textarea><div class="memo-n" id="rmemoN">${f.memo.length}/100</div></div>
          <div class="field"><span class="flabel">사진 <span class="opt">선택 · 최대 3장 · 첫 장이 목록 대표 사진이 돼요</span></span>
            <div class="photo-pick">${f.photos.map((ph, i) => `<div class="ph-item"><img src="${ph.thumb}" alt="" /><button type="button" data-ph-del="${i}" aria-label="사진 빼기">✕</button></div>`).join("")}
              ${f.photos.length < 3 ? `<label class="ph-add"${f.busy ? ' aria-busy="true"' : ""}><input type="file" accept="image/*" multiple hidden id="rphoto" /><span>${f.busy ? "…" : "＋"}</span><small>${f.busy ? "준비 중" : "사진 추가"}</small></label>` : ""}</div>
            <p class="err" id="phErr"></p></div>`
        : `<div class="field"><label class="flabel" for="rmenu">먹어보고 싶은 메뉴 <span class="opt">선택</span></label><input class="input" id="rmenu" maxlength="40" placeholder="더블 치즈버거" value="${esc(f.menu)}" /></div>
           <div class="field"><label class="flabel" for="rmemo">메모 <span class="opt">선택 · 왜 가고 싶은지, 누구랑 가고 싶은지</span></label><textarea class="input memo" id="rmemo" maxlength="100" rows="2" placeholder="인스타에서 봤는데 웨이팅 있대요 · 금요일에 같이 가요">${esc(f.memo)}</textarea><div class="memo-n" id="rmemoN">${f.memo.length}/100</div></div>`}
        <div class="stack" style="margin-top:26px"><button class="btn btn-primary btn-block" id="rsave">${f.editId ? "수정 완료" : "기록 저장"}</button>${f.editId ? `<button class="btn btn-plain btn-block danger-text" id="rdel">이 기록 삭제</button>` : ""}</div>
      `, "review");
      $$("[data-status]", s).forEach((b) => (b.onclick = () => { f.status = b.dataset.status; render(); }));
      $$("[data-star]", s).forEach((b) => (b.onclick = () => { f.rating = +b.dataset.star; render(); }));
      $$("[data-wait]", s).forEach((b) => (b.onclick = () => { f.wait = f.wait === b.dataset.wait ? "" : b.dataset.wait; render(); }));
      $$("[data-solo]", s).forEach((b) => (b.onclick = () => { f.solo = f.solo === b.dataset.solo ? "" : b.dataset.solo; render(); }));
      const m = $("#rmenu", s); if (m) m.oninput = () => (f.menu = m.value);
      const mm = $("#rmemo", s); if (mm) mm.oninput = () => { f.memo = mm.value; $("#rmemoN", s).textContent = `${mm.value.length}/100`; };
      $$("[data-pick]", s).forEach((b) => (b.onclick = () => {
        const k = b.dataset.pick;
        if (f.picks.includes(k)) f.picks = f.picks.filter((x) => x !== k);
        else if (f.picks.length < MAX_PICKS) f.picks = [...f.picks, k];
        else { toast(`추천 포인트는 ${MAX_PICKS}개까지 고를 수 있어요`); return; }
        render();
      }));
      const pr = $("#rprice", s); if (pr) pr.oninput = () => { pr.value = pr.value.replace(/\D/g, ""); f.price = pr.value; };
      $$("[data-ph-del]", s).forEach((b) => (b.onclick = () => { const [x] = f.photos.splice(+b.dataset.phDel, 1); if (x?.existing) f.removed.push(x.id); render(); }));
      const rd = $("#rdel", s); if (rd) rd.onclick = async () => {
        if (!confirm("이 기록을 삭제할까요? 같이 올린 사진도 지워져요.")) return;
        await state.store.deleteReview(f.editId); state.store.deletePhotosOf?.("reviewId", f.editId);
        state.form = null; toast("기록을 삭제했어요"); openPlace(placeId);
      };
      const pi = $("#rphoto", s);
      if (pi) pi.onchange = async () => {
        const files = [...pi.files].filter((x) => x.type.startsWith("image/")).slice(0, 3 - f.photos.length);
        if (!files.length) return;
        f.busy = true; render();
        for (const file of files) {
          try { f.photos.push(await preparePhoto(file)); }
          catch { f.busy = false; render(); $("#phErr").textContent = "이 사진은 읽지 못했어요. JPG나 PNG로 다시 골라주세요."; return; }
        }
        f.busy = false; render();
      };
      $("#rsave", s).onclick = saveReview;
      $$("[data-close]", s).forEach((b) => (b.onclick = () => openPlace(placeId)));
    };
    render();
  }
  // 재방문 기록 폼: 별점·웨이팅·가격 없이 오늘 먹은 메뉴 · 추천 포인트 · 한 줄 메모만 (전부 선택)
  function renderRevisitForm(p) {
    const f = state.form, me = state.user.uid, st = stats(p);
    const at = f.editId ? state.reviews.find((x) => x.id === f.editId)?.createdAt || 0 : Infinity;
    const n = st.visited.filter((r) => r.uid === me && r.createdAt <= at).length + (f.editId ? 0 : 1);   // 이번이 몇 번째 방문인지
    const known = topMenus(st.visited, 6);   // 이 가게에서 멤버들이 적은 메뉴 — 누르면 바로 입력
    const s = showSheet(`
      ${head(esc(p.name), `<span class="again">🔁 ${n}번째 방문</span><span>${f.editId ? "재방문 기록 수정" : "별점 없이 간단하게"}</span>`)}
      <p class="revisit-note">별점은 처음 남긴 기록 그대로 두고, 이번에 먹은 것만 남겨요. 방문이 쌓이면 🔁 또간집과 멤버별 '자주 간 곳'에 반영돼요.</p>
      <div class="field"><label class="flabel" for="rmenu">오늘 먹은 메뉴 <span class="opt">선택</span></label><input class="input" id="rmenu" maxlength="40" placeholder="${esc(known[0] || "제육 정식")}" value="${esc(f.menu)}" />
        ${known.length ? `<div class="chips sub quick-menus" aria-label="이 가게에서 멤버들이 먹은 메뉴">${known.map((m) => `<button class="chip" data-qm="${esc(m)}" aria-pressed="${!!f.menu && menuKey(f.menu) === menuKey(m)}">${esc(m)}</button>`).join("")}</div>` : ""}</div>
      <div class="field"><span class="flabel">추천 포인트 <span class="opt">선택 · 최대 ${MAX_PICKS}개</span></span><div class="chips wrap">${Object.entries(PICKS).map(([k, l]) => `<button class="chip" data-pick="${k}" aria-pressed="${f.picks.includes(k)}">${l}</button>`).join("")}</div></div>
      <div class="field"><label class="flabel" for="rmemo">한 줄 메모 <span class="opt">선택</span></label><textarea class="input memo" id="rmemo" maxlength="100" rows="2" placeholder="이번엔 곱빼기로 · 새 메뉴 나왔어요">${esc(f.memo)}</textarea><div class="memo-n" id="rmemoN">${f.memo.length}/100</div></div>
      <div class="stack" style="margin-top:26px"><button class="btn btn-primary btn-block" id="rsave">${f.editId ? "수정 완료" : "재방문 기록 저장"}</button>${f.editId ? `<button class="btn btn-plain btn-block danger-text" id="rdel">이 기록 삭제</button>` : ""}</div>
    `, "review");
    const m = $("#rmenu", s); m.oninput = () => { f.menu = m.value; $$("[data-qm]", s).forEach((b) => b.setAttribute("aria-pressed", !!f.menu && menuKey(f.menu) === menuKey(b.dataset.qm))); };
    $$("[data-qm]", s).forEach((b) => (b.onclick = () => { f.menu = menuKey(f.menu) === menuKey(b.dataset.qm) ? "" : b.dataset.qm; renderRevisitForm(p); }));
    const mm = $("#rmemo", s); mm.oninput = () => { f.memo = mm.value; $("#rmemoN", s).textContent = `${mm.value.length}/100`; };
    $$("[data-pick]", s).forEach((b) => (b.onclick = () => {
      const k = b.dataset.pick;
      if (f.picks.includes(k)) f.picks = f.picks.filter((x) => x !== k);
      else if (f.picks.length < MAX_PICKS) f.picks = [...f.picks, k];
      else { toast(`추천 포인트는 ${MAX_PICKS}개까지 고를 수 있어요`); return; }
      renderRevisitForm(p);
    }));
    const rd = $("#rdel", s); if (rd) rd.onclick = async () => {
      if (!confirm("이 재방문 기록을 삭제할까요?")) return;
      await state.store.deleteReview(f.editId); state.form = null; toast("기록을 삭제했어요"); openPlace(p.id);
    };
    $("#rsave", s).onclick = saveReview;
    $$("[data-close]", s).forEach((b) => (b.onclick = () => openPlace(p.id)));
  }
  async function saveReview() {
    const f = state.form, v = f.status === "visited";
    if (v && !f.revisit && !f.rating) { $("#rerr").textContent = "별점을 골라주세요."; return; }
    if (f.busy) { $("#phErr").textContent = "사진을 준비하고 있어요. 잠시만요."; return; }
    const btn = $("#rsave"); btn.disabled = true;
    const photos = v && !f.revisit ? f.photos : [];
    try {
      const menu = f.menu.trim().replace(/\s+/g, " ").slice(0, 40), memo = f.memo.trim().replace(/\s+/g, " ").slice(0, 100);
      const body = f.revisit
        ? { status: "visited", kind: "revisit", rating: 0, wait: "", solo: "", menu, price: 0, picks: f.picks, memo, photoCount: 0 }
        : { status: f.status, rating: v ? f.rating : 0, wait: v ? f.wait : "", solo: v ? f.solo : "", menu, price: v ? Number(f.price) || 0 : 0, picks: v ? f.picks : [], memo, photoCount: photos.length };
      if (f.revisit && !f.editId) {
        const n = state.reviews.filter((r) => r.placeId === state.selected && r.uid === state.user.uid && r.status === "visited").length + 1;
        await state.store.addReview({ placeId: state.selected, uid: state.user.uid, userName: state.user.name, ...body, thumb: "" });
        toast(`🔁 ${n}번째 방문을 남겼어요`);
        const id = state.selected; state.form = null; openPlace(id); return;
      }
      if (f.editId) {
        // 수정: 기록 내용 바꾸고 → 뺀 사진 지우고 → 새 사진만 올림 (대표 썸네일은 첫 장 기준으로 다시 만듦)
        const first = photos[0];
        body.thumb = !first ? "" : first.existing ? await shrinkImage(await (await fetch(first.full)).blob(), 200, 0.6) : first.thumb;
        await state.store.updateReview(f.editId, body);
        const gone = v ? f.removed : [...f.removed, ...f.photos.filter((x) => x.existing).map((x) => x.id)];
        for (const id of gone) await state.store.deletePhoto?.(id).catch(() => {});
        const fresh = photos.filter((x) => !x.existing);
        for (let i = 0; i < fresh.length; i++) {
          btn.textContent = `사진 올리는 중 ${i + 1}/${fresh.length}`;
          await state.store.addPhoto({ placeId: state.selected, reviewId: f.editId, uid: state.user.uid, userName: state.user.name, menu: body.menu, data: fresh[i].full });
        }
        toast("기록을 수정했어요");
        const id = state.selected; state.form = null; openPlace(id); return;
      }
      const rid = await state.store.addReview({ placeId: state.selected, uid: state.user.uid, userName: state.user.name, ...body, thumb: photos[0]?.thumb || "" });
      for (let i = 0; i < photos.length; i++) {
        btn.textContent = `사진 올리는 중 ${i + 1}/${photos.length}`;
        await state.store.addPhoto({ placeId: state.selected, reviewId: rid, uid: state.user.uid, userName: state.user.name, menu: f.menu.trim().slice(0, 40), data: photos[i].full });
      }
      toast(v ? (photos.length ? `사진 ${photos.length}장과 함께 기록을 남겼어요` : "기록을 남겼어요") : "가고 싶은 곳에 담았어요");
      const id = state.selected; state.form = null; openPlace(id);
    } catch (e) { console.error(e); $("#rsave").disabled = false; toast("저장하지 못했어요"); }
  }

  // 처음 한 번만: 미리 고른 가게들을 등록하고 블로그 사진을 찾아둠
  async function seedPlaces(list) {
    try {
      await state.store.seedPlaces(list.map((s) => ({ ...s, address: s.address || "", note: s.note || "", images: [], imageIdx: 0, createdBy: state.user.uid, createdByName: "기본 등록" })));
      if (!state.store.demo) for (const s of list) await loadImages(s);
    } catch (e) { console.warn("기본 가게 등록 실패", e); }
  }

  // ───────── 오늘 뭐 먹지? (룰렛) ─────────
  // "어제" = 지난 평일 하루 (월요일이면 금요일). 오늘 몰아서 남긴 기록은 어제로 치지 않음
  function yesterdayCats() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const end = d.getTime();
    do d.setDate(d.getDate() - 1); while (d.getDay() === 0 || d.getDay() === 6);
    const start = d.getTime();
    return [...new Set(state.reviews.filter((r) => r.uid === state.user.uid && r.status === "visited" && r.createdAt >= start && r.createdAt < end).map((r) => placeById(r.placeId)?.category).filter(Boolean))];
  }
  // 룰렛 후보: 땡기는 것(전체 목록과 같은 칩, 혼밥·거지맵 포함) 안에서 → 먹기 싫은 것 빼고 → 체크된 곳만
  // "어제 먹은 종류 빼기"는 땡기는 것을 하나도 안 골랐을 때만 적용 (직접 고른 게 항상 우선)
  function rlBase() {
    const rl = state.rl;
    // 오늘 뭐 먹지는 점심 밥집만 — 카페는 후보에서 제외
    return state.places.filter((p) => p.category !== "카페").map((p) => ({ p, st: stats(p) })).filter((x) => (x.st.count || rl.includeWish) && !rl.avoid.includes(x.p.category || "기타"));
  }
  function rlPool() {
    const rl = state.rl, yc = rl.skipYesterday && !rl.want.length ? yesterdayCats() : [];
    const base = rlBase().filter((x) => !rl.want.length || rl.want.some((c) => inCat(x, c)));
    const out = base.filter((x) => !yc.includes(x.p.category || "기타"));
    // 어제 먹은 종류를 빼면 하나도 안 남을 때는 빼지 않음 (룰렛이 비어 버리지 않게)
    rl.relaxed = yc.length > 0 && !out.length && base.length > 0;
    return (rl.relaxed ? base : out).sort(byRating);
  }
  const candidates = () => rlPool().filter((x) => !state.rl.off.has(x.p.id));
  function openRoulette() {
    const rl = state.rl;
    // 전체 탭에서 카테고리를 골라둔 상태로 열면 그 카테고리로 시작
    if (!rl.opened && state.cats.length) rl.want = [...state.cats];
    rl.opened = true;
    const render = () => {
      const prevScroll = state.sheet === "roulette" ? $("#sheet").scrollTop : 0;
      const pool = rlPool(), list = pool.filter((x) => !rl.off.has(x.p.id));
      const base = rlBase(), cnt = (c) => base.filter((x) => inCat(x, c)).length;
      const used = CATS.filter((c) => c !== "카페" && state.places.some((p) => (p.category || "기타") === c));
      const wantChips = [`<button class="chip" data-want="" aria-pressed="${!rl.want.length}">전체<span class="n">${base.length}</span></button>`,
        ...Object.keys(SPECIAL).map((c) => `<button class="chip special" data-want="${c}" aria-pressed="${rl.want.includes(c)}">${SPECIAL[c].label}<span class="n">${cnt(c)}</span></button>`),
        ...used.filter((c) => !rl.avoid.includes(c)).map((c) => `<button class="chip" data-want="${c}" aria-pressed="${rl.want.includes(c)}">${catLabel(c)}<span class="n">${cnt(c)}</span></button>`)].join("");
      const avoidChips = used.map((c) => `<button class="chip" data-avoid="${c}" aria-pressed="${rl.avoid.includes(c)}">${catLabel(c)}</button>`).join("");
      const ycAll = yesterdayCats(), ycOn = rl.skipYesterday && !rl.want.length && ycAll.length;
      const allOn = pool.length && pool.every((x) => !rl.off.has(x.p.id));
      const s = showSheet(`
        ${head("오늘 뭐 먹지?", `<span>카테고리를 고르고, 돌릴 가게를 체크해 주세요</span>`)}
        <div class="field"><span class="flabel">땡기는 것 <span class="opt">여러 개 선택 · 안 고르면 전체</span></span><div class="chips rl-cats">${wantChips}</div></div>
        <div class="field"><span class="flabel">먹기 싫은 것 <span class="opt">고르면 후보에서 빠져요</span></span><div class="chips neg rl-cats">${avoidChips}</div></div>
        <div class="field"><div class="rl-head"><span class="flabel" style="margin:0">돌릴 가게 <b>${list.length}</b> / ${pool.length}곳</span>${pool.length ? `<button class="link" data-rl-all>${allOn ? "모두 빼기" : "모두 넣기"}</button>` : ""}</div>
          <div class="rl-list">${pool.length ? pool.map((x) => `<label class="rl-item"><input type="checkbox" data-rp="${esc(x.p.id)}" ${rl.off.has(x.p.id) ? "" : "checked"} />${thumbHTML(x.p, "thumb sm")}<span class="rl-nm">${esc(x.p.name)}<small>${x.st.count ? `★ ${x.st.avg.toFixed(1)} · ` : ""}${esc(x.p.category || "기타")} · 도보 ${x.st.walk}분</small></span></label>`).join("") : `<p class="empty" style="padding:6px 0">${"조건에 맞는 가게가 없어요. 먹기 싫은 것을 조금 풀어보세요."}</p>`}</div></div>
        <div class="field list-card" style="background:var(--parchment);padding:0 12px">
          <div class="toggle-row"><span>어제 먹은 종류 빼기<br><span style="font-size:13px;color:var(--ink-2)">${rl.want.length ? "땡기는 것을 고르면 적용 안 해요" : ycAll.length ? (rl.relaxed ? `어제 ${ycAll.map(esc).join(", ")} · 빼면 남는 곳이 없어 이번엔 포함` : `어제 기록: ${ycAll.map(esc).join(", ")}`) : "어제 남긴 내 기록이 없어요"}</span></span><button class="switch" role="switch" aria-checked="${rl.skipYesterday}" data-tg="skipYesterday" aria-label="어제 먹은 종류 빼기"></button></div>
          <div class="toggle-row" style="border-top:.5px solid var(--hair)"><span>아직 기록 없는 곳도 넣기<br><span style="font-size:13px;color:var(--ink-2)">가고 싶은 곳, 새로 등록된 곳 포함</span></span><button class="switch" role="switch" aria-checked="${rl.includeWish}" data-tg="includeWish" aria-label="가고 싶은 곳도 넣기"></button></div>
        </div>
        <div class="wheel" aria-hidden="true"><div class="wheel-band"></div><div class="wheel-track" id="track">${(list.length ? list : [{ p: { name: "후보가 없어요" } }]).slice(0, 5).map((x) => `<div class="wheel-item">${esc(x.p.name)}</div>`).join("")}</div></div>
        <p class="count">후보 ${list.length}곳${list.length === 1 ? " · 한 곳뿐이에요" : ""}</p>
        <div id="rlResult"></div>
        <div class="stack" style="margin-top:14px"><button class="btn btn-primary btn-block" id="spin" ${list.length ? "" : "disabled"}>돌리기</button></div>
      `, "roulette");
      $$("[data-want]", s).forEach((b) => (b.onclick = () => {
        const c = b.dataset.want;
        rl.want = !c ? [] : rl.want.includes(c) ? rl.want.filter((x) => x !== c) : [...rl.want, c];
        render();
      }));
      $$("[data-avoid]", s).forEach((b) => (b.onclick = () => {
        const c = b.dataset.avoid;
        rl.avoid = rl.avoid.includes(c) ? rl.avoid.filter((x) => x !== c) : [...rl.avoid, c];
        rl.want = rl.want.filter((x) => x !== c);
        render();
      }));
      $$("[data-rp]", s).forEach((b) => (b.onchange = () => { b.checked ? rl.off.delete(b.dataset.rp) : rl.off.add(b.dataset.rp); render(); }));
      const ra = $("[data-rl-all]", s); if (ra) ra.onclick = () => { pool.forEach((x) => (allOn ? rl.off.add(x.p.id) : rl.off.delete(x.p.id))); render(); };
      $$("[data-tg]", s).forEach((b) => (b.onclick = () => { rl[b.dataset.tg] = !rl[b.dataset.tg]; render(); }));
      $("#spin", s).onclick = () => spin(list, render);
      s.scrollTop = prevScroll;
    };
    render();
  }
  function spin(list, rerender) {
    if (state.rl.spinning || !list.length) return;
    state.rl.spinning = true;
    const w = list.map(({ st }) => (st.count ? 1 + st.avg : 1.5));
    let x = Math.random() * w.reduce((a, b) => a + b, 0), pick = 0;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { pick = i; break; } }
    const order = [];
    while (order.length < 34) {
      const next = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && order.length && order[order.length - 1] === next) continue;
      order.push(next);
    }
    if (list.length > 1 && order[33] === list[pick]) order[33] = list[(pick + 1) % list.length];
    order.push(list[pick]); order.push(...list.slice(0, 2));
    const track = $("#track"), final = 34;
    track.innerHTML = order.map((o) => `<div class="wheel-item">${esc(o.p.name)}</div>`).join("");
    track.style.transition = "none"; track.style.transform = "translateY(0)";
    $("#rlResult").innerHTML = ""; $("#spin").disabled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      track.style.transition = "transform 3.2s cubic-bezier(.1,.75,.15,1)";
      track.style.transform = `translateY(${-final * 44}px)`;
    }));
    const done = () => {
      state.rl.spinning = false;
      if (state.sheet !== "roulette") return;
      navigator.vibrate?.(12);
      const { p, st } = list[pick];
      $("#rlResult").innerHTML = `<div class="result-card">${thumbHTML(p)}<div style="flex:1;min-width:0"><div class="rc-kicker">오늘은 여기!</div><div class="rc-name">${emojiFor(p)} ${esc(p.name)}</div>
        <div class="row-meta">${st.count ? `<span class="rate"><i>★</i> ${st.avg.toFixed(1)}</span>` : "<span>첫 기록을 남겨주세요</span>"}<span>도보 ${st.walk}분</span>${st.price ? `<span>${won(st.price)}</span>` : ""}</div></div></div>
        <div class="btns" style="margin-top:10px"><button class="btn btn-plain" id="again">다시 돌리기</button><button class="btn btn-primary" id="go">여기 갈래요</button></div>
        <button class="btn btn-secondary btn-block" id="rlMeet" style="margin-top:8px">🍽 같이 갈 사람 모으기</button>`;
      $("#spin").hidden = true;
      $("#go").onclick = () => openPlace(p.id);
      $("#rlMeet").onclick = () => openMeetForm(p.id);
      $("#again").onclick = () => { $("#spin").hidden = false; spin(list, rerender); };
    };
    track.addEventListener("transitionend", done, { once: true });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setTimeout(done, 50);
  }

  // ───────── 장소 정보 수정 (관리자) ─────────
  // 가게 종류 수정: 멤버 누구나 종류·세부 종류 / 관리자는 이름까지
  function openEditPlace(p) {
    const full = isAdmin();
    const f = { name: p.name, category: CATS.includes(p.category) ? p.category : "", note: p.note || "", address: p.address || "" };
    const render = () => {
      const s = showSheet(`
        ${head(full ? "장소 정보 수정" : "종류 수정", `<span>${full ? "관리자 · " : ""}모든 멤버에게 바로 반영돼요</span>`)}
        ${full ? `<div class="field"><label class="flabel" for="epName">가게 이름</label><input class="input" id="epName" maxlength="40" value="${esc(f.name)}" /><p class="err" id="epErr"></p></div>
          <div class="field"><label class="flabel" for="epAddr">주소 <span class="opt">상세 화면에 보여요</span></label><input class="input" id="epAddr" maxlength="60" value="${esc(f.address)}" /></div>` : `<div class="field"><div class="flabel">${esc(p.name)}</div></div>`}
        <div class="field"><span class="flabel">종류</span>${catPickHTML(f.category, f.note)}<p class="err" id="ecErr"></p></div>
        <div class="stack" style="margin-top:24px"><button class="btn btn-primary btn-block" id="epSave">저장</button><button class="btn btn-plain btn-block" id="epBack">취소</button></div>`, "editplace");
      const n = $("#epName", s); if (n) n.oninput = () => (f.name = n.value);
      const ea = $("#epAddr", s); if (ea) ea.oninput = () => (f.address = ea.value);
      bindCatPick(s, f, render);
      $("#epBack", s).onclick = () => openPlace(p.id);
      $("#epSave", s).onclick = async () => {
        if (full && !f.name.trim()) { $("#epErr", s).textContent = "가게 이름을 적어주세요."; return; }
        if (!f.category) { $("#ecErr", s).textContent = "종류를 하나 골라주세요."; return; }
        const btn = $("#epSave", s); btn.disabled = true;
        const note = f.note.replace(/\s+/g, " ").trim().slice(0, 12);
        try {
          if (full || state.store.demo) await state.store.updatePlace(p.id, { ...(full ? { name: f.name.trim().slice(0, 40), address: f.address.trim().slice(0, 60) } : {}), category: f.category, note, emoji: "" });
          else {
            const t = await state.store.idToken();
            const r = await fetch("/api/place", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ op: "category", id: p.id, category: f.category, note }) });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "FAIL");
          }
          toast(full ? "장소 정보를 고쳤어요" : "종류를 고쳤어요"); openPlace(p.id);
        } catch (e) { console.error(e); btn.disabled = false; toast("저장하지 못했어요"); }
      };
    };
    render();
  }

  // ───────── 오늘 약속 (식사조인) ─────────
  // 점심시간은 12:30 시작 ~ 13:30 종료로 고정. 13:30이 지나면 새 약속은 내일 점심으로 올라감
  const LUNCH = C.lunch || { start: "12:30", end: "13:30" };
  const minsOf = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const lunchOver = () => nowMins() >= minsOf(LUNCH.end);
  const weekend = () => [0, 6].includes(new Date().getDay());
  const targetDate = () => (lunchOver() || weekend() ? TOMORROW() : TODAY());
  // 약속 날짜 표시: 오늘 / 내일 / 월요일 (금요일 오후·주말에 만든 약속은 다음 평일)
  const dayWord = (m) => {
    if (m.date === TODAY()) return "오늘";
    const d = new Date(); d.setDate(d.getDate() + 1);
    if (m.date === d.toLocaleDateString("sv-SE")) return "내일";
    return ["일", "월", "화", "수", "목", "금", "토"][new Date(`${m.date}T12:00:00`).getDay()] + "요일";
  };
  const nextWord = () => dayWord({ date: targetDate() });
  const joinedList = (m) => Object.entries(m.joined || {}).map(([uid, v]) => ({ uid, ...v })).sort((x, y) => x.at - y.at);
  const mtCount = (m) => Object.keys(m.joined || {}).length;
  const mtFull = (m) => mtCount(m) >= m.capacity;
  const mtPast = (m) => m.date < TODAY() || (m.date === TODAY() && lunchOver());
  const openMeets = () => state.meetups.filter((m) => !mtPast(m) && !mtFull(m));
  const notifyOn = () => { try { return localStorage.getItem("lunchmap-notify") === "1"; } catch { return false; } };
  const notifyPref = () => { try { return localStorage.getItem("lunchmap-notify"); } catch { return null; } };
  function updateMeetBadge() {
    const n = openMeets().length, b = $("#meetBadge");
    if (String(n) !== b.textContent) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    b.textContent = n; b.hidden = !n;
  }
  const meetPlace = (m) => placeById(m.placeId) || { id: m.placeId, name: m.placeName, category: m.category };

  function meetCard(m) {
    const me = state.user.uid, n = mtCount(m), host = m.hostUid === me, mine = !!(m.joined || {})[me];
    const p = meetPlace(m), ppl = joinedList(m);
    const slots = Array.from({ length: m.capacity }, (_, i) => (i < n ? avatar(ppl[i].name, true) : `<span class="slot"></span>`)).join("");
    const action = host ? `<button class="btn btn-plain" data-mt-del="${esc(m.id)}">모집 취소</button>`
      : mine ? `<button class="btn btn-plain" data-mt-leave="${esc(m.id)}">참여 취소</button>`
      : mtPast(m) ? `<button class="btn btn-plain" disabled>지난 약속</button>`
      : mtFull(m) ? `<button class="btn btn-plain" disabled>마감됐어요</button>`
      : `<button class="btn btn-primary" data-mt-join="${esc(m.id)}">식사 참여</button>`;
    return `<div class="meet${mtPast(m) ? " past" : ""}${mine || host ? " mine" : ""}">
      <div class="meet-top"><span class="meet-time"><small>${dayWord(m)}</small>${esc(LUNCH.start)}</span><button class="meet-place" data-mt-place="${esc(m.placeId)}">${emojiFor(p)} ${esc(p.name)} ›</button></div>
      <div class="meet-host">${avatar(m.hostName, true)}<span><b>${esc(m.hostName)}님</b>${host ? " (나)" : ""}이 모집 중${m.note ? ` · ${esc(m.note)}` : ""}</span></div>
      <div class="meet-bottom"><div class="slots">${slots}</div><span class="meet-n${mtFull(m) ? " full" : ""}">${mtFull(m) ? "마감" : `선착순 ${n}/${m.capacity}명`}</span></div>
      <div class="meet-who">${ppl.length ? ppl.map((x) => `${esc(x.name)}님`).join(", ") + " 참여" : "아직 참여한 사람이 없어요"}</div>
      <div class="btns" style="margin-top:12px">${action}<button class="btn btn-plain" data-mt-share="${esc(m.id)}">공유하기</button></div>
      ${!host && isAdmin() ? `<button class="link danger" data-mt-del="${esc(m.id)}" style="margin-top:10px">이 약속 취소 (관리자)</button>` : ""}
    </div>`;
  }

  function openMeetList() {
    const list = [...state.meetups].sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.createdAt - y.createdAt);
    const canNotify = "Notification" in window;
    const s = showSheet(`
      ${head("오늘 약속", `<span>점심 ${LUNCH.start}~${LUNCH.end} · 선착순 모집</span>`)}
      <div class="stack" style="margin-top:14px"><button class="btn btn-primary btn-block" id="mtNew">+ 약속 만들기</button></div>
      ${pushCard()}
      <div class="h3">${nextWord()} 점심 ${list.filter((m) => !mtPast(m)).length ? `${list.filter((m) => !mtPast(m)).length}건` : ""}</div>
      ${list.length ? list.map(meetCard).join("") : `<p class="empty" style="padding:8px 0">아직 ${nextWord()} 약속이 없어요. 먼저 "${nextWord()} ○○ 먹으실 분!"을 올려보세요.</p>`}
    `, "meets");
    $("#mtNew", s).onclick = () => openMeetForm(null);
    bindPushCard(s, openMeetList);
    bindMeetButtons(s);
  }

  function bindMeetButtons(root) {
    $$("[data-mt-join]", root).forEach((b) => (b.onclick = () => joinMeet(b.dataset.mtJoin)));
    $$("[data-mt-leave]", root).forEach((b) => (b.onclick = async () => { await state.store.leaveMeetup(b.dataset.mtLeave, state.user.uid); toast("참여를 취소했어요"); }));
    $$("[data-mt-del]", root).forEach((b) => (b.onclick = async () => { if (!confirm("이 약속 모집을 취소할까요?")) return; await state.store.deleteMeetup(b.dataset.mtDel); toast("모집을 취소했어요"); }));
    $$("[data-mt-place]", root).forEach((b) => (b.onclick = () => openPlace(b.dataset.mtPlace)));
    $$("[data-mt-share]", root).forEach((b) => (b.onclick = async () => {
      const m = state.meetups.find((x) => x.id === b.dataset.mtShare); if (!m) return;
      const text = `${dayWord(m)} ${LUNCH.start} ${meetPlace(m).name} 먹으실 분! (선착순 ${mtCount(m)}/${m.capacity}명)${m.note ? ` ${m.note}` : ""}\n👉 Lunchfound에서 참여: ${location.href.split("#")[0]}`;
      try { await navigator.clipboard.writeText(text); toast("공유 문구를 복사했어요"); } catch { prompt("아래 문구를 복사해 주세요", text); }
    }));
  }

  async function joinMeet(id) {
    try {
      await state.store.joinMeetup(id, state.user);
      pushApi({ op: "meetup-join", meetupId: id });
      const m = state.meetups.find((x) => x.id === id);
      toast(m ? `참여했어요! ${dayWord(m)} ${LUNCH.start}에 만나요` : "참여했어요!");
      hideAlert();
    } catch (e) { toast(e.message === "FULL" ? "아쉽게도 방금 마감됐어요" : "참여하지 못했어요. 다시 눌러주세요"); }
  }

  function openMeetForm(placeId) {
    state.mf = { placeId, cap: 3, note: "", q: "", sort: "rating" };
    const render = () => {
      const f = state.mf, p = f.placeId ? placeById(f.placeId) : null;
      const near = state.places.map((x) => ({ p: x, st: stats(x), w: walkMin(x.lat, x.lng) }))
        .filter((x) => !f.q || x.p.name.replace(/\s/g, "").includes(f.q.replace(/\s/g, ""))).sort(sorter(f.sort)).slice(0, 8);
      const why = (x) => f.sort === "price" && x.st.minPrice ? `${won(x.st.minPrice)}부터 · ` : f.sort === "rating" && x.st.count ? `★ ${x.st.avg.toFixed(1)} · ` : "";
      const s = showSheet(`
        ${head("약속 만들기", `<span>${targetDate() !== TODAY() ? `${nextWord()} 점심 약속으로 올라가요` : "오늘 ○○ 먹으실 분! 을 올려요"}</span>`)}
        <div class="field"><span class="flabel">어디서</span>
          ${p ? `<div class="pick">${thumbHTML(p)}<div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="ad">${esc(p.category || "기타")} · 사옥에서 도보 ${walkMin(p.lat, p.lng)}분</div></div><button class="link" id="mfChange">바꾸기</button></div>`
          : `<input class="input" id="mfQ" placeholder="등록된 가게 이름 검색" value="${esc(f.q)}" autocomplete="off" />
             <div class="seg sortbar" role="group" aria-label="정렬">${Object.entries(SORTS).map(([k, v]) => `<button data-mf-sort="${k}" aria-pressed="${f.sort === k}">${v}</button>`).join("")}</div>
             <div class="results">${near.map((x) => `<button class="result" data-mf-p="${esc(x.p.id)}">${thumbHTML(x.p, "thumb sm")}<div style="flex:1;min-width:0"><div class="nm">${esc(x.p.name)}</div><div class="ad">${esc(x.p.category || "기타")}${x.st.minPrice ? ` · ${won(x.st.minPrice)}부터` : ""}</div></div><span class="ds">${why(x)}도보 ${x.w}분</span></button>`).join("") || `<p class="empty">등록된 가게가 없어요. 먼저 + 장소 추가로 등록해 주세요.</p>`}</div>`}
          <p class="err" id="mfErr"></p></div>
        <div class="field"><span class="flabel">언제</span><div class="fixed-time"><b>${nextWord()} ${LUNCH.start}</b><span>점심시간 ${LUNCH.start}~${LUNCH.end} 고정</span></div></div>
        <div class="field"><span class="flabel">선착순 모집 인원 <span class="opt">나 빼고</span></span><div class="chips">${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-mf-c="${n}" aria-pressed="${f.cap === n}">${n}명</button>`).join("")}</div></div>
        <div class="field"><label class="flabel" for="mfNote">한 줄 메모 <span class="opt">선택</span></label><input class="input" id="mfNote" maxlength="40" placeholder="예: 11:50 사옥 1층에서 출발" value="${esc(f.note)}" /></div>
        <p class="count" style="margin-top:14px">나 포함 최대 ${f.cap + 1}명 · 정원이 차면 자동으로 마감돼요</p>
        <div class="stack" style="margin-top:12px"><button class="btn btn-primary btn-block" id="mfSave">약속 올리기</button></div>
      `, "meetform");
      const q = $("#mfQ", s); if (q) { q.oninput = () => { f.q = q.value; const pos = q.selectionStart; render(); const n2 = $("#mfQ"); n2.focus(); n2.setSelectionRange(pos, pos); }; }
      $$("[data-mf-p]", s).forEach((b) => (b.onclick = () => { f.placeId = b.dataset.mfP; render(); }));
      $$("[data-mf-sort]", s).forEach((b) => (b.onclick = () => { f.sort = b.dataset.mfSort; render(); }));
      const ch = $("#mfChange", s); if (ch) ch.onclick = () => { f.placeId = null; render(); };
      $$("[data-mf-c]", s).forEach((b) => (b.onclick = () => { f.cap = +b.dataset.mfC; render(); }));
      const nt = $("#mfNote", s); nt.oninput = () => (f.note = nt.value);
      $("#mfSave", s).onclick = async () => {
        const pl = f.placeId && placeById(f.placeId);
        if (!pl) { $("#mfErr", s).textContent = "어디서 먹을지 골라주세요."; return; }
        $("#mfSave", s).disabled = true;
        try {
          const mid = await state.store.addMeetup({ placeId: pl.id, placeName: pl.name, category: pl.category || "기타", hostUid: state.user.uid, hostName: state.user.name, time: LUNCH.start, date: targetDate(), capacity: f.cap, note: f.note.trim().slice(0, 40) });
          pushApi({ op: "meetup-new", meetupId: mid });
          toast("약속을 올렸어요. 알림을 켠 멤버 모두에게 알림이 가요");
          openMeetList();
        } catch (e) { console.error(e); $("#mfSave", s).disabled = false; toast("올리지 못했어요. 다시 눌러주세요"); }
      };
    };
    render();
  }

  // 새 약속 · 참여 알림
  let alertTimer;
  function hideAlert() { $("#alert").hidden = true; clearTimeout(alertTimer); }
  function showMeetAlert(m) {
    const p = meetPlace(m), el = $("#alert");
    el.innerHTML = `<div class="alert-in glass">${avatar(m.hostName, true)}<div class="alert-txt"><b>${esc(m.hostName)}님</b> ${dayWord(m)} ${LUNCH.start} ${emojiFor(p)} ${esc(p.name)} 먹으실 분!<span>선착순 ${mtCount(m)}/${m.capacity}명${m.note ? ` · ${esc(m.note)}` : ""}</span></div>
      <button class="btn btn-primary alert-go" data-a-join>참여</button><button class="close" data-a-x aria-label="닫기">✕</button></div>`;
    el.hidden = false;
    $("[data-a-join]", el).onclick = () => joinMeet(m.id);
    $("[data-a-x]", el).onclick = hideAlert;
    $(".alert-txt", el).onclick = () => { hideAlert(); openMeetList(); };
    clearTimeout(alertTimer); alertTimer = setTimeout(hideAlert, 15000);
    navigator.vibrate?.([10, 60, 10]);
    if (!state.pushOn) sysNotify(`🍽 ${m.hostName}님이 점심 약속을 올렸어요`, `${dayWord(m)} ${LUNCH.start} ${p.name} · 선착순 ${mtCount(m)}/${m.capacity}명`, `meet-${m.id}`);
  }
  function onMeetups(list) {
    const prev = state.meetups;
    state.meetups = list;
    if (!state.meetInit) { state.meetInit = true; list.forEach((m) => state.seenMeet.add(m.id)); }
    else for (const m of list) {
      if (!state.seenMeet.has(m.id)) { state.seenMeet.add(m.id); if (m.hostUid !== state.user.uid && !mtPast(m)) showMeetAlert(m); }
      const old = prev.find((x) => x.id === m.id);
      if (old && m.hostUid === state.user.uid) {
        Object.keys(m.joined || {}).filter((k) => !(old.joined || {})[k]).forEach((k) => {
          toast(`${m.joined[k].name}님이 참여했어요 (${mtCount(m)}/${m.capacity})${mtFull(m) ? " · 마감" : ""}`);
          if (!state.pushOn) sysNotify(`🙋 ${m.joined[k].name}님이 식사에 참여했어요`, `${dayWord(m)} ${LUNCH.start} ${m.placeName} · ${mtCount(m)}/${m.capacity}명`, `join-${m.id}-${k}`);
        });
      }
    }
    updateMeetBadge();
    if (state.sheet === "meets") openMeetList();
  }


  // ───────── 시스템 알림 (안드로이드는 서비스워커 경유가 필수) ─────────
  function sysNotify(title, body, tag) {
    if (!(notifyOn() && "Notification" in window && Notification.permission === "granted" && document.hidden)) return;
    const opts = { body, tag, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png" };
    (navigator.serviceWorker?.ready || Promise.reject()).then((r) => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch {} });
  }

  // ───────── 앱을 닫아도 오는 알림 (Web Push) ─────────
  // 새 약속 → 알림 켠 멤버 전원(올린 사람 제외) / 약속 참여 → 개설자에게만. 발송은 서버(/api/push)가 해요.
  const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!C.vapidPublicKey && !state.store.demo;
  // 아이폰은 Safari 탭에서는 푸시가 안 되고, 홈 화면에 추가한 앱에서만 돼요 (iOS 16.4 이상)
  const pushBlockedReason = () => {
    if (state.store.demo) return "미리보기에서는 알림이 오지 않아요";
    if (isIOS() && !standalone()) return "아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요";
    if (!pushSupported()) return "이 브라우저는 알림을 지원하지 않아요";
    if (Notification.permission === "denied") return "알림이 차단돼 있어요. 브라우저(또는 휴대폰) 설정에서 Lunchfound 알림을 허용해 주세요";
    return "";
  };
  async function pushApi(body) {
    if (state.store.demo || !state.store.idToken) return null;
    try {
      const t = await state.store.idToken();
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
      return await r.json().catch(() => ({}));
    } catch (e) { console.warn("push api", e); return null; }
  }
  const b64key = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
  async function swReady() {
    if (!navigator.serviceWorker.controller) await navigator.serviceWorker.register("./sw.js").catch(() => {});
    return navigator.serviceWorker.ready;
  }
  // 이 기기를 알림 받는 기기로 등록 (권한 요청은 반드시 버튼을 누른 직후에)
  async function enablePush({ ask = true } = {}) {
    const why = pushBlockedReason(); if (why) throw new Error(why);
    let perm = Notification.permission;
    if (perm === "default" && ask) perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("알림을 허용해야 받을 수 있어요");
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(C.vapidPublicKey) });
    const r = await pushApi({ op: "subscribe", sub: sub.toJSON() });
    if (!r?.ok) throw new Error(r?.error || "알림 등록에 실패했어요. 잠시 뒤 다시 해주세요");
    try { localStorage.setItem("lunchmap-notify", "1"); } catch {}
    state.pushOn = true;
  }
  async function disablePush(keepPref) {
    state.pushOn = false;
    if (!keepPref) try { localStorage.setItem("lunchmap-notify", "0"); } catch {}
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
    if (sub) { await pushApi({ op: "unsubscribe", endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
  }
  // 시작할 때: 이미 허용한 기기는 조용히 다시 연결(누가 로그인했는지 갱신), 아직이면 한 번 권유
  function initPush() {
    if (state.store.demo) return;
    navigator.serviceWorker?.addEventListener("message", (e) => { if (e.data?.type === "open-meet") openMeetList(); });
    const q = new URLSearchParams(location.search).get("meet");
    if (q) { history.replaceState(null, "", location.pathname); setTimeout(openMeetList, 600); }
    if (pushBlockedReason()) return;
    if (Notification.permission === "granted" && notifyPref() !== "0") { enablePush({ ask: false }).catch((e) => console.warn("push", e.message)); return; }
    if (Notification.permission === "default" && notifyPref() !== "0" && !localStorage.getItem("lunchmap-push-asked")) {
      setTimeout(() => {
        try { localStorage.setItem("lunchmap-push-asked", "1"); } catch {}
        showBanner({ icon: "🔔", title: "약속 알림을 켜둘까요?", sub: "새 점심 약속, 내 약속에 누가 참여했는지 앱을 닫아도 알려드려요", ms: 20000,
          actions: [{ label: "알림 켜기", primary: true, run: () => enablePush().then(() => { toast("알림을 켰어요"); pushApi({ op: "test" }); }).catch((e) => toast(e.message)) }] });
      }, 2500);
    }
  }
  // 알림 설정 카드 (오늘 약속 · 내 정보에서 같이 사용)
  function pushCard() {
    const why = pushBlockedReason(), on = !why && state.pushOn;
    return `<div class="list-card push-card" style="background:var(--parchment);padding:0 12px;margin-top:12px">
      <div class="toggle-row"><span>약속 알림 받기<br><span style="font-size:13px;color:var(--ink-2)">${why ? esc(why) : "새 약속은 멤버 모두에게, 내 약속 참여 소식은 개설자에게 · 앱을 닫아도 와요"}</span></span>
      <button class="switch" role="switch" data-push aria-checked="${on}" aria-label="약속 알림 받기" ${why && !state.pushOn ? "disabled" : ""}></button></div>
      ${on ? `<div class="toggle-row" style="border-top:.5px solid var(--hair)"><span style="font-size:14px">이 기기로 시험 알림 보내기</span><button class="btn btn-plain" data-push-test style="min-height:34px;padding:0 14px;font-size:14px">보내기</button></div>` : ""}
      ${isIOS() && !standalone() && !state.store.demo ? `<div class="toggle-row" style="border-top:.5px solid var(--hair)"><span style="font-size:14px">홈 화면에 추가하는 방법</span><button class="btn btn-plain" data-push-install style="min-height:34px;padding:0 14px;font-size:14px">보기</button></div>` : ""}
    </div>`;
  }
  function bindPushCard(root, rerender) {
    const sw = $("[data-push]", root);
    if (sw) sw.onclick = async () => {
      sw.disabled = true;
      try {
        if (state.pushOn) { await disablePush(); toast("이 기기 알림을 껐어요"); }
        else { await enablePush(); toast("알림을 켰어요. 시험 알림을 보냈어요"); pushApi({ op: "test" }); }
      } catch (e) { toast(e.message); }
      rerender();
    };
    const t = $("[data-push-test]", root);
    if (t) t.onclick = async () => { const r = await pushApi({ op: "test" }); toast(r?.sent ? "시험 알림을 보냈어요" : "보내지 못했어요. 알림을 껐다 다시 켜 주세요"); };
    const ins = $("[data-push-install]", root); if (ins) ins.onclick = openInstall;
  }

  // ───────── 공용 배너 (상단 알림 자리) ─────────
  function showBanner({ icon, title, sub, actions = [], ms = 15000 }) {
    const el = $("#alert");
    el.innerHTML = `<div class="alert-in glass"><span class="alert-ico">${icon}</span><div class="alert-txt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div>
      ${actions.map((x, i) => `<button class="btn ${x.primary ? "btn-primary" : "btn-plain"} alert-go" data-b="${i}">${esc(x.label)}</button>`).join("")}<button class="close" data-a-x aria-label="닫기">✕</button></div>`;
    el.hidden = false;
    actions.forEach((x, i) => ($(`[data-b="${i}"]`, el).onclick = () => { hideAlert(); x.run(); }));
    $("[data-a-x]", el).onclick = hideAlert;
    clearTimeout(alertTimer); alertTimer = setTimeout(hideAlert, ms);
  }

  // ───────── 점심시간 알림: 12시대 "지난주 인기 장소" · 점심 후 "오늘 어디서 드셨어요?" ─────────
  const onceToday = (k) => { const key = `lunchmap-nudge-${k}-${TODAY()}`; try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, "1"); } catch {} return true; };
  function popularLastWeek() {
    const since = Date.now() - 7 * 864e5, c = {};
    state.reviews.filter((r) => r.status === "visited" && r.createdAt >= since).forEach((r) => (c[r.placeId] = (c[r.placeId] || 0) + 1));
    return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id, n]) => ({ p: placeById(id), n })).filter((x) => x.p);
  }
  function nudgePopular() {
    const top = popularLastWeek();
    const sub = top.length ? `지난주 멤버들이 많이 간 곳 · ${top.map((x) => `${emojiFor(x.p)} ${esc(x.p.name)}`).join(", ")}` : "아직 지난주 기록이 없어요. 오늘 약속을 먼저 올려보세요";
    showBanner({ icon: "🍽", title: `곧 점심이에요 · ${LUNCH.start} 시작`, sub,
      actions: top.length ? [{ label: "보기", primary: true, run: () => openPlace(top[0].p.id) }] : [{ label: "약속 만들기", primary: true, run: () => openMeetForm(null) }] });
    sysNotify(`곧 점심이에요 · ${LUNCH.start} 시작`, top.length ? `지난주 인기: ${top.map((x) => x.p.name).join(", ")}` : "오늘 같이 먹을 사람을 모아보세요", "popular");
  }
  function nudgeRecord() {
    const uid = state.user.uid;
    const ate = state.meetups.find((m) => m.date === TODAY() && (m.hostUid === uid || (m.joined || {})[uid]));
    showBanner({ icon: "✍️", title: "오늘 어디서 드셨어요?", sub: ate ? `${esc(meetPlace(ate).name)} 어땠는지 30초면 남길 수 있어요` : "30초면 기록 끝! 다음 사람의 점심이 쉬워져요",
      actions: [{ label: "기록하기", primary: true, run: () => (ate ? openReviewForm(ate.placeId, "visited") : openAdd()) }] });
    sysNotify("오늘 어디서 드셨어요?", "30초면 기록 끝! Lunchfound에 남겨주세요", "record");
  }
  function lunchTick() {
    if (!state.user) return;
    const t = nowMins(), uid = state.user.uid;
    if (t >= minsOf("12:00") && t < minsOf(LUNCH.start) && onceToday("popular")) return nudgePopular();
    const ateToday = state.reviews.some((r) => r.uid === uid && r.status === "visited" && new Date(r.createdAt).toLocaleDateString("sv-SE") === TODAY());
    if (t >= minsOf(LUNCH.end) && t < minsOf("17:00") && !ateToday && onceToday("record")) nudgeRecord();
  }

  // ───────── "내 추천을 본 사람" (조회 기록) ─────────
  const viewedNow = new Set();
  function markView(p) {
    if (!p || viewedNow.has(p.id) || !state.store.markView) return;
    viewedNow.add(p.id);
    if ((p.views || {})[state.user.uid]) return;   // 이미 본 곳은 다시 쓰지 않음 (무료 한도 절약)
    state.store.markView(p.id, state.user.uid).catch(() => {});
  }
  const viewersOf = (p) => Object.keys(p.views || {}).filter((u) => u !== state.user.uid);
  function myImpact() {
    const uid = state.user.uid, mine = new Set(state.reviews.filter((r) => r.uid === uid && r.status === "visited").map((r) => r.placeId));
    const who = new Set();
    state.places.filter((p) => mine.has(p.id)).forEach((p) => viewersOf(p).forEach((u) => who.add(u)));
    return { places: mine.size, viewers: who.size };
  }

  // ───────── 앱으로 설치 (홈 화면에 추가) ─────────
  let installEvt = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function openInstall() {
    const how = standalone() ? `<p class="empty">이미 앱으로 쓰고 있어요 👍</p>`
      : installEvt ? `<div class="stack" style="margin-top:14px"><button class="btn btn-primary btn-block" id="doInstall">앱 설치하기</button></div>`
      : isIOS() ? `<ol class="steps"><li><b>Safari</b>로 이 주소를 열어요</li><li>아래쪽 <b>공유 버튼(□↑)</b>을 눌러요</li><li><b>홈 화면에 추가</b> → <b>추가</b></li><li>홈 화면의 Lunchfound 아이콘으로 열면 앱처럼 전체 화면으로 열려요. 아이폰은 이렇게 추가해야 알림도 받을 수 있어요(iOS 16.4 이상)</li></ol>`
      : `<ol class="steps"><li><b>크롬</b>으로 이 주소를 열어요</li><li>오른쪽 위 <b>⋮ 메뉴</b> → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b></li><li>PC 크롬은 주소창 오른쪽의 <b>설치 아이콘</b>을 눌러도 돼요</li></ol>`;
    const s = showSheet(`${head("앱으로 설치", "<span>홈 화면에 추가하면 앱처럼 전체 화면으로 열려요</span>")}${how}`, "install");
    const b = $("#doInstall", s);
    if (b) b.onclick = async () => { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; toast(r?.outcome === "accepted" ? "설치했어요!" : "다음에 설치할 수 있어요"); closeSheet(); };
  }
  function installTip() {
    if (standalone() || !matchMedia("(max-width: 899px)").matches) return;
    try { if (localStorage.getItem("lunchmap-install-tip")) return; localStorage.setItem("lunchmap-install-tip", "1"); } catch { return; }
    showBanner({ icon: "📲", title: "홈 화면에 추가해 보세요", sub: "앱처럼 바로 열리고, 약속 알림도 받을 수 있어요", actions: [{ label: "방법 보기", primary: true, run: openInstall }], ms: 12000 });
  }
  function registerSW() {
    // 미리보기(공유 링크) 페이지에는 서비스워커 파일이 없으니 등록하지 않음
    if (!("serviceWorker" in navigator) || window.PREVIEW_TILES || !/^https:|^http:\/\/localhost/.test(location.href)) return;
    // 새 버전이 올라오면 바로 바꿔 끼우고 한 번 새로고침 — 홈 화면 앱이 예전 코드로 계속 도는 일이 없게
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded || state.sheet === "review" || state.sheet === "pin") return;
      reloaded = true; try { sessionStorage.setItem("lf-skip-intro", "1"); } catch {} location.reload();
    });
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
      setInterval(check, 30 * 60e3);
    }).catch(() => {});
  }

  // ───────── 버튼 눌림 효과 (눌림 0.96배 · 100ms, 놓으면 스프링 복귀) ─────────
  function initPress() {
    const sel = ".btn,.chip,.icon-btn,.fab,.roulette-btn,.meet-btn,.me,.row,.result,.member,.seg button,.close,.pin,.stars button,.switch,.meet-place";
    let cur = null, sx = 0, sy = 0;
    const release = () => { if (cur) { cur.classList.remove("is-pressed"); cur = null; } };
    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(sel);
      if (!el || el.disabled) return;
      cur = el; sx = e.clientX; sy = e.clientY;
      el.classList.add("is-pressed");
      if (el.matches(".btn-primary,.fab,.roulette-btn") && e.pointerType === "touch") navigator.vibrate?.(6);
    }, { passive: true });
    document.addEventListener("pointermove", (e) => { if (cur && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) release(); }, { passive: true });
    ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, release, { passive: true }));
    addEventListener("scroll", release, { passive: true, capture: true });
  }

  // ───────── 첫 화면 소개 (모션그래픽) ─────────
  // auto=true: 로그인된 상태로 앱을 켰을 때 — 버튼 없이 모션만 보여주고 저절로 홈으로 (화면을 누르면 바로 넘어감)
  // auto=false: 로그아웃 상태 — 모션 뒤 "시작하기" 버튼 → 로그인
  function showIntro(next, auto = false) {
    const el = $("#intro");
    $("#login").hidden = true; if (!auto) $("#app").hidden = true; el.hidden = false;
    el.classList.toggle("auto", auto);
    $("#introBrand").innerHTML = $("#loginBrand").innerHTML;
    const vid = $("#introVideo"), svg = $(".intro-svg");
    if (C.introVideo) { vid.src = C.introVideo; vid.hidden = false; svg.style.display = "none"; vid.play?.().catch(() => {}); }
    else {
      const replay = () => { svg.classList.remove("play"); void svg.getBoundingClientRect(); svg.classList.add("play"); };
      replay(); el._loop = setInterval(replay, 8600);
    }
    let left = false;
    const leave = () => { if (left) return; left = true; clearInterval(el._loop); clearTimeout(el._auto); el.onclick = null; el.classList.add("leave"); setTimeout(() => { el.hidden = true; el.classList.remove("leave", "auto"); next(); }, 260); };
    $("#introGo").onclick = leave;
    if (auto) {
      clearInterval(el._loop);   // 자동 모드는 한 번만 재생
      el._auto = setTimeout(leave, matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 3400);
      el.onclick = leave;
    } else el.onclick = null;
  }

  // ───────── 내 정보 ─────────
  function openMe() {
    const m = isAdmin() ? { team: "ADMIN", role: "관리자 · 장소·기록·약속 편집 권한" } : member(state.user.name) || { team: "", role: "" };
    const s = showSheet(`
      ${head("내 정보")}
      <div class="list-card" style="background:var(--parchment);margin-top:14px"><div class="member">${avatar(state.user.name)}<div style="flex:1"><div class="nm"><span class="team">${esc(m.team)}</span>${esc(state.user.name)}님</div><div class="rl">${esc(m.role)}</div></div></div></div>
      <div class="field"><span class="flabel">화면 모드</span>${themeSeg()}</div>
      <div class="field"><span class="flabel">알림</span>${pushCard()}</div>
      <div class="stack" style="margin-top:18px">
        <button class="btn btn-plain btn-block" id="installBtn">📲 앱으로 설치 (홈 화면에 추가)</button>
        ${state.store.demo ? `<div class="h3" style="margin-top:14px">알림 미리보기</div><div class="btns"><button class="btn btn-plain" id="pvPopular">12시 인기 장소</button><button class="btn btn-plain" id="pvRecord">기록 요청</button></div>
        <button class="btn btn-plain btn-block" id="pvIntro">첫 화면 소개 다시 보기</button>` : ""}
        ${state.store.demo ? `<button class="btn btn-plain btn-block" id="switchMe">다른 멤버로 보기</button><button class="btn btn-secondary btn-block" id="resetDemo">미리보기 데이터 처음으로</button>` : `<button class="btn btn-plain btn-block" id="logout">로그아웃</button>`}
      </div>`, "me");
    const lo = $("#logout", s); if (lo) lo.onclick = async () => { await disablePush(true).catch(() => {}); await state.store.signOut(); location.reload(); };
    $("#installBtn", s).onclick = openInstall;
    bindThemeSeg(s);
    bindPushCard(s, openMe);
    const pp = $("#pvPopular", s); if (pp) pp.onclick = () => { closeSheet(); nudgePopular(); };
    const pr2 = $("#pvRecord", s); if (pr2) pr2.onclick = () => { closeSheet(); nudgeRecord(); };
    const pi = $("#pvIntro", s); if (pi) pi.onclick = () => { closeSheet(); showIntro(() => { $("#app").hidden = false; }); };
    const sw = $("#switchMe", s); if (sw) sw.onclick = async () => { await state.store.signOut(); location.reload(); };
    const rs = $("#resetDemo", s); if (rs) rs.onclick = () => { if (confirm("예시 데이터로 되돌릴까요? 남긴 기록이 지워져요.")) { state.store.reset(); location.reload(); } };
  }

  // ───────── 로그인 · 멤버 고르기 ─────────
  // 로그인 창: 이름 + 비밀번호 (멤버 명단은 로그인 전에 보여주지 않음)
  // 관리자는 이름에 admin, 비밀번호에 관리자 비밀번호
  function showLogin({ error } = {}) {
    $("#app").hidden = true; $("#intro").hidden = true; $("#login").hidden = false;
    const demo = !state.store.needsPassword;
    $("#loginBody").innerHTML = `
      <form id="loginForm" class="login-form" autocomplete="on" novalidate>
        <label class="flabel" for="loginName">이름</label>
        <input class="input" id="loginName" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="예: 태영" maxlength="20" />
        <label class="flabel" for="loginPw" style="margin-top:14px">비밀번호</label>
        <input class="input" id="loginPw" name="password" type="password" autocomplete="current-password" placeholder="${demo ? "미리보기에서는 비워도 돼요" : "공용 비밀번호"}" />
        <div class="stack" style="margin-top:18px"><button class="btn btn-primary btn-block" id="loginGo" type="submit">로그인</button></div>
        <p class="login-err" id="loginErr" role="alert">${esc(error || "")}</p>
      </form>
      <p class="login-help">파파 멤버만 쓸 수 있어요. 이름은 사내에서 부르는 이름 그대로(예: 태영) 적어 주세요.<br />한 번 로그인하면 이 기기에서 계속 유지돼요.</p>
      ${demo ? `<p class="demo-note">미리보기 버전이에요. 실제 버전은 공용 비밀번호로 로그인하고, 기록이 멤버 모두에게 공유돼요.</p>` : ""}`;
    const nm = $("#loginName"), pw = $("#loginPw"), go = $("#loginGo"), er = $("#loginErr");
    setTimeout(() => nm.focus(), 60);
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      let name = nm.value.trim().replace(/\s+/g, "").replace(/님$/, "");
      const isAdm = name.toLowerCase() === "admin" || name === "관리자";
      if (!name) { er.textContent = "이름을 적어 주세요."; nm.focus(); return; }
      if (!isAdm && !member(name)) { er.textContent = "명단에 없는 이름이에요. 사내에서 부르는 이름(예: 태영)으로 적어 주세요."; nm.select(); return; }
      if (!demo && !pw.value) { er.textContent = "비밀번호를 입력해 주세요."; pw.focus(); return; }
      go.disabled = true; go.textContent = "확인 중…"; er.textContent = "";
      try { await state.store.signIn(isAdm ? (demo ? "관리자" : "admin") : name, pw.value); }
      catch (err) { er.textContent = err.userMsg || "로그인하지 못했어요."; go.disabled = false; go.textContent = "로그인"; pw.select(); }
    };
  }


  // ───────── 화면 모드 (라이트 / 다크 / 기기 설정) ─────────
  const THEMES = { light: "라이트", dark: "다크", system: "기기 설정" };
  const themePref = () => { try { return localStorage.getItem("lunchfound-theme") || "light"; } catch { return "light"; } };
  function applyTheme(pref) {
    try { localStorage.setItem("lunchfound-theme", pref); } catch {}
    const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    // 상태바·내비게이션바를 화면 배경(--parchment)과 같은 색으로 → 위아래 색이 달라 보이지 않게. 스플래시 중엔 버건디 유지
    // 상태바 색: 모바일은 흰/검정 헤더와 같은 색으로 이어지게
    if (!document.getElementById("splash")) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : matchMedia("(max-width: 899px)").matches ? "#FFFFFF" : "#F5F5F7");
    const lb = $("#themeBtnLogin"); if (lb) lb.textContent = `${dark ? "🌙" : "☀️"} ${THEMES[pref]}`;
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (themePref() === "system") applyTheme("system"); });
  const themeSeg = () => `<div class="seg" id="themeSeg" role="group" aria-label="화면 모드">${Object.entries(THEMES).map(([k, v]) => `<button data-th="${k}" aria-pressed="${themePref() === k}">${v}</button>`).join("")}</div>`;
  const bindThemeSeg = (root) => $$("[data-th]", root).forEach((b) => (b.onclick = () => { applyTheme(b.dataset.th); $$("[data-th]", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));

  // ───────── 기타 ─────────
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 1900); }

  function bindUI() {
    $$("#tabs button").forEach((t) => (t.onclick = () => { if (t.dataset.tab === "member") state.who = null; state.tab = t.dataset.tab; $$("#tabs button").forEach((x) => x.setAttribute("aria-selected", x === t)); setPanel("open"); renderPanel(); stagger(); renderMarkers(); }));
    $("#grab").onclick = () => setPanel(panelStage() === "open" ? "min" : "open");
    setPanel("min");   // 처음엔 내린 상태로 지도에 집중
    initPanelSwipe();
    $("#fab").onclick = openAdd;
    $("#rouletteBtn").onclick = openRoulette;
    $("#meetBtn").onclick = openMeetList;
    $("#meBtn").onclick = openMe;
    $("#addCancel").onclick = stopAdding;
    $("#scrim").onclick = closeSheet;
    $("#zin").onclick = () => MapKit.zoom(1);
    $("#zout").onclick = () => MapKit.zoom(-1);
    $("#zhome").onclick = () => homeView();
    // 앱 화면·지도는 스크롤되면 안 됨: 브라우저가 포커스 때문에 밀어도 즉시 제자리로 (overflow: clip 미지원 브라우저 대비)
    ["#app", "#map"].forEach((s) => { const el = $(s); el.addEventListener("scroll", () => { if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0; } }); });
    // 지도를 움직이거나 휠로 확대하면 정보 카드 숨김
    // 지도를 만지면 마우스 올려서 뜬 미리보기 카드만 닫음. 핀을 눌러 고정한 카드는 끌기·확대 중에도 유지 (빈 곳 한 번 탭으로만 닫힘)
    ["pointerdown", "wheel"].forEach((t) => $("#map").addEventListener(t, () => { if (!tipPinned) hideTip(); }, { passive: true }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (state.sheet || state.adding)) closeSheet(); });
  }

  async function start(user) {
    state.user = user;
    $("#login").hidden = true; if (!$("#intro").classList.contains("auto")) $("#intro").hidden = true; $("#app").hidden = false;   // 자동 소개 모션 중이면 그 뒤에서 미리 준비
    const me = $("#meBtn"); me.style.background = hue(user.name);
    me.innerHTML = `${esc(user.name.charAt(0))}${photoOf(user.name) ? `<img src="${photoOf(user.name)}" alt="" onerror="this.remove()">` : ""}`;
    if (state.store.demo) $("#demoBadge").hidden = false;
    bindUI();
    // 지도는 따로 준비 — 목록·핀 데이터는 지도 라이브러리·타일을 기다리지 않고 바로 받아서 보여줌
    // (예전엔 지도가 다 뜰 때까지 목록도 기다려서, 지도 서버가 느리면 사이트 전체가 느려 보였음)
    initMap();
    if (window.Walk) await Walk.init(C.office).catch(() => {});
    if (state.store.demo) demoSimulate();
    registerSW();
    initPush();
    setInterval(lunchTick, 60000); setTimeout(lunchTick, 4000);
    setTimeout(installTip, 25000);
    // 기본 가게 자동 등록은 하지 않음 (예전 버전이 목록을 다 받기 전에 "비어 있다"고 보고 다시 등록하던 문제)
    // 미리보기 모드(이 브라우저에만 저장)만 기본 가게를 채워서 보여줌 — 실제 서비스에는 자동 등록 없음
    if (state.store.demo && window.SEED_PLACES) seedPlaces(SEED_PLACES.filter(() => true));
    let firstView = true;
    state.store.subscribe(({ places, reviews, meetups }) => {
      state.places = places.map((p) => (CAT_ALIAS[p.category] ? { ...p, category: CAT_ALIAS[p.category] } : p)); state.reviews = reviews;
      onMeetups(meetups || []);
      if (state.pending && places.some((p) => p.id === state.pending.id)) state.pending = null;
      renderAll();
      // 첫 데이터 때 한 번만: 지도가 이미 떠 있으면 목록 패널이 자리 잡은 뒤(0.3초) 사옥을 가운데로. 지도가 나중에 뜨면 initMap이 직접 맞춤
      if (firstView) { firstView = false; if (state.mapReady) setTimeout(() => homeView(true), 450); }
    });
  }

  // 미리보기: 7초 뒤 다른 멤버가 약속을 올린 상황을 흉내 내서 알림 흐름을 보여줌
  function demoSimulate() {
    if (!state.store.simulateMeetup) return;
    setTimeout(() => {
      if (state.meetups.some((m) => m.hostUid !== state.user.uid)) return;
      const host = state.user.name === "현열" ? "유진" : "현열";
      const p = state.places.find((x) => x.id === "seed-14") || state.places[0];
      if (!p) return;
      state.store.simulateMeetup({ placeId: p.id, placeName: p.name, category: p.category, hostUid: "demo-" + host, hostName: host, time: LUNCH.start, date: targetDate(), capacity: 3, note: "미리보기 예시 알림이에요",
        joined: { "demo-다은": { name: "다은", at: Date.now() - 60000 } } });
    }, 7000);
  }

  // ───────── 시작 ─────────
  (async function boot() {
    // 로고: 보내주신 "// Lunchfound" 이미지 (없으면 글자로)
    const n = C.appName, i = n.indexOf("//");
    const brand = C.logo?.black ? `<img class="logo" src="${C.logo.black}" alt="${esc(C.appTitle || n)}" />`
      : i < 0 ? esc(n) : `${esc(n.slice(0, i))}<span class="chop" aria-hidden="true">//</span><b>${esc(n.slice(i + 2))}</b>`;
    // 상단 바: 넓은 화면은 전체 로고, 좁은 휴대폰은 // 마크만 (버튼들이 한 줄에 들어가도록)
    $("#brand").innerHTML = C.logo?.black ? `${brand}<img class="logo-mark" src="${C.logo.mark || C.logo.black}" alt="" aria-hidden="true" />` : brand;
    $("#loginBrand").innerHTML = brand; $("#brand").setAttribute("aria-label", `${C.appTitle || n} · 사옥으로 지도 맞추기`);
    // 로고를 누르면: 보던 가게·카드를 닫고 사옥을 가운데로 지도 다시 맞춤
    const br = $("#brand"); br.setAttribute("role", "button"); br.tabIndex = 0;
    br.onclick = () => { if (state.sheet === "place") closeSheet(); hideTip(); state.selected = null; MapKit.clearRoute?.(); state.routeFor = null; renderMarkers(); if (state.mapReady) homeView(); };
    br.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); br.onclick(); } };
    document.title = C.appTitle || n;
    initPress();
    applyTheme(themePref());
    $("#themeBtnLogin").onclick = () => { const order = ["light", "dark", "system"]; applyTheme(order[(order.indexOf(themePref()) + 1) % 3]); };
    // 스플래시: 최소 0.9초 보여준 뒤 부드럽게 사라짐 (그동안 데이터 준비)
    const t0 = performance.now(), sp = $("#splash");
    let splashGone; const afterSplash = new Promise((r) => (splashGone = r));   // 스플래시가 걷히기 시작하는 순간
    const hideSplash = () => { if (!sp) return splashGone(); setTimeout(() => { splashGone(); sp.classList.add("hide"); setTimeout(() => { sp.remove(); applyTheme(themePref()); }, 400); }, Math.max(0, 900 - (performance.now() - t0))); };
    // 새 버전으로 자동 새로고침한 직후엔 소개 모션을 다시 보여주지 않음
    let skipIntro = false; try { skipIntro = sessionStorage.getItem("lf-skip-intro") === "1"; sessionStorage.removeItem("lf-skip-intro"); } catch {}
    state.store = await createStore();
    hideSplash();
    let started = false;
    state.store.onUser(async (u, err) => {
      if (started) return;
      if (!u) {
        const login = () => {
          showLogin({ error: err });
        };
        if (err) { skipIntro = true; return login(); }
        await afterSplash;
        skipIntro = true;   // 방금 소개를 봤으니 로그인한 뒤엔 바로 홈으로
        return showIntro(login);   // 로그인 전 첫 화면: 모션그래픽 소개 + 시작하기 버튼
      }
      const prof = await state.store.getProfile(u.uid);
      if (prof?.memberName && (member(prof.memberName) || prof.admin)) {
        started = true;
        // 앱 실행: 스플래시 → 지도 모션(버튼 없음) → 홈. 그동안 뒤에서 지도·데이터를 준비
        await afterSplash;
        if (!skipIntro) showIntro(() => { $("#app").hidden = false; }, true);
        return start({ ...u, name: prof.memberName, admin: !!prof.admin });
      }
      window.__pickMember = async (name) => { await state.store.setProfile(u.uid, name); started = true; start({ ...u, name }); };
      showLogin();
    });
  })();
})();
