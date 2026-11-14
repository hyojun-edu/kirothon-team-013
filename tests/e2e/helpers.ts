import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const PHOTO = path.resolve('public/icon-192.png');

export interface Reg {
  productName?: string;
  item: string;
  brand?: string;
  amount?: string;
  bundle?: string;
  price: string;
  store: string;
  online?: boolean;
  shipping?: string;
}

/** 등록 화면에서 값을 넣고 저장한다. 저장 후 결과 화면 주소를 기다린다. */
export async function register(page: Page, r: Reg, { goto = true } = {}) {
  if (goto) await page.goto('/register');
  await expect(page.getByRole('heading', { name: '가격 등록' })).toBeVisible();
  if (r.productName) await page.getByLabel('품명 입력').fill(r.productName);
  if (r.item) await page.getByLabel(/^품목/).fill(r.item);
  if (r.brand) await page.getByLabel('브랜드 입력').fill(r.brand);
  if (r.amount) await page.getByLabel('단위용량', { exact: true }).fill(r.amount);
  if (r.bundle) await page.getByLabel(/^번들묶음/).fill(r.bundle);
  await page.getByLabel(/^가격/).fill(r.price);
  await page.getByLabel(/^판매처/).fill(r.store);
  if (r.online) await page.getByLabel('온라인 판매처').check();
  if (r.shipping) await page.getByLabel('배송비').fill(r.shipping);
  await page.getByTestId('photo-input').setInputFiles(PHOTO);
  // 사진 처리(리사이즈)가 끝나야 저장할 수 있다. 실패하면 남은 항목을 보여준다.
  await expect(page.getByTestId('missing'), 'missing fields').toHaveCount(0);
  await expect(page.getByRole('button', { name: '저장' })).toBeEnabled();
  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL(/\/items\/[^/?]+\?mine=/);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** 요구 13.4: 보이는 터치 대상은 높이 44px 이상 */
export async function touchTargetsOk(page: Page) {
  const small = await page.evaluate(() => {
    const sel = 'button, a, select, textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]), label.na-check, label.multi-opt, .radio-row label, [role=link]';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
      .map(({ e, r }) => `${e.tagName}.${e.className} "${e.textContent?.trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  expect(small).toEqual([]);
}
