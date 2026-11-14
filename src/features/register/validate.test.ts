import { emptyDraft } from '../../domain/types';
import { validateDraft } from './validate';

const ok = () => ({ ...emptyDraft(), itemName: '두부', packUnit: '팩', bundleCount: 1, price: 1000, storeName: '이마트' });

describe('validateDraft (요구 1.1, 1.2)', () => {
  it('필수 7개가 있으면 오류 없음', () => {
    expect(validateDraft(ok(), true)).toEqual({});
  });
  it('사진이 없으면 저장 불가', () => {
    expect(validateDraft(ok(), false).photo).toBe('사진이 있어야 저장할 수 있어요');
  });
  it('필수 항목이 비면 각각 오류', () => {
    const e = validateDraft({ ...emptyDraft(), packUnit: '', bundleCount: null, purchasedAt: '' }, false);
    expect(Object.keys(e).sort()).toEqual(['bundleCount', 'itemName', 'packUnit', 'photo', 'price', 'purchasedAt', 'storeName'].sort());
  });
  it('0 이하이거나 숫자가 아니면 오류', () => {
    expect(validateDraft({ ...ok(), price: 0 }, true).price).toBeTruthy();
    expect(validateDraft({ ...ok(), bundleCount: 1.5 }, true).bundleCount).toBeTruthy();
    expect(validateDraft({ ...ok(), unitAmount: { kind: 'value', value: { amount: 0, unit: 'g' } } }, true).unitAmount).toBeTruthy();
  });
  it('선택 항목은 N/A여도 된다 (요구 2.2)', () => {
    const d = { ...ok(), productName: { kind: 'na' as const }, brand: { kind: 'na' as const }, origin: { kind: 'na' as const }, unitAmount: { kind: 'na' as const } };
    expect(validateDraft(d, true)).toEqual({});
  });
});
