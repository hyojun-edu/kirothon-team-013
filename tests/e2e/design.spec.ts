import { expect, test, type Page } from '@playwright/test';
import { noHorizontalScroll, register } from './helpers';

/** 요구 14.2: 글자가 한 줄(줄 높이 × 1.2 이하)이고 잘리지 않는다 */
async function oneLine(page: Page, sel: string, n: number) {
  const els = page.locator(sel);
  await expect(els).toHaveCount(n);
  const bad = await els.evaluateAll((list) =>
    list
      .map((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        const h = r.getBoundingClientRect().height;
        const lh = parseFloat(getComputedStyle(e).lineHeight);
        const cut = e.scrollWidth > e.clientWidth;
        return h > lh * 1.2 || cut ? `"${e.textContent?.trim()}" h=${h} lh=${lh} cut=${cut}` : '';
      })
      .filter(Boolean),
  );
  expect(bad).toEqual([]);
}

// 작업 12.8: 인수 기준 27, 29 (폭 360px)
test('프리셋 탭, 필터 버튼, 하단 버튼이 한 줄이고 1위 카드가 구분된다', async ({ page }) => {
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '400', bundle: '1', price: '2900', store: '이마트 구로점' });
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '롯데마트' });

  // 인수 28: 새 탭 이름과 한 줄 설명
  await expect(page.getByRole('tab')).toHaveText(['똑같은 상품', '용량 무관', '품목 전체']);
  await expect(page.locator('.tab-hint')).toHaveText('같은 품목의 모든 기록을 비교해요');
  await page.getByRole('tab', { name: '용량 무관' }).click();
  await expect(page.locator('.tab-hint')).toHaveText('품명·브랜드가 같으면 용량이 달라도 비교해요');
  await oneLine(page, '[role=tab]', 3);
  await oneLine(page, '.filter-bar .pill', 4); // 작업 16: 기간 알약 추가
  await oneLine(page, '.bottom-bar > button', 2);
  const hint = await page.locator('.tab-hint').evaluate((e) => e.getBoundingClientRect().height <= parseFloat(getComputedStyle(e).lineHeight) * 1.2);
  expect(hint).toBe(true);

  // 인수 29: 1위 카드는 색, 테두리, "최저가" 배지
  const first = page.locator('.row[data-rank="1"]');
  await expect(first).toHaveCount(1);
  await expect(first).toHaveClass(/cheapest/);
  await expect(first.getByText('최저가')).toBeVisible();
  const look = await first.evaluate((e) => {
    const s = getComputedStyle(e);
    const other = getComputedStyle(document.querySelector('.row[data-rank="2"]')!);
    return { bg: s.backgroundColor !== other.backgroundColor, border: parseFloat(s.borderTopWidth) >= 2 && s.borderTopColor !== other.borderTopColor };
  });
  expect(look).toEqual({ bg: true, border: true });

  // 개수 배지가 붙어도 한 줄, 시트를 열어도 가로 스크롤 없음
  await page.getByRole('button', { name: /브랜드/ }).click();
  await page.getByRole('checkbox', { name: /^풀무원/ }).check();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.locator('.filter-bar .pill-count')).toHaveText('1');
  await oneLine(page, '.filter-bar .pill', 4); // 작업 16: 기간 알약 추가
  await expect(page.getByRole('button', { name: '전체 해제' })).toBeVisible();
  await noHorizontalScroll(page);
});

// 요구 14.4: 비활성 탭을 누르면 이유를 한 줄로
test('내 상품이 없으면 비활성 탭을 눌렀을 때 이유를 알린다', async ({ page }) => {
  await register(page, { item: '양파', price: '3000', store: '시장', amount: '1000', bundle: '1' });
  await page.goto(page.url().replace(/\?.*/, ''));
  await page.getByRole('tab', { name: '똑같은 상품' }).click({ force: true }); // aria-disabled라 Playwright는 비활성으로 본다
  await expect(page.locator('.tab-hint')).toHaveText('등록하거나 고른 상품이 있을 때 쓸 수 있어요');
  await expect(page.getByRole('tab', { name: '품목 전체' })).toHaveAttribute('aria-selected', 'true');
});
