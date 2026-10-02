# Lunchfound — 사옥 근처 점심 지도

빌드 과정이 없는 정적 웹사이트 + 서버 함수 1개예요. 폴더째 GitHub에 올리면 Vercel이 배포해요.

| 파일 | 하는 일 |
|---|---|
| `config.js` | **여기만 고치면 돼요** — 카카오 키, Firebase 값, 로그인 도메인, 점심시간(12:30~13:30), 인트로 영상 |
| `avatars/` | **멤버 프로필 사진** — 예약 서비스의 `public/{이름}.png`를 그대로 복사 |
| `index.html` · `styles.css` · `app.js` | 화면, 디자인·모션, 기능 |
| `members.js` · `seeds.js` | 멤버 명단, 기본 가게 25곳 |
| `store.js` · `map-kakao.js` · `walk.js` · `walk-graph.json` | 데이터, 카카오맵, 도보 길찾기 |
| `manifest.webmanifest` · `sw.js` · `icons/` | 앱으로 설치(홈 화면 추가), 오프라인, 알림 |
| `api/place-image.js` | 블로그 대표 사진을 찾아주는 서버 함수 |
| `firestore.rules` | 데이터 보안 규칙 (바뀔 때마다 다시 게시) |
| `DESIGN.md` · `PLAN.md` | 디자인·모션 기준, 웹·앱 계획과 제작 순서 |

## 1. 카카오 설정 (10분)

1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가 (fafaai3377 계정)
2. 앱 설정 > 플랫폼 > Web에 Vercel 주소 등록 (예: `https://lunchfound.vercel.app`)
3. 카카오맵 > 사용 설정 ON
4. 앱 키 두 개
   - JavaScript 키 → `config.js`의 `kakaoJsKey`
   - REST API 키 → Vercel 환경변수 `KAKAO_REST_KEY`

## 2. Firebase 설정 (프로젝트 lunchfound-f470e)

1. Firestore Database 만들기 → 위치 `asia-northeast3 (서울)` → 프로덕션 모드
2. Firestore 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시
3. 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가(</>) → `firebaseConfig` 값 6개를 `config.js`의 `firebase`에
4. 프로젝트 설정 > **서비스 계정** > 새 비공개 키 생성 → JSON 파일 다운로드
   - 이 파일은 비밀번호와 같아요. 깃허브에 올리지 마세요.
   - base64로 바꾼 값을 Vercel 환경변수 `FIREBASE_SERVICE_ACCOUNT`에 넣어요.
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("받은파일.json"))`
   - Mac 터미널: `base64 -i 받은파일.json | tr -d '\n'`
   - (Google 로그인은 켜지 않아도 돼요. 이름 + 공용 비밀번호 방식이라 Authentication은 자동으로 쓰여요.)

## 3. 로그인 (멤버 이름 + 공용 비밀번호)

- 처음 들어오면 명단에서 이름을 고르고, 파파 공용 비밀번호를 입력해요. 한 번 로그인하면 그 기기에서 유지돼요.
- 비밀번호 원문은 어디에도 저장하지 않아요. Vercel 환경변수 `LOGIN_PASSWORD_HASH`에 **SHA-256 해시**만 넣어요.
  - Windows PowerShell: `-join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes('비밀번호')) | % { $_.ToString('x2') })`
  - Mac 터미널: `printf '%s' '비밀번호' | shasum -a 256`
  - 결과는 0-9a-f로 된 64글자예요.
- 확인은 서버 함수 `api/login.js`가 하고, 맞으면 Firebase 로그인 토큰을 발급해요. 틀리면 0.6초 지연 후 거절해서 대입 공격을 늦춰요.
- 비밀번호를 바꾸려면 해시만 새로 만들어 환경변수를 바꾸고 다시 배포하면 돼요.

## 4. Vercel 환경변수 (Settings > Environment Variables)

| 이름 | 값 |
|---|---|
| `LOGIN_PASSWORD_HASH` | 공용 비밀번호 해시 (SHA-256 64글자 또는 bcrypt) |
| `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 JSON (원문 그대로 붙여넣어도 되고 base64도 돼요) |
| `KAKAO_REST_KEY` | 카카오 REST API 키 (블로그 대표 사진) |

