import Dexie from 'dexie';
import type { Field, FieldState, PriceRecordView, RegisterDraft } from '../domain/types';
import { toBase } from '../domain/units';
import { db, newMeta, type Item, type Photo, type PriceRecord, type Product, type Store } from './db';
import type { ProcessedPhoto } from './image';

// 요구 2.3: empty → 필드 없음(미입력), na → {kind:'na'}
export function toField<T>(f: FieldState<T>): Field<T> | undefined {
  return f.kind === 'empty' ? undefined : f.kind === 'na' ? { kind: 'na' } : { kind: 'value', value: f.value };
}

function fk(f: Field<unknown> | undefined): string {
  return !f ? 'e' : f.kind === 'na' ? 'n' : JSON.stringify(f.value);
}

export function productKey(p: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'key'>): string {
  const ua = p.unitAmount?.kind === 'value' ? { kind: 'value' as const, value: toBase(p.unitAmount.value.amount, p.unitAmount.value.unit) } : p.unitAmount;
  return [p.itemId, fk(p.name), fk(p.brand), fk(ua), fk(p.origin), p.packUnit].join('|');
}

function now() {
  return new Date().toISOString();
}

async function upsertItem(name: string): Promise<Item> {
  const n = name.trim();
  const found = await db.items.where('name').equals(n).first();
  if (found) {
    await db.items.update(found.id, { updatedAt: now() });
    return found;
  }
  const item: Item = { ...newMeta(), name: n };
  await db.items.add(item);
  return item;
}

async function upsertStore(name: string, isOnline: boolean): Promise<Store> {
  const n = name.trim();
  const found = await db.stores.where('name').equals(n).first();
  if (found) {
    if (found.isOnline !== isOnline) await db.stores.update(found.id, { isOnline, updatedAt: now() });
    return { ...found, isOnline };
  }
  const store: Store = { ...newMeta(), name: n, isOnline };
  await db.stores.add(store);
  return store;
}

/** 같은 상품이면 기존 Product를 재사용한다. 원래 기록을 바꾸지 않도록 Product는 수정하지 않는다 (요구 10.5). */
async function findOrCreateProduct(itemId: string, d: RegisterDraft): Promise<Product> {
  const trim = (f: FieldState<string>): FieldState<string> =>
    f.kind === 'value' ? { kind: 'value', value: f.value.trim() } : f;
  const base = {
    itemId,
    name: toField(trim(d.productName)),
    brand: toField(trim(d.brand)),
    origin: toField(d.origin),
    packUnit: d.packUnit.trim(),
    unitAmount: toField(d.unitAmount),
  };
  for (const k of Object.keys(base) as (keyof typeof base)[]) if (base[k] === undefined) delete base[k];
  const key = productKey(base);
  const found = await db.products.where('key').equals(key).first();
  if (found) return found;
  const p: Product = { ...newMeta(), ...base, key };
  await db.products.add(p);
  return p;
}

async function addPhoto(photo: ProcessedPhoto): Promise<string> {
  const p: Photo = { ...newMeta(), ...photo };
  await db.photos.add(p);
  return p.id;
}

function recordFields(d: RegisterDraft) {
  return {
    bundleCount: d.bundleCount!,
    price: d.price!,
    shippingFee: d.storeIsOnline && d.shippingFee.kind === 'value' ? d.shippingFee.value : undefined,
    shippingFeeNA: d.storeIsOnline && d.shippingFee.kind === 'na' ? true : undefined,
    purchasedAt: d.purchasedAt,
    note: d.note.trim() || undefined,
  };
}

const TABLES = () => [db.items, db.products, db.records, db.stores, db.photos];

/** 다른 기록이 같은 사진을 쓰고 있으면 남긴다 (요구 3.9, design.md "이전 사진 불러오기") */
async function deletePhotoIfUnused(photoId: string): Promise<void> {
  const users = await db.records.where('photoId').equals(photoId).count();
  if (users === 0) await db.photos.delete(photoId);
}

/** 상품의 가장 최근 기록 사진 (요구 3.7). 사진이 지워졌으면 undefined (요구 3.10) */
export async function latestPhotoId(productId: string): Promise<string | undefined> {
  // [productId+purchasedAt] 인덱스로 가장 늦은 구매일만 읽는다. 같은 날이면 나중에 만든 기록.
  const range = db.records.where('[productId+purchasedAt]').between([productId, Dexie.minKey], [productId, Dexie.maxKey]);
  const last = await range.last();
  if (!last) return undefined;
  const sameDay = await db.records.where('[productId+purchasedAt]').equals([productId, last.purchasedAt]).toArray();
  sameDay.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const photoId = sameDay[0]?.photoId;
  return photoId && (await db.photos.get(photoId)) ? photoId : undefined;
}

/** 새 기록 저장. photo가 문자열이면 그 기존 사진을 같이 쓴다 (요구 3.8). 반환: 기록 id, 품목 id */
export async function saveRecord(d: RegisterDraft, photo: ProcessedPhoto | string): Promise<{ id: string; itemId: string }> {
  return db.transaction('rw', TABLES(), async () => {
    const item = await upsertItem(d.itemName);
    const store = await upsertStore(d.storeName, d.storeIsOnline);
    const product = await findOrCreateProduct(item.id, d);
    const photoId = typeof photo === 'string' ? photo : await addPhoto(photo);
    const rec: PriceRecord = { ...newMeta(), productId: product.id, storeId: store.id, photoId, ...recordFields(d) };
    await db.records.add(rec);
    return { id: rec.id, itemId: item.id };
  });
}

