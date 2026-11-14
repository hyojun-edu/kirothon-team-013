import type { RegisterDraft } from '../../domain/types';

export type Errors = Partial<Record<'photo' | 'itemName' | 'packUnit' | 'bundleCount' | 'price' | 'storeName' | 'purchasedAt' | 'unitAmount' | 'shippingFee' | 'productName' | 'brand', string>>;

const posInt = (n: number | null) => n !== null && Number.isInteger(n) && n > 0;

// 요구 1.1: 필수 7개 (사진, 품목, 포장단위, 번들묶음, 가격, 판매처, 날짜). 그 외는 형식만 확인.
export function validateDraft(d: RegisterDraft, hasPhoto: boolean): Errors {
  const e: Errors = {};
  if (!hasPhoto) e.photo = '사진이 있어야 저장할 수 있어요';
  if (!d.itemName.trim()) e.itemName = '품목을 입력해 주세요';
  if (!d.packUnit.trim()) e.packUnit = '포장단위를 입력해 주세요';
  if (!posInt(d.bundleCount)) e.bundleCount = '1 이상의 정수를 입력해 주세요';
  if (!posInt(d.price)) e.price = '0보다 큰 금액(원)을 입력해 주세요';
  if (!d.storeName.trim()) e.storeName = '판매처를 입력해 주세요';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.purchasedAt)) e.purchasedAt = '날짜를 입력해 주세요';
  if (d.unitAmount.kind === 'value' && !(d.unitAmount.value.amount > 0)) e.unitAmount = '0보다 큰 숫자를 입력해 주세요';
  if (d.storeIsOnline && d.shippingFee.kind === 'value' && !(d.shippingFee.value >= 0)) e.shippingFee = '0 이상의 금액을 입력해 주세요';
  return e;
}
