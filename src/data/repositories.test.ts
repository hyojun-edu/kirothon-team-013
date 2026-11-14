import { emptyDraft, type RegisterDraft } from '../domain/types';
import { db, OWNER_ID } from './db';
import {
  deleteRecord,
  getRecordView,
  latestPhotoId,
  listRecordViews,
  recentRecords,
  saveRecord,
  searchItems,
  searchProducts,
  searchStores,
  updateRecord,
} from './repositories';

const photo = { blob: new Blob(['a']), thumb: new Blob(['t']), width: 10, height: 10 };
function draft(p: Partial<RegisterDraft> = {}): RegisterDraft {
  return {
    ...emptyDraft(new Date(2026, 10, 14)),
    itemName: '두부',
    productName: { kind: 'value', value: '국산콩 두부' },
    brand: { kind: 'value', value: '풀무원' },
    unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
    packUnit: '팩',
    bundleCount: 2,
    price: 3480,
    storeName: '이마트 구로점',
    ...p,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('저장소 (작업 3)', () => {
  it('요구 13.6: UUID, 생성/수정 시각, ownerId=local', async () => {
    const { id } = await saveRecord(draft(), photo);
    const r = (await db.records.get(id))!;
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.ownerId).toBe(OWNER_ID);
    expect(r.createdAt).toBeTruthy();
    expect(r.updatedAt).toBeTruthy();
    for (const t of [db.items, db.products, db.stores, db.photos]) {
      const row = (await t.toArray())[0] as { ownerId: string; createdAt: string };
      expect(row.ownerId).toBe('local');
      expect(row.createdAt).toBeTruthy();
    }
  });

  it('요구 2.3: 해당사항 없음과 미입력을 다르게 저장한다', async () => {
    await saveRecord(draft({ productName: { kind: 'na' }, brand: { kind: 'empty' } }), photo);
    const p = (await db.products.toArray())[0];
    expect(p.name).toEqual({ kind: 'na' });
    expect('brand' in p).toBe(false);
  });

  it('요구 4.7: 단위가격은 저장하지 않는다', async () => {
    const { id } = await saveRecord(draft(), photo);
    const r = (await db.records.get(id)) as unknown as Record<string, unknown>;
    expect(Object.keys(r).some((k) => k.toLowerCase().includes('unitprice'))).toBe(false);
  });

  it('같은 품목, 판매처, 상품은 재사용하고 기록만 쌓는다', async () => {
    const a = await saveRecord(draft(), photo);
    const b = await saveRecord(draft({ price: 3000 }), photo);
    expect(a.itemId).toBe(b.itemId);
    expect(await db.items.count()).toBe(1);
    expect(await db.products.count()).toBe(1);
    expect(await db.stores.count()).toBe(1);
    expect(await db.records.count()).toBe(2);
    const views = await listRecordViews(a.itemId);
    expect(views).toHaveLength(2);
    expect(views[0].itemName).toBe('두부');
  });

  it('배송비는 온라인 판매처에서만 저장한다 (요구 1.5, 1.6)', async () => {
    const off = await saveRecord(draft({ shippingFee: { kind: 'value', value: 3000 } }), photo);
    expect((await getRecordView(off.id))!.shippingFee).toBeUndefined();
    const on = await saveRecord(draft({ storeName: '쿠팡', storeIsOnline: true, shippingFee: { kind: 'value', value: 3000 } }), photo);
    const v = (await getRecordView(on.id))!;
    expect(v.shippingFee).toBe(3000);
    expect(v.isOnline).toBe(true);
  });

  it('수정과 삭제 (요구 12)', async () => {
    const { id } = await saveRecord(draft(), photo);
    await updateRecord(id, draft({ price: 1000 }), null);
    expect((await getRecordView(id))!.price).toBe(1000);
    await deleteRecord(id);
    expect(await getRecordView(id)).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
  });

  it('요구 10.5: 복제 후 값을 바꿔 저장해도 원래 기록은 그대로', async () => {
    const a = await saveRecord(draft(), photo);
    const before = await getRecordView(a.id);
    await saveRecord(draft({ origin: { kind: 'value', value: { type: 'import', country: '중국' } }, bundleCount: 6 }), photo);
    expect(await getRecordView(a.id)).toEqual(before);
  });

  it('자동완성: 품명, 품목, 판매처 (요구 3.1, 3.5, 3.6)', async () => {
    await saveRecord(draft(), photo);
    await saveRecord(draft({ itemName: '양파', productName: { kind: 'na' }, storeName: '시장' }), photo);
    expect((await searchProducts('국산'))[0].bundleCount).toBe(2);
    expect((await searchProducts('양', { byItem: true }))[0].itemName).toBe('양파');
    expect((await searchItems('두')).map((i) => i.name)).toEqual(['두부']);
    expect((await searchStores('이마트')).map((s) => s.name)).toEqual(['이마트 구로점']);
    expect(await recentRecords()).toHaveLength(2);
  });

  describe('이전 사진 불러오기 (작업 11.1, 요구 3.7~3.10)', () => {
    it('구매일이 가장 늦은 기록의 사진을 돌려준다', async () => {
      const a = await saveRecord(draft({ purchasedAt: '2026-11-01' }), { ...photo, blob: new Blob(['new']) });
      await saveRecord(draft({ purchasedAt: '2026-09-01', storeName: '롯데' }), photo);
      const v = (await getRecordView(a.id))!;
      expect(await latestPhotoId(v.productId)).toBe(v.photoId);
    });

    it('기록이 없거나 사진이 지워졌으면 undefined', async () => {
      expect(await latestPhotoId('none')).toBeUndefined();
      const a = await saveRecord(draft(), photo);
      const v = (await getRecordView(a.id))!;
      await db.photos.delete(v.photoId);
      expect(await latestPhotoId(v.productId)).toBeUndefined();
    });

    it('기존 photoId로 저장하면 새 Photo를 만들지 않고 같은 사진을 가리킨다', async () => {
      const a = await saveRecord(draft(), photo);
      const pid = (await getRecordView(a.id))!.photoId;
      const b = await saveRecord(draft({ price: 3000 }), pid);
      expect((await getRecordView(b.id))!.photoId).toBe(pid);
      expect(await db.photos.count()).toBe(1);
    });

    it('다른 기록이 쓰는 사진은 삭제·수정해도 남는다', async () => {
      const a = await saveRecord(draft(), photo);
      const pid = (await getRecordView(a.id))!.photoId;
      const b = await saveRecord(draft({ price: 3000 }), pid);
      await updateRecord(b.id, draft({ price: 3000 }), { ...photo, blob: new Blob(['n']) });
      expect(await db.photos.get(pid)).toBeDefined();
      const c = await saveRecord(draft({ price: 2000 }), pid);
      await deleteRecord(a.id);
      expect(await db.photos.get(pid)).toBeDefined();
      await deleteRecord(c.id);
      expect(await db.photos.get(pid)).toBeUndefined();
      expect(await db.photos.count()).toBe(1); // b의 새 사진
    });
  });
});
