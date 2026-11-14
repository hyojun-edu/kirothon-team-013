import type { Field, FieldState, UnitAmount } from './types';
import { formatAmount } from './units';

export interface SearchProduct {
  itemName: string;
  productName?: Field<string> | FieldState<string>;
  brand?: Field<string> | FieldState<string>;
  unitAmount?: Field<UnitAmount> | FieldState<UnitAmount>;
}

// 요구 9.3, 11.3: 브랜드 + 품명(없으면 품목) + 단위용량 (+ 판매처) + "가격"
export function buildSearchQuery(p: SearchProduct, store?: string): string {
  const parts: string[] = [];
  if (p.brand?.kind === 'value' && p.brand.value.trim()) parts.push(p.brand.value.trim());
  const name = p.productName?.kind === 'value' && p.productName.value.trim() ? p.productName.value.trim() : p.itemName.trim();
  if (name) parts.push(name);
  if (p.unitAmount?.kind === 'value') parts.push(formatAmount(p.unitAmount.value));
  if (store && store.trim()) parts.push(store.trim());
  parts.push('가격');
  return parts.join(' ');
}

// 요구 9.2, 9.5: 쇼핑몰이 아니라 구글 검색 결과
export function googleUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
