/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaOptions } from './src/pwa/pwaOptions.ts';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [react(), VitePWA(pwaOptions)],
  // 데모 빌드는 dist-demo/에 따로 둔다. 일반 미리보기(4173, dist/)에 섞이지 않게 (요구 15.9)
  build: mode === 'demo' ? { outDir: 'dist-demo' } : undefined,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
