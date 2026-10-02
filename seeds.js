// 처음 열 때 미리 넣어두는 사옥 근처 실제 가게 25곳 (카테고리별 3~5곳)
// 위치: OpenStreetMap 좌표 / 업종: OpenStreetMap cuisine 정보 또는 가게 이름으로 확인
// walkM · walkMin: 카카오맵 도보 길찾기(출발 파운드파운디드) 결과 — 길찾기 버튼을 눌렀을 때 나오는 숫자와 같게 맞춤 (2026.10 기준)
// 기록(별점)은 넣지 않았어요 — 멤버가 직접 가보고 남기는 게 이 지도의 의미라서요.
// 링크는 앱이 이름·좌표로 네이버 지도 / 카카오맵 도보 길찾기(출발: 파운드파운디드)를 자동으로 만들어요.
// naverPlaceId(네이버 장소 번호)를 알면 넣어두세요. 네이버 길찾기에서 도착지가 정확한 가게로 잡혀요.
window.SEED_PLACES = [
  // 🍚 한식 (밥·국)
  { id: "seed-01", name: "제주은희네해장국 홍대점", category: "한식", emoji: "🍲", lat: 37.5580682, lng: 126.9178448, naverPlaceId: "134716918", walkM: 335, walkMin: 5 },
  { id: "seed-02", name: "대청마루", category: "한식", emoji: "🍚", lat: 37.555555, lng: 126.918349, address: "마포구 동교로 147", walkM: 167, walkMin: 2 },
  { id: "seed-03", name: "영동감자탕", category: "한식", emoji: "🍲", lat: 37.556962, lng: 126.917871, walkM: 241, walkMin: 4 },
  { id: "seed-04", name: "육전국밥 서교점", category: "한식", emoji: "🍲", lat: 37.555754, lng: 126.920385, walkM: 185, walkMin: 3 },

  // 🥩 고기
  { id: "seed-05", name: "목구멍 홍대입구역점", category: "고기", emoji: "🥩", lat: 37.556734, lng: 126.92051, walkM: 284, walkMin: 5 },
  { id: "seed-06", name: "서교가든숯불갈비", category: "고기", emoji: "🥩", lat: 37.554665, lng: 126.915753, walkM: 441, walkMin: 7 },
  { id: "seed-07", name: "연남 물갈비", category: "고기", emoji: "🥩", lat: 37.558462, lng: 126.920708, walkM: 480, walkMin: 8 },

  // 🍜 면
  { id: "seed-08", name: "하연옥 마포직영점", category: "면", emoji: "🍜", lat: 37.555045, lng: 126.91726, note: "진주냉면", walkM: 285, walkMin: 5 },
  { id: "seed-09", name: "고랭", category: "면", emoji: "🍜", lat: 37.557109, lng: 126.917615, walkM: 262, walkMin: 4 },
  { id: "seed-10", name: "유원냉면&육개장", category: "면", emoji: "🍜", lat: 37.557763, lng: 126.916771, walkM: 385, walkMin: 6 },

  // 🍣 일식 · 라멘
  { id: "seed-11", name: "스시 이안앤", category: "일식", emoji: "🍣", lat: 37.556217, lng: 126.919928, walkM: 106, walkMin: 2 },
  { id: "seed-12", name: "치쿠린서울", category: "일식", emoji: "🍱", lat: 37.555745, lng: 126.919048, address: "마포구 동교로 155", walkM: 103, walkMin: 2 },
  { id: "seed-13", name: "카와카츠", category: "일식", emoji: "🍱", lat: 37.554741, lng: 126.916201, note: "돈카츠", walkM: 396, walkMin: 6 },
  { id: "seed-14", name: "멘야준", category: "일식", emoji: "🍜", lat: 37.554905, lng: 126.916388, address: "마포구 동교로 128", note: "라멘", walkM: 361, walkMin: 6 },
  { id: "seed-15", name: "멘야산다이메", category: "일식", emoji: "🍜", lat: 37.553699, lng: 126.921433, address: "마포구 홍익로5안길 24", note: "라멘", walkM: 562, walkMin: 10 },

  // 🥟 중식
  { id: "seed-16", name: "진진", category: "중식", emoji: "🥟", lat: 37.553764, lng: 126.918414, address: "마포구 월드컵북로1길 60", walkM: 369, walkMin: 6 },
  { id: "seed-17", name: "불이아", category: "중식", emoji: "🌶️", lat: 37.556589, lng: 126.922014, address: "마포구 동교로 182-6", walkM: 386, walkMin: 7 },
  { id: "seed-18", name: "홍콩반점0410", category: "중식", emoji: "🥟", lat: 37.554774, lng: 126.923639, walkM: 591, walkMin: 11 },

  // 🍛 아시안
  { id: "seed-19", name: "어메이징 타일랜드 농카이", category: "아시안", emoji: "🍛", lat: 37.555329, lng: 126.919924, note: "태국 음식", walkM: 150, walkMin: 3 },
  { id: "seed-20", name: "쌥이리", category: "아시안", emoji: "🍛", lat: 37.556481, lng: 126.922194, note: "태국 음식", walkM: 401, walkMin: 7 },
  { id: "seed-21", name: "포머이 쌀국수 연남점", category: "아시안", emoji: "🍜", lat: 37.557811, lng: 126.922607, note: "베트남 쌀국수", walkM: 458, walkMin: 7 },

  // 🍝 양식
  { id: "seed-22", name: "까사 포모도로", category: "양식", emoji: "🍝", lat: 37.558166, lng: 126.920255, walkM: 404, walkMin: 7 },
  { id: "seed-23", name: "라룬비올렛", category: "양식", emoji: "🍝", lat: 37.55753, lng: 126.920953, address: "마포구 월드컵북로4길 25", walkM: 380, walkMin: 6 },
  { id: "seed-24", name: "뚜또 페르 뚜띠", category: "양식", emoji: "🍝", lat: 37.555668, lng: 126.918135, walkM: 201, walkMin: 3 },

  // ☕ 카페
  { id: "seed-25", name: "히트커피로스터스", category: "카페", emoji: "☕", lat: 37.555254, lng: 126.918354, address: "마포구 동교로 146", walkM: 204, walkMin: 4 },
];
