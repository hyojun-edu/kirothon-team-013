import { defineConfig, devices } from '@playwright/test';

// 작업 14.7: 데모 모드 종단 테스트. 실행: npx playwright test -c playwright.demo.config.ts
// 기존 4173 테스트와 따로 4174의 데모 서버를 띄운다.
export default defineConfig({
  testDir: './tests/demo',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 740 },
  },
  projects: [{ name: 'demo-360', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run demo',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
