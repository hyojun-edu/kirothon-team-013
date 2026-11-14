import { expect, test } from '@playwright/test';
import { noHorizontalScroll, register, touchTargetsOk } from './helpers';

// 작업 16.6: 기간 때문에 0건 (인수 기준 50), 폭 360px
test('기간 때문에 기록이 0건이면 안내와 모두 보기', async ({ page }) => {
  await register(page, { item: '양파', amount: '1000', bundle: '1', price: '3000', store: '시장', date: '2025-01-01' });
  await expect(page.getByTestId('row')).toHaveCount(1);
  await page.getByRole('button', { name: /^기간/ }).click();
  await page.getByRole('radio', { name: '최근 30일' }).check();
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByText('이 기간에는 기록이 없어요')).toBeVisible();
  await expect(page.getByTestId('row')).toHaveCount(0);
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await page.getByRole('button', { name: '모두 보기' }).click();
  await expect(page.getByTestId('row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^기간/ })).toBeVisible();
});
