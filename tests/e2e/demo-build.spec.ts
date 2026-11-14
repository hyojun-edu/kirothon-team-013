import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// 작업 14.6, 인수 기준 36 (요구 15.9): 일반 빌드(dist/)와 미리보기(4173)에는 샘플 데이터·사진 코드·데모 표시가 없다.
// webServer가 먼저 `npm run build`로 dist/를 만든다.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

test('일반 빌드에 데모 코드가 없다', async ({ page }) => {
  const text = files('dist')
    .filter((f) => /\.(js|css|html|webmanifest|json)$/.test(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
  expect(text.length).toBeGreaterThan(1000);
  // seed.ts, drawPhoto.ts, DemoBadge.tsx에만 있는 글자열
  for (const s of ['데모 데이터', '맑은물에', '엔비 사과', '마켓컬리', 'demo-badge', 'startDemo', 'roundRect']) expect(text, s).not.toContain(s);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('데모 데이터')).toHaveCount(0);
});
