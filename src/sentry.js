import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

// DSN이 없으면(로컬 개발 중이거나, 아직 Sentry 프로젝트를 안 만든 배포) 조용히
// 꺼짐 — Supabase 환경변수 없을 때와 같은 패턴으로, 없어도 앱이 죽지 않게 함
export function initErrorMonitoring() {
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // 성능 트레이싱은 안 씀 — 에러만 잡으면 됨
  })

  // 코드 전체 catch 블록이 이미 하나같이 console.error(e) 뒤에 toast.error로
  // 사용자에게 알리는 패턴이라(예: useSupabase.js, EquipmentTab.jsx 등), 매
  // catch 블록을 일일이 Sentry.captureException으로 바꾸는 대신 console.error
  // 자체를 가로채서 한 곳에서 다 잡음. 장비 이력 버그처럼 "콘솔에만 찍히고
  // 아무도 모르는" 실패가 다시 생겨도 이제 여기서 걸러짐.
  // PostgrestError(Supabase 쿼리 실패)도 Error를 상속해서 여기 걸림
  const originalConsoleError = console.error
  console.error = (...args) => {
    originalConsoleError(...args)
    const err = args.find(a => a instanceof Error)
    if (err) Sentry.captureException(err)
    else Sentry.captureMessage(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '), 'error')
  }
}

export function setSentryUser(user) {
  if (!dsn) return
  Sentry.setUser(user ? { id: user.id, username: user.name } : null)
}

export { Sentry }
