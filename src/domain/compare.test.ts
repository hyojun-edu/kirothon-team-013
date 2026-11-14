import { buildResult, emptyFilters, inPeriod, isOld, NA, type ResultQuery } from './compare';
import type { PriceRecordView } from './types';

let n = 0;
function rec(p: Partial<PriceRecordView>): PriceRecordView {
  n++;
  return {
    id: `r${n}`,
    productId: `p${n}`,
    storeId: `s${n}`,
    itemId: 'i1',
    itemName: '두부',
    packUnit: '팩',
    bundleCount: 1,
    price: 1000,
    purchasedAt: '2026-11-01',
    photoId: 'ph',
    storeName: `가게${n}`,
    isOnline: false,
    createdAt: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`,
    unitAmount: { kind: 'value', value: { amount: 100, unit: 'g' } },
    ...p,
  };
}
const g = (amount: number) => ({ kind: 'value', value: { amount, unit: 'g' } }) as const;
const v = (value: string) => ({ kind: 'value', value }) as const;
const q = (p: Partial<ResultQuery> = {}): ResultQuery => ({
  preset: 'allItem',
  filters: emptyFilters(),
  sort: 'unitPrice',
  showHistory: false,
  now: new Date(2026, 10, 14),
  ...p,
});

describe('buildResult 정렬과 순위 (요구 5.1, 4.4)', () => {
  it('300g×2 3,480원(580)이 400g×1 2,900원(725)보다 위', () => {
    const a = rec({ unitAmount: g(400), price: 2900 });
    const b = rec({ unitAmount: g(300), bundleCount: 2, price: 3480 });
    const r = buildResult([a, b], q());
    expect(r.rows.map((x) => x.rec.id)).toEqual([b.id, a.id]);
    expect(r.rows.map((x) => x.rank)).toEqual([1, 2]);
    expect(r.cheapest?.rec.id).toBe(b.id);
    expect(r.rows[0].isCheapest).toBe(true);
    expect(r.rows[1].isCheapest).toBe(false);
  });
  it('단위가격이 같으면 최신 날짜가 먼저', () => {
    const a = rec({ purchasedAt: '2026-10-01' });
    const b = rec({ purchasedAt: '2026-11-10' });
    expect(buildResult([a, b], q()).rows.map((x) => x.rec.id)).toEqual([b.id, a.id]);
  });
  it('요구 5.8: 최신순 정렬도 되고 순위는 단위가격 기준', () => {
    const a = rec({ price: 500, purchasedAt: '2026-10-01' });
    const b = rec({ price: 900, purchasedAt: '2026-11-10' });
    const r = buildResult([a, b], q({ sort: 'recent' }));
    expect(r.rows.map((x) => x.rec.id)).toEqual([b.id, a.id]);
    expect(r.rows[1].rank).toBe(1);
    expect(r.rows[1].isCheapest).toBe(true);
  });
});

describe('단위 타입 분리 (요구 4.6, 5.12)', () => {
  it('g, ml, 개 기록은 섞이지 않고 적은 쪽은 비교 불가', () => {
    const a = rec({});
    const b = rec({});
    const c = rec({ unitAmount: { kind: 'value', value: { amount: 500, unit: 'ml' } } });
    const d = rec({ unitAmount: { kind: 'na' } });
    const r = buildResult([a, b, c, d], q());
    expect(r.baseType).toBe('g');
    expect(r.rows.map((x) => x.rec.id).sort()).toEqual([a.id, b.id].sort());
    expect(r.incomparable.map((x) => x.rec.id).sort()).toEqual([c.id, d.id].sort());
  });
  it('내 상품이 있으면 그 단위 타입이 기준', () => {
    const a = rec({});
    const b = rec({});
    const c = rec({ unitAmount: { kind: 'na' } });
    const r = buildResult([a, b, c], q({ anchor: { recordId: c.id } }));
    expect(r.baseType).toBe('ea');
    expect(r.rows.map((x) => x.rec.id)).toEqual([c.id]);
  });
});

describe('최신 기록만과 이력 (요구 5.7, 11.6)', () => {
  it('같은 상품+판매처는 최신만, 이전 기록은 날짜순 history', () => {
    const old1 = rec({ productId: 'P', storeId: 'S', purchasedAt: '2026-09-01', price: 500 });
    const old2 = rec({ productId: 'P', storeId: 'S', purchasedAt: '2026-10-01', price: 700 });
    const latest = rec({ productId: 'P', storeId: 'S', purchasedAt: '2026-11-01', price: 900 });
    const other = rec({ productId: 'P', storeId: 'T' });
    const r = buildResult([old2, latest, old1, other], q());
    expect(r.rows).toHaveLength(2);
    const row = r.rows.find((x) => x.rec.id === latest.id)!;
    expect(row.history.map((h) => h.id)).toEqual([old1.id, old2.id]);
    expect(buildResult([old2, latest, old1, other], q({ showHistory: true })).rows).toHaveLength(4);
  });
});

describe('필터 (요구 6)', () => {
  const recs = [
    rec({ brand: v('풀무원'), origin: { kind: 'value', value: { type: 'domestic' } }, bundleCount: 1, price: 900 }),
    rec({ brand: v('CJ'), origin: { kind: 'value', value: { type: 'import', country: '중국' } }, bundleCount: 2, price: 1000 }),
    rec({ brand: { kind: 'na' }, origin: { kind: 'value', value: { type: 'import', country: '미국' } }, bundleCount: 1, price: 300 }),
    rec({ brand: v('풀무원'), origin: { kind: 'na' }, bundleCount: 3, price: 3000 }),
  ];
  it('facets는 존재하는 값만, 해당사항 없음 포함 (요구 6.2, 6.3)', () => {
    const r = buildResult(recs, q());
    expect(r.facets.brands.map((f) => f.key).sort()).toEqual(['CJ', NA, '풀무원'].sort());
    expect(r.facets.brands.find((f) => f.key === NA)?.label).toBe('해당사항 없음');
    expect(r.facets.origins.map((f) => f.key).sort()).toEqual(
      ['domestic', 'import', 'import:중국', 'import:미국', 'na'].sort(),
    );
    expect(r.facets.bundles.map((f) => f.key)).toEqual([1, 2, 3]);
  });
  it('같은 필터 안은 OR', () => {
    const f = emptyFilters();
    f.brands.add('CJ').add(NA);
    expect(buildResult(recs, q({ filters: f })).rows.map((x) => x.rec.id).sort()).toEqual([recs[1].id, recs[2].id].sort());
  });
  it('다른 필터끼리는 AND, 조건부 최저가 표시 (요구 6.4, 6.5)', () => {
    const f = emptyFilters();
    f.brands.add('풀무원').add('CJ');
    f.bundles.add(1).add(2);
    const r = buildResult(recs, q({ filters: f }));
    // CJ 2개 1,000원 = 500원/100g 이 풀무원 900원보다 싸다
    expect(r.rows.map((x) => x.rec.id)).toEqual([recs[1].id, recs[0].id]);
    expect(r.cheapest?.rec.id).toBe(recs[1].id);
  });
  it('원산지: 수입 전체와 국가별', () => {
    const all = emptyFilters();
    all.origins.add('import');
    expect(buildResult(recs, q({ filters: all })).rows).toHaveLength(2);
    const cn = emptyFilters();
    cn.origins.add('import:중국');
    expect(buildResult(recs, q({ filters: cn })).rows.map((x) => x.rec.id)).toEqual([recs[1].id]);
  });
  it('조건에 맞는 기록이 없으면 빈 목록', () => {
    const f = emptyFilters();
    f.brands.add('없는브랜드');
    const r = buildResult(recs, q({ filters: f }));
    expect(r.rows).toEqual([]);
    expect(r.cheapest).toBeNull();
  });
});

describe('프리셋 (요구 7)', () => {
  const a = rec({ productName: v('국산콩 두부'), brand: v('풀무원'), unitAmount: g(300) });
  const b = rec({ productName: v('국산콩 두부'), brand: v('풀무원'), unitAmount: { kind: 'value', value: { amount: 0.3, unit: 'kg' } } });
  const c = rec({ productName: v('국산콩 두부'), brand: v('풀무원'), unitAmount: g(500) });
  const d = rec({ productName: v('부침 두부'), brand: v('풀무원'), unitAmount: g(300) });
  const all = [a, b, c, d];
  it('똑같은 상품: 품명, 브랜드, 단위용량이 같은 것만', () => {
    const r = buildResult(all, q({ preset: 'exact', anchor: { recordId: a.id } }));
    expect(r.rows.map((x) => x.rec.id).sort()).toEqual([a.id, b.id].sort());
  });
  it('같은 상품, 용량 무관: 품명, 브랜드가 같은 것', () => {
    const r = buildResult(all, q({ preset: 'sameProduct', anchor: { recordId: a.id } }));
    expect(r.rows).toHaveLength(3);
  });
  it('같은 품목 전체 + 필터 추가 (요구 7.4)', () => {
    const f = emptyFilters();
    f.brands.add('풀무원');
    expect(buildResult(all, q({ preset: 'allItem', filters: f })).rows).toHaveLength(4);
    const r = buildResult(all, q({ preset: 'sameProduct', anchor: { recordId: a.id }, filters: { ...emptyFilters(), bundles: new Set([2]) } }));
    expect(r.rows).toHaveLength(0);
  });
});

describe('내 상품 요약 (요구 8)', () => {
  const recs = [rec({ price: 500 }), rec({ price: 700 }), rec({ price: 900 }), rec({ price: 1100 })];
  it('저장 전 입력값: 순위, 전체, 최저가 차이(원, %)', () => {
    const r = buildResult(recs, q({ anchor: { unitPrice: { value: 800, per: 100, type: 'g' } } }));
    expect(r.anchorSummary).toMatchObject({ rank: 3, total: 5, diffWon: 300 });
    expect(r.anchorSummary!.diffPct).toBeCloseTo(60);
  });
  it('저장된 내 기록: 행에 내 상품 표시, 순위', () => {
    const r = buildResult(recs, q({ anchor: { recordId: recs[1].id } }));
    expect(r.anchorSummary).toMatchObject({ rank: 2, total: 4, diffWon: 200 });
    expect(r.rows.find((x) => x.isMine)?.rec.id).toBe(recs[1].id);
  });
  it('내가 최저가면 차이는 음수', () => {
    const r = buildResult(recs, q({ anchor: { recordId: recs[0].id } }));
    expect(r.anchorSummary).toMatchObject({ rank: 1, diffWon: -200 });
  });
  it('내 상품이 없으면 요약도 없다', () => {
    expect(buildResult(recs, q()).anchorSummary).toBeUndefined();
  });
});

describe('isOld (요구 5.6)', () => {
  const now = new Date(2026, 10, 14);
  it('90일 넘으면 오래된 가격', () => {
    expect(isOld('2026-08-16', now)).toBe(false); // 90일
    expect(isOld('2026-08-15', now)).toBe(true); // 91일
  });
});

describe('성능 (요구 6.7)', () => {
  it('1,000건 필터 계산이 300ms 안', () => {
    const many = Array.from({ length: 1000 }, (_, i) =>
      rec({ brand: v(`b${i % 7}`), bundleCount: (i % 3) + 1, price: 500 + i, productId: `P${i % 50}`, storeId: `S${i % 13}` }),
    );
    const f = emptyFilters();
    f.brands.add('b1').add('b2');
    const t = performance.now();
    buildResult(many, q({ filters: f }));
    expect(performance.now() - t).toBeLessThan(300);
  });
});

describe('기간 필터 (요구 6.9, 6.10, 6.14)', () => {
  const NOW = new Date(2026, 10, 14);
  const day = (n: number) => {
    const d = new Date(2026, 10, 14 - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  it('경계일 포함: 90일 전은 남고 91일 전은 빠진다', () => {
    expect(inPeriod(day(90), '90d', NOW)).toBe(true);
    expect(inPeriod(day(91), '90d', NOW)).toBe(false);
    expect(inPeriod(day(30), '30d', NOW)).toBe(true);
    expect(inPeriod(day(31), '30d', NOW)).toBe(false);
    expect(inPeriod(day(365), '1y', NOW)).toBe(true);
    expect(inPeriod(day(366), '1y', NOW)).toBe(false);
    expect(inPeriod(day(9999), 'all', NOW)).toBe(true);
  });

  it('기본은 전체, 빠진 기록은 순위·1위·hiddenByPeriod에 반영', () => {
    const recs = [rec({ price: 500, purchasedAt: day(120) }), rec({ price: 700, purchasedAt: day(10) }), rec({ price: 900, purchasedAt: day(40) })];
    const all = buildResult(recs, q({ now: NOW }));
    expect(all.rows.map((r) => r.rec.price)).toEqual([500, 700, 900]);
    expect(all.hiddenByPeriod).toBe(0);
    const r90 = buildResult(recs, q({ now: NOW, period: '90d' }));
    expect(r90.rows.map((r) => [r.rec.price, r.rank])).toEqual([[700, 1], [900, 2]]);
    expect(r90.cheapest!.rec.price).toBe(700);
    expect(r90.hiddenByPeriod).toBe(1);
    expect(buildResult(recs, q({ now: NOW, period: '30d' })).hiddenByPeriod).toBe(2);
  });

  it('최신 기록이 기간 밖이면 상품+판매처가 통째로 빠지고, 안이면 이력만 줄어든다 (순서 규칙)', () => {
    const recs = [
      rec({ productId: 'a', storeId: 's', price: 500, purchasedAt: day(200) }),
      rec({ productId: 'a', storeId: 's', price: 600, purchasedAt: day(100) }),
      rec({ productId: 'b', storeId: 's', price: 800, purchasedAt: day(120) }),
      rec({ productId: 'b', storeId: 's', price: 900, purchasedAt: day(5) }),
    ];
    const r = buildResult(recs, q({ now: NOW, period: '90d' }));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].rec.price).toBe(900);
    expect(r.rows[0].history).toEqual([]);
    expect(r.hiddenByPeriod).toBe(3);
    // 기간 다음에 최신 기록만: 전체면 a의 최신(600)이 남는다
    expect(buildResult(recs, q({ now: NOW })).rows.map((x) => x.rec.price)).toEqual([600, 900]);
  });

  it('프리셋 다음에 기간: hiddenByPeriod는 프리셋 안에서만 센다', () => {
    const recs = [rec({ productName: v('가'), price: 500, purchasedAt: day(200) }), rec({ productName: v('나'), price: 700, purchasedAt: day(200) }), rec({ productName: v('가'), price: 800, purchasedAt: day(1) })];
    const r = buildResult(recs, q({ now: NOW, period: '90d', preset: 'sameProduct', anchor: { productName: v('가') } }));
    expect(r.hiddenByPeriod).toBe(1);
    expect(r.rows.map((x) => x.rec.price)).toEqual([800]);
  });

  it('내 상품 비교 바의 순위와 최저가 차이도 남은 기록으로 다시 계산', () => {
    const recs = [rec({ price: 400, purchasedAt: day(200) }), rec({ price: 700, purchasedAt: day(10) }), rec({ price: 900, purchasedAt: day(20) })];
    const anchor = { unitPrice: { value: 800, per: 100, type: 'g' as const } };
    const all = buildResult(recs, q({ now: NOW, anchor })).anchorSummary!;
    expect([all.rank, all.total, all.diffWon]).toEqual([3, 4, 400]);
    const r90 = buildResult(recs, q({ now: NOW, anchor, period: '90d' })).anchorSummary!;
    expect([r90.rank, r90.total, r90.diffWon]).toEqual([2, 3, 100]);
  });
});
