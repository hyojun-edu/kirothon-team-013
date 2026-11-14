import { prefill } from './prefill';
import type { PriceRecordView } from './types';

const rec: PriceRecordView = {
  id: 'r1',
  productId: 'p1',
  storeId: 's1',
  itemId: 'i1',
  itemName: '두부',
  productName: { kind: 'value', value: '국산콩 두부' },
  brand: { kind: 'value', value: '풀무원' },
  origin: { kind: 'value', value: { type: 'domestic' } },
  packUnit: '팩',
  unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
  bundleCount: 2,
  price: 3480,
  shippingFee: 3000,
  purchasedAt: '2026-01-01',
  photoId: 'ph1',
  note: '메모',
  storeName: '쿠팡',
  isOnline: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const now = new Date(2026, 10, 14);

describe('prefill (요구 10, 11)', () => {
  for (const mode of ['search', 'clone'] as const) {
    it(`${mode}: 상품 정보 7개는 채우고 가격·판매처·배송비·사진·메모는 비운다, 날짜는 오늘`, () => {
      const d = prefill(rec, mode, now);
      expect(d.productName).toEqual({ kind: 'value', value: '국산콩 두부' });
      expect(d.itemName).toBe('두부');
      expect(d.origin).toEqual({ kind: 'value', value: { type: 'domestic' } });
      expect(d.brand).toEqual({ kind: 'value', value: '풀무원' });
      expect(d.packUnit).toBe('팩');
      expect(d.unitAmount).toEqual({ kind: 'value', value: { amount: 300, unit: 'g' } });
      expect(d.bundleCount).toBe(2);
      expect(d.price).toBeNull();
      expect(d.storeName).toBe('');
      expect(d.shippingFee).toEqual({ kind: 'empty' });
      expect(d.photo).toBeNull();
      expect(d.photoId).toBeUndefined();
      expect(d.note).toBe('');
      expect(d.purchasedAt).toBe('2026-11-14');
    });
  }
  it('refresh: 판매처와 배송비까지 채우고 가격·사진·메모만 비운다 (요구 11.4)', () => {
    const d = prefill(rec, 'refresh', now);
    expect(d.storeName).toBe('쿠팡');
    expect(d.storeIsOnline).toBe(true);
    expect(d.shippingFee).toEqual({ kind: 'value', value: 3000 });
    expect(d.price).toBeNull();
    expect(d.photo).toBeNull();
    expect(d.note).toBe('');
  });
  it('N/A 필드는 N/A로 복사한다', () => {
    const d = prefill({ ...rec, productName: { kind: 'na' }, brand: undefined }, 'clone', now);
    expect(d.productName).toEqual({ kind: 'na' });
    expect(d.brand).toEqual({ kind: 'empty' });
  });
  it('요구 10.5: 채운 값을 고쳐도 원래 기록은 바뀌지 않는다', () => {
    const before = structuredClone(rec);
    const d = prefill(rec, 'refresh', now);
    if (d.unitAmount.kind === 'value') d.unitAmount.value.amount = 999;
    if (d.origin.kind === 'value') (d.origin.value as { type: string }).type = 'import';
    d.bundleCount = 6;
    expect(rec).toEqual(before);
  });
});
