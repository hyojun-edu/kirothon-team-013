import Dexie from 'dexie';
import { ShoppingDB } from './db';

// design.md "데이터 모델" 인덱스, questions.md 1·2번 답 (Dexie version 2, 데이터 이전 없음)
describe('저장 구조 version 2', () => {
  it('records에 photoId와 [productId+purchasedAt] 인덱스가 있다', async () => {
    const d = new ShoppingDB('schema-v2-test');
    await d.open();
    const names = d.records.schema.indexes.map((i) => i.name);
    expect(names).toContain('photoId');
    expect(names).toContain('[productId+purchasedAt]');
    expect(d.verno).toBe(2);
    d.close();
    await Dexie.delete('schema-v2-test');
  });

  it('version 1 데이터가 version 2로 올라가도 그대로 남고 새 인덱스로 찾힌다', async () => {
    const name = 'upgrade-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({
      items: 'id, &name, updatedAt',
      products: 'id, itemId, name.value, key',
      records: 'id, productId, storeId, [storeId+productId], purchasedAt, createdAt',
      stores: 'id, &name',
      photos: 'id',
    });
    await v1.table('records').add({ id: 'r1', productId: 'p1', storeId: 's1', purchasedAt: '2026-11-01', createdAt: 'x', photoId: 'ph1' });
    v1.close();

    const v2 = new ShoppingDB(name);
    await v2.open();
    expect(await v2.records.count()).toBe(1);
    expect(await v2.records.where('photoId').equals('ph1').count()).toBe(1);
    expect(await v2.records.where('[productId+purchasedAt]').equals(['p1', '2026-11-01']).count()).toBe(1);
    v2.close();
    await Dexie.delete(name);
  });
});
