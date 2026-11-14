import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chip } from '../../components/Chip';
import { MultiSelect } from '../../components/MultiSelect';
import { PhotoZoom } from '../../components/Thumb';
import { useAsync } from '../../components/useAsync';
import { buildResult, emptyFilters, originLabel, type Anchor, type Filters, type Preset } from '../../domain/compare';
import { buildSearchQuery } from '../../domain/searchQuery';
import { formatUnitPrice, formatWon } from '../../domain/unitPrice';
import { getItem, listRecordViews } from '../../data/repositories';
import { OnlineSearch, pendingSearch, rememberSearch, type PendingSearch } from '../search/OnlineSearch';
import { ReturnBar } from '../search/ReturnBar';
import { loadViewState, saveViewState } from './filterState';
import { ResultCard } from './ResultCard';

export const PAGE = 20;
const PRESETS: Preset[] = ['exact', 'sameProduct', 'allItem'];
// 요구 14.3: 탭 이름은 짧게, 전체 뜻은 탭 아래 한 줄 설명으로
export const PRESET_LABELS: Record<Preset, string> = { exact: '똑같은 상품', sameProduct: '용량 무관', allItem: '품목 전체' };
export const PRESET_HINTS: Record<Preset, string> = {
  exact: '품명·브랜드·용량이 같은 상품만 비교해요',
  sameProduct: '품명·브랜드가 같으면 용량이 달라도 비교해요',
  allItem: '같은 품목의 모든 기록을 비교해요',
};
export const PRESET_DISABLED_REASON = '등록하거나 고른 상품이 있을 때 쓸 수 있어요';

export function diffText(diffWon: number, diffPct: number): string {
  if (diffWon > 0) return `최저가보다 ${formatWon(diffWon)} 비싸요 (+${diffPct.toFixed(0)}%)`;
  if (diffWon < 0) return `최저가보다 ${formatWon(-diffWon)} 싸요 (${diffPct.toFixed(0)}%)`;
  return '최저가와 같아요';
}

