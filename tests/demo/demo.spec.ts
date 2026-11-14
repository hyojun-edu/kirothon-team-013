import { expect, test } from '@playwright/test';

// 인수 기준 33, 35, 37 (요구 15.1, 15.2, 15.4, 15.7, 15.8)
test('데모: 첫 화면에 샘플 품목 5개 이상, 작은 데모 표시, 사진은 앱이 그린 이미지', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'image' && !/^(blob:|data:|http:\/\/127\.0\.0\.1:4174\/)/.test(r.url())) external.push(r.url());
  });
  await page.goto('/?reset=1');
  await expect(page).toHaveURL('http://127.0.0.1:4174/');
  await expect(page.getByTestId('demo-badge')).toHaveText('데모 데이터');
  const subs = page.locator('ul.recent li');
  await expect(subs.first()).toBeVisible();
  const items = await page.evaluate(async () => {
    const req = indexedDB.open('shopping-helper');
    const idb: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const count = (t: string) => new Promise<number>((res) => { const c = idb.transaction(t).objectStore(t).count(); c.onsuccess = () => res(c.result); });
    const r = { items: await count('items'), records: await count('records'), photos: await count('photos') };
    idb.close();
    return r;
  });
  expect(items.items).toBeGreaterThanOrEqual(5);
  expect(items.records).toBeGreaterThanOrEqual(25);
  // 최근 기록 목록에 품목 5개 이상이 보인다
  const text = (await subs.allInnerTexts()).join('\n');
  for (const name of ['두부', '우유', '계란', '사과', '라면']) expect(text).toContain(name);
  // 데모 표시는 하단 바와 겹치지 않는다
  const badge = (await page.getByTestId('demo-badge').boundingBox())!;
  const bar = (await page.locator('.bottom-bar').boundingBox())!;
  expect(badge.y + badge.height).toBeLessThan(bar.y);
  expect(badge.height).toBeLessThan(24);
  expect(external).toEqual([]);
});

test('데모: ?reset=1로 열면 초기 샘플 상태로 돌아간다', async ({ page }) => {
  await page.goto('/?reset=1');
  await expect(page.locator('ul.recent li').first()).toBeVisible();
  const counts = () =>
    page.evaluate(async () => {
      const req = indexedDB.open('shopping-helper');
      const idb: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
      const count = (t: string) => new Promise<number>((res) => { const c = idb.transaction(t).objectStore(t).count(); c.onsuccess = () => res(c.result); });
      const r = { items: await count('items'), records: await count('records') };
      idb.close();
      return r;
    });
  const initial = await counts();
  // 기록 하나를 지우고 품목 하나를 더한다 (촬영 중 바뀐 상태)
  await page.evaluate(async () => {
    const req = indexedDB.open('shopping-helper');
    const idb: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = idb.transaction(['items', 'records'], 'readwrite');
    tx.objectStore('items').put({ id: 'extra', ownerId: 'local', createdAt: '', updatedAt: '', name: '촬영중추가' });
    const cur = tx.objectStore('records').openCursor();
    cur.onsuccess = () => cur.result?.delete();
    await new Promise((res) => (tx.oncomplete = res));
    idb.close();
  });
  const changed = { items: initial.items + 1, records: initial.records - 1 };
  // 그냥 다시 열면 샘플을 넣지 않는다 (요구 15.3)
  await page.goto('/');
  await expect(page.locator('ul.recent li').first()).toBeVisible();
  expect(await counts()).toEqual(changed);
  // reset이면 초기 상태로 (요구 15.4)
  await page.goto('/?reset=1');
  await expect(page).toHaveURL('http://127.0.0.1:4174/');
  await expect(page.locator('ul.recent li').first()).toBeVisible();
  expect(await counts()).toEqual(initial);
});
