import React from 'react'
import ReactDOM from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import './index.css'

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
