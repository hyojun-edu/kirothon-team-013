import type { VitePWAOptions } from 'vite-plugin-pwa';

// 요구 13.1: 홈 화면에 설치. 요구 13.2: 네트워크 없이 등록과 조회.
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  injectRegister: false,
  includeAssets: ['icon.svg'],
  manifest: {
    name: '장보기 도우미',
    short_name: '장보기',
    description: '마트 할인가가 정말 싼지 단위가격으로 바로 비교해요.',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1f7a4d',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // 앱 셸 전체를 미리 캐시해서 오프라인에서도 열린다.
    globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
    navigateFallback: '/index.html',
  },
};
