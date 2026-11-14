import { expect, test } from '@playwright/test';
import { noHorizontalScroll, PHOTO, register, touchTargetsOk } from './helpers';

test.beforeEach(async ({ context }) => {
  // 실제 구글로 나가지 않는다. 주소만 확인한다.
  await context.route('https://www.google.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>google</title>' }));
});

// 작업 10.1: 등록 → 순위 → 필터 → 온라인 검색 URL → 미리 채운 등록 → 갱신 이력
test('전체 흐름', async ({ page, context }) => {
  // 인수 기준 4: 300g×2 3,480원(580) / 400g×1 2,900원(725)
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '400', bundle: '1', price: '2900', store: '이마트 구로점' });
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '롯데마트' });

  // 요구 1.7, 8: 저장 후 결과 화면, 내 상품 순위
  await expect(page.getByRole('region', { name: '내 상품 비교' })).toContainText('2건 중 1위');
  const units = page.getByTestId('unit-price');
  await expect(units).toHaveText(['580원/100g', '725원/100g']);
  const first = page.getByTestId('row').first();
  await expect(first.getByText('최저가')).toBeVisible();
  await expect(first.getByText('내 상품')).toBeVisible();
  // 인수 기준 17: 행에서 단위가격 글자가 가장 크다
  const sizes = await first.evaluate((li) => {
    const px = (e: Element) => parseFloat(getComputedStyle(e).fontSize);
    const up = px(li.querySelector('[data-testid=unit-price]')!);
    const others = [...li.querySelectorAll('.sub, .meta span, .rank')].map(px);
    return { up, maxOther: Math.max(...others) };
  });
  expect(sizes.up).toBeGreaterThan(sizes.maxOther);
  await touchTargetsOk(page);
  await noHorizontalScroll(page);

  // 다른 브랜드 기록을 추가하고 필터
  await page.getByRole('button', { name: '가격 등록' }).first().click();
  await register(page, { productName: '부침두부', item: '두부', brand: 'CJ', amount: '300', bundle: '1', price: '1500', store: '동네마트' }, { goto: false });
  await page.goto(page.url().replace(/\?.*/, ''));
  await expect(page.getByTestId('row')).toHaveCount(3);
  await expect(page.getByRole('region', { name: '조건부 최저가' })).toContainText('500원/100g');
  await page.getByRole('button', { name: /브랜드/ }).click();
  await page.getByRole('checkbox', { name: /^풀무원/ }).check();
  await expect(page.getByTestId('row')).toHaveCount(2);
  await expect(page.getByRole('region', { name: '조건부 최저가' })).toContainText('580원/100g');
  await expect(page.getByRole('button', { name: '풀무원 필터 해제' })).toBeVisible();
  await touchTargetsOk(page);
  await noHorizontalScroll(page);

  // 요구 9: 구글 검색 새 탭
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: /온라인 가격 검색/ }).click();
  await expect(page.getByLabel('검색어')).toHaveValue('풀무원 국산콩 두부 300g 가격');
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: '구글에서 열기' }).click()]);
  const url = new URL(popup.url());
  expect(url.hostname).toBe('www.google.com');
  expect(url.searchParams.get('q')).toBe('풀무원 국산콩 두부 300g 가격');
  await popup.close();

  // 요구 10: 돌아와서 온라인 가격 등록
  await page.getByRole('button', { name: '온라인 가격 등록' }).click();
  await expect(page.getByLabel(/^품목/)).toHaveValue('두부');
  await expect(page.getByLabel('품명 입력')).toHaveValue('국산콩 두부');
  await expect(page.getByLabel(/^번들묶음/)).toHaveValue('2');
  await expect(page.getByLabel(/^가격/)).toHaveValue('');
  await expect(page.getByLabel(/^판매처/)).toHaveValue('');
  await expect(page.getByText('사진 없음')).toBeVisible(); // 인수 26
  await register(page, { item: '', bundle: '6', price: '9000', store: '쿠팡', online: true, shipping: '3000' }, { goto: false });
  await expect(page.getByRole('region', { name: '내 상품 비교' })).toContainText('667원/100g');

  // 요구 11: 온라인 기록 상세 → 최신가격 다시 검색 → 판매처·배송비 채움 → 갱신 이력
  await page.getByTestId('row').filter({ hasText: '쿠팡' }).locator('.row').click();
  await expect(page.getByRole('heading', { name: '기록 상세' })).toBeVisible();
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await page.getByRole('button', { name: /최신가격 다시 검색/ }).click();
  await expect(page.getByLabel('검색어')).toHaveValue('풀무원 국산콩 두부 300g 쿠팡 가격');
  const [p2] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: '구글에서 열기' }).click()]);
  expect(new URL(p2.url()).hostname).toBe('www.google.com');
  await p2.close();
  await page.getByRole('button', { name: '온라인 가격 등록' }).click();
  await expect(page.getByLabel(/^판매처/)).toHaveValue('쿠팡');
  await expect(page.getByLabel('배송비')).toHaveValue('3000');
  await expect(page.getByLabel(/^가격/)).toHaveValue('');
  await page.getByLabel(/^가격/).fill('8400');
  await page.getByTestId('photo-input').setInputFiles(PHOTO);
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL(/\?mine=/);
  const coupang = page.getByTestId('row').filter({ hasText: '쿠팡' });
  await expect(coupang).toHaveCount(1);
  await expect(coupang).toContainText('8,400원');
  await coupang.getByRole('button', { name: '이전 기록 보기 (1)' }).click();
  await expect(page.getByRole('list', { name: '이전 기록' })).toContainText('9,000원');

  // 오프라인 판매처 상세에는 다시 검색이 없다 (요구 11.2)
  await page.getByTestId('row').filter({ hasText: '이마트 구로점' }).locator('.row').click();
  await expect(page.getByRole('button', { name: '이 기록으로 새로 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: /최신가격 다시 검색/ })).toHaveCount(0);
});

// 작업 11: 자동완성으로 이전 사진 불러오기 (인수 23, 24)
test('품명 자동완성으로 이전 사진을 불러와 저장하고, 바꾸면 새 사진으로 저장한다', async ({ page }) => {
  await register(page, { productName: '국산콩 두부', item: '두부', brand: '풀무원', amount: '300', bundle: '2', price: '3480', store: '이마트' });
  const pick = async () => {
    await page.goto('/register');
    await page.getByLabel('품명 입력').fill('국산');
    await page.getByRole('button', { name: /풀무원 국산콩 두부 300g ×2/ }).click();
    await expect(page.getByTestId('reused-photo')).toHaveText('이전 사진');
    await expect(page.getByRole('img', { name: '이전 사진' })).toBeVisible();
    await page.getByLabel(/^가격/).fill('3000');
    await page.getByLabel(/^판매처/).fill('롯데마트');
  };
  const photoCount = () =>
    page.evaluate(
      () =>
        new Promise<number>((res) => {
          const r = indexedDB.open('shopping-helper');
          r.onsuccess = () => {
            const c = r.result.transaction('photos').objectStore('photos').count();
            c.onsuccess = () => res(c.result);
          };
        }),
    );

  // 인수 23: 사진을 새로 올리지 않아도 저장된다
  await pick();
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await expect(page.getByTestId('missing')).toHaveCount(0);
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL(/\?mine=/);
  await expect(page.getByTestId('row')).toHaveCount(2);
  expect(await photoCount()).toBe(1);

  // 인수 24: 갤러리에서 바꾸면 새 사진으로 저장된다
  await pick();
  await expect(page.getByRole('button', { name: /갤러리에서 선택/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /다시 촬영/ })).toBeVisible();
  await page.getByTestId('photo-input').setInputFiles(PHOTO);
  await expect(page.getByTestId('reused-photo')).toHaveCount(0);
  await page.getByLabel(/^판매처/).fill('홈플러스');
  await expect(page.getByRole('button', { name: '저장' })).toBeEnabled();
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL(/\?mine=/);
  await expect(page.getByTestId('row')).toHaveCount(3);
  expect(await photoCount()).toBe(2);
});

// 작업 10.2: 오프라인에서 등록과 조회 (요구 13.2)
test('네트워크 없이 등록하고 조회한다', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: '가격 등록' }).click();
  await register(page, { item: '양파', price: '3000', store: '시장', amount: '1000', bundle: '1' }, { goto: false });
  await expect(page.getByTestId('row')).toHaveCount(1);
  await page.goto('/');
  await page.getByLabel('품목 검색').fill('양파');
  await page.getByRole('button', { name: '양파' }).click();
  await expect(page.getByTestId('unit-price')).toHaveText('300원/100g');
  await context.setOffline(false);
});

