import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'LABO — 연구실 올인원 운영 플랫폼',
        short_name: 'LABO',
        description: '연구실 일정, 잡무 분담, 장비, 소모품을 한곳에서 관리해요.',
        lang: 'ko',
        theme_color: '#1F9D6B',
        // iOS "홈 화면에 추가" standalone 모드는 하단 세이프에어리어(홈 인디케이터) 부분을
        // 페이지가 아니라 OS 셸이 직접 그리는데, 그 색을 이 manifest의 background_color로
        // 칠함 — 크림색(--bg)이었을 땐 흰색 탭바 바로 아래에 이질적인 띠로 보였음.
        // 탭바 배경(rgba(255,255,255,0.92) 블러)과 거의 같은 흰색으로 맞춰서 이어져 보이게 함
        background_color: '#FDFCFA',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 셸(정적 JS/CSS/이미지)만 캐싱 — Firestore 데이터는 자체 SDK가
        // 오프라인 캐시를 따로 관리하므로 서비스 워커에서는 건드리지 않음
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  server: {
    port: 3000,
  },
})