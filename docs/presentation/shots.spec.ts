import { expect, test, type Page } from '@playwright/test';

// 작업 12.9: 폭 360px 캡처. 실행: npx playwright test -c docs/presentation/shots.config.ts
const OUT = 'docs/screenshots';
const FILTER = 'docs/presentation/filter.png';
const CANDIDATES = 'docs/presentation/candidates.png';
test.setTimeout(180_000);

async function photo(page: Page, label: string, color: string): Promise<Buffer> {
  const p = await page.context().newPage();
  await p.setViewportSize({ width: 600, height: 600 });
  await p.setContent(`<body style="margin:0;display:grid;place-items:center;height:600px;background:${color};font-family:sans-serif">
    <div style="background:#fff;border-radius:24px;padding:40px 48px;text-align:center;box-shadow:0 8px 24px #0003">
    <div style="font-size:120px">🧈</div><div style="font-size:44px;font-weight:700">${label}</div></div></body>`);
  const b = await p.screenshot();
  await p.close();
  return b;
}

interface R { productName?: string; item: string; brand?: string; amount?: string; bundle?: string; price: string; store: string; online?: boolean; shipping?: string; color: string; date?: string }
async function reg(page: Page, r: R) {
  await page.goto('/register');
  if (r.productName) await page.getByLabel('품명 입력').fill(r.productName);
  await page.getByLabel(/^품목/).fill(r.item);
  if (r.brand) await page.getByLabel('브랜드 입력').fill(r.brand);
  if (r.amount) await page.getByLabel('단위용량', { exact: true }).fill(r.amount);
  if (r.bundle) await page.getByLabel(/^번들묶음/).fill(r.bundle);
  await page.getByLabel(/^가격/).fill(r.price);
  await page.getByLabel(/^판매처/).fill(r.store);
  if (r.online) await page.getByLabel('온라인 판매처').check();
  if (r.shipping) await page.getByLabel('배송비').fill(r.shipping);
  if (r.date) await page.getByLabel(/^날짜/).fill(r.date);
  await page.getByTestId('photo-input').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await photo(page, r.brand ?? r.item, r.color) });
  await expect(page.getByTestId('missing')).toHaveCount(0);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForURL(/\/items\//);
}

test('screens', async ({ page, context }) => {
  await context.route('https://www.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: 'g' }));
  const data: R[] = [
    { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '이마트 구로점', color: '#cfe8d8' },
    { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '400', bundle: '1', price: '2900', store: '롯데마트 신도림', color: '#cfe8d8' },
    { productName: '행복한콩 두부', item: '두부', brand: 'CJ', amount: '300', bundle: '1', price: '1980', store: '홈플러스', color: '#f6e3c3' },
    { productName: '부침두부', item: '두부', brand: '노브랜드', amount: '550', bundle: '1', price: '2480', store: '이마트 구로점', color: '#f3d1d1' },
    { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '4', price: '6200', store: '쿠팡', online: true, shipping: '0', color: '#cfe8d8' },
    { productName: '찌개두부', item: '두부', brand: '맑은물에', amount: '300', bundle: '1', price: '1500', store: '동네시장', color: '#dde3f6', date: '2026-07-20' },
  ];
  for (const r of data) await reg(page, r);

  // 1. 결과 화면 (홈에서 진입)
  const itemUrl = page.url().replace(/\?.*/, '');
  await page.goto(itemUrl);
  await expect(page.getByTestId('row').first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/results.png` });

  // 2. 필터 적용
  await page.getByRole('button', { name: /브랜드/ }).click();
  await page.getByRole('checkbox', { name: /^풀무원/ }).check();
  await page.getByRole('button', { name: '적용' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: FILTER });

  // 3. 등록: 자동완성 + 이전 사진 + 비교 바
  await page.goto('/register');
  await page.getByLabel('품명 입력').fill('국산');
  await page.getByRole('button', { name: /국산콩 두부.*300g×4/ }).click();
  await page.getByLabel(/^번들묶음/).fill('2');
  await page.getByLabel(/^가격/).fill('3290');
  await page.getByLabel(/^판매처/).fill('홈플러스');
  await page.getByRole('heading', { name: '가격 등록' }).click();
  await page.waitForTimeout(500);
  // 가격 정보 카드와 아래에 고정된 비교 바가 같이 보이게
  await page.getByRole('heading', { name: '가격 정보' }).evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/register.png` });

  // 4. 홈 (맨 위 빠른 비교, 작업 15)
  await page.goto('/');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/home.png` });

  // 4-1. 홈 빠른 비교 자동완성 후보 (작업 15.9)
  await page.getByLabel('품명', { exact: true }).fill('국산콩');
  await expect(page.getByRole('listbox', { name: '자동완성 후보' }).getByRole('option')).toHaveCount(3);
  await page.waitForTimeout(400);
  await page.screenshot({ path: CANDIDATES });

  // 5. 온라인 기록 상세
  await page.goto(itemUrl);
  await page.getByTestId('row').filter({ hasText: '쿠팡' }).first().click();
  await page.waitForURL(/\/records\//);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/detail.png`, fullPage: true });
});
