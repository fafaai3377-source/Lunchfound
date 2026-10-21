// 데이터 저장소: Firebase가 설정돼 있으면 Firestore, 아니면 미리보기(localStorage)
(function () {
  const FB = "https://www.gstatic.com/firebasejs/10.12.2";
  const C = window.CONFIG;
  window.IS_DEMO = !C.firebase.apiKey;
  const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (기기 시간 기준)
  // "다음 점심" = 다음 평일 (금요일 오후에 만든 약속은 월요일 점심으로)
  const tomorrow = () => { const d = new Date(); do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); return d.toLocaleDateString("sv-SE"); };
  window.TODAY = today; window.TOMORROW = tomorrow;

  window.createStore = async function () {
    return window.IS_DEMO ? demoStore() : firebaseStore();
  };

  // ── Firebase ──────────────────────────────
  async function firebaseStore() {
    const { initializeApp } = await import(`${FB}/firebase-app.js`);
    const A = await import(`${FB}/firebase-auth.js`);
    const F = await import(`${FB}/firebase-firestore.js`);
    const app = initializeApp(C.firebase);
    const auth = A.getAuth(app);
    const db = F.getFirestore(app);
    // 로그인: 멤버 이름 + 공용 비밀번호 → /api/login이 확인 후 Firebase 토큰 발급 → 토큰 안의 member가 이름
    let userCb = () => {}, current = null;
    A.onAuthStateChanged(auth, async (u) => {
      if (!u) { current = null; return userCb(null); }
      // 오랜만에 열면 로그인 토큰을 새로 받아야 함 — 휴대폰이 막 깨어나 연결이 불안정하면 실패할 수 있어서 3번까지 다시 시도
      let t = null;
      for (let i = 0; i < 3 && !t; i++) {
        t = await u.getIdTokenResult().catch((e) => { console.warn("[foundeat] 로그인 토큰 갱신 실패", e?.code || e); return null; });
        if (!t) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
      // 연결 문제로 토큰을 못 받은 경우엔 로그아웃시키지 않음 (다음에 열면 그대로 로그인 상태)
      if (!t) return userCb(null, "인터넷 연결이 불안정해요. 잠시 뒤 새로고침해 주세요.");
      // 게스트(둘러보기 전용): 토큰에 member 대신 guest가 있음
      if (t.claims?.guest === true) { current = { uid: u.uid, name: "게스트", guest: true }; return userCb(current); }
      const name = t.claims?.member;
      if (!name) { await A.signOut(auth); return userCb(null, "다시 로그인해 주세요."); }
      current = { uid: u.uid, name, admin: t?.claims?.admin === true };
      userCb(current);
    });
    // 게스트: Firestore 대신 /api/guest (이름을 뺀 가게·기록)를 받아옴 — 실시간 대신 1분마다, 앱을 다시 볼 때마다 새로
    async function guestFetch(q = "") {
      const tok = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/guest${q}`, { headers: { Authorization: `Bearer ${tok}` } });
      if (!r.ok) { const e = new Error("GUEST_FAIL"); e.code = r.status === 401 ? "unauthenticated" : "unavailable"; throw e; }
      return r.json();
    }
    function guestSubscribe(cb, onErr) {
      const load = async () => {
        try {
          const j = await guestFetch();
          cb({ places: j.places || [], reviews: (j.reviews || []).map((r) => (r.rating2 > 0 ? { ...r, rating: r.rating2 / 2 } : r)), meetups: [] });
        } catch (e) { console.error("[foundeat] 게스트 목록 오류", e); onErr?.(e.code || "error", "places"); }
      };
      load();
      clearInterval(this._guestTimer); this._guestTimer = setInterval(load, 60000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
      this.retry = load;
    }
    const toArr = (s) => s.docs.map((d) => { const v = d.data(); return { id: d.id, ...v, createdAt: v.createdAt?.toMillis?.() ?? Date.now() }; });
    return {
      demo: false,
      onUser(cb) { userCb = cb; },
      needsPassword: true,
      async signIn(name, password) {
        const r = await fetch(C.loginApi || "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.token) { const e = new Error("LOGIN_FAIL"); e.userMsg = j.error || "로그인하지 못했어요. 잠시 뒤 다시 해주세요."; throw e; }
        await A.signInWithCustomToken(auth, j.token);
      },
      signOut: () => A.signOut(auth),
      idToken: () => auth.currentUser?.getIdToken() ?? Promise.resolve(null),
      async getProfile() { return current ? { memberName: current.name, admin: current.admin, guest: !!current.guest } : null; },
      async setProfile() {},
      // onErr(code): 가게·기록 목록을 받다가 오류가 나면 알려줌 (권한 오류는 토큰을 새로 받아 한 번 자동 재시도)
      subscribe(cb, onErr) {
        if (current?.guest) return guestSubscribe.call(this, cb, onErr);
        const st = { places: [], reviews: [], meetups: [] };
        // 가게 목록과 기록을 둘 다 처음 받기 전에는 화면에 내보내지 않음 (잠깐 "가게 0곳"·"기록 없음"으로 보이는 순간이 생기지 않게)
        let gotPlaces = false, gotReviews = false, retried = false, unsubs = [];
        const emit = () => { if (gotPlaces && gotReviews) cb({ places: [...st.places], reviews: [...st.reviews], meetups: [...st.meetups] }); };
        const fail = (what) => async (e) => {
          console.error(`[foundeat] ${what} 목록 오류`, e?.code, e);
          if (what !== "meetups" && /permission|unauth/.test(e?.code || "") && !retried) { retried = true; await auth.currentUser?.getIdToken(true).catch(() => {}); return listen(); }
          if (what !== "meetups") onErr?.(e?.code || "error", what);
        };
        const listen = () => {
          unsubs.forEach((u) => { try { u(); } catch {} });
          unsubs = [
            F.onSnapshot(F.query(F.collection(db, "meetups"), F.where("date", "in", [today(), tomorrow()])), (s) => { st.meetups = toArr(s); emit(); }, fail("meetups")),
            F.onSnapshot(F.collection(db, "places"), (s) => { st.places = toArr(s); gotPlaces = true; emit(); }, fail("places")),
            // 반 별점: 보안 규칙(rating은 정수)을 그대로 두고 rating2(별점×2, 1~10)에 함께 저장 → 읽을 때 rating2/2로 복원
            F.onSnapshot(F.collection(db, "reviews"), (s) => { st.reviews = toArr(s).map((r) => (r.rating2 > 0 ? { ...r, rating: r.rating2 / 2 } : r)); gotReviews = true; emit(); }, fail("reviews")),
          ];
        };
        listen();
        // "다시 시도" 버튼: 로그인 토큰을 새로 받고 목록을 처음부터 다시 받음
        this.retry = async () => { retried = false; await auth.currentUser?.getIdToken(true).catch(() => {}); listen(); };
      },
      async addPlace(d) { const r = await F.addDoc(F.collection(db, "places"), { ...d, createdAt: F.serverTimestamp() }); return r.id; },
      updatePlace: (id, patch) => F.updateDoc(F.doc(db, "places", id), patch),
      // 상세를 처음 연 멤버를 places.views.{uid}에 한 번만 기록 ("내 추천을 본 사람")
      markView: (id, uid) => (current?.guest ? Promise.resolve() : F.updateDoc(F.doc(db, "places", id), { [`views.${uid}`]: true })),
      deletePlace: (id) => F.deleteDoc(F.doc(db, "places", id)),
      async addReview(d) { const h = Math.round((+d.rating || 0) * 2); const r = await F.addDoc(F.collection(db, "reviews"), { ...d, rating: Math.floor(h / 2), rating2: h, createdAt: F.serverTimestamp() }); return r.id; },
      deleteReview: (id) => F.deleteDoc(F.doc(db, "reviews", id)),
      // 내 기록 수정 (보안 규칙: 쓴 사람만 수정 가능)
      async updateReview(id, d) { const h = Math.round((+d.rating || 0) * 2); await F.updateDoc(F.doc(db, "reviews", id), { ...d, rating: Math.floor(h / 2), rating2: h, updatedAt: F.serverTimestamp() }); },
      // 멤버 사진: 원본 크기 사진은 photos 컬렉션에 따로 두고, 가게를 열 때만 불러옴 (앱이 무거워지지 않게)
      async addPhoto(d) { const r = await F.addDoc(F.collection(db, "photos"), { ...d, createdAt: F.serverTimestamp() }); return r.id; },
      async listPhotos(placeId) {
        if (current?.guest) { const j = await guestFetch(`?photos=${encodeURIComponent(placeId)}`); return j.photos || []; }
        const snap = await F.getDocs(F.query(F.collection(db, "photos"), F.where("placeId", "==", placeId)));
        return toArr(snap).sort((a, b) => b.createdAt - a.createdAt);
      },
      deletePhoto: (id) => F.deleteDoc(F.doc(db, "photos", id)),
      async deletePhotosOf(field, value) {
        const snap = await F.getDocs(F.query(F.collection(db, "photos"), F.where(field, "==", value)));
        await Promise.all(snap.docs.map((d) => F.deleteDoc(d.ref).catch(() => {})));
      },
      // 오늘 약속 (식사조인)
      async addMeetup(d) { const r = await F.addDoc(F.collection(db, "meetups"), { date: today(), ...d, joined: {}, createdAt: F.serverTimestamp() }); return r.id; },
      // 선착순: 트랜잭션으로 정원 확인과 참여를 한 번에 처리 (동시에 눌러도 정원 초과 없음)
      async joinMeetup(id, user) {
        const ref = F.doc(db, "meetups", id);
        await F.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error("GONE");
          const m = snap.data(), joined = { ...(m.joined || {}) };
          if (joined[user.uid]) return;
          if (Object.keys(joined).length >= m.capacity) throw new Error("FULL");
          joined[user.uid] = { name: user.name, at: Date.now() };
          tx.update(ref, { joined });
        });
      },
      leaveMeetup: (id, uid) => F.updateDoc(F.doc(db, "meetups", id), { [`joined.${uid}`]: F.deleteField() }),
      deleteMeetup: (id) => F.deleteDoc(F.doc(db, "meetups", id)),
      // 기본 가게: 정해진 id로 저장해서 여러 명이 동시에 열어도 중복되지 않음
      async seedPlaces(list) {
        for (const { id, ...d } of list) {
          const ref = F.doc(db, "places", id);
          if (!(await F.getDoc(ref)).exists()) await F.setDoc(ref, { ...d, createdAt: F.serverTimestamp() });
        }
      },
    };
  }

  // ── 미리보기 (이 브라우저에만 저장) ──────────
  function demoStore() {
    const KEY = "lunchmap-demo-v4", NKEY = "lunchmap-demo-member";
    const o = C.office;
    const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
    const seed = () => ({ places: [], reviews: [], meetups: [], photos: [] }); // 기본 가게는 app.js가 seeds.js로 채움
    let data; try { data = JSON.parse(get(KEY)) || seed(); } catch { data = seed(); }
    let sub = () => {}, userCb = () => {};
    data.meetups = (data.meetups || []).filter((m) => m.date >= today()); // 지난 날 약속은 정리
    data.photos = data.photos || [];
    const emit = () => sub(isGuest() ? anonView() : { places: [...data.places], reviews: [...data.reviews], meetups: data.meetups.map((m) => ({ ...m, joined: { ...m.joined } })) });
    const save = () => { set(KEY, JSON.stringify(data)); emit(); };
    const id = () => Math.random().toString(36).slice(2, 10);
    const userOf = (n) => ({ uid: "demo-" + n, email: "preview@local", name: n, admin: n === "관리자", guest: n === "게스트" });
    // 미리보기에서도 게스트는 실제와 똑같이 이름을 뺀 데이터만 봄
    const isGuest = () => get(NKEY) === "게스트";
    const anonView = () => {
      const ids = new Map(), aid = (u) => { if (!ids.has(u)) ids.set(u, "g" + (ids.size + 1)); return ids.get(u); };
      return {
        places: data.places.map((p) => ({ ...p, createdBy: "", createdByName: "", views: Object.fromEntries(Object.keys(p.views || {}).map((k, i) => ["v" + i, true])), images: (p.images || []).map((im) => ({ ...im, by: "", uid: "" })) })),
        reviews: [...data.reviews].sort((a, b) => a.createdAt - b.createdAt).map((r) => ({ ...r, uid: aid(r.uid), userName: "" })),
        meetups: [],
      };
    };
    return {
      demo: true,
      onUser(cb) { userCb = cb; const n = get(NKEY); setTimeout(() => cb(n ? userOf(n) : null), 0); },
      async signIn(memberName) { set(NKEY, memberName); userCb(userOf(memberName)); },
      async signOut() { try { localStorage.removeItem(NKEY); } catch {} },
      async getProfile(uid) { const n = uid.replace(/^demo-/, ""); return n ? { memberName: n, admin: n === "관리자", guest: n === "게스트" } : null; },
      async setProfile() {},
      reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(NKEY); } catch {} },
      subscribe(cb) { sub = cb; emit(); },
      async addPlace(d) { const i = id(); data.places.push({ id: i, ...d, createdAt: Date.now() }); save(); return i; },
      async markView(pid, uid) { const p = data.places.find((x) => x.id === pid); if (p) { p.views = { ...(p.views || {}), [uid]: true }; save(); } },
      async updatePlace(pid, patch) { const p = data.places.find((x) => x.id === pid); if (p) Object.assign(p, patch); save(); },
      async deletePlace(pid) { data.places = data.places.filter((p) => p.id !== pid); data.reviews = data.reviews.filter((r) => r.placeId !== pid); data.photos = data.photos.filter((x) => x.placeId !== pid); save(); },
      async addReview(d) { const i = id(); data.reviews.push({ id: i, ...d, createdAt: Date.now() }); save(); return i; },
      async addPhoto(d) { const i = id(); data.photos.push({ id: i, ...d, createdAt: Date.now() }); try { save(); } catch { data.photos.pop(); throw new Error("미리보기 저장 공간이 부족해요"); } return i; },
      async listPhotos(pid) { return data.photos.filter((x) => x.placeId === pid).sort((a, b) => b.createdAt - a.createdAt).map((x) => (isGuest() ? { ...x, uid: "", userName: "" } : x)); },
      async deletePhotosOf(field, value) { data.photos = data.photos.filter((x) => x[field] !== value); save(); },
      async deletePhoto(pid) { data.photos = data.photos.filter((x) => x.id !== pid); save(); },
      async updateReview(rid, d) { const r = data.reviews.find((x) => x.id === rid); if (r) Object.assign(r, d, { updatedAt: Date.now() }); save(); },
      async deleteReview(rid) { data.reviews = data.reviews.filter((r) => r.id !== rid); save(); },
      async addMeetup(d) { const i = id(); data.meetups.push({ id: i, date: today(), ...d, joined: {}, createdAt: Date.now() }); save(); return i; },
      async joinMeetup(mid, user) {
        const m = data.meetups.find((x) => x.id === mid); if (!m) throw new Error("GONE");
        if (m.joined[user.uid]) return;
        if (Object.keys(m.joined).length >= m.capacity) throw new Error("FULL");
        m.joined[user.uid] = { name: user.name, at: Date.now() }; save();
      },
      async leaveMeetup(mid, uid) { const m = data.meetups.find((x) => x.id === mid); if (m) { delete m.joined[uid]; save(); } },
      async deleteMeetup(mid) { data.meetups = data.meetups.filter((x) => x.id !== mid); save(); },
      // 미리보기 전용: 다른 멤버가 약속을 만든 상황을 흉내 내서 알림을 보여줌
      async simulateMeetup(d) { data.meetups.push({ id: id(), date: today(), ...d, createdAt: Date.now() }); save(); },
      async seedPlaces(list) { for (const p of list) if (!data.places.some((x) => x.id === p.id)) data.places.push({ ...p, createdAt: Date.now() }); save(); },
    };
  }
})();
