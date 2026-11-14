import type { PriceRecordView, UnitAmount, UnitType } from './types';
import { toBase } from './units';

export interface UnitPrice {
  value: number; // 원 / per 기준
  per: 100 | 1;
  type: UnitType;
}

interface PriceInput {
  price: number;
  shippingFee?: number;
  bundleCount: number;
  unitAmount?: { kind: 'value'; value: UnitAmount } | { kind: 'na' } | { kind: 'empty' };
}

// 요구 4.1, 4.2, 4.5: (가격 + 배송비) ÷ (단위용량 × 번들묶음), 100g/100ml/1개 기준
export function unitPrice(rec: PriceInput | PriceRecordView): UnitPrice | null {
  if (!(rec.price >= 0) || !(rec.bundleCount > 0)) return null;
  const total = rec.price + (rec.shippingFee ?? 0);
  const ua = rec.unitAmount;
  if (!ua || ua.kind !== 'value') {
    return { value: total / rec.bundleCount, per: 1, type: 'ea' };
  }
  const base = toBase(ua.value.amount, ua.value.unit);
  if (!(base.value > 0)) return null;
  const totalAmount = base.value * rec.bundleCount;
  const per = base.type === 'ea' ? 1 : 100;
  return { value: (total / totalAmount) * per, per, type: base.type };
}

const won = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

export function formatWon(n: number): string {
  return `${won.format(Math.round(n))}원`;
}

export function formatUnitPrice(u: UnitPrice): string {
  const label = u.type === 'ea' ? '1개' : `100${u.type}`;
  return `${formatWon(u.value)}/${label}`;
}
