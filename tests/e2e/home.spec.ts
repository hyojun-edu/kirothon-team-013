import { expect, test } from '@playwright/test';
import { noHorizontalScroll, register, touchTargetsOk } from './helpers';

// 작업 17.6: 홈 정리 (요구 16.15~16.18, 인수 기준 51~53). 폭 360px
test('홈: 품목 검색칸 없음, 내 품목 칩 줄바꿈과 결과 화면, 빠른 비교에 품목 이름만', async ({ page }) => {
  // 인수 기준 18 (요구 16.18): 기록 0건 안내
  await page.goto('/');
  await expect(page.getByText('아직 품목이 없어요. 첫 가격을 등록해 보세요')).toBeVisible();

  const names = ['두부', '아주긴이름의국산콩유기농두부세트', '우유', '계란', '양파', '대파', '사과'];
  for (const [i, item] of names.entries()) {
    await register(page, { productName: `${item} 상품`, item, amount: '300', bundle: '1', price: String(1000 + i * 100), store: '이마트' });
  }
  await register(page, { productName: '행복한콩', item: '두부', brand: 'CJ', amount: '300', bundle: '1', price: '1980', store: '홈플러스' });

  await page.goto('/');
  // 인수 51: 품목 검색칸이 없다
  await expect(page.getByLabel('품목 검색')).toHaveCount(0);
  // 인수 52: 칩, 건수, 줄바꿈
  const chips = page.locator('.item-chip');
  await expect(chips).toHaveCount(names.length);
  await expect(page.getByRole('link', { name: '두부 기록 2건' })).toBeVisible();
  const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBeGreaterThan(1);
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  for (const h of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);

  // 인수 52: 칩을 누르면 품목 전체 탭, 나머지 둘은 꺼짐
  await page.getByRole('link', { name: '두부 기록 2건' }).click();
  await expect(page.getByRole('tab', { name: '품목 전체' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '똑같은 상품' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('tab', { name: '용량 무관' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('row')).toHaveCount(2);

  // 인수 53: 빠른 비교에 "두부"만 입력해도 후보가 나온다
  await page.goto('/');
  await page.getByLabel('품명').fill('두부');
  await expect(page.getByRole('listbox').getByRole('button', { name: /행복한콩/ })).toBeVisible();
});
