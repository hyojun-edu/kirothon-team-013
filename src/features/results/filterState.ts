import { emptyFilters, type Filters, type Preset, type SortKey } from '../../domain/compare';

// 요구 6.8: 품목별로 sessionStorage에 저장해 돌아와도 유지
export interface ViewState {
  preset: Preset;
  sort: SortKey;
  filters: Filters;
}
const key = (itemId: string) => `results:${itemId}`;

export function loadViewState(itemId: string): ViewState {
  try {
    const raw = JSON.parse(sessionStorage.getItem(key(itemId)) ?? 'null');
    if (raw)
      return {
        preset: raw.preset,
        sort: raw.sort,
        filters: { brands: new Set(raw.brands), origins: new Set(raw.origins), bundles: new Set(raw.bundles) },
      };
  } catch {
    /* 무시하고 기본값 */
  }
  return { preset: 'allItem', sort: 'unitPrice', filters: emptyFilters() };
}

export function saveViewState(itemId: string, s: ViewState) {
  sessionStorage.setItem(
    key(itemId),
    JSON.stringify({ preset: s.preset, sort: s.sort, brands: [...s.filters.brands], origins: [...s.filters.origins], bundles: [...s.filters.bundles] }),
  );
}
