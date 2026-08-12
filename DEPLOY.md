# LABO 앱스토어 배포 가이드

React 웹앱 → Supabase 백엔드 → Capacitor 네이티브 앱까지 전 과정을 정리했어요.
순서대로 따라오시면 됩니다.

## 0. 지금까지 된 것 / 앞으로 직접 하셔야 하는 것

**코드로 이미 준비된 것**
- Firebase → Supabase 전체 마이그레이션 (`supabase/schema.sql`)
- 계정 탈퇴 기능 (`supabase/functions/delete-account`) — 앱스토어 필수 요건
- Capacitor iOS/Android 프로젝트 (`ios/`, `android/`)
- 앱 아이콘 · 스플래시 스크린 (기존 512px 아이콘을 업스케일한 임시본 — 아래 1번 참고)
- 카메라 권한 설명(iOS Info.plist), 카메라 권한(Android Manifest)
- Safe area / 상태바 / 뒤로가기 버튼 등 네이티브 셸 대응

**직접 하셔야 하는 것** (계정·기기가 필요해서 제가 대신 못 해요)
1. Supabase 프로젝트 생성 + `supabase/schema.sql` 실행 + `.env.local` 채우기
2. Supabase Edge Function 배포 (`delete-account`)
3. **1024×1024 고화질 앱 아이콘 준비** — 지금 건 512px를 늘린 거라 스토어 심사용으로는 화질이 아쉬워요
4. Apple Developer Program 가입 ($99/년) + Mac + Xcode
5. Google Play Console 가입 ($25 1회) — Android는 이 리눅스 환경에도 Android SDK가 없어서 실제 빌드는 로컬/CI에서 해야 해요
6. 개인정보처리방침 페이지 호스팅 (아래 초안 제공 — GitHub Pages 등에 올리면 돼요)
7. 스토어 스크린샷, 앱 설명, 심사 제출

---

## 1. 앱 아이콘 교체 (권장)

`assets/icon.png` (1024×1024), `assets/splash.png` / `splash-dark.png` (2732×2732)를
원하는 이미지로 바꾼 뒤 다시 생성하세요:

```bash
npx capacitor-assets generate \
  --iconBackgroundColor '#1F9D6B' --iconBackgroundColorDark '#147A4F' \
  --splashBackgroundColor '#1F9D6B' --splashBackgroundColorDark '#147A4F'
npm run cap:sync
```

## 2. Supabase 설정

`이거 지금 html 웹이야?` 대화에서 안내한 대로:
1. Supabase 프로젝트 생성 (Confirm email 끄기 필수)
2. SQL Editor에 `supabase/schema.sql` 실행
3. `.env.local`에 URL/anon key 채우기

