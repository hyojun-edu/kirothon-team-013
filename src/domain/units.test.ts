import { formatAmount, toBase } from './units';

describe('toBase (요구 4.3)', () => {
  it('kg는 g로, L는 ml로 환산한다', () => {
    expect(toBase(1.5, 'kg')).toEqual({ value: 1500, type: 'g' });
    expect(toBase(2, 'L')).toEqual({ value: 2000, type: 'ml' });
  });
  it('g, ml, ea는 그대로 둔다', () => {
    expect(toBase(300, 'g')).toEqual({ value: 300, type: 'g' });
    expect(toBase(500, 'ml')).toEqual({ value: 500, type: 'ml' });
    expect(toBase(10, 'ea')).toEqual({ value: 10, type: 'ea' });
  });
  it('용량을 글자로 보여준다', () => {
    expect(formatAmount({ amount: 300, unit: 'g' })).toBe('300g');
    expect(formatAmount({ amount: 10, unit: 'ea' })).toBe('10개');
  });
});
