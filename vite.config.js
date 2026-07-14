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
        background_color: '#F5F2EA',
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