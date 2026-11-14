// 도메인 공통 타입 (design.md "데이터 모델")
export type UnitType = 'g' | 'ml' | 'ea';
export type InputUnit = 'g' | 'kg' | 'ml' | 'L' | 'ea';

/** 저장되는 선택 필드. 미입력은 필드 자체가 없다(undefined). 요구 2.3 */
export type Field<T> = { kind: 'value'; value: T } | { kind: 'na' };
/** 입력 화면 상태. empty = 미입력 */
export type FieldState<T> = Field<T> | { kind: 'empty' };

export type Origin = { type: 'domestic' } | { type: 'import'; country?: string };
export interface UnitAmount {
  amount: number;
  unit: InputUnit;
}

/** 화면과 비교 로직이 쓰는 평평한 기록 보기 (기록 + 상품 + 품목 + 판매처) */
export interface PriceRecordView {
  id: string;
  productId: string;
  storeId: string;
  itemId: string;
  itemName: string;
  productName?: Field<string>;
  brand?: Field<string>;
  origin?: Field<Origin>;
  packUnit: string;
  unitAmount?: Field<UnitAmount>;
  bundleCount: number;
  price: number;
  shippingFee?: number;
  purchasedAt: string; // YYYY-MM-DD
  photoId: string;
  note?: string;
  storeName: string;
  isOnline: boolean;
  createdAt: string;
}

/** 등록 화면 사진 상태 (요구 3.7~3.10). reused = 기존 사진을 같이 쓴다, new = 새로 고른 사진 */
export type DraftPhoto =
  | { kind: 'reused'; photoId: string }
  | { kind: 'new'; blob: Blob; thumb: Blob; width: number; height: number }
  | { kind: 'empty' };

/** 등록 화면 입력값 */
export interface RegisterDraft {
  productName: FieldState<string>;
  itemName: string;
  origin: FieldState<Origin>;
  brand: FieldState<string>;
  packUnit: string;
  unitAmount: FieldState<UnitAmount>;
  bundleCount: number | null;
  price: number | null;
  storeName: string;
  storeIsOnline: boolean;
  shippingFee: FieldState<number>;
  purchasedAt: string;
  photo: DraftPhoto;
  note: string;
}

export function fieldValue<T>(f: Field<T> | FieldState<T> | undefined): T | undefined {
  return f && f.kind === 'value' ? f.value : undefined;
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function emptyDraft(now: Date = new Date()): RegisterDraft {
  return {
    productName: { kind: 'empty' },
    itemName: '',
    origin: { kind: 'empty' },
    brand: { kind: 'empty' },
    packUnit: '개',
    unitAmount: { kind: 'empty' },
    bundleCount: 1,
    price: null,
    storeName: '',
    storeIsOnline: false,
    shippingFee: { kind: 'empty' },
    purchasedAt: todayISO(now),
    photo: { kind: 'empty' },
    note: '',
  };
}