// 작업 10.3: 모든 화면 360px 가로 스크롤 없음 (요구 13.3), 4.3 터치 영역
test('모든 화면이 360px 안에 들어오고 터치 대상이 44px 이상', async ({ page }) => {
  await page.goto('/');
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await page.goto('/register');
  await page.getByLabel('온라인 판매처').check();
  await page.getByRole('radio', { name: '수입' }).check();
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await page.goto('/register');
  await register(page, { productName: '아주아주긴이름의상품명이들어가는경우를확인하는두부', item: '두부', brand: '아주긴브랜드이름입니다', amount: '300', price: '1234567', store: '아주아주아주긴판매처이름 지점명까지' }, { goto: false });
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: /번들/ }).click();
  await noHorizontalScroll(page);
  await touchTargetsOk(page);
  await page.getByTestId('row').first().locator('.row').click();
  await noHorizontalScroll(page);
});

// 작업 10.4: 기록 1,000건에서 필터 반영 300ms 이내 (요구 6.7)
test('1,000건에서 필터 변경이 300ms 안에 반영된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '최근 기록' })).toBeVisible();
  const itemId = await page.evaluate(async (n) => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('shopping-helper');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const now = new Date().toISOString();
    const meta = (id: string) => ({ id, ownerId: 'local', createdAt: now, updatedAt: now });
    const tx = db.transaction(['items', 'products', 'records', 'stores'], 'readwrite');
    tx.objectStore('items').put({ ...meta('perf-item'), name: '성능두부' });
    for (let s = 0; s < 20; s++) tx.objectStore('stores').put({ ...meta(`st${s}`), name: `가게${s}`, isOnline: false });
    for (let p = 0; p < 50; p++)
      tx.objectStore('products').put({
        ...meta(`pr${p}`),
        itemId: 'perf-item',
        name: { kind: 'value', value: `두부${p}` },
        brand: { kind: 'value', value: `브랜드${p % 8}` },
        origin: { kind: 'value', value: { type: 'domestic' } },
        packUnit: '팩',
        unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
        key: `k${p}`,
      });
    for (let i = 0; i < n; i++)
      tx.objectStore('records').put({
        ...meta(`rc${i}`),
        productId: `pr${i % 50}`,
        storeId: `st${i % 20}`,
        bundleCount: (i % 3) + 1,
        price: 1000 + i,
        purchasedAt: `2026-${String((i % 10) + 1).padStart(2, '0')}-01`,
        photoId: 'none',
      });
    await new Promise((res) => (tx.oncomplete = res));
    db.close();
    return 'perf-item';
  }, 1000);
  await page.goto(`/items/${itemId}`);
  await expect(page.getByText('전체 1000건')).toBeVisible();
  await expect(page.getByTestId('row')).toHaveCount(20);
  await page.getByRole('button', { name: /브랜드/ }).click();
  const ms = await page.evaluate(async () => {
    const box = [...document.querySelectorAll<HTMLInputElement>('.multi-opt input')][0];
    const t0 = performance.now();
    box.click();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const ok = document.querySelector('[aria-label="적용된 필터"]') !== null;
    return ok ? performance.now() - t0 : -1;
  });
  expect(ms).toBeGreaterThanOrEqual(0);
  expect(ms).toBeLessThan(300);

  // 요구 5.14: 아래로 스크롤하면 20건씩 더 불러온다
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '전체 해제' }).click();
  await expect(page.getByTestId('row')).toHaveCount(20);
  await page.getByRole('button', { name: /더 보기/ }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId('row')).toHaveCount(40);
});