## 5. 배포

1. GitHub 저장소(fafaai3377-source/Lunchfound)에 이 폴더의 파일을 그대로 올리기 (`old/` 폴더는 빼도 돼요)
2. Vercel 프로젝트 lunchfound를 이 저장소와 연결 → Framework "Other" → 배포
3. 이후에는 GitHub에 올릴 때마다 자동 배포

## 처음 쓸 때

- "나는 누구예요?"에서 이름을 고르고 공용 비밀번호를 입력하면 끝이에요. 기록에는 "현열님"처럼 표시돼요.
- **+ 장소 추가** → 가게 이름 검색 → 탭 → 별점 등 30초 기록. 검색에 없으면 "지도에서 직접 찍기".
- 장소를 추가하면 블로그 대표 사진이 자동으로 들어가요. 마음에 안 들면 사진 위 **다른 사진**을 눌러요 (최대 5장 중에서).
- **오늘 뭐 먹지?** → 땡기는 것 / 먹기 싫은 것 / 어제 먹은 종류 빼기 → 돌리기.

- **오늘 약속**(상단 버튼) → 가게·시간·선착순 인원(나 빼고 1~5명)·메모 → 약속 올리기. 다른 멤버 화면에 "○○님: 오늘 12:00 ○○ 먹으실 분!" 알림이 뜨고, 거기서 바로 **식사 참여**. 정원이 차면 자동 마감돼요. 가게 상세·룰렛 결과에서도 바로 만들 수 있어요.

## 알림에 대해

- 지금 버전: 지도를 열어둔 멤버에게 화면 위 배너로 바로 떠요. "새 약속 알림 받기"를 켜면 다른 탭을 보고 있을 때도 브라우저 알림이 와요(PC 크롬, 안드로이드).
- 앱을 완전히 닫았을 때도 받는 푸시 알림, 아이폰 알림은 다음 단계예요. 홈 화면에 추가(PWA) + 웹 푸시 키(VAPID) + Vercel 서버 함수로 붙일 수 있고, 모두 무료 범위예요.
- 선착순은 Firestore 트랜잭션으로 처리해서 두 명이 동시에 눌러도 정원을 넘지 않아요. 보안 규칙에서도 정원 초과와 남의 자리 수정을 막아요. 규칙이 바뀌었으니 `firestore.rules`를 다시 게시해 주세요.

## 오픈 전 체크리스트

- [ ] 사옥 핀이 실제 위치에 있다 (지금 좌표는 캡처 기준 역산값, 오차 약 5m)
- [ ] 맞는 비밀번호로 로그인되고, 틀린 비밀번호는 막힌다
- [ ] 시크릿 창(로그인 전)에서는 장소가 안 보인다
- [ ] 가게 검색 → 추가 → 사진 자동 표시까지 된다
- [ ] 휴대폰에서 기록 하나가 30초 안에 끝난다
- [ ] 시드 기록 20곳을 채웠다
- [ ] 두 사람이 각자 휴대폰으로 약속 만들기 → 알림 → 참여 → 마감까지 확인했다

## 알아두면 좋은 것

- 비용: 카카오맵(하루 30만 회)·카카오 검색·Firebase Spark·Vercel Hobby 모두 무료 한도 안이에요.
- 사진은 블로그 글의 대표 미리보기 이미지를 링크로 보여주는 방식이에요. 사진 아래 출처 버튼으로 원문 블로그가 열려요. 사진의 저작권은 각 블로거에게 있으니, 사내용으로만 쓰고 외부 공개는 하지 않는 걸 권해요.
- 도보 시간은 직선거리 × 1.3 ÷ 분당 75m로 계산한 대략값이에요.
