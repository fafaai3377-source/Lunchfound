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
  // 대표 카테고리와 이모지 (핀·칩·썸네일에 같이 씀)
  const CAT_EMOJI = { 한식: "🍚", 고기: "🥩", 면: "🍜", 일식: "🍣", 중식: "🥟", 아시안: "🍛", 양식: "🍝", 분식: "🍢", 카페: "☕", 기타: "🍴" };
  const CATS = Object.keys(CAT_EMOJI);
  const catLabel = (c) => `${CAT_EMOJI[c] || "🍴"} ${c}`;
  function catFrom(raw, name = "") {
    const s = `${raw || ""} ${name}`;
    if (/카페|커피|제과|베이커리|디저트|케이크|빵/.test(s)) return "카페";
    if (/라멘|라면|초밥|스시|일식|일본|돈까스|돈카츠|카츠|우동|소바|이자카야/.test(s)) return "일식";
    if (/중식|중국|짜장|짬뽕|마라|딤섬|훠궈|반점/.test(s)) return "중식";
    if (/아시아|베트남|태국|타이|인도|쌀국수|커리|카레|분짜/.test(s)) return "아시안";
    if (/양식|이탈리|파스타|피자|햄버거|버거|스테이크|브런치|멕시|패스트푸드/.test(s)) return "양식";
    if (/고기|구이|갈비|삼겹|곱창|육류|숯불|정육/.test(s)) return "고기";
    if (/국수|냉면|칼국수|막국수|수제비|면/.test(s)) return "면";
    if (/분식|떡볶이|김밥|치킨/.test(s)) return "분식";
    if (/한식|국밥|해장국|찌개|백반|감자탕|곰탕|설렁탕|순대/.test(s)) return "한식";
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
    tab: "top", cat: "", sheet: null, selected: null, adding: false, ghost: null, form: null,
    markers: new Map(), mapReady: false,
    rl: { want: [], avoid: [], skipYesterday: true, includeWish: true, spinning: false },
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
  function stats(p) {
    const rs = state.reviews.filter((r) => r.placeId === p.id).sort((a, b) => b.createdAt - a.createdAt);
    const visited = rs.filter((r) => r.status === "visited");
    const rated = visited.filter((r) => r.rating > 0), priced = visited.filter((r) => r.price > 0);
    return {
      rs, visited, wish: rs.filter((r) => r.status === "wish"), count: visited.length,
      avg: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0,
      wait: most(visited.map((r) => r.wait)), solo: most(visited.map((r) => r.solo)),
      price: priced.length ? Math.round(priced.reduce((s, r) => s + r.price, 0) / priced.length / 500) * 500 : 0,
      walk: walkMin(p.lat, p.lng),
    };
  }
  const anyFilter = () => Object.values(state.filters).some(Boolean) || (state.tab === "list" && !!state.cat);
  function passes(st, p) {
    const f = state.filters;
    if (p && state.tab === "list" && state.cat && (p.category || "기타") !== state.cat) return false;
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
  function thumbHTML(p, cls = "thumb") {
    const img = curImage(p);
    return `<div class="${cls}"><div class="ph">${emojiFor(p)}</div>${img ? `<img src="${esc(img.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" style="position:relative">` : ""}</div>`;
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
  async function initMap() {
    try {
      await MapKit.init($("#map"), C.office, onMapTap);
    } catch (e) {
      const m = document.createElement("div");
      m.className = "map-msg";
      m.innerHTML = e.message === "NO_KAKAO_KEY" ? "지도를 띄우려면 <b>config.js</b>에 카카오 JavaScript 키를 넣어주세요." : "카카오맵을 불러오지 못했어요. 키와 등록된 사이트 주소를 확인해 주세요.";
      $("#map").appendChild(m);
      return;
    }
    state.mapReady = true;
    if (MapKit.attribution) { const a = $("#attrib"); a.textContent = MapKit.attribution; a.hidden = false; }
    const el = document.createElement("div");
    el.className = "office";
    el.innerHTML = `<div class="pin-b">◉ ${esc(C.office.name)}</div><div class="pin-t"></div>`;
    MapKit.add(el, C.office.lat, C.office.lng, "bottom");
    renderMarkers();
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
      el.className = ["pin", fresh && "wish", anyFilter() && !passes(st, p) && "dim", state.selected === p.id && "on"].filter(Boolean).join(" ");
      const label = fresh ? (st.wish.length ? ` <span class="pin-n">♡${st.wish.length}</span>` : "") : ` <span class="pin-r">${st.avg.toFixed(1)}</span>`;
      el.innerHTML = `<div class="pin-b"><span class="pin-e">${emojiFor(p)}</span>${label}</div><div class="pin-t"></div><div class="pin-l">${esc(p.name)}</div>`;
      if (!popped.has(p.id)) { popped.add(p.id); el.classList.add("pop"); el.style.setProperty("--d", `${Math.min(order++ * 35, 700)}ms`); }
      el.addEventListener("click", (e) => { e.stopPropagation(); hideTip(); if (!state.adding) openPlace(p.id); });
      el.addEventListener("mouseenter", () => showTip(p, el));
      el.addEventListener("mouseleave", hideTip);
      const m = MapKit.add(el, p.lat, p.lng, "bottom");
      if (state.selected === p.id) m.front?.(true);
      state.markers.set(p.id, m);
    }
  }

  // ───────── 마우스 올리면 뜨는 정보 카드 (메뉴 · 도보 시간 · 카테고리) ─────────
  const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  let tipShownAt = 0;
  function topMenu(p, st) {
    const c = {};
    st.visited.filter((r) => r.menu).forEach((r) => { const k = r.menu.trim(); c[k] = (c[k] || 0) + 1 + (r.rating || 0) / 10; });
    return Object.entries(c).sort((x, y) => y[1] - x[1])[0]?.[0] || p.note || "";
  }
  function showTip(p, el) {
    if (!canHover() || state.adding) return;
    const st = stats(p), wi = walkInfo(p.lat, p.lng), menu = topMenu(p, st), tip = $("#tip");
    const dist = wi.m ? ` · ${wi.m >= 1000 ? (wi.m / 1000).toFixed(1) + "km" : wi.m + "m"}` : "";
    tip.innerHTML = `<div class="tip-h">${emojiFor(p)} <b>${esc(p.name)}</b></div>
      <div class="tip-r"><span>카테고리</span><b>${esc(p.category || "기타")}</b></div>
      <div class="tip-r"><span>대표 메뉴</span><b>${menu ? esc(menu) : "아직 기록 없음"}</b></div>
      <div class="tip-r"><span>사옥에서</span><b>걸어서 ${wi.min}분${dist}</b></div>
      ${st.count ? `<div class="tip-r"><span>멤버 별점</span><b><i class="star">★</i> ${st.avg.toFixed(1)} (${st.count})${st.wait ? ` · 웨이팅 ${WAIT_S[st.wait]}` : ""}${st.price ? ` · ${won(st.price)}` : ""}</b></div>` : `<div class="tip-foot">아직 멤버 기록이 없어요 · 눌러서 첫 기록 남기기</div>`}`;
    const r = el.querySelector(".pin-b").getBoundingClientRect();
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 10, below = false;
    if (y < 70) { y = r.bottom + 30; below = true; }
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    tip.classList.toggle("below", below);
    // 첫 카드만 등장 모션, 이어서 다른 핀으로 옮길 땐 바로 (애니메이션 반복으로 굼떠 보이지 않게)
    tip.classList.toggle("instant", Date.now() - tipShownAt < 400);
    tip.classList.remove("show"); void tip.offsetWidth; tip.classList.add("show");
    tipShownAt = Date.now();
  }
  function hideTip() { const t = $("#tip"); if (t) { t.classList.remove("show"); t.hidden = true; tipShownAt = Date.now(); } }

  function onMapTap(lat, lng) {
    if (!state.adding) return;
    state.ghost?.remove();
    const g = document.createElement("div");
    g.className = "ghost";
    state.ghost = MapKit.add(g, lat, lng, "center");
    openPinForm(lat, lng);
  }
  function routePad() {
    return desk() ? { top: 90, right: 490, bottom: 50, left: 440 } : { top: 120, right: 50, bottom: Math.round(innerHeight * 0.55) + 20, left: 50 };
  }
  function focusPlace(p) { if (desk()) MapKit.focus(p.lat, p.lng, -20, 0); else MapKit.focus(p.lat, p.lng, 0, -190); }

  // ───────── 패널 ─────────
  function rowHTML({ p, st }, rank) {
    const meta = [];
    meta.push(st.count ? `<span class="rate"><i>★</i> ${st.avg.toFixed(1)} <span style="color:var(--ink-2);font-weight:400">(${st.count})</span></span>` : st.wish.length ? `<span>♡ 가고 싶은 멤버 ${st.wish.length}</span>` : `<span>아직 기록 없음</span>`);
    meta.push(`<span>${esc(p.category || "기타")}${p.note ? ` · ${esc(p.note)}` : ""}</span>`);
    if (st.wait) meta.push(`<span>웨이팅 ${WAIT_S[st.wait]}</span>`);
    if (st.solo === "ok") meta.push(`<span>혼밥 OK</span>`);
    if (st.price) meta.push(`<span>${won(st.price)}</span>`);
    return `<button class="row" data-place="${esc(p.id)}">${rank ? `<span class="rank">${rank}</span>` : ""}${thumbHTML(p)}
      <div class="row-main"><div class="row-name">${esc(p.name)}</div><div class="row-meta">${meta.join("")}</div></div>
      <span class="row-walk">도보 ${st.walk}분</span></button>`;
  }
  function renderPanel() {
    const body = $("#panelBody"), all = state.places.map((p) => ({ p, st: stats(p) }));
    let html = "";
    if (state.tab === "top") {
      const top = all.filter((x) => x.st.count && passes(x.st)).sort((a, b) => b.st.avg - a.st.avg || b.st.count - a.st.count || a.st.walk - b.st.walk).slice(0, 3);
      html = `<div class="section-h">오늘의 추천</div><div class="section-sub">멤버 별점이 높은 순${anyFilter() ? " · 필터 적용" : ""}</div>` +
        (top.length ? top.map((x, i) => rowHTML(x, i + 1)).join("") : `<p class="empty">${anyFilter() ? "조건에 맞는 곳이 없어요. 필터를 하나 꺼보세요." : "아직 별점이 남은 곳이 없어요. 오늘 먹은 곳부터 남겨보세요."}</p>`);
    } else if (state.tab === "list") {
      // 카테고리 칩(개수 포함) + 고른 카테고리만 / 전체일 때는 카테고리별로 묶어서
      const base = all.filter((x) => passes(x.st));
      const count = (c) => base.filter((x) => (x.p.category || "기타") === c).length;
      const cats = CATS.filter((c) => count(c));
      const chips = `<div class="catbar"><button class="chip" data-cat="" aria-pressed="${!state.cat}">전체<span class="n">${base.length}</span></button>${cats.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${state.cat === c}">${catLabel(c)}<span class="n">${count(c)}</span></button>`).join("")}</div>`;
      const near = (x, y) => x.st.walk - y.st.walk;
      let body2;
      if (state.cat) {
        const list = base.filter((x) => (x.p.category || "기타") === state.cat).sort(near);
        body2 = list.length ? list.map((x) => rowHTML(x)).join("") : `<p class="empty">이 카테고리에 등록된 곳이 없어요.</p>`;
      } else {
        body2 = cats.length ? cats.map((c) => { const list = base.filter((x) => (x.p.category || "기타") === c).sort(near);
          return `<div class="group-h">${catLabel(c)}<span class="n">${list.length}곳</span></div>` + list.map((x) => rowHTML(x)).join(""); }).join("")
          : `<p class="empty">${anyFilter() ? "조건에 맞는 곳이 없어요." : "아직 등록된 곳이 없어요. + 장소 추가로 첫 가게를 등록해 주세요."}</p>`;
      }
      html = `<div class="section-h">전체 ${base.length}곳</div><div class="section-sub">카테고리별 · 사옥에서 가까운 순</div>${chips}${body2}`;
    } else {
      const mine = state.reviews.filter((r) => r.uid === state.user.uid).sort((a, b) => b.createdAt - a.createdAt);
      const im = myImpact();
      html = `<div class="section-h">내 기록 ${mine.length}</div><div class="section-sub">${esc(state.user.name)}님이 남긴 기록</div>` +
        (im.places ? `<div class="impact"><span class="impact-n">${im.viewers}</span><span>${im.viewers ? `내가 기록한 ${im.places}곳을 멤버 <b>${im.viewers}명</b>이 봤어요` : `내가 기록한 ${im.places}곳, 아직 본 멤버가 없어요. 약속으로 같이 가볼까요?`}</span></div>` : "") +
        (mine.length ? mine.map((r) => { const p = placeById(r.placeId); if (!p) return "";
          return `<button class="row" data-place="${esc(p.id)}">${thumbHTML(p)}<div class="row-main"><div class="row-name">${esc(p.name)}</div>
            <div class="row-meta"><span class="rate">${r.status === "wish" ? "♡ 가고 싶어요" : `<i>★</i> ${r.rating}`}</span>${r.menu ? `<span>${esc(r.menu)}</span>` : ""}<span>${ago(r.createdAt)}</span></div></div></button>`; }).join("")
          : `<p class="empty">아직 남긴 기록이 없어요.</p>`);
    }
    body.innerHTML = html;
    $$("[data-place]", body).forEach((b) => (b.onclick = () => openPlace(b.dataset.place)));
    $$(".catbar [data-cat]", body).forEach((b) => (b.onclick = () => { state.cat = b.dataset.cat; renderPanel(); renderMarkers(); }));
  }
  function stagger() {
    const body = $("#panelBody");
    $$(".row, .group-h, .impact", body).slice(0, 14).forEach((r, i) => r.style.setProperty("--i", i));
    body.classList.remove("stagger"); void body.offsetWidth; body.classList.add("stagger");
    setTimeout(() => body.classList.remove("stagger"), 700);
  }
  function renderAll() {
    renderMarkers();
    renderPanel();
    if (state.sheet === "place" && state.selected) renderPlace(state.selected);
  }

  // ───────── 시트 공통 ─────────
  let closeTimer;
  function showSheet(html, kind) {
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
    MapKit.clearRoute?.();
    renderMarkers();
  }
  const head = (title, sub) => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div><button class="close" data-close aria-label="닫기">✕</button></div>`;

  // ───────── 장소 상세 ─────────
  function openPlace(id) {
    const p = placeById(id); if (!p) return;
    state.selected = id;
    markView(p);
    if (state.mapReady) {
      const wi = walkInfo(p.lat, p.lng);
      if (wi.path && MapKit.showRoute) MapKit.showRoute(wi.path, routePad()); else { MapKit.clearRoute?.(); focusPlace(p); }
    }
    renderMarkers();
    renderPlace(id);
  }
  function renderPlace(id) {
    const p = placeById(id); if (!p) return closeSheet();
    const st = stats(p), l = links(p), me = state.user.uid, img = curImage(p);
    const mineAny = st.rs.some((r) => r.uid === me), others = st.rs.some((r) => r.uid !== me);
    const reviews = st.visited.map((r) => `<div class="review">${avatar(r.userName, true)}<div class="review-body">
        <div class="review-top"><span class="who">${esc(r.userName)}님</span><span class="when">${ago(r.createdAt)}</span></div>
        <div class="stars-s">${"★".repeat(r.rating)}<span style="color:var(--fill-2)">${"★".repeat(5 - r.rating)}</span></div>
        <div class="tags">${r.wait ? `<span class="tag">${WAIT[r.wait]}</span>` : ""}${r.solo ? `<span class="tag">${SOLO[r.solo]}</span>` : ""}${r.price ? `<span class="tag">${won(r.price)}</span>` : ""}</div>
        ${r.menu ? `<div class="review-menu">추천 메뉴 <b>${esc(r.menu)}</b></div>` : ""}
        ${r.uid === me || isAdmin() ? `<button class="del" data-del="${esc(r.id)}">${r.uid === me ? "내 기록 삭제" : "기록 삭제 (관리자)"}</button>` : ""}</div></div>`).join("");
    const wishers = st.wish.length ? `<p class="wishers">♡ 가고 싶은 멤버 ${st.wish.map((r) => `<b>${esc(r.userName)}님</b>${r.menu ? ` (${esc(r.menu)})` : ""}${r.uid === me || isAdmin() ? ` <button class="link" data-del="${esc(r.id)}">취소</button>` : ""}`).join(", ")}</p>` : "";
    const hero = img
      ? `<div class="hero">${thumbHTML(p, "thumb").replace('class="thumb"', 'style="position:absolute;inset:0"')}<div class="hero-cap"><a href="${esc(img.source)}" target="_blank" rel="noopener">${esc(img.from || "블로그")} 사진 ↗</a>${p.images.length > 1 ? `<button data-act="nextimg">다른 사진</button>` : ""}</div></div>`
      : `<div class="hero">${thumbHTML(p, "thumb").replace('class="thumb"', 'style="position:absolute;inset:0"')}${state.store.demo ? `<div class="hero-cap"><span style="font-size:12px;font-weight:600;color:#fff;background:rgba(0,0,0,.45);padding:4px 10px;border-radius:999px">실제 버전에서는 블로그 대표 사진이 자동으로 들어가요</span></div>` : `<div class="hero-cap"><button data-act="findimg">블로그 사진 찾기</button></div>`}</div>`;
    const s = showSheet(`
      ${head(esc(p.name), `<span>${emojiFor(p)} ${esc(p.category || "기타")}${p.note ? ` · ${esc(p.note)}` : ""}</span>${(() => { const wi = walkInfo(p.lat, p.lng); return wi.m ? `<b>사옥에서 걸어서 ${wi.min}분 · ${wi.m >= 1000 ? (wi.m / 1000).toFixed(1) + "km" : wi.m + "m"}</b>` : `<b>사옥에서 도보 약 ${wi.min}분</b>`; })()}${p.createdByName ? `<span>${p.createdByName === "기본 등록" ? "기본 등록" : `${esc(p.createdByName)}님이 등록`}</span>` : ""}${viewersOf(p).length ? `<span>👀 멤버 ${viewersOf(p).length}명이 봤어요</span>` : ""}`)}
      ${hero}
      <div class="stats">
        <div class="stat"><div class="k">별점</div><div class="v">${st.count ? `★ ${st.avg.toFixed(1)}` : "–"}</div></div>
        <div class="stat"><div class="k">웨이팅</div><div class="v">${st.wait ? WAIT_S[st.wait] : "–"}</div></div>
        <div class="stat"><div class="k">혼밥</div><div class="v">${st.solo ? SOLO_S[st.solo] : "–"}</div></div>
        <div class="stat"><div class="k">평균</div><div class="v">${st.price ? `${(st.price / 1000).toFixed(st.price % 1000 ? 1 : 0)}천원` : "–"}</div></div>
      </div>
      <div class="stack">
        <button class="btn btn-primary btn-block" data-act="review">기록 남기기</button>
        ${mineAny ? "" : `<button class="btn btn-secondary btn-block" data-act="wish">♡ 가고 싶어요</button>`}
        <button class="btn btn-plain btn-block" data-act="meet">🍽 여기로 오늘 약속 만들기</button>
        <div class="btns"><a class="btn btn-plain" href="${l.naver}" data-dir="naver" target="_blank" rel="noopener">네이버 지도 길찾기</a><a class="btn btn-plain" href="${l.kakao}" data-dir="kakao" target="_blank" rel="noopener">카카오맵 길찾기</a></div>
        <p class="dir-note">출발 ${esc(C.office.mapName || C.office.name)} · 도보 경로로 열려요</p>
      </div>
      ${wishers}
      <div class="h3">멤버 기록 ${st.count}</div>
      ${reviews || `<p class="empty" style="padding:8px 0">아직 가본 멤버의 기록이 없어요. 다녀왔다면 첫 기록을 남겨주세요.</p>`}
      ${isAdmin() ? `<div class="admin-tools"><span class="admin-tag">관리자</span><button class="link" data-act="editplace">장소 정보 수정</button><button class="link danger" data-act="delplace">장소와 기록 모두 삭제</button></div>`
        : p.createdBy === me && !others ? `<button class="del" data-act="delplace" style="margin-top:18px">이 장소 삭제</button>` : ""}
    `, "place");
    $$("[data-dir]", s).forEach((b) => (b.onclick = (e) => { e.preventDefault(); openDir(b.dataset.dir, p); }));
    $("[data-act=review]", s).onclick = () => openReviewForm(p.id, "visited");
    const w = $("[data-act=wish]", s); if (w) w.onclick = () => openReviewForm(p.id, "wish");
    $("[data-act=meet]", s).onclick = () => openMeetForm(p.id);
    const ni = $("[data-act=nextimg]", s); if (ni) ni.onclick = () => state.store.updatePlace(p.id, { imageIdx: ((p.imageIdx || 0) + 1) % p.images.length });
    const fi = $("[data-act=findimg]", s); if (fi) fi.onclick = async () => { fi.textContent = "찾는 중…"; await loadImages(p); if (!curImage(placeById(p.id))) fi.textContent = "사진을 찾지 못했어요"; };
    $$("[data-del]", s).forEach((b) => (b.onclick = async () => { if (!confirm("이 기록을 삭제할까요?")) return; await state.store.deleteReview(b.dataset.del); toast("삭제했어요"); }));
    const ep = $("[data-act=editplace]", s); if (ep) ep.onclick = () => openEditPlace(p);
    const dp = $("[data-act=delplace]", s);
    if (dp) dp.onclick = async () => { if (!confirm("이 장소와 내 기록을 삭제할까요?")) return; for (const r of st.rs) await state.store.deleteReview(r.id); await state.store.deletePlace(p.id); closeSheet(); toast("장소를 삭제했어요"); };
  }

  // ───────── 장소 추가: 검색 ─────────
  function openAdd() {
    const s = showSheet(`
      ${head("장소 추가", "<span>가게 이름으로 찾아보세요</span>")}
      <div class="field"><input class="input" id="q" placeholder="예: 어서와칼국수" autocomplete="off" enterkeyhint="search" /></div>
      <div class="results" id="results"></div>
      <p class="empty" style="padding:14px 4px 0">목록에 없나요? <button class="link" id="pinMode">지도에서 직접 찍기</button></p>
    `, "add");
    const q = $("#q", s);
    let t;
    q.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(q.value.trim()), 250); };
    $("#pinMode", s).onclick = startPinMode;
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
    }).join("") : `<p class="empty">검색 결과가 없어요. 이름을 줄여서 찾거나 지도에서 직접 찍어주세요.</p>`;
    $$("[data-i]", box).forEach((b) => (b.onclick = () => pickResult(list[+b.dataset.i])));
  }
  async function pickResult(r) {
    const exists = state.places.find((p) => (r.kakaoId && p.kakaoId === r.kakaoId) || p.name.replace(/\s/g, "") === r.name.replace(/\s/g, ""));
    if (exists) return openPlace(exists.id);
    await createPlace({ name: r.name, category: catFrom(r.categoryRaw, r.name), lat: r.lat, lng: r.lng, address: r.address || "", kakaoId: r.kakaoId || "", placeUrl: r.placeUrl || "" });
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
  function openPinForm(lat, lng) {
    state.form = { name: "", category: "", lat, lng };
    const render = () => {
      const f = state.form;
      const s = showSheet(`
        ${head("새 장소", `<b>사옥에서 도보 ${walkMin(lat, lng)}분</b><span>위치가 다르면 지도를 다시 눌러주세요</span>`)}
        <div class="field"><label class="flabel" for="pname">가게 이름</label><input class="input" id="pname" maxlength="30" placeholder="간판에 적힌 이름 그대로" value="${esc(f.name)}" autocomplete="off" /><p class="err" id="perr"></p></div>
        <div class="field"><span class="flabel">종류 <span class="opt">선택</span></span><div class="chips">${CATS.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${f.category === c}">${catLabel(c)}</button>`).join("")}</div></div>
        <div class="stack" style="margin-top:24px"><button class="btn btn-primary btn-block" id="psave">저장하고 기록 남기기</button></div>
      `, "pin");
      $("#scrim").hidden = true;
      const i = $("#pname", s); i.oninput = () => { f.name = i.value; $("#perr", s).textContent = ""; };
      $$("[data-cat]", s).forEach((b) => (b.onclick = () => { f.category = f.category === b.dataset.cat ? "" : b.dataset.cat; render(); }));
      $("#psave", s).onclick = async () => {
        const name = f.name.trim();
        if (!name) { $("#perr", s).textContent = "가게 이름을 적어주세요."; return; }
        const dup = state.places.find((p) => p.name.replace(/\s/g, "") === name.replace(/\s/g, ""));
        if (dup) { stopAdding(); return openPlace(dup.id); }
        $("#psave", s).disabled = true;
        stopAdding();
        await createPlace({ name, category: f.category || "기타", lat, lng, address: "", kakaoId: "", placeUrl: "" });
      };
      if (!f.name) setTimeout(() => i.focus(), 60);
    };
    render();
  }

  // ───────── 기록 남기기 ─────────
  function openReviewForm(placeId, status) {
    const p = placeById(placeId); if (!p) return;
    state.selected = placeId;
    state.form = { status, rating: 0, wait: "", solo: "", menu: "", price: "" };
    const render = () => {
      const f = state.form, v = f.status === "visited";
      const chips = (k, m) => Object.entries(m).map(([key, label]) => `<button class="chip" data-${k}="${key}" aria-pressed="${f[k] === key}">${label}</button>`).join("");
      const s = showSheet(`
        ${head(esc(p.name), "<span>30초면 끝나요</span>")}
        <div class="field"><div class="seg"><button data-status="visited" aria-pressed="${v}">가봤어요</button><button data-status="wish" aria-pressed="${!v}">♡ 가고 싶어요</button></div></div>
        ${v ? `
          <div class="field"><span class="flabel">별점</span><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" aria-label="${n}점" aria-pressed="${n <= f.rating}">★</button>`).join("")}</div><p class="err" id="rerr"></p></div>
          <div class="field"><span class="flabel">점심시간 웨이팅</span><div class="chips">${chips("wait", WAIT)}</div></div>
          <div class="field"><span class="flabel">혼밥</span><div class="chips">${chips("solo", SOLO)}</div></div>
          <div class="field"><label class="flabel" for="rmenu">추천 메뉴</label><input class="input" id="rmenu" maxlength="40" placeholder="제육 정식" value="${esc(f.menu)}" /></div>
          <div class="field"><label class="flabel" for="rprice">내가 낸 가격</label><input class="input" id="rprice" inputmode="numeric" maxlength="7" placeholder="9000" value="${esc(f.price)}" /></div>`
        : `<div class="field"><label class="flabel" for="rmenu">먹어보고 싶은 메뉴 <span class="opt">선택</span></label><input class="input" id="rmenu" maxlength="40" placeholder="더블 치즈버거" value="${esc(f.menu)}" /></div>`}
        <div class="stack" style="margin-top:26px"><button class="btn btn-primary btn-block" id="rsave">기록 저장</button></div>
      `, "review");
      $$("[data-status]", s).forEach((b) => (b.onclick = () => { f.status = b.dataset.status; render(); }));
      $$("[data-star]", s).forEach((b) => (b.onclick = () => { f.rating = +b.dataset.star; render(); }));
      $$("[data-wait]", s).forEach((b) => (b.onclick = () => { f.wait = f.wait === b.dataset.wait ? "" : b.dataset.wait; render(); }));
      $$("[data-solo]", s).forEach((b) => (b.onclick = () => { f.solo = f.solo === b.dataset.solo ? "" : b.dataset.solo; render(); }));
      const m = $("#rmenu", s); if (m) m.oninput = () => (f.menu = m.value);
      const pr = $("#rprice", s); if (pr) pr.oninput = () => { pr.value = pr.value.replace(/\D/g, ""); f.price = pr.value; };
      $("#rsave", s).onclick = saveReview;
      $$("[data-close]", s).forEach((b) => (b.onclick = () => openPlace(placeId)));
    };
    render();
  }
  async function saveReview() {
    const f = state.form, v = f.status === "visited";
    if (v && !f.rating) { $("#rerr").textContent = "별점을 골라주세요."; return; }
    $("#rsave").disabled = true;
    try {
      await state.store.addReview({ placeId: state.selected, uid: state.user.uid, userName: state.user.name, status: f.status, rating: v ? f.rating : 0, wait: v ? f.wait : "", solo: v ? f.solo : "", menu: f.menu.trim().slice(0, 40), price: v ? Number(f.price) || 0 : 0 });
      toast(v ? "기록을 남겼어요" : "가고 싶은 곳에 담았어요");
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
  function yesterdayCats() {
    const since = Date.now() - 2 * 864e5;
    return [...new Set(state.reviews.filter((r) => r.uid === state.user.uid && r.status === "visited" && r.createdAt >= since).map((r) => placeById(r.placeId)?.category).filter(Boolean))];
  }
  function candidates() {
    const rl = state.rl, yc = rl.skipYesterday ? yesterdayCats() : [];
    return state.places.map((p) => ({ p, st: stats(p) })).filter(({ p, st }) => {
      if (!st.count && !rl.includeWish) return false;
      const cat = p.category || "기타";
      if (rl.want.length && !rl.want.includes(cat)) return false;
      if (rl.avoid.includes(cat)) return false;
      if (yc.includes(cat) && !rl.want.includes(cat)) return false; // 직접 고른 "땡기는 것"이 자동 규칙보다 우선
      return passes(st);
    });
  }
  function openRoulette() {
    const rl = state.rl;
    const render = () => {
      const list = candidates(), yc = yesterdayCats();
      const chip = (k, c) => `<button class="chip" data-${k}="${c}" aria-pressed="${rl[k].includes(c)}">${catLabel(c)}</button>`;
      const s = showSheet(`
        ${head("오늘 뭐 먹지?", `<span>우리 팀 기록 중에서 골라드려요${anyFilter() ? " · 상단 필터 적용 중" : ""}</span>`)}
        <div class="field"><span class="flabel">땡기는 것 <span class="opt">여러 개 선택 · 안 고르면 전부</span></span><div class="chips">${CATS.map((c) => chip("want", c)).join("")}</div></div>
        <div class="field"><span class="flabel">먹기 싫은 것</span><div class="chips neg">${CATS.map((c) => chip("avoid", c)).join("")}</div></div>
        <div class="field list-card" style="background:var(--parchment);padding:0 12px">
          <div class="toggle-row"><span>어제 먹은 종류 빼기<br><span style="font-size:13px;color:var(--ink-2)">${yc.length ? `최근 기록: ${yc.map(esc).join(", ")}` : "최근 이틀 내 내 기록이 없어요"}</span></span><button class="switch" role="switch" aria-checked="${rl.skipYesterday}" data-tg="skipYesterday" aria-label="어제 먹은 종류 빼기"></button></div>
          <div class="toggle-row" style="border-top:.5px solid var(--hair)"><span>아직 기록 없는 곳도 넣기<br><span style="font-size:13px;color:var(--ink-2)">가고 싶은 곳, 새로 등록된 곳 포함</span></span><button class="switch" role="switch" aria-checked="${rl.includeWish}" data-tg="includeWish" aria-label="가고 싶은 곳도 넣기"></button></div>
        </div>
        <div class="wheel" aria-hidden="true"><div class="wheel-band"></div><div class="wheel-track" id="track">${(list.length ? list : [{ p: { name: "후보가 없어요" } }]).slice(0, 5).map((x) => `<div class="wheel-item">${esc(x.p.name)}</div>`).join("")}</div></div>
        <p class="count">후보 ${list.length}곳${list.length === 1 ? " · 조건을 조금 풀어보세요" : ""}</p>
        <div id="rlResult"></div>
        <div class="stack" style="margin-top:14px"><button class="btn btn-primary btn-block" id="spin" ${list.length ? "" : "disabled"}>돌리기</button></div>
      `, "roulette");
      $$("[data-want]", s).forEach((b) => (b.onclick = () => { const c = b.dataset.want; rl.want = rl.want.includes(c) ? rl.want.filter((x) => x !== c) : [...rl.want, c]; rl.avoid = rl.avoid.filter((x) => x !== c); render(); }));
      $$("[data-avoid]", s).forEach((b) => (b.onclick = () => { const c = b.dataset.avoid; rl.avoid = rl.avoid.includes(c) ? rl.avoid.filter((x) => x !== c) : [...rl.avoid, c]; rl.want = rl.want.filter((x) => x !== c); render(); }));
      $$("[data-tg]", s).forEach((b) => (b.onclick = () => { rl[b.dataset.tg] = !rl[b.dataset.tg]; render(); }));
      $("#spin", s).onclick = () => spin(list, render);
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
  function openEditPlace(p) {
    const f = { name: p.name, category: p.category || "기타", note: p.note || "" };
    const render = () => {
      const s = showSheet(`
        ${head("장소 정보 수정", "<span>관리자 · 모든 멤버에게 바로 반영돼요</span>")}
        <div class="field"><label class="flabel" for="epName">가게 이름</label><input class="input" id="epName" maxlength="40" value="${esc(f.name)}" /><p class="err" id="epErr"></p></div>
        <div class="field"><span class="flabel">종류</span><div class="chips">${CATS.map((c) => `<button class="chip" data-ec="${c}" aria-pressed="${f.category === c}">${catLabel(c)}</button>`).join("")}</div></div>
        <div class="field"><label class="flabel" for="epNote">한 줄 설명 <span class="opt">선택 · 예: 라멘, 진주냉면</span></label><input class="input" id="epNote" maxlength="30" value="${esc(f.note)}" /></div>
        <div class="stack" style="margin-top:24px"><button class="btn btn-primary btn-block" id="epSave">저장</button><button class="btn btn-plain btn-block" id="epBack">취소</button></div>`, "editplace");
      const n = $("#epName", s); n.oninput = () => (f.name = n.value);
      const nt = $("#epNote", s); nt.oninput = () => (f.note = nt.value);
      $$("[data-ec]", s).forEach((b) => (b.onclick = () => { f.category = b.dataset.ec; render(); }));
      $("#epBack", s).onclick = () => openPlace(p.id);
      $("#epSave", s).onclick = async () => {
        if (!f.name.trim()) { $("#epErr", s).textContent = "가게 이름을 적어주세요."; return; }
        try { await state.store.updatePlace(p.id, { name: f.name.trim().slice(0, 40), category: f.category, note: f.note.trim().slice(0, 30), emoji: "" }); toast("장소 정보를 고쳤어요"); openPlace(p.id); }
        catch (e) { console.error(e); toast("저장하지 못했어요"); }
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
      <div class="btns" style="margin-top:12px">${action}<button class="btn btn-plain" data-mt-share="${esc(m.id)}">공유 문구 복사</button></div>
      ${!host && isAdmin() ? `<button class="link danger" data-mt-del="${esc(m.id)}" style="margin-top:10px">이 약속 취소 (관리자)</button>` : ""}
    </div>`;
  }

  function openMeetList() {
    const list = [...state.meetups].sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.createdAt - y.createdAt);
    const canNotify = "Notification" in window;
    const s = showSheet(`
      ${head("오늘 약속", `<span>점심 ${LUNCH.start}~${LUNCH.end} · 같이 먹을 사람을 선착순으로 모아요</span>`)}
      <div class="stack" style="margin-top:14px"><button class="btn btn-primary btn-block" id="mtNew">+ 약속 만들기</button></div>
      ${canNotify ? `<div class="list-card" style="background:var(--parchment);padding:0 12px;margin-top:12px"><div class="toggle-row"><span>새 약속 알림 받기<br><span style="font-size:13px;color:var(--ink-2)">이 기기에서 지도를 열어둔 동안 알려줘요</span></span><button class="switch" role="switch" id="mtNotify" aria-checked="${notifyOn() && Notification.permission === "granted"}" aria-label="새 약속 알림 받기"></button></div></div>` : ""}
      <div class="h3">${nextWord()} 점심 ${list.filter((m) => !mtPast(m)).length ? `${list.filter((m) => !mtPast(m)).length}건` : ""}</div>
      ${list.length ? list.map(meetCard).join("") : `<p class="empty" style="padding:8px 0">아직 오늘 약속이 없어요. 먼저 "오늘 ○○ 먹으실 분!"을 올려보세요.</p>`}
    `, "meets");
    $("#mtNew", s).onclick = () => openMeetForm(null);
    const nt = $("#mtNotify", s);
    if (nt) nt.onclick = async () => {
      const on = nt.getAttribute("aria-checked") === "true";
      if (on) { try { localStorage.setItem("lunchmap-notify", "0"); } catch {} return openMeetList(); }
      let perm = Notification.permission;
      try { if (perm === "default") perm = await Notification.requestPermission(); } catch {}
      if (perm === "granted") { try { localStorage.setItem("lunchmap-notify", "1"); } catch {} toast("새 약속이 생기면 알려드릴게요"); }
      else toast("브라우저 설정에서 알림을 허용해 주세요");
      openMeetList();
    };
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
      const m = state.meetups.find((x) => x.id === id);
      toast(m ? `참여했어요! ${dayWord(m)} ${LUNCH.start}에 만나요` : "참여했어요!");
      hideAlert();
    } catch (e) { toast(e.message === "FULL" ? "아쉽게도 방금 마감됐어요" : "참여하지 못했어요. 다시 눌러주세요"); }
  }

  function openMeetForm(placeId) {
    state.mf = { placeId, cap: 3, note: "", q: "" };
    const render = () => {
      const f = state.mf, p = f.placeId ? placeById(f.placeId) : null;
      const near = state.places.map((x) => ({ p: x, w: walkMin(x.lat, x.lng) }))
        .filter((x) => !f.q || x.p.name.replace(/\s/g, "").includes(f.q.replace(/\s/g, ""))).sort((x, y) => x.w - y.w).slice(0, 6);
      const s = showSheet(`
        ${head("약속 만들기", `<span>${targetDate() !== TODAY() ? `오늘 점심시간이 아니라서 ${nextWord()} 점심 약속으로 올라가요` : "오늘 ○○ 먹으실 분! 을 올려요"}</span>`)}
        <div class="field"><span class="flabel">어디서</span>
          ${p ? `<div class="pick">${thumbHTML(p)}<div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="ad">${esc(p.category || "기타")} · 사옥에서 도보 ${walkMin(p.lat, p.lng)}분</div></div><button class="link" id="mfChange">바꾸기</button></div>`
          : `<input class="input" id="mfQ" placeholder="등록된 가게 이름 검색" value="${esc(f.q)}" autocomplete="off" /><div class="results">${near.map((x) => `<button class="result" data-mf-p="${esc(x.p.id)}"><div style="flex:1;min-width:0"><div class="nm">${emojiFor(x.p)} ${esc(x.p.name)}</div></div><span class="ds">도보 ${x.w}분</span></button>`).join("") || `<p class="empty">등록된 가게가 없어요. 먼저 + 장소 추가로 등록해 주세요.</p>`}</div>`}
          <p class="err" id="mfErr"></p></div>
        <div class="field"><span class="flabel">언제</span><div class="fixed-time"><b>${nextWord()} ${LUNCH.start}</b><span>점심시간 ${LUNCH.start}~${LUNCH.end} 고정</span></div></div>
        <div class="field"><span class="flabel">선착순 모집 인원 <span class="opt">나 빼고</span></span><div class="chips">${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-mf-c="${n}" aria-pressed="${f.cap === n}">${n}명</button>`).join("")}</div></div>
        <div class="field"><label class="flabel" for="mfNote">한 줄 메모 <span class="opt">선택</span></label><input class="input" id="mfNote" maxlength="40" placeholder="예: 11:50 사옥 1층에서 출발" value="${esc(f.note)}" /></div>
        <p class="count" style="margin-top:14px">나 포함 최대 ${f.cap + 1}명 · 정원이 차면 자동으로 마감돼요</p>
        <div class="stack" style="margin-top:12px"><button class="btn btn-primary btn-block" id="mfSave">약속 올리기</button></div>
      `, "meetform");
      const q = $("#mfQ", s); if (q) { q.oninput = () => { f.q = q.value; const pos = q.selectionStart; render(); const n2 = $("#mfQ"); n2.focus(); n2.setSelectionRange(pos, pos); }; }
      $$("[data-mf-p]", s).forEach((b) => (b.onclick = () => { f.placeId = b.dataset.mfP; render(); }));
      const ch = $("#mfChange", s); if (ch) ch.onclick = () => { f.placeId = null; render(); };
      $$("[data-mf-c]", s).forEach((b) => (b.onclick = () => { f.cap = +b.dataset.mfC; render(); }));
      const nt = $("#mfNote", s); nt.oninput = () => (f.note = nt.value);
      $("#mfSave", s).onclick = async () => {
        const pl = f.placeId && placeById(f.placeId);
        if (!pl) { $("#mfErr", s).textContent = "어디서 먹을지 골라주세요."; return; }
        $("#mfSave", s).disabled = true;
        try {
          await state.store.addMeetup({ placeId: pl.id, placeName: pl.name, category: pl.category || "기타", hostUid: state.user.uid, hostName: state.user.name, time: LUNCH.start, date: targetDate(), capacity: f.cap, note: f.note.trim().slice(0, 40) });
          toast("약속을 올렸어요. 멤버들에게 알림이 가요");
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
    sysNotify(`${dayWord(m)} ${LUNCH.start} ${p.name} 먹으실 분!`, `${m.hostName}님이 선착순 ${m.capacity}명 모집 중이에요`, m.id);
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
          sysNotify(`${m.joined[k].name}님이 식사에 참여했어요`, `${dayWord(m)} ${LUNCH.start} ${m.placeName} · ${mtCount(m)}/${m.capacity}명`, m.id + k);
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
    navigator.serviceWorker.register("./sw.js").catch(() => {});
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
  function showIntro(next) {
    const el = $("#intro");
    $("#login").hidden = true; $("#app").hidden = true; el.hidden = false;
    $("#introBrand").innerHTML = $("#loginBrand").innerHTML;
    const vid = $("#introVideo"), svg = $(".intro-svg");
    if (C.introVideo) { vid.src = C.introVideo; vid.hidden = false; svg.style.display = "none"; vid.play?.().catch(() => {}); }
    else {
      const replay = () => { svg.classList.remove("play"); void svg.getBoundingClientRect(); svg.classList.add("play"); };
      replay(); el._loop = setInterval(replay, 8600);
    }
    $("#introGo").onclick = () => { clearInterval(el._loop); el.classList.add("leave"); setTimeout(() => { el.hidden = true; el.classList.remove("leave"); next(); }, 260); };
  }

  // ───────── 내 정보 ─────────
  function openMe() {
    const m = isAdmin() ? { team: "ADMIN", role: "관리자 · 장소·기록·약속 편집 권한" } : member(state.user.name) || { team: "", role: "" };
    const s = showSheet(`
      ${head("내 정보")}
      <div class="list-card" style="background:var(--parchment);margin-top:14px"><div class="member">${avatar(state.user.name)}<div style="flex:1"><div class="nm"><span class="team">${esc(m.team)}</span>${esc(state.user.name)}님</div><div class="rl">${esc(m.role)}</div></div></div></div>
      <div class="stack" style="margin-top:18px">
        <button class="btn btn-plain btn-block" id="installBtn">📲 앱으로 설치 (홈 화면에 추가)</button>
        ${state.store.demo ? `<div class="h3" style="margin-top:14px">알림 미리보기</div><div class="btns"><button class="btn btn-plain" id="pvPopular">12시 인기 장소</button><button class="btn btn-plain" id="pvRecord">점심 후 기록 요청</button></div>
        <button class="btn btn-plain btn-block" id="pvIntro">첫 화면 소개 다시 보기</button>` : ""}
        ${state.store.demo ? `<button class="btn btn-plain btn-block" id="switchMe">다른 멤버로 보기</button><button class="btn btn-secondary btn-block" id="resetDemo">미리보기 데이터 처음으로</button>` : `<button class="btn btn-plain btn-block" id="logout">로그아웃</button>`}
      </div>`, "me");
    const lo = $("#logout", s); if (lo) lo.onclick = async () => { await state.store.signOut(); location.reload(); };
    $("#installBtn", s).onclick = openInstall;
    const pp = $("#pvPopular", s); if (pp) pp.onclick = () => { closeSheet(); nudgePopular(); };
    const pr2 = $("#pvRecord", s); if (pr2) pr2.onclick = () => { closeSheet(); nudgeRecord(); };
    const pi = $("#pvIntro", s); if (pi) pi.onclick = () => { closeSheet(); showIntro(() => { $("#app").hidden = false; }); };
    const sw = $("#switchMe", s); if (sw) sw.onclick = async () => { await state.store.signOut(); location.reload(); };
    const rs = $("#resetDemo", s); if (rs) rs.onclick = () => { if (confirm("예시 데이터로 되돌릴까요? 남긴 기록이 지워져요.")) { state.store.reset(); location.reload(); } };
  }

  // ───────── 로그인 · 멤버 고르기 ─────────
  function showLogin({ google, error }) {
    $("#app").hidden = true; $("#intro").hidden = true; $("#login").hidden = false;
    const groups = ["디렉터", "임직원"].map((g) => {
      const ms = MEMBERS.filter((m) => m.group === g);
      return `<div class="group-label">${g} (${ms.length})</div><div class="list-card">${ms.map((m) => `<button class="member" data-member="${esc(m.name)}">${avatar(m.name)}<div style="flex:1"><div class="nm"><span class="team">${esc(m.team)}</span>${esc(m.name)}님</div><div class="rl">${esc(m.role)}</div></div><span class="chev">›</span></button>`).join("")}</div>`;
    }).join("");
    $("#loginBody").innerHTML = google
      ? `<button class="btn btn-primary btn-block" id="gBtn">Google 계정으로 시작하기</button><p class="login-err">${esc(error || "")}</p>`
      : `<h2 class="picker-title">나는 누구예요?</h2><p class="picker-sub">기록에 이 이름이 표시돼요. 한 번만 고르면 돼요.</p>${groups}<p class="login-err">${esc(error || "")}</p>
         <div class="admin-entry"><button class="link" data-member="admin">관리자 로그인</button></div>
         ${state.store.demo ? `<p class="demo-note">미리보기 버전이에요. 실제 버전은 이름 + 공용 비밀번호로 로그인하고, 기록이 멤버 모두에게 공유돼요.</p>` : ""}`;
    const g = $("#gBtn"); if (g) g.onclick = async () => { try { await state.store.signIn(); } catch (e) { $(".login-err").textContent = "로그인 창이 닫혔거나 팝업이 차단됐어요."; } };
    $$("[data-member]").forEach((b) => (b.onclick = () => window.__pickMember?.(b.dataset.member)));
  }

  // 공용 비밀번호 입력 단계 (실제 버전)
  function showPassword(name) {
    const adm = name === "admin";
    const m = adm ? { team: "ADMIN", role: "장소·기록·약속을 지우고 고칠 수 있어요" } : member(name) || { team: "", role: "" };
    const shown = adm ? "관리자" : name;
    $("#loginBody").innerHTML = `
      <h2 class="picker-title">${adm ? "관리자 로그인" : "비밀번호를 입력해 주세요"}</h2>
      <p class="picker-sub">${adm ? "관리자 비밀번호를 입력해 주세요." : "파파 공용 비밀번호예요. 한 번 로그인하면 이 기기에서 계속 유지돼요."}</p>
      <div class="list-card"><div class="member">${avatar(shown)}<div style="flex:1"><div class="nm"><span class="team">${esc(m.team)}</span>${esc(shown)}${adm ? "" : "님"}</div><div class="rl">${esc(m.role)}</div></div><button class="link" id="pwBack" type="button">다른 이름</button></div></div>
      <form id="pwForm" class="field" autocomplete="on">
        <input type="text" name="username" value="${esc(name)}" autocomplete="username" hidden />
        <input class="input" id="pw" type="password" autocomplete="current-password" placeholder="${adm ? "관리자 비밀번호" : "공용 비밀번호"}" aria-label="비밀번호" />
        <div class="stack" style="margin-top:12px"><button class="btn btn-primary btn-block" id="pwGo" type="submit">로그인</button></div>
      </form>
      <p class="login-err" id="pwErr" role="alert"></p>`;
    const pw = $("#pw"), go = $("#pwGo");
    setTimeout(() => pw.focus(), 50);
    $("#pwBack").onclick = () => showLogin({ google: false });
    $("#pwForm").onsubmit = async (e) => {
      e.preventDefault();
      if (!pw.value) { $("#pwErr").textContent = "비밀번호를 입력해 주세요."; return; }
      go.disabled = true; go.textContent = "확인 중…"; $("#pwErr").textContent = "";
      try { await state.store.signIn(name, pw.value); }
      catch (err) { $("#pwErr").textContent = err.userMsg || "로그인하지 못했어요."; go.disabled = false; go.textContent = "로그인"; pw.select(); }
    };
  }

  // ───────── 기타 ─────────
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 1900); }

  function bindUI() {
    $$(".filters .chip").forEach((b) => (b.onclick = () => { const k = b.dataset.filter; state.filters[k] = !state.filters[k]; b.setAttribute("aria-pressed", state.filters[k]); renderMarkers(); renderPanel(); }));
    $$("#tabs button").forEach((t) => (t.onclick = () => { state.tab = t.dataset.tab; $$("#tabs button").forEach((x) => x.setAttribute("aria-selected", x === t)); $("#panel").dataset.open = "true"; renderPanel(); stagger(); renderMarkers(); }));
    $("#grab").onclick = () => { const p = $("#panel"); p.dataset.open = p.dataset.open === "true" ? "false" : "true"; };
    $("#fab").onclick = openAdd;
    $("#rouletteBtn").onclick = openRoulette;
    $("#meetBtn").onclick = openMeetList;
    $("#meBtn").onclick = openMe;
    $("#addCancel").onclick = stopAdding;
    $("#scrim").onclick = closeSheet;
    $("#zin").onclick = () => MapKit.zoom(1);
    $("#zout").onclick = () => MapKit.zoom(-1);
    $("#zhome").onclick = () => MapKit.home();
    // 앱 화면·지도는 스크롤되면 안 됨: 브라우저가 포커스 때문에 밀어도 즉시 제자리로 (overflow: clip 미지원 브라우저 대비)
    ["#app", "#map"].forEach((s) => { const el = $(s); el.addEventListener("scroll", () => { if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0; } }); });
    // 지도를 움직이거나 휠로 확대하면 정보 카드 숨김
    ["pointerdown", "wheel"].forEach((t) => $("#map").addEventListener(t, hideTip, { passive: true }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (state.sheet || state.adding)) closeSheet(); });
  }

  async function start(user) {
    state.user = user;
    $("#login").hidden = true; $("#intro").hidden = true; $("#app").hidden = false;
    const me = $("#meBtn"); me.style.background = hue(user.name);
    me.innerHTML = `${esc(user.name.charAt(0))}${photoOf(user.name) ? `<img src="${photoOf(user.name)}" alt="" onerror="this.remove()">` : ""}`;
    if (state.store.demo) $("#demoBadge").hidden = false;
    bindUI();
    await Promise.all([initMap(), window.Walk ? Walk.init(C.office) : null]);
    if (state.store.demo) demoSimulate();
    registerSW();
    setInterval(lunchTick, 60000); setTimeout(lunchTick, 4000);
    setTimeout(installTip, 25000);
    let seeded = false;
    state.store.subscribe(({ places, reviews, meetups }) => {
      state.places = places; state.reviews = reviews;
      onMeetups(meetups || []);
      if (!seeded && window.SEED_PLACES) {
        seeded = true;
        const missing = SEED_PLACES.filter((s) => !places.some((p) => p.id === s.id || p.name === s.name));
        if (missing.length && !places.some((p) => String(p.id).startsWith("seed-"))) seedPlaces(missing);
      }
      if (state.pending && places.some((p) => p.id === state.pending.id)) state.pending = null;
      renderAll();
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
    $("#loginBrand").innerHTML = brand; $("#brand").setAttribute("aria-label", C.appTitle || n);
    document.title = C.appTitle || n;
    initPress();
    // 스플래시: 최소 0.9초 보여준 뒤 부드럽게 사라짐 (그동안 데이터 준비)
    const t0 = performance.now(), sp = $("#splash");
    const hideSplash = () => { if (!sp) return; setTimeout(() => { sp.classList.add("hide"); setTimeout(() => sp.remove(), 400); }, Math.max(0, 900 - (performance.now() - t0))); };
    state.store = await createStore();
    hideSplash();
    let started = false;
    state.store.onUser(async (u, err) => {
      if (started) return;
      if (!u) {
        const login = () => {
          // 이름 고르기 → (실제 버전) 공용 비밀번호 입력 → 로그인
          window.__pickMember = (name) => (state.store.needsPassword ? showPassword(name) : state.store.signIn(name === "admin" ? "관리자" : name));
          showLogin({ google: false, error: err });
        };
        if (err) return login();
        return showIntro(login);   // 로그인 전 첫 화면: 모션그래픽 소개
      }
      const prof = await state.store.getProfile(u.uid);
      if (prof?.memberName && (member(prof.memberName) || prof.admin)) { started = true; return start({ ...u, name: prof.memberName, admin: !!prof.admin }); }
      window.__pickMember = async (name) => { await state.store.setProfile(u.uid, name); started = true; start({ ...u, name }); };
      showLogin({ google: false });
    });
  })();
})();
