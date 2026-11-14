import type { InputUnit, UnitAmount, UnitType } from './types';

// 요구 4.3: kg→g, L→ml 환산
export function toBase(amount: number, unit: InputUnit): { value: number; type: UnitType } {
  switch (unit) {
    case 'kg':
      return { value: amount * 1000, type: 'g' };
    case 'L':
      return { value: amount * 1000, type: 'ml' };
    case 'g':
      return { value: amount, type: 'g' };
    case 'ml':
      return { value: amount, type: 'ml' };
    default:
      return { value: amount, type: 'ea' };
  }
}

export function formatAmount(a: UnitAmount): string {
  return `${a.amount}${a.unit === 'ea' ? '개' : a.unit}`;
}

export const INPUT_UNITS: InputUnit[] = ['g', 'kg', 'ml', 'L', 'ea'];
