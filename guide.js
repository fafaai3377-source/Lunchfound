// ─────────────────────────────────────────────
//  사용 방법 안내 (코치마크) — 실제 버튼을 하나씩 비추면서 따라가는 가이드
//  · 처음 들어온 멤버에게 홈 화면에서 자동으로 한 번
//  · 닫기: 이번에만 닫기 (앱을 다시 열면 또 보여요)
//  · 7일간 보지 않기: 7일 동안 자동으로 안 뜸
//  · 끝까지 보면(시작하기) 다시 자동으로 뜨지 않음 — 내 정보 > 사용 방법 다시 보기로 언제든
//  기록은 이 기기에만 (localStorage). 비공개 창 등 저장이 막혀 있어도 안내는 정상 동작
// ─────────────────────────────────────────────
(() => {
  const KEY = "lunchfound-guide", SKEY = "lunchfound-guide-closed", WEEK = 7 * 864e5;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...o })); } catch {} };
  const closedThisSession = () => { try { return sessionStorage.getItem(SKEY) === "1"; } catch { return false; } };

  function shouldShow() {
    const g = read();
    if (g.done) return false;
    if (g.snoozeUntil && Date.now() < g.snoozeUntil) return false;
    return !closedThisSession();
  }

  let root = null, steps = [], idx = 0, onEnd = null, lastRect = null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const target = (st) => { try { return typeof st.el === "function" ? st.el() : st.el ? document.querySelector(st.el) : null; } catch { return null; } };
  // 화면에 실제로 보이는 요소인지 (숨김·크기 0·화면 밖이면 그 단계는 건너뜀)
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(el).visibility !== "hidden";
  };
  const usable = (st) => !st.el || visible(target(st));

  function start(list, opts = {}) {
    stop(true);
    steps = list.filter(usable);
    if (!steps.length) return;
    onEnd = opts.onEnd || null;
    idx = 0;
    root = document.createElement("div");
    root.className = "guide";
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-labelledby", "gdTitle");
    root.innerHTML = `<div class="gd-hole"></div><div class="gd-tap" aria-hidden="true"><i></i></div>
      <div class="gd-pop"><span class="gd-arrow" aria-hidden="true"></span><div class="gd-body" aria-live="polite"></div>
        <div class="gd-foot"><button type="button" class="gd-link" data-gd="week">7일간 보지 않기</button><button type="button" class="gd-link" data-gd="close">닫기</button></div></div>`;
    document.body.appendChild(root);
    document.documentElement.classList.add("guide-on");
    root.addEventListener("click", onClick);
    addEventListener("resize", place); addEventListener("keydown", onKey, true);
    requestAnimationFrame(() => { root.classList.add("in"); show(0, true); });
  }

  function stop(silent) {
    if (!root) return;
    const r = root; root = null;
    removeEventListener("resize", place); removeEventListener("keydown", onKey, true);
    document.documentElement.classList.remove("guide-on");
    r.classList.remove("in"); r.classList.add("out");
    setTimeout(() => r.remove(), silent ? 0 : 220);
    if (!silent && onEnd) onEnd();
  }
  // 닫는 방법 3가지
  function close(kind) {
    if (kind === "week") write({ snoozeUntil: Date.now() + WEEK });
    else if (kind === "done") write({ done: true, doneAt: Date.now() });
    else { try { sessionStorage.setItem(SKEY, "1"); } catch {} }
    stop();
  }

  function onClick(e) {
    const b = e.target.closest("[data-gd]");
    if (b) { e.stopPropagation(); const a = b.dataset.gd; if (a === "next") return go(1); if (a === "prev") return go(-1); return close(a); }
    // 비춘 버튼 자리를 직접 눌러도 다음으로 (실제 버튼은 안내가 끝난 뒤에 눌러요)
    if (lastRect && steps[idx]?.el) {
      const { clientX: x, clientY: y } = e;
      if (x >= lastRect.left && x <= lastRect.right && y >= lastRect.top && y <= lastRect.bottom) go(1);
    }
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close("close"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  }
  function go(d) {
    let n = idx + d;
    // 그 사이에 사라진 버튼(예: 지도가 안 뜬 경우의 핀)은 건너뜀
    while (n >= 0 && n < steps.length && !usable(steps[n])) n += d;
    if (n >= steps.length) return close("done");
    if (n < 0) return;
    show(n);
  }

  function show(i, first) {
    idx = i;
    const st = steps[i], last = i === steps.length - 1;
    const dots = steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    const body = root.querySelector(".gd-body");
    body.innerHTML = `${st.hero && st.icon ? `<div class="gd-icon">${st.icon}</div>` : ""}
      <h3 id="gdTitle">${esc(st.title)}</h3><p>${st.html || esc(st.body)}</p>
      <div class="gd-nav"><span class="gd-dots" aria-label="${i + 1} / ${steps.length}">${dots}</span>
        ${i > 0 ? `<button type="button" class="gd-btn gd-prev" data-gd="prev">이전</button>` : ""}
        <button type="button" class="gd-btn" data-gd="next">${esc(st.next || (last ? "시작하기" : i === 0 ? "둘러보기" : "다음"))}</button></div>`;
    root.classList.toggle("hero", !st.el);
    const pop = root.querySelector(".gd-pop");
    pop.classList.remove("swap"); void pop.offsetWidth; pop.classList.add("swap");
    // 처음 뜰 때는 미끄러지지 않고 제자리에서 바로 (그다음 단계부터 따라 움직임)
    if (first) root.classList.add("instant");
    place(first);
    if (first) requestAnimationFrame(() => requestAnimationFrame(() => root?.classList.remove("instant")));
    root.querySelector('[data-gd="next"]')?.focus({ preventScroll: true });
  }

  // 구멍(스포트라이트) · 누르는 손짓 · 말풍선 위치 잡기 — 단계가 바뀌면 다음 버튼으로 미끄러지듯 따라감
  function place(first) {
    if (!root) return;
    const st = steps[idx], el = st.el ? target(st) : null;
    const hole = root.querySelector(".gd-hole"), tap = root.querySelector(".gd-tap"), pop = root.querySelector(".gd-pop"), arrow = root.querySelector(".gd-arrow");
    const vw = innerWidth, vh = innerHeight, M = 12;
    if (!el || !visible(el)) {
      // 버튼 없는 단계(환영·마무리): 화면 가운데 카드, 구멍은 가운데 점으로 접힘
      lastRect = null;
      Object.assign(hole.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px", borderRadius: "50%" });
      tap.classList.remove("on");
      const pw = Math.min(340, vw - M * 2);
      pop.style.width = pw + "px";
      const ph = pop.offsetHeight;
      Object.assign(pop.style, { left: (vw - pw) / 2 + "px", top: Math.max(M, (vh - ph) / 2) + "px" });
      arrow.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect(), pad = st.pad ?? 6;
    const box = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
    lastRect = { left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height };
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    Object.assign(hole.style, { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px", borderRadius: Math.min(rad + pad, box.height / 2) + "px" });
    // 누르는 손짓: 버튼 가운데 (넓은 영역은 왼쪽 첫 칸쯤)
    const tx = st.tapX != null ? r.left + r.width * st.tapX : r.left + Math.min(r.width / 2, 60), ty = r.top + r.height / 2;
    Object.assign(tap.style, { left: tx + "px", top: ty + "px" });
    tap.classList.add("on");
    // 말풍선: 아래 공간이 넉넉하면 아래, 아니면 위
    const pw = Math.min(320, vw - M * 2);
    pop.style.width = pw + "px";
    const ph = pop.offsetHeight, gap = 14;
    const below = vh - lastRect.bottom - gap - M >= ph || lastRect.top - gap - M < ph && vh - lastRect.bottom > lastRect.top;
    const top = below ? Math.min(lastRect.bottom + gap, vh - ph - M) : Math.max(M, lastRect.top - gap - ph);
    const cx = r.left + r.width / 2;
    const left = Math.min(Math.max(M, cx - pw / 2), vw - pw - M);
    Object.assign(pop.style, { left: left + "px", top: top + "px" });
    arrow.hidden = false;
    arrow.className = `gd-arrow ${below ? "up" : "down"}`;
    arrow.style.left = Math.min(Math.max(18, cx - left), pw - 18) + "px";
  }

  window.LFGuide = { shouldShow, start, stop: () => stop(true), isOpen: () => !!root };
})();
