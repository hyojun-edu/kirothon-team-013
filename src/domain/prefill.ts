import type { Field, FieldState, PriceRecordView, RegisterDraft } from './types';
import { emptyDraft } from './types';

export type PrefillMode = 'search' | 'clone' | 'refresh';

function copyField<T>(f: Field<T> | undefined): FieldState<T> {
  if (!f) return { kind: 'empty' };
  if (f.kind === 'na') return { kind: 'na' };
  return { kind: 'value', value: structuredClone(f.value) };
}

// 요구 10.2~10.5, 11.4, 3.11: 상품 정보는 채우고 가격·사진은 비운다 (이전 사진은 자동완성 경로만). 원본은 건드리지 않는다.
export function prefill(rec: PriceRecordView, mode: PrefillMode, now: Date = new Date()): RegisterDraft {
  const d = emptyDraft(now);
  d.productName = copyField(rec.productName);
  d.itemName = rec.itemName;
  d.origin = copyField(rec.origin);
  d.brand = copyField(rec.brand);
  d.packUnit = rec.packUnit;
  d.unitAmount = copyField(rec.unitAmount);
  d.bundleCount = rec.bundleCount;
  if (mode === 'refresh') {
    d.storeName = rec.storeName;
    d.storeIsOnline = rec.isOnline;
    d.shippingFee = rec.shippingFee !== undefined ? { kind: 'value', value: rec.shippingFee } : { kind: 'empty' };
  }
  return d;
}

/** 아직 저장 안 한 내 상품(빠른 비교, 저장 없이 비교만)에서 "온라인 가격 등록"을 열 때.
 *  search 모드와 같은 규칙: 상품 정보만 채우고 가격·판매처·배송비·사진·메모는 비운다 (요구 10.2, 10.3). */
export type DraftSource = Partial<Omit<RegisterDraft, 'productName' | 'brand' | 'unitAmount'>> & {
  itemName: string;
  productName?: FieldState<string> | Field<string>;
  brand?: FieldState<string> | Field<string>;
  unitAmount?: RegisterDraft['unitAmount'] | Field<NonNullable<Extract<RegisterDraft['unitAmount'], { kind: 'value' }>['value']>>;
};
export function prefillFromDraft(src: DraftSource, now: Date = new Date()): RegisterDraft {
  const d = emptyDraft(now);
  d.itemName = src.itemName;
  if (src.productName) d.productName = structuredClone(src.productName);
  if (src.origin) d.origin = structuredClone(src.origin);
  if (src.brand) d.brand = structuredClone(src.brand);
  if (src.packUnit) d.packUnit = src.packUnit;
  if (src.unitAmount) d.unitAmount = structuredClone(src.unitAmount);
  if (src.bundleCount != null) d.bundleCount = src.bundleCount;
  return d;
}
