import { expect, test } from '@playwright/test';
import { noHorizontalScroll, register, touchTargetsOk } from './helpers';

// 작업 15.8: 홈 빠른 비교와 자동완성 후보 (요구 16, 인수 기준 38~45). 폭 360px
test('홈 빠른 비교: 품명 → 후보 → 채움 → 비교하기 → 탭 두 개와 내 상품 비교 바 → 이 가격으로 등록', async ({ page }) => {
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '이마트 구로점' });
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '4', price: '6200', store: '쿠팡', online: true });
  await register(page, { productName: '부침두부', item: '두부', brand: 'CJ', amount: '550', bundle: '1', price: '2480', store: '홈플러스' });

  // 인수 38: 첫 입력칸이 품명, 입력하면 후보 목록이 열린다
  await page.goto('/');
  const first = page.locator('main input').first();
  await expect(first).toHaveAccessibleName('품명');
  await first.fill('국산');
  const list = page.getByRole('listbox', { name: '자동완성 후보' });
  await expect(list).toBeVisible();
  const opts = list.getByRole('option');
  // 인수 41: 번들이 다르면 별개 후보, 한 줄만 봐도 구별된다
  await expect(opts).toHaveCount(2);
  await expect(opts.filter({ hasText: '300g×4' })).toContainText('쿠팡');
  await expect(opts.filter({ hasText: '300g×4' })).toContainText('온라인');
  // 인수 40: 한 줄에 모든 정보
  const two = opts.filter({ hasText: '300g×2' });
  await expect(two.locator('img')).toBeVisible();
  for (const t of ['국산콩 두부', '두부 · 풀무원', '3,480원', '580원/100g', '이마트 구로점', '오늘', '기록 1건']) await expect(two).toContainText(t);
  const h = await two.evaluate((e) => e.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(56);
  await noHorizontalScroll(page);
  await touchTargetsOk(page);

  // 인수 39: 한 번에 채우고 모두 고칠 수 있다
  await two.click();
  await expect(page.getByLabel('품명', { exact: true })).toHaveValue('국산콩 두부');
  await expect(page.getByLabel(/^품목 필수/)).toHaveValue('두부');
  await expect(page.getByLabel('브랜드', { exact: true })).toHaveValue('풀무원');
  await expect(page.getByLabel('포장단위', { exact: true })).toHaveValue('개');
  await expect(page.getByLabel('단위용량', { exact: true })).toHaveValue('300');
  await expect(page.getByLabel('번들묶음', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel(/^가격/)).toHaveValue('3480');
  await expect(page.getByTestId('prev-price')).toHaveText('이전 가격');
  await page.getByLabel(/^가격/).fill('3000');
  await expect(page.getByTestId('prev-price')).toHaveCount(0);
  await noHorizontalScroll(page);
  await touchTargetsOk(page);

  // 인수 42: 저장 없이 결과 화면, 탭 두 개 켜짐, 내 상품 비교 바
  await page.getByRole('button', { name: '비교하기' }).click();
  await page.waitForURL(/\/items\/[^/?]+$/);
  await expect(page.getByRole('tab', { name: '똑같은 상품' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '용량 무관' })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('region', { name: '내 상품 비교' })).toContainText('500원/100g');
  await expect(page.getByText('전체 3건')).toBeVisible();
  await noHorizontalScroll(page);

  // 요구 16.12: 이 가격으로 등록 → 값과 이전 사진
  await page.getByRole('button', { name: '이 가격으로 등록' }).click();
  await expect(page.getByRole('heading', { name: '가격 등록' })).toBeVisible();
  await expect(page.getByLabel('품명 입력')).toHaveValue('국산콩 두부');
  await expect(page.getByLabel(/^가격/)).toHaveValue('3000');
  await expect(page.getByTestId('reused-photo')).toHaveText('이전 사진');
});

test('직접 입력, 후보 없음 안내, 등록 화면 후보와 이전 가격', async ({ page }) => {
  await register(page, { item: '양파', amount: '1000', bundle: '1', price: '3000', store: '시장' });
  await page.goto('/');
  // 인수 45
  await page.getByLabel('품명', { exact: true }).fill('우유');
  await expect(page.getByText('처음 보는 상품이에요. 직접 입력하세요')).toBeVisible();
  // 인수 43: 품목만 있으면 비교
  await page.getByLabel(/^품목 필수/).fill('양파');
  await page.getByRole('button', { name: '비교하기' }).click();
  await page.waitForURL(/\/items\//);
  await expect(page.getByTestId('row')).toHaveCount(1);

  // 인수 44: 등록 화면 품명 자동완성도 같은 후보, 가격은 이전 가격, 판매처는 비움
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '이마트' });
  await page.goto('/register');
  await page.getByLabel('품명 입력').fill('풀무원');
  const opt = page.getByRole('listbox', { name: '자동완성 후보' }).getByRole('option');
  await expect(opt).toHaveCount(1);
  await expect(opt).toContainText('300g×2 · 3,480원 · 580원/100g');
  await expect(opt).toContainText('기록 1건');
  await noHorizontalScroll(page);
  await opt.click();
  await expect(page.getByLabel(/^가격/)).toHaveValue('3480');
  await expect(page.getByTestId('prev-price')).toHaveText('이전 가격');
  await expect(page.getByLabel(/^판매처/)).toHaveValue('');
});
