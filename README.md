# LABO — 연구실 올인원 운영 앱

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 열기

## Supabase 연동

스키마는 이제 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)의 마이그레이션 기능으로 관리해요. SQL Editor에 뭘 실행했는지 사람이 기억할 필요 없이, CLI가 원격 DB에 어떤 마이그레이션이 이미 적용됐는지 직접 추적해줘요.

1. [Supabase](https://supabase.com) 에서 새 프로젝트 생성 (Northeast Asia (Seoul) 리전 추천)
2. Authentication → Providers → Email → **Confirm email 끄기** (이메일 인증 없이 바로 로그인되는 구조라 꼭 꺼야 해요)
3. CLI 설치 후 프로젝트 연결:
   ```bash
   npx supabase login
   npx supabase link --project-ref <프로젝트 ref>   # Project Settings → General 에서 확인
   ```
4. 마이그레이션 적용:
   ```bash
   npx supabase db push
   ```
   `supabase/migrations/` 안의 파일들이 순서대로 원격 DB에 적용돼요. 이미 일부/전부 적용된 프로젝트에 다시 실행해도 안전해요(모든 마이그레이션이 idempotent하게 작성돼 있음).
5. 앞으로 스키마를 바꿀 땐 `npx supabase migration new <이름>`으로 새 파일을 만들고, 다 쓴 뒤 `npx supabase db push`로 반영하세요. `supabase/migrations/`의 기존 파일은 고치지 마세요 — 이미 적용된 마이그레이션을 사후에 수정하면 CLI의 추적 상태와 실제 원격 DB 상태가 어긋나요.
6. Project Settings → API 에서 **Project URL**, **anon public key** 복사
7. 루트에 `.env.local` 파일을 만들고 아래처럼 채우기 (`.env.example` 참고)
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
  modules.js          # 모듈 레지스트리 — 구성원 각자 탭바에 켜고 끄는 도메인 기능
  supabase.js         # Supabase 클라이언트 (.env.local 필요)
  mockData.js         # 데모 데이터
  utils.js            # 공통 유틸
  App.jsx             # 라우팅
  App.css             # 컴포넌트 스타일
  index.css           # 전역 스타일 + CSS 변수
```
