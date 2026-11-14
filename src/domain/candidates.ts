import type { Origin, PriceRecordView, UnitAmount } from './types';
import { unitPrice, type UnitPrice } from './unitPrice';

/** 자동완성 후보: 상품 + 번들묶음 조합의 가장 최근 기록 (요구 16.4) */
export interface Candidate {
  key: string;
  productId: string;
  bundleCount: number;
  record: PriceRecordView;
  productName: string | null; // 품명이 N/A나 없음이면 null, 화면은 itemName을 쓴다
  itemName: string;
  brand: string | null;
  origin: Origin | null;
  packUnit: string;
  unitAmount: UnitAmount | null;
  price: number;
  unitPrice: UnitPrice | null;
  storeName: string;
  isOnline: boolean;
  purchasedAt: string;
  recordCount: number;
  photoId?: string;
}

const norm = (s: string) => s.toLowerCase();
const val = <T,>(f: { kind: string; value?: T } | undefined): T | null => (f && f.kind === 'value' ? (f.value as T) : null);

/** 0 = 불일치. 3 품명 앞부분 > 2 품명 안 > 1 품목/브랜드 (design.md) */
function score(c: Candidate, text: string, tokens: string[]): number {
  const name = norm(c.productName ?? c.itemName);
  const item = norm(c.itemName);
  const brand = norm(c.brand ?? '');
  if (!tokens.every((t) => name.includes(t) || item.includes(t) || brand.includes(t))) return 0;
  if (name.startsWith(text)) return 3;
  if (tokens.every((t) => name.includes(t))) return 2;
  return 1;
}

// 요구 16.4, 16.5: 묶고, 일치하는 것만, 점수 → 최근 날짜 → 기록 수 순으로 limit개
export function findCandidates(records: PriceRecordView[], text: string, limit = 8): { items: Candidate[]; more: number } {
  const q = norm(text.trim());
  if (!q) return { items: [], more: 0 };
  const tokens = q.split(/\s+/);
  const groups = new Map<string, { latest: PriceRecordView; count: number }>();
  for (const r of records) {
    const k = `${r.productId}|${r.bundleCount}`;
    const g = groups.get(k);
    if (!g) groups.set(k, { latest: r, count: 1 });
    else {
      g.count++;
      if (r.purchasedAt > g.latest.purchasedAt || (r.purchasedAt === g.latest.purchasedAt && r.createdAt > g.latest.createdAt)) g.latest = r;
    }
  }
  const scored: { c: Candidate; s: number }[] = [];
  for (const [key, { latest: r, count }] of groups) {
    const c: Candidate = {
      key,
      productId: r.productId,
      bundleCount: r.bundleCount,
      record: r,
      productName: val(r.productName),
      itemName: r.itemName,
      brand: val(r.brand),
      origin: val(r.origin),
      packUnit: r.packUnit,
      unitAmount: val(r.unitAmount),
      price: r.price,
      unitPrice: unitPrice(r),
      storeName: r.storeName,
      isOnline: r.isOnline,
      purchasedAt: r.purchasedAt,
      recordCount: count,
      photoId: r.photoId || undefined,
    };
    const s = score(c, q, tokens);
    if (s > 0) scored.push({ c, s });
  }
  scored.sort((a, b) => b.s - a.s || b.c.purchasedAt.localeCompare(a.c.purchasedAt) || b.c.recordCount - a.c.recordCount);
  return { items: scored.slice(0, limit).map((x) => x.c), more: Math.max(0, scored.length - limit) };
}

/** "오늘", "3일 전" (요구 16.3 날짜) */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전`;
}
