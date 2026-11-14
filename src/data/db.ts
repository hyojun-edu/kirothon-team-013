import Dexie, { type EntityTable } from 'dexie';
import type { Field, Origin, UnitAmount } from '../domain/types';

// design.md "데이터 모델". 요구 13.6: 모든 기록에 UUID, 생성/수정 시각, 소유자.
export const OWNER_ID = 'local';

interface Meta {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Item extends Meta {
  name: string;
}
export interface Product extends Meta {
  itemId: string;
  name?: Field<string>; // 없으면 미입력, {kind:'na'}면 해당사항 없음 (요구 2.3)
  brand?: Field<string>;
  origin?: Field<Origin>;
  packUnit: string;
  unitAmount?: Field<UnitAmount>;
  key: string; // 같은 상품 판단용: 품목+품명+브랜드+단위용량
}
export interface PriceRecord extends Meta {
  productId: string;
  storeId: string;
  bundleCount: number;
  price: number;
  shippingFee?: number;
  shippingFeeNA?: boolean;
  purchasedAt: string;
  photoId: string;
  note?: string;
}
export interface Store extends Meta {
  name: string;
  chain?: string;
  branch?: string;
  isOnline: boolean;
}
export interface Photo extends Meta {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export class ShoppingDB extends Dexie {
  items!: EntityTable<Item, 'id'>;
  products!: EntityTable<Product, 'id'>;
  records!: EntityTable<PriceRecord, 'id'>;
  stores!: EntityTable<Store, 'id'>;
  photos!: EntityTable<Photo, 'id'>;

  constructor(name = 'shopping-helper') {
    super(name);
    this.version(1).stores({
      items: 'id, &name, updatedAt',
      products: 'id, itemId, name.value, key',
      records: 'id, productId, storeId, [storeId+productId], purchasedAt, createdAt',
      stores: 'id, &name',
      photos: 'id',
    });
    // design.md "데이터 모델" 인덱스 (version 2, 기존 데이터 이전 없음)
    // photoId: 같은 사진을 쓰는 다른 기록 확인. [productId+purchasedAt]: 상품의 최근 기록.
    this.version(2).stores({
      records: 'id, productId, storeId, [storeId+productId], purchasedAt, createdAt, photoId, [productId+purchasedAt]',
    });
  }
}

export const db = new ShoppingDB();

export function newMeta(now = new Date()): Meta {
  const t = now.toISOString();
  return { id: crypto.randomUUID(), ownerId: OWNER_ID, createdAt: t, updatedAt: t };
}
