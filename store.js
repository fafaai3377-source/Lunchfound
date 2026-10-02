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
      const t = await u.getIdTokenResult().catch(() => null);
      const name = t?.claims?.member;
      if (!name) { await A.signOut(auth); return userCb(null, "다시 로그인해 주세요."); }
      current = { uid: u.uid, name };
      userCb(current);
    });
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
      async getProfile() { return current ? { memberName: current.name } : null; },
      async setProfile() {},
      subscribe(cb) {
        const st = { places: [], reviews: [], meetups: [] };
        const emit = () => cb({ places: [...st.places], reviews: [...st.reviews], meetups: [...st.meetups] });
        F.onSnapshot(F.query(F.collection(db, "meetups"), F.where("date", "in", [today(), tomorrow()])), (s) => { st.meetups = toArr(s); emit(); }, (e) => console.error(e));
        F.onSnapshot(F.collection(db, "places"), (s) => { st.places = toArr(s); emit(); }, (e) => console.error(e));
        F.onSnapshot(F.collection(db, "reviews"), (s) => { st.reviews = toArr(s); emit(); }, (e) => console.error(e));
      },
      async addPlace(d) { const r = await F.addDoc(F.collection(db, "places"), { ...d, createdAt: F.serverTimestamp() }); return r.id; },
      updatePlace: (id, patch) => F.updateDoc(F.doc(db, "places", id), patch),
      // 상세를 처음 연 멤버를 places.views.{uid}에 한 번만 기록 ("내 추천을 본 사람")
      markView: (id, uid) => F.updateDoc(F.doc(db, "places", id), { [`views.${uid}`]: true }),
      deletePlace: (id) => F.deleteDoc(F.doc(db, "places", id)),
      addReview: (d) => F.addDoc(F.collection(db, "reviews"), { ...d, createdAt: F.serverTimestamp() }),
      deleteReview: (id) => F.deleteDoc(F.doc(db, "reviews", id)),
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
    const seed = () => ({ places: [], reviews: [], meetups: [] }); // 기본 가게는 app.js가 seeds.js로 채움
    let data; try { data = JSON.parse(get(KEY)) || seed(); } catch { data = seed(); }
    let sub = () => {}, userCb = () => {};
    data.meetups = (data.meetups || []).filter((m) => m.date >= today()); // 지난 날 약속은 정리
    const emit = () => sub({ places: [...data.places], reviews: [...data.reviews], meetups: data.meetups.map((m) => ({ ...m, joined: { ...m.joined } })) });
    const save = () => { set(KEY, JSON.stringify(data)); emit(); };
    const id = () => Math.random().toString(36).slice(2, 10);
    const userOf = (n) => ({ uid: "demo-" + n, email: "preview@local", name: n });
    return {
      demo: true,
      onUser(cb) { userCb = cb; const n = get(NKEY); setTimeout(() => cb(n ? userOf(n) : null), 0); },
      async signIn(memberName) { set(NKEY, memberName); userCb(userOf(memberName)); },
      async signOut() { try { localStorage.removeItem(NKEY); } catch {} },
      async getProfile(uid) { const n = uid.replace(/^demo-/, ""); return n ? { memberName: n } : null; },
      async setProfile() {},
      reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(NKEY); } catch {} },
      subscribe(cb) { sub = cb; emit(); },
      async addPlace(d) { const i = id(); data.places.push({ id: i, ...d, createdAt: Date.now() }); save(); return i; },
      async markView(pid, uid) { const p = data.places.find((x) => x.id === pid); if (p) { p.views = { ...(p.views || {}), [uid]: true }; save(); } },
      async updatePlace(pid, patch) { const p = data.places.find((x) => x.id === pid); if (p) Object.assign(p, patch); save(); },
      async deletePlace(pid) { data.places = data.places.filter((p) => p.id !== pid); data.reviews = data.reviews.filter((r) => r.placeId !== pid); save(); },
      async addReview(d) { data.reviews.push({ id: id(), ...d, createdAt: Date.now() }); save(); },
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
