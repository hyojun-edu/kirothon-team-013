import { db } from '../data/db';
import { listRecordViews } from '../data/repositories';
import { buildResult, emptyFilters, type ResultQuery } from '../domain/compare';
import { unitPrice } from '../domain/unitPrice';
import { daysAgo, prepareDemo, SAMPLE, seed, TOFU, toDraft } from './seed';

// 작업 14.7 단위 테스트 (요구 15.2~15.6). jsdom에는 canvas가 없어 사진은 가짜로 만든다.
const NOW = new Date(2026, 10, 14);
const makePhoto = async () => ({ blob: new Blob(['p']), thumb: new Blob(['t']), width: 10, height: 10 });
const q = (p: Partial<ResultQuery> = {}): ResultQuery => ({ preset: 'allItem', filters: emptyFilters(), sort: 'unitPrice', showHistory: false, now: NOW, ...p });

async function tofu() {
  const item = (await db.items.where('name').equals('두부').first())!;
  return listRecordViews(item.id);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('데모 샘플 (작업 14)', () => {
  it('요구 15.2: 품목 5개 이상, 기록 25건 이상, 모든 기록에 사진', async () => {
    await seed({ now: NOW, makePhoto });
    expect(await db.items.count()).toBeGreaterThanOrEqual(5);
    expect(await db.records.count()).toBeGreaterThanOrEqual(25);
    const recs = await db.records.toArray();
    for (const r of recs) expect(await db.photos.get(r.photoId)).toBeTruthy();
  });

  it('요구 15.5: 날짜는 오늘 기준 상대값이고 90일 넘은 기록이 있다', () => {
    expect(daysAgo(0, NOW)).toBe('2026-11-14');
    expect(daysAgo(120, NOW)).toBe('2026-07-17');
    expect(toDraft(TOFU[1], new Date(2027, 0, 10)).purchasedAt).toBe(daysAgo(120, new Date(2027, 0, 10)));
    expect(SAMPLE.some((r) => r.daysAgo > 90)).toBe(true);
  });

  it('요구 15.6: 두부 구성표', async () => {
    await seed({ now: NOW, makePhoto });
    const recs = await tofu();
    expect(recs.length).toBeGreaterThanOrEqual(8);
    const res = buildResult(recs, q());
    const all = [...res.rows, ...res.incomparable];
    // 번들·용량이 다른 기록
    expect(new Set(recs.map((r) => `${JSON.stringify(r.unitAmount)}x${r.bundleCount}`)).size).toBeGreaterThanOrEqual(3);
    // 브랜드 3개 이상, 국산과 수입
    expect(res.facets.brands.length).toBeGreaterThanOrEqual(3);
    expect(res.facets.origins.map((f) => f.key)).toEqual(expect.arrayContaining(['domestic', 'import']));
    // 온라인 2건 이상, 배송비 있는 기록, 같은 상품+판매처 이력
    expect(recs.filter((r) => r.isOnline).length).toBeGreaterThanOrEqual(2);
    expect(recs.some((r) => r.isOnline && (r.shippingFee ?? 0) > 0)).toBe(true);
    expect(all.some((r) => r.history.length > 0 && r.rec.isOnline)).toBe(true);
    // 오프라인 판매처, 오래된 가격, 비교 불가
    expect(recs.some((r) => !r.isOnline)).toBe(true);
    expect(all.some((r) => r.isOld)).toBe(true);
    expect(res.incomparable.length).toBeGreaterThanOrEqual(1);
    // 필터에 따라 1위가 바뀐다 (국산만)
    const domestic = buildResult(recs, q({ filters: { ...emptyFilters(), origins: new Set(['domestic']) } }));
    expect(domestic.rows[0].rec.id).not.toBe(res.rows[0].rec.id);
  });

  it('spec.md 14.2: 두부 300g×2 3,480원을 넣으면 4~5위', async () => {
    await seed({ now: NOW, makePhoto });
    const up = unitPrice({ price: 3480, bundleCount: 2, unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } } })!;
    const s = buildResult(await tofu(), q({ anchor: { unitPrice: up } })).anchorSummary!;
    expect(s.rank).toBeGreaterThanOrEqual(4);
    expect(s.rank).toBeLessThanOrEqual(5);
  });

  it('요구 15.3: 데이터가 이미 있으면 넣지 않는다', async () => {
    await prepareDemo({ now: NOW, makePhoto });
    const n = await db.records.count();
    await prepareDemo({ now: NOW, makePhoto });
    expect(await db.records.count()).toBe(n);
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.items.add({ id: 'x', ownerId: 'local', createdAt: '', updatedAt: '', name: '내 품목' });
    await prepareDemo({ now: NOW, makePhoto });
    expect(await db.records.count()).toBe(0);
  });

  it('요구 15.4: reset이면 비우고 다시 넣는다', async () => {
    await prepareDemo({ now: NOW, makePhoto });
    const n = await db.records.count();
    await db.items.add({ id: 'x', ownerId: 'local', createdAt: '', updatedAt: '', name: '내 품목' });
    await prepareDemo({ reset: true, now: NOW, makePhoto });
    expect(await db.records.count()).toBe(n);
    expect(await db.items.get('x')).toBeUndefined();
  });
});
