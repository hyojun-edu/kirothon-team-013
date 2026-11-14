import type { Field, Origin, PriceRecordView, UnitAmount, UnitType } from './types';
import { toBase } from './units';
import { unitPrice, type UnitPrice } from './unitPrice';

export const NA = '__na__';
export type Preset = 'exact' | 'sameProduct' | 'allItem';
export type SortKey = 'unitPrice' | 'recent';

export interface ProductKey {
  productName?: Field<string> | { kind: 'empty' };
  brand?: Field<string> | { kind: 'empty' };
  unitAmount?: Field<UnitAmount> | { kind: 'empty' };
}
/** 내 상품: 저장된 기록(recordId) 또는 아직 저장 안 한 입력값(unitPrice) */
export interface Anchor extends ProductKey {
  recordId?: string;
  unitPrice?: UnitPrice;
}
export interface Filters {
  brands: Set<string>; // 브랜드 값 또는 NA
  origins: Set<string>; // 'domestic' | 'import' | 'import:<국가>' | 'na'
  bundles: Set<number>;
}
export interface ResultQuery {
  preset: Preset;
  anchor?: Anchor;
  filters: Filters;
  sort: SortKey;
  showHistory: boolean;
  now?: Date;
}
export interface Row {
  rec: PriceRecordView;
  unitPrice: UnitPrice;
  rank: number;
  isCheapest: boolean;
  isMine: boolean;
  isOld: boolean;
  history: PriceRecordView[]; // 같은 상품+판매처의 이전 기록, 날짜 오름차순
}
export interface Facet<K = string> {
  key: K;
  label: string;
  count: number;
}
export interface AnchorSummary {
  unitPrice: UnitPrice;
  rank: number;
  total: number;
  diffWon: number;
  diffPct: number;
}
export interface ResultView {
  rows: Row[];
  incomparable: Row[];
  cheapest: Row | null;
  facets: { brands: Facet[]; origins: Facet[]; bundles: Facet<number>[] };
  anchorSummary?: AnchorSummary;
  baseType: UnitType | null;
}

export const emptyFilters = (): Filters => ({ brands: new Set(), origins: new Set(), bundles: new Set() });
export const OLD_DAYS = 90;

function fieldKey(f: { kind: string; value?: unknown } | undefined, norm?: (v: never) => unknown): string {
  if (!f || f.kind === 'empty') return 'e';
  if (f.kind === 'na') return 'n';
  return 'v:' + JSON.stringify(norm ? norm(f.value as never) : f.value);
}
const amountNorm = (a: UnitAmount) => toBase(a.amount, a.unit);
const nameKey = (k: ProductKey) => fieldKey(k.productName) + '|' + fieldKey(k.brand);
const exactKey = (k: ProductKey) => nameKey(k) + '|' + fieldKey(k.unitAmount, amountNorm);

export function brandKey(r: PriceRecordView): string {
  return r.brand?.kind === 'value' ? r.brand.value : NA;
}
export function originKeys(o: Field<Origin> | undefined): string[] {
  if (!o || o.kind === 'na') return ['na'];
  if (o.value.type === 'domestic') return ['domestic'];
  return o.value.country ? ['import', `import:${o.value.country}`] : ['import'];
}
export function originLabel(key: string): string {
  if (key === 'domestic') return '국산';
  if (key === 'import') return '수입 전체';
  if (key === 'na') return '해당사항 없음';
  return `수입(${key.slice(7)})`;
}

/** 90일 넘은 기록 (요구 5.6) */
export function isOld(purchasedAt: string, now: Date = new Date()): boolean {
  const [y, m, d] = purchasedAt.split('-').map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (today - then) / 86_400_000 > OLD_DAYS;
}

const byRecentDesc = (a: PriceRecordView, b: PriceRecordView) =>
  b.purchasedAt.localeCompare(a.purchasedAt) || b.createdAt.localeCompare(a.createdAt);

function countFacet<K>(map: Map<K, Facet<K>>, key: K, label: string) {
  const f = map.get(key);
  if (f) f.count++;
  else map.set(key, { key, label, count: 1 });
}

