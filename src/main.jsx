import React from 'react'
import ReactDOM from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import { initErrorMonitoring } from './sentry'
import './index.css'

// 화면 렌더링이든 Supabase 쿼리든, 코드 전체에서 실패하면 console.error부터
// 찍고 있어서(사용자에겐 토스트로 알림) 이걸 가로채는 것만으로 앱 전체의
// 에러를 한 곳에서 잡을 수 있음 — App 렌더링보다 먼저 초기화해야 부팅 초반
// 에러도 놓치지 않음
initErrorMonitoring()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 네이티브 앱(Capacitor)에서만 동작 — 웹 브라우저에서는 플러그인이 없어서 그냥 스킵됨
if (Capacitor.isNativePlatform()) {
  // 배경이 밝은 크림톤이라 상태바 아이콘은 어둡게 (연구실 히어로 화면 등 초록 배경 위에서는
  // AuthScreen에서 별도로 Light로 바꿔줌)
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  SplashScreen.hide().catch(() => {})
}
