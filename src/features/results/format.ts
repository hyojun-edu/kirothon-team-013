import type { PriceRecordView } from '../../domain/types';
import { formatAmount } from '../../domain/units';
import { originKeys, originLabel } from '../../domain/compare';

export const fmtDate = (iso: string) => iso.replaceAll('-', '.');
export const amountText = (r: PriceRecordView) =>
  r.unitAmount?.kind === 'value' ? `${formatAmount(r.unitAmount.value)}×${r.bundleCount}` : `×${r.bundleCount}`;
export const nameText = (r: PriceRecordView) => (r.productName?.kind === 'value' ? r.productName.value : r.itemName);
export const brandText = (r: PriceRecordView) => (r.brand?.kind === 'value' ? r.brand.value : '');
export function originText(r: PriceRecordView): string {
  if (!r.origin || r.origin.kind === 'na') return '';
  const keys = originKeys(r.origin);
  return keys.length > 1 ? originLabel(keys[1]) : r.origin.value.type === 'domestic' ? '국산' : '수입';
}
