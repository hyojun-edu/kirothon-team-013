import { expect, test } from '@playwright/test';

test('요구 13.1: 매니페스트가 연결되고 설치 정보가 있다', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('요구 13.2: 서비스 워커 등록 후 네트워크 없이 다시 열린다', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 서비스 워커가 페이지를 제어할 때까지 한 번 새로고침한다.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '장보기 도우미' })).toBeVisible();
  await context.setOffline(false);
});

test('요구 13.3: 폭 360px에서 가로 스크롤이 없다', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
