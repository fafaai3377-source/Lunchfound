// ─────────────────────────────────────────────
//  Lunchfound 설정 — 여기만 고치면 됩니다
// ─────────────────────────────────────────────
window.CONFIG = {
  // 서비스 이름. 로고는 lunch//found — 가운데 "//"가 젓가락 모티프로 파랗게 표시돼요
  appName: "lunch//found",
  appTitle: "Lunchfound",
  // 로고 이미지 (보내주신 // Lunchfound). 밝은 화면엔 검정, 스플래시(버건디)엔 흰색
  logo: { black: "./brand/logo-black.png", white: "./brand/logo-white.png", mark: "./brand/mark-black.png" },
  // 브랜드 색: 스플래시 · 앱 아이콘 · 파비콘에 쓰는 버건디 (UI 버튼 강조색은 styles.css의 --accent)
  brandColor: "#6E1519",

  // 사옥 위치 (네이버 지도에 등록된 파운드파운디드 좌표)
  office: { name: "사옥", lat: 37.5561767, lng: 126.9190359,
    // 길찾기 출발지 (네이버 지도 "파운드파운디드" 장소 기준). 네이버·카카오 길찾기가 항상 여기서 출발해요
    mapName: "파운드파운디드", naverPlaceId: "38507959" },

  // 카카오 개발자 > 내 애플리케이션 > 앱 키 > JavaScript 키
  // (플랫폼 > Web 에 Vercel 주소 등록, 카카오맵 사용 설정 ON 필요)
  kakaoJsKey: "",

  // 위성 지도(항공사진): 브이월드(vworld.kr) 회원가입 → 오픈API 인증키 발급(무료, 서비스 URL에 이 사이트 주소 등록) → 여기에 붙여넣기
  // 비어 있으면 지도 종류에서 "위성"은 '준비 중'으로 보이고, 그래픽 지도만 쓸 수 있어요
  vworldKey: "BD6DD78F-693B-4811-A701-F8716E611A0C",

  // 로그인: 멤버 이름 + 공용 비밀번호 (확인은 서버 함수 api/login.js, 비밀번호 해시는 Vercel 환경변수)
  loginApi: "/api/login",
  // 앱을 닫아도 오는 알림(Web Push) 공개 키. 짝이 되는 비밀 키는 Vercel 환경변수 VAPID_PRIVATE_KEY에만 있어요
  vapidPublicKey: "BKpyQTRXsKhY8KMNOvf2j-LFqtmGMCBGt3s52CaWWHl_BEl6U2qkbhg5RVzsTNexckZpVGYEM7_8B0FiqmyU0KQ",

  // Firebase 웹 앱 설정값. apiKey가 비어 있으면 미리보기 모드(이 브라우저에만 저장)
  firebase: {
    apiKey: "AIzaSyDxZCi8FfVBdDLJuubgDP3FWHU_0UBinlM",
    authDomain: "lunchfound-f470e.firebaseapp.com",
    projectId: "lunchfound-f470e",
    storageBucket: "lunchfound-f470e.firebasestorage.app",
    messagingSenderId: "769338024285",
    appId: "1:769338024285:web:cc7bfc2599d3832b8e08b4",
  },

  // 대표 이미지 서버 함수 (api/place-image.js). Vercel 환경변수 KAKAO_REST_KEY 필요
  // 블로그 사진 자동 찾기는 쓰지 않아요 (카카오 키 없이 운영). 대표 사진은 멤버가 직접 올려요
  imageApi: "",
  // 처음 실행 때 기본 가게(seeds.js)를 자동 등록할지. 실제 운영은 멤버가 등록한 곳만 쓰므로 꺼둠
  autoSeed: false,

  cheapPrice: 10000, // "1만원 이하" 기준

  // 점심시간 (고정). 약속은 항상 시작 시간에 모이고, 끝나는 시간이 지나면 다음 점심(평일)으로 넘어가요
  lunch: { start: "12:30", end: "13:30" },

  // 멤버 프로필 사진 폴더 — 예약 서비스의 public/{이름}.png 파일들을 avatars/ 폴더에 그대로 복사하면 돼요
  // 파일이 없으면 이름 첫 글자 동그라미로 자동 대체
  avatarBase: "./avatars/",

  // 첫 화면 인트로. 영상 파일(예: "./intro.mp4")을 넣으면 영상으로, 비워두면 코드로 만든 모션그래픽으로 보여줘요
  introVideo: "",
};