/** 기록 수정 (요구 12.1). 사진을 새로 고르면 바꾼다. */
export async function updateRecord(id: string, d: RegisterDraft, photo: ProcessedPhoto | null): Promise<{ id: string; itemId: string }> {
  return db.transaction('rw', TABLES(), async () => {
    const old = await db.records.get(id);
    if (!old) throw new Error('기록이 없어요');
    const item = await upsertItem(d.itemName);
    const store = await upsertStore(d.storeName, d.storeIsOnline);
    const product = await findOrCreateProduct(item.id, d);
    let photoId = old.photoId;
    if (photo) {
      photoId = await addPhoto(photo);
    }
    const next: PriceRecord = { ...old, productId: product.id, storeId: store.id, photoId, ...recordFields(d), updatedAt: now() };
    await db.records.put(next);
    if (photoId !== old.photoId) await deletePhotoIfUnused(old.photoId);
    return { id, itemId: item.id };
  });
}

export async function deleteRecord(id: string): Promise<void> {
  await db.transaction('rw', db.records, db.photos, async () => {
    const r = await db.records.get(id);
    if (!r) return;
    await db.records.delete(id);
    await deletePhotoIfUnused(r.photoId);
  });
}

function view(r: PriceRecord, p: Product, item: Item, s: Store): PriceRecordView {
  return {
    id: r.id,
    productId: p.id,
    storeId: s.id,
    itemId: item.id,
    itemName: item.name,
    productName: p.name,
    brand: p.brand,
    origin: p.origin,
    packUnit: p.packUnit,
    unitAmount: p.unitAmount,
    bundleCount: r.bundleCount,
    price: r.price,
    shippingFee: r.shippingFee,
    purchasedAt: r.purchasedAt,
    photoId: r.photoId,
    note: r.note,
    storeName: s.name,
    isOnline: s.isOnline,
    createdAt: r.createdAt,
  };
}

/** 품목의 모든 기록을 한 번에 읽는다 (필터는 메모리 계산, 요구 6.7) */
export async function listRecordViews(itemId: string): Promise<PriceRecordView[]> {
  const item = await db.items.get(itemId);
  if (!item) return [];
  const products = await db.products.where('itemId').equals(itemId).toArray();
  const pmap = new Map(products.map((p) => [p.id, p]));
  const records = await db.records.where('productId').anyOf([...pmap.keys()]).toArray();
  const stores = await db.stores.bulkGet([...new Set(records.map((r) => r.storeId))]);
  const smap = new Map(stores.filter((s): s is Store => !!s).map((s) => [s.id, s]));
  return records.flatMap((r) => {
    const p = pmap.get(r.productId);
    const s = smap.get(r.storeId);
    return p && s ? [view(r, p, item, s)] : [];
  });
}

export async function getRecordView(id: string): Promise<PriceRecordView | undefined> {
  const r = await db.records.get(id);
  if (!r) return undefined;
  const p = await db.products.get(r.productId);
  const s = await db.stores.get(r.storeId);
  const item = p && (await db.items.get(p.itemId));
  return p && s && item ? view(r, p, item, s) : undefined;
}

export async function recentRecords(limit = 10): Promise<PriceRecordView[]> {
  const recs = await db.records.orderBy('createdAt').reverse().limit(limit).toArray();
  const out: PriceRecordView[] = [];
  for (const r of recs) {
    const v = await getRecordView(r.id);
    if (v) out.push(v);
  }
  return out;
}

export const getItem = (id: string) => db.items.get(id);
export const findItemByName = (name: string) => db.items.where('name').equals(name.trim()).first();
export const getPhoto = (id: string) => db.photos.get(id);

const starts = (s: string, prefix: string) => s.toLowerCase().includes(prefix.trim().toLowerCase());

/** 품목 검색 (홈, 품목 자동완성 요구 3.5) */
export async function searchItems(prefix: string, limit = 8): Promise<Item[]> {
  const all = await db.items.orderBy('updatedAt').reverse().toArray();
  return all.filter((i) => starts(i.name, prefix)).slice(0, limit);
}

export async function searchStores(prefix: string, limit = 8): Promise<Store[]> {
  const all = await db.stores.toArray();
  return all.filter((s) => starts(s.name, prefix)).slice(0, limit);
}

/** 품명 자동완성 (요구 3.1). 최근 기록 1건을 대표로 돌려준다. 품명이 N/A면 품목명으로 찾는다 (요구 3.5). */
export async function searchProducts(prefix: string, opts: { byItem?: boolean } = {}, limit = 8): Promise<PriceRecordView[]> {
  const products = await db.products.toArray();
  const items = new Map((await db.items.toArray()).map((i) => [i.id, i]));
  const hits = products.filter((p) => {
    if (opts.byItem) return starts(items.get(p.itemId)?.name ?? '', prefix);
    return p.name?.kind === 'value' && starts(p.name.value, prefix);
  });
  const out: PriceRecordView[] = [];
  for (const p of hits) {
    const latest = (await db.records.where('productId').equals(p.id).toArray()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    if (!latest) continue;
    const v = await getRecordView(latest.id);
    if (v) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/** 모든 기록 보기 (자동완성 후보, 요구 16). shortcut: 매번 전체를 읽는다, 기록이 수만 건이 되면 인덱스 조회로 바꾼다 */
export async function listAllRecordViews(): Promise<PriceRecordView[]> {
  const [records, products, items, stores] = await Promise.all([db.records.toArray(), db.products.toArray(), db.items.toArray(), db.stores.toArray()]);
  const pmap = new Map(products.map((p) => [p.id, p]));
  const imap = new Map(items.map((i) => [i.id, i]));
  const smap = new Map(stores.map((s) => [s.id, s]));
  return records.flatMap((r) => {
    const p = pmap.get(r.productId);
    const item = p && imap.get(p.itemId);
    const s = smap.get(r.storeId);
    return p && item && s ? [view(r, p, item, s)] : [];
  });
}
