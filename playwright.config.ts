import { defineConfig, devices } from '@playwright/test';

// 요구 13.3: 모바일 폭 360px 기준으로 확인한다.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 740 },
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'mobile-360', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