export function ResultsPage() {
  const { itemId = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const mine = params.get('mine') ?? undefined;
  const draftAnchor = (location.state as { draftAnchor?: Anchor } | null)?.draftAnchor;
  const anchor: Anchor | undefined = mine ? { recordId: mine } : draftAnchor;

  const item = useAsync(() => getItem(itemId), [itemId]);
  const records = useAsync(() => listRecordViews(itemId), [itemId]);

  const [view, setView] = useState(() => loadViewState(itemId));
  useEffect(() => saveViewState(itemId, view), [itemId, view]);
  const preset: Preset = anchor ? view.preset : 'allItem';
  const setFilters = (f: Filters) => setView((v) => ({ ...v, filters: f }));
  const [visible, setVisible] = useState(PAGE);
  const [zoom, setZoom] = useState<string | null>(null);
  const [tabNote, setTabNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSearch | null>(() => pendingSearch());

  const result = useMemo(
    () => (records ? buildResult(records, { preset, anchor, filters: view.filters, sort: view.sort, showHistory: false }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, preset, mine, draftAnchor, view.filters, view.sort],
  );

  // 내 상품 행이 보이도록 (spec 7.3)
  const mineIdx = result && mine ? result.rows.findIndex((r) => r.rec.id === mine) : -1;
  const shown = Math.max(visible, mineIdx + 1);
  useEffect(() => {
    if (mineIdx < 0) return;
    document.querySelector(`[data-id="${mine}"]`)?.scrollIntoView?.({ block: 'center' });
  }, [mineIdx, mine]);

  // 20건씩 더 불러오기 (요구 5.14)
  const sentinel = useRef<HTMLDivElement>(null);
  const total = result?.rows.length ?? 0;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible((v) => v + PAGE));
    io.observe(el);
    return () => io.disconnect();
  }, [total, shown]);

  const f = view.filters;
  const activeChips = [
    ...[...f.brands].map((k) => ({ label: result?.facets.brands.find((x) => x.key === k)?.label ?? k, remove: () => { const s = new Set(f.brands); s.delete(k); setFilters({ ...f, brands: s }); } })),
    ...[...f.origins].map((k) => ({ label: originLabel(k), remove: () => { const s = new Set(f.origins); s.delete(k); setFilters({ ...f, origins: s }); } })),
    ...[...f.bundles].map((k) => ({ label: `${k}개 묶음`, remove: () => { const s = new Set(f.bundles); s.delete(k); setFilters({ ...f, bundles: s }); } })),
  ];
  const clearFilters = () => setFilters(emptyFilters());

  // 검색어와 미리 채우기 기준 상품: 내 상품 → 최저가 기록 → 품목명
  const baseRec = (mine && records?.find((r) => r.id === mine)) || result?.cheapest?.rec || records?.[0];
  const query = baseRec
    ? buildSearchQuery(baseRec)
    : draftAnchor
      ? buildSearchQuery({ itemName: item?.name ?? '', productName: draftAnchor.productName, brand: draftAnchor.brand, unitAmount: draftAnchor.unitAmount })
      : buildSearchQuery({ itemName: item?.name ?? '' });
  const onSearched = () => {
    const p: PendingSearch = { from: baseRec?.id, mode: 'search', itemName: item?.name };
    rememberSearch(p);
    setPending(p);
  };

  const summary = result?.anchorSummary;
  const loading = !records || item === undefined;

  return (
    <main className="page">
      {/* A. 헤더 */}
      <div className="header">
        <button type="button" className="back" aria-label="뒤로" onClick={() => nav('/')}>
          ←
        </button>
        <h1>{item?.name ?? '품목'}</h1>
        {records && <span className="count">전체 {records.length}건</span>}
      </div>

      {pending && <ReturnBar pending={pending} onClose={() => setPending(null)} />}

      {/* B. 내 상품 비교 바 (요구 8.1, 8.4) */}
      {anchor && summary && (
        <section className="compare-bar" aria-label="내 상품 비교">
          <div>
            내 상품 <strong>{formatUnitPrice(summary.unitPrice)}</strong>
          </div>
          <div>
            {summary.total}건 중 <strong>{summary.rank}위</strong> · {diffText(summary.diffWon, summary.diffPct)}
          </div>
        </section>
      )}

      {/* C. 프리셋 탭 (요구 7) */}
      <div className="tabs" role="tablist" aria-label="비교 범위">
        {PRESETS.map((p) => {
          const off = !anchor && p !== 'allItem';
          return (
            <button
              key={p}
              type="button"
              role="tab"
              className="tab"
              aria-selected={preset === p}
              aria-disabled={off || undefined}
              onClick={() => {
                // 요구 14.4: 비활성 탭은 이유를 한 줄로 알려 준다
                if (off) return setTabNote(PRESET_DISABLED_REASON);
                setTabNote(null);
                setView((v) => ({ ...v, preset: p }));
              }}
            >
              {PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>
      <p className="tab-hint" role="status">
        {tabNote ?? PRESET_HINTS[preset]}
      </p>

      {/* D. 필터 바 (요구 6) */}
      {result && (
        <>
          <div className="filter-bar">
            <MultiSelect label="브랜드" options={result.facets.brands} selected={f.brands} onChange={(s) => setFilters({ ...f, brands: s })} />
            <MultiSelect label="원산지" options={result.facets.origins} selected={f.origins} onChange={(s) => setFilters({ ...f, origins: s })} />
            <MultiSelect label="번들" options={result.facets.bundles} selected={f.bundles} onChange={(s) => setFilters({ ...f, bundles: s })} />
            <select aria-label="정렬" value={view.sort} onChange={(e) => setView((v) => ({ ...v, sort: e.target.value as 'unitPrice' | 'recent' }))}>
              <option value="unitPrice">단위가격순</option>
              <option value="recent">최신순</option>
            </select>
          </div>
          {activeChips.length > 0 && (
            <div className="chips" aria-label="적용된 필터">
              {activeChips.map((c) => (
                <Chip key={c.label} label={c.label} onRemove={c.remove} />
              ))}
              <button type="button" className="link-btn" onClick={clearFilters}>
                전체 해제
              </button>
            </div>
          )}
        </>
      )}

      {loading && (
        <div aria-label="불러오는 중">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}

      {result && records && records.length === 0 && (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🛒</span>
          <p>아직 기록이 없어요</p>
          <div className="row-btns">
            <button type="button" className="primary" onClick={() => nav(`/register?item=${encodeURIComponent(item?.name ?? '')}`)}>
              가격 등록
            </button>
          </div>
          <div className="row-btns">
            <OnlineSearch query={query} onOpened={onSearched} />
          </div>
        </div>
      )}

      {result && records && records.length > 0 && result.rows.length === 0 && result.incomparable.length === 0 && (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🔍</span>
          <p>조건에 맞는 기록이 없어요</p>
          <button type="button" onClick={clearFilters}>
            필터 해제
          </button>
        </div>
      )}

      {result && result.rows.length === 1 && <p className="hint">비교할 기록이 더 필요해요</p>}

      {/* E. 기록 목록. 맨 위 1위 카드가 현재 조건의 최저가 (요구 5.2, 6.5) */}
      {result && result.rows.length > 0 && (
        <ul className="rows" aria-label="기록 목록">
          {result.rows.slice(0, shown).map((row) => (
            <ResultCard key={row.rec.id} row={row} showRank cheapestLabel={activeChips.length > 0 ? '조건 내 최저가' : '최저가'} onOpen={(id) => nav(`/records/${id}`)} onZoom={setZoom} />
          ))}
        </ul>
      )}
      {result && shown < result.rows.length && (
        <div ref={sentinel}>
          <button type="button" className="link-btn" onClick={() => setVisible(shown + PAGE)}>
            더 보기 ({result.rows.length - shown}건 남음)
          </button>
        </div>
      )}

      {/* F. 비교 불가 구역 (요구 5.12) */}
      {result && result.incomparable.length > 0 && (
        <section className="section-incomparable" aria-label="비교 불가">
          <h2>비교 불가</h2>
          <p className="hint">단위가 달라 비교할 수 없어요</p>
          <ul className="rows">
            {result.incomparable.map((row) => (
              <ResultCard key={row.rec.id} row={row} showRank={false} onOpen={(id) => nav(`/records/${id}`)} onZoom={setZoom} />
            ))}
          </ul>
        </section>
      )}

      {zoom && <PhotoZoom photoId={zoom} onClose={() => setZoom(null)} />}

      {/* G. 하단 고정 버튼 */}
      {records && records.length > 0 && (
        <div className="bottom-bar">
          <button type="button" className="primary" onClick={() => nav(`/register?item=${encodeURIComponent(item?.name ?? '')}`)}>
            가격 등록
          </button>
          <OnlineSearch query={query} onOpened={onSearched} />
        </div>
      )}
    </main>
  );
}
