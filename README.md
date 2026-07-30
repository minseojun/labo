# LABO — 연구실 올인원 운영 앱

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 열기

## Firebase 연동

1. [Firebase Console](https://console.firebase.google.com) 에서 새 프로젝트 생성
2. Authentication → 이메일/비밀번호 로그인 활성화
3. Firestore Database → 테스트 모드로 생성
4. 프로젝트 설정 → 웹 앱 추가 → config 복사
5. `src/firebase.js` 에서 `firebaseConfig` 교체

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
  firebase.js         # Firebase 설정 (config 교체 필요)
  mockData.js         # 데모 데이터
  utils.js            # 공통 유틸
  App.jsx             # 라우팅
  App.css             # 컴포넌트 스타일
  index.css           # 전역 스타일 + CSS 변수
```
