# LABO — 연구실 올인원 운영 앱

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 열기

## Supabase 연동

1. [Supabase](https://supabase.com) 에서 새 프로젝트 생성 (Northeast Asia (Seoul) 리전 추천)
2. Authentication → Providers → Email → **Confirm email 끄기** (이메일 인증 없이 바로 로그인되는 구조라 꼭 꺼야 해요)
3. SQL Editor 에 `supabase/schema.sql` 전체 내용을 붙여넣고 실행 (테이블 + RLS 정책 + realtime 설정이 한 번에 생성됨)
   - 이미 프로젝트를 만들어서 `schema.sql`을 예전에 한 번 실행했다면, 그걸 다시 통째로 돌리면 기존 테이블 때문에 에러가 나요. 그 이후 새로 생긴 기능은 `supabase/migrations/` 안의 파일들을 (파일명 순서대로, 아직 안 돌린 것만) SQL Editor에 붙여넣고 실행하면 돼요.
4. Project Settings → API 에서 **Project URL**, **anon public key** 복사
5. 루트에 `.env.local` 파일을 만들고 아래처럼 채우기 (`.env.example` 참고)
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## Vercel 배포

```bash
npm install -g vercel
vercel
```

## 파일 구조

```
src/
  components/
    AuthScreen.jsx    # 로그인/가입
    HomeTab.jsx       # 홈 (요약, 할일, 공지)
    ScheduleTab.jsx   # 주간 캘린더 + 공지
    EquipmentTab.jsx  # 장비 관리 + QR
    TimerTab.jsx      # 멀티 타이머
    SuppliesTab.jsx   # 소모품 신호등
    HazardLogScreen.jsx           # [모듈] Wet Lab · 위험물 이력
    FridgeMapScreen.jsx           # [모듈] Wet Lab · 냉장/냉동고 재고맵
    GpuReservationScreen.jsx      # [모듈] Dry Lab · GPU 서버 예약
    DatasetScreen.jsx             # [모듈] Dry Lab · 데이터셋 관리
    OnboardingChecklistScreen.jsx # [모듈] Lab Ops · 온보딩 체크리스트
  modules.js          # 모듈 레지스트리 — 랩마다 켜고 끄는 도메인 기능
  supabase.js         # Supabase 클라이언트 (.env.local 필요)
  mockData.js         # 데모 데이터
  utils.js            # 공통 유틸
  App.jsx             # 라우팅
  App.css             # 컴포넌트 스타일
  index.css           # 전역 스타일 + CSS 변수
```
