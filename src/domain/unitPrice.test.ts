import { formatUnitPrice, unitPrice } from './unitPrice';

const v = (amount: number, unit: 'g' | 'kg' | 'ml' | 'L' | 'ea') =>
  ({ kind: 'value', value: { amount, unit } }) as const;

describe('unitPrice (요구 4)', () => {
  it('요구 4.4: 300g×2 3,480원은 580원/100g, 400g×1 2,900원은 725원/100g', () => {
    const a = unitPrice({ price: 3480, bundleCount: 2, unitAmount: v(300, 'g') })!;
    const b = unitPrice({ price: 2900, bundleCount: 1, unitAmount: v(400, 'g') })!;
    expect(a.value).toBeCloseTo(580);
    expect(b.value).toBeCloseTo(725);
    expect(formatUnitPrice(a)).toBe('580원/100g');
    expect(formatUnitPrice(b)).toBe('725원/100g');
    expect(a.value).toBeLessThan(b.value);
  });
  it('요구 4.2: 배송비를 더해서 계산한다', () => {
    const u = unitPrice({ price: 9000, shippingFee: 3000, bundleCount: 2, unitAmount: v(1, 'kg') })!;
    expect(u).toEqual({ value: 600, per: 100, type: 'g' });
  });
  it('요구 4.3: L는 ml로 환산해 100ml 기준', () => {
    const u = unitPrice({ price: 2000, bundleCount: 1, unitAmount: v(1, 'L') })!;
    expect(u).toEqual({ value: 200, per: 100, type: 'ml' });
    expect(formatUnitPrice(u)).toBe('200원/100ml');
  });
  it('요구 4.5: 단위용량이 N/A이면 번들 기준 개당 가격', () => {
    expect(unitPrice({ price: 3000, bundleCount: 3, unitAmount: { kind: 'na' } })).toEqual({
      value: 1000,
      per: 1,
      type: 'ea',
    });
    expect(formatUnitPrice(unitPrice({ price: 3000, bundleCount: 3 })!)).toBe('1,000원/1개');
  });
  it('개 단위 용량은 1개 기준', () => {
    expect(unitPrice({ price: 6000, bundleCount: 2, unitAmount: v(10, 'ea') })).toEqual({
      value: 300,
      per: 1,
      type: 'ea',
    });
  });
  it('잘못된 값은 null', () => {
    expect(unitPrice({ price: 1000, bundleCount: 0 })).toBeNull();
    expect(unitPrice({ price: 1000, bundleCount: 1, unitAmount: v(0, 'g') })).toBeNull();
  });
});
