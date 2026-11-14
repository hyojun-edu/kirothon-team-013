import { findCandidates, relativeDay } from './candidates';
import type { PriceRecordView } from './types';

let n = 0;
function rec(p: Partial<PriceRecordView>): PriceRecordView {
  n++;
  return {
    id: `r${n}`,
    productId: 'p1',
    storeId: 's1',
    itemId: 'i1',
    itemName: '두부',
    productName: { kind: 'value', value: '국산콩 두부' },
    brand: { kind: 'value', value: '풀무원' },
    packUnit: '모',
    bundleCount: 1,
    price: 1000,
    purchasedAt: '2026-11-01',
    photoId: 'ph',
    storeName: '이마트',
    isOnline: false,
    createdAt: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`,
    unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
    ...p,
  };
}

describe('findCandidates (요구 16.4, 16.5)', () => {
  it('상품+번들로 묶고 가장 최근 기록이 대표, 기록 수를 센다', () => {
    const r = findCandidates(
      [rec({ price: 1000, purchasedAt: '2026-10-01' }), rec({ price: 1200, purchasedAt: '2026-11-01', photoId: 'new' }), rec({ bundleCount: 2, price: 1900 })],
      '두부',
    );
    expect(r.items).toHaveLength(2);
    const one = r.items.find((c) => c.bundleCount === 1)!;
    expect(one.price).toBe(1200);
    expect(one.recordCount).toBe(2);
    expect(one.photoId).toBe('new');
    expect(r.items.find((c) => c.bundleCount === 2)!.price).toBe(1900);
  });

  it('품명, 품목, 브랜드 어디든 일치하면 후보, 조각은 모두 일치해야 한다', () => {
    const recs = [rec({})];
    expect(findCandidates(recs, '풀무').items).toHaveLength(1);
    expect(findCandidates(recs, '콩').items).toHaveLength(1);
    expect(findCandidates(recs, '풀무원 두부').items).toHaveLength(1);
    expect(findCandidates(recs, '풀무원 우유').items).toHaveLength(0);
    expect(findCandidates(recs, ' ').items).toHaveLength(0);
  });

  it('앞부분 일치 → 품명 안 → 품목/브랜드, 같으면 최근 날짜 → 기록 수', () => {
    const recs = [
      rec({ productId: 'brand', productName: { kind: 'value', value: '찌개용' }, brand: { kind: 'value', value: '두부나라' }, purchasedAt: '2026-11-10' }),
      rec({ productId: 'inside', productName: { kind: 'value', value: '부침두부' }, purchasedAt: '2026-11-09' }),
      rec({ productId: 'prefix-old', productName: { kind: 'value', value: '두부 한모' }, purchasedAt: '2026-10-01' }),
      rec({ productId: 'prefix-new', productName: { kind: 'value', value: '두부 반모' }, purchasedAt: '2026-11-05' }),
      rec({ productId: 'prefix-many', productName: { kind: 'value', value: '두부 세모' }, purchasedAt: '2026-10-01' }),
      rec({ productId: 'prefix-many', productName: { kind: 'value', value: '두부 세모' }, purchasedAt: '2026-09-01' }),
    ];
    const ids = findCandidates(recs, '두부').items.map((c) => c.productId);
    expect(ids).toEqual(['prefix-new', 'prefix-many', 'prefix-old', 'inside', 'brand']);
  });

  it('최대 8개, 나머지는 more', () => {
    const recs = Array.from({ length: 11 }, (_, i) => rec({ productId: `p${i}` }));
    const r = findCandidates(recs, '두부');
    expect(r.items).toHaveLength(8);
    expect(r.more).toBe(3);
  });

  it('품명이 N/A이면 productName은 null이고 품목으로 찾는다', () => {
    const r = findCandidates([rec({ itemName: '양파', productName: { kind: 'na' }, brand: { kind: 'na' } })], '양');
    expect(r.items[0].productName).toBeNull();
    expect(r.items[0].brand).toBeNull();
  });

  it('기록 1,000건에서 100ms 안', () => {
    const recs = Array.from({ length: 1000 }, (_, i) => rec({ productId: `p${i % 300}`, bundleCount: (i % 3) + 1 }));
    const t = performance.now();
    findCandidates(recs, '두부');
    expect(performance.now() - t).toBeLessThan(100);
  });
});

describe('relativeDay', () => {
  const now = new Date(2026, 10, 14);
  it('오늘, 어제, n일 전', () => {
    expect(relativeDay('2026-11-14', now)).toBe('오늘');
    expect(relativeDay('2026-11-13', now)).toBe('어제');
    expect(relativeDay('2026-11-11', now)).toBe('3일 전');
  });
});