// design.md: 프리셋 → 최신 기록만 → 필터 → 단위 타입 분리 → 정렬 → 순위
export function buildResult(records: PriceRecordView[], q: ResultQuery): ResultView {
  const now = q.now ?? new Date();
  const anchor = q.anchor;
  const anchorRec = anchor?.recordId ? records.find((r) => r.id === anchor.recordId) : undefined;
  const anchorKey: ProductKey | undefined = anchorRec ?? anchor;

  // 1. 프리셋 (요구 7)
  let list = records;
  if (anchorKey && q.preset === 'exact') {
    const k = exactKey(anchorKey);
    list = list.filter((r) => exactKey(r) === k);
  } else if (anchorKey && q.preset === 'sameProduct') {
    const k = nameKey(anchorKey);
    list = list.filter((r) => nameKey(r) === k);
  }

  // 2. 같은 상품+판매처는 최신 기록만 (요구 5.7)
  const groups = new Map<string, PriceRecordView[]>();
  for (const r of list) {
    const k = r.productId + '|' + r.storeId;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const entries: { rec: PriceRecordView; history: PriceRecordView[] }[] = [];
  for (const g of groups.values()) {
    g.sort(byRecentDesc);
    if (q.showHistory) for (const r of g) entries.push({ rec: r, history: [] });
    else entries.push({ rec: g[0], history: g.slice(1).reverse() });
  }

  // facets: 프리셋 적용 후, 필터 적용 전 (요구 6.2)
  const brands = new Map<string, Facet>();
  const origins = new Map<string, Facet>();
  const bundles = new Map<number, Facet<number>>();
  for (const { rec } of entries) {
    const b = brandKey(rec);
    countFacet(brands, b, b === NA ? '해당사항 없음' : b);
    for (const o of originKeys(rec.origin)) countFacet(origins, o, originLabel(o));
    countFacet(bundles, rec.bundleCount, `${rec.bundleCount}개`);
  }

  // 3. 필터: 필터끼리 AND, 필터 안은 OR (요구 6.4)
  const f = q.filters;
  const filtered = entries.filter(({ rec }) => {
    if (f.brands.size && !f.brands.has(brandKey(rec))) return false;
    if (f.origins.size && !originKeys(rec.origin).some((k) => f.origins.has(k))) return false;
    if (f.bundles.size && !f.bundles.has(rec.bundleCount)) return false;
    return true;
  });

  // 4. 단위 타입 분리 (요구 4.6, 5.12)
  const priced = filtered
    .map((e) => ({ ...e, up: unitPrice(e.rec) }))
    .filter((e): e is typeof e & { up: UnitPrice } => e.up !== null);
  const anchorUp = anchorRec ? unitPrice(anchorRec) : anchor?.unitPrice;
  let baseType: UnitType | null = anchorUp?.type ?? null;
  if (!baseType && priced.length) {
    const counts: Record<UnitType, number> = { g: 0, ml: 0, ea: 0 };
    for (const e of priced) counts[e.up.type]++;
    baseType = (['g', 'ml', 'ea'] as UnitType[]).reduce((a, b) => (counts[b] > counts[a] ? b : a));
  }
  const mk = (e: (typeof priced)[number]): Row => ({
    rec: e.rec,
    unitPrice: e.up,
    rank: 0,
    isCheapest: false,
    isMine: !!anchor?.recordId && e.rec.id === anchor.recordId,
    isOld: isOld(e.rec.purchasedAt, now),
    history: e.history,
  });
  const comparable = priced.filter((e) => e.up.type === baseType).map(mk);
  const incomparable = priced.filter((e) => e.up.type !== baseType).map(mk);

  // 5~6. 단위가격 순위 (같으면 최신 먼저), 표시 정렬 (요구 5.1, 5.8)
  comparable.sort((a, b) => a.unitPrice.value - b.unitPrice.value || byRecentDesc(a.rec, b.rec));
  comparable.forEach((r, i) => (r.rank = i + 1));
  const cheapest = comparable[0] ?? null;
  if (cheapest) cheapest.isCheapest = true;
  const rows = q.sort === 'recent' ? [...comparable].sort((a, b) => byRecentDesc(a.rec, b.rec)) : comparable;

  // 내 상품 요약 (요구 8.1)
  let anchorSummary: AnchorSummary | undefined;
  if (anchorUp && anchorUp.type === baseType) {
    const mine = anchor?.recordId ? comparable.find((r) => r.rec.id === anchor.recordId) : undefined;
    const rank = mine ? mine.rank : 1 + comparable.filter((r) => r.unitPrice.value < anchorUp.value).length;
    const total = mine ? comparable.length : comparable.length + 1;
    // 기존 최저가 = 내 상품을 뺀 나머지 중 최저. 음수면 그만큼 더 싸다.
    const others = comparable.filter((r) => r !== mine);
    const best = others.length ? others[0].unitPrice.value : anchorUp.value;
    const diffWon = anchorUp.value - best;
    anchorSummary = { unitPrice: anchorUp, rank, total, diffWon, diffPct: best > 0 ? (diffWon / best) * 100 : 0 };
  }

  return {
    rows,
    incomparable,
    cheapest,
    facets: {
      brands: [...brands.values()].sort((a, b) => b.count - a.count),
      origins: [...origins.values()],
      bundles: [...bundles.values()].sort((a, b) => a.key - b.key),
    },
    anchorSummary,
    baseType,
  };
}