### Edge Function 배포 (계정 탈퇴용, 필수)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <프로젝트-ref>   # Project Settings → General에서 확인
supabase functions deploy delete-account
```

이 함수는 `SUPABASE_SERVICE_ROLE_KEY`가 필요한데, Supabase가 배포 시 자동으로
프로젝트의 시크릿을 주입해주므로 별도 설정 없이 바로 동작해요.

## 3. 로컬에서 실제 기기로 테스트

```bash
npm install
npm run cap:sync          # 웹 빌드 + 네이티브 프로젝트에 반영
npm run cap:ios           # Xcode 열림 (Mac 필요)
npm run cap:android       # Android Studio 열림
```

코드를 고칠 때마다 `npm run cap:sync`를 다시 실행해야 네이티브 앱에 반영돼요.

## 4. iOS — App Store 제출 (Mac 필요)

1. `npm run cap:ios`로 Xcode 열기
2. 프로젝트 설정 → **Signing & Capabilities** → 본인 Apple Developer 팀 선택
3. Bundle Identifier를 App Store Connect에서 만든 App ID와 동일하게 맞추기
   (지금은 `com.labo.app`로 되어있음 — `capacitor.config.json`의 `appId`도 같이 바꿔야 함)
4. [App Store Connect](https://appstoreconnect.apple.com)에서 새 앱 등록
5. Xcode에서 **Product → Archive** → Organizer에서 **Distribute App** → App Store Connect 업로드
6. App Store Connect에서 스크린샷(6.7" 필수), 설명, 개인정보처리방침 URL, 카테고리 등 입력 후 심사 제출

### 자주 걸리는 리젝 사유 체크
- **Guideline 5.1.1(v) 계정 삭제**: 이미 구현됨 (사이드바 → 계정 탈퇴)
- **Guideline 5.1.1 개인정보처리방침**: URL 필수 — 아래 초안 참고
- **Guideline 4.2 미니멀 기능성**: 단순 웹뷰 래핑처럼 보이면 리젝됨 — 카메라(QR스캔), 네이티브 상태바/스플래시/뒤로가기 등으로 이미 대응됨
- **App Privacy 설문**: 수집 데이터는 이메일·이름(계정), 카메라(QR 스캔, 저장 안 함) 정도로 답변하면 됩니다

## 5. Android — Play Store 제출

### GitHub Actions로 자동 빌드 (권장 — 로컬에 Android Studio 없어도 됨)

`.github/workflows/android-release.yml`이 이미 준비돼 있어요. 클로드가 작업하던
클라우드 환경은 `dl.google.com` 접근이 막혀있어서 Android SDK를 직접 받을 수
없었는데, GitHub Actions의 빌드 서버는 이 제약이 없어서 여기서 대신 빌드해요.

1. 릴리즈 서명 키스토어(`labo-release.keystore.jks`)와 비밀번호를 이미 전달받으셨을
   거예요 — **반드시 먼저 안전한 곳에 백업**하세요 (잃어버리면 이후 업데이트 불가능).
2. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**에서
   아래 4개를 등록:
   - `LABO_KEYSTORE_BASE64` — 키스토어 파일을 base64로 인코딩한 값 (`base64 -i labo-release.keystore.jks | pbcopy` 로 Mac에서 클립보드에 복사 가능)
   - `LABO_KEYSTORE_PASSWORD`, `LABO_KEY_ALIAS`, `LABO_KEY_PASSWORD` — 전달받은 `keystore-credentials.txt` 참고
3. GitHub 저장소 → **Actions** 탭 → **Android Release Build** → **Run workflow**
4. 빌드가 끝나면 그 워크플로 실행 결과 페이지 하단 **Artifacts**에서 `labo-release-aab`를 다운로드 (서명된 `.aab` 파일)
5. [Google Play Console](https://play.google.com/console)에서 새 앱 등록 → 프로덕션(또는 먼저 비공개 테스트) 트랙에 그 `.aab` 업로드
6. **Data safety** 섹션 작성 — `STORE_LISTING.md`에 답변 가이드 정리해뒀어요
7. 개인정보처리방침 URL 등록 — `https://<username>.github.io/labo/privacy-policy.html` (Pages 활성화 필요, 아래 참고)
8. 스크린샷, 설명 작성 후 심사 제출 (`STORE_LISTING.md`에 붙여넣을 문구 준비돼 있음)

### 로컬 Android Studio로 빌드하려면

1. Android Studio에서 **Build → Generate Signed Bundle** → 전달받은 키스토어 선택 (또는 새로 생성)
2. `.aab` 파일 생성
3. 이후 단계는 위 3~8번과 동일

## 6. 개인정보처리방침 (완료 — Pages 활성화만 하면 됨)

`PRIVACY_POLICY.md`(원본)와 `docs/privacy-policy.html`(호스팅용 완성 페이지)이
이미 준비돼 있어요. 마지막으로 한 번만 켜주세요:

1. 이 저장소 → **Settings → Pages**
2. Source: **Deploy from a branch** 선택
3. Branch: **main**, 폴더: **/docs** 선택 → Save
4. 몇 분 뒤 `https://<username>.github.io/labo/privacy-policy.html`에서 열림 —
   브라우저로 직접 열어서 정상 표시되는지 꼭 확인 후 스토어에 등록하세요

## 7. 버전 올릴 때

- iOS: Xcode에서 `MARKETING_VERSION`(사용자에게 보이는 버전) / `CURRENT_PROJECT_VERSION`(빌드 번호) 올리기
- Android: `android/app/build.gradle`의 `versionCode`(정수, 매번 +1) / `versionName` 올리기
