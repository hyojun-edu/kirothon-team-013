import type { Field, FieldState, PriceRecordView, RegisterDraft } from './types';
import { emptyDraft } from './types';

export type PrefillMode = 'search' | 'clone' | 'refresh';

function copyField<T>(f: Field<T> | undefined): FieldState<T> {
  if (!f) return { kind: 'empty' };
  if (f.kind === 'na') return { kind: 'na' };
  return { kind: 'value', value: structuredClone(f.value) };
}

// 요구 10.2~10.5, 11.4: 상품 정보는 채우고 가격·사진은 비운다. 원본은 건드리지 않는다.
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
