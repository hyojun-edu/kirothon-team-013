import { useEffect, useId, useState, type ReactNode } from 'react';
import { listAllRecordViews } from '../data/repositories';
import { isOld } from '../domain/compare';
import { findCandidates, relativeDay, type Candidate } from '../domain/candidates';
import { formatUnitPrice, formatWon } from '../domain/unitPrice';
import { formatAmount } from '../domain/units';
import { OnlineBadge } from './Badges';
import { usePhotoUrl } from './Thumb';

export const NO_CANDIDATE = '처음 보는 상품이에요. 직접 입력하세요';

/** 입력과 일치하는 글자를 <mark>로 */
function highlight(text: string, q: string): ReactNode {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const hit = new Array<boolean>(text.length).fill(false);
  for (const t of tokens) for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + 1)) hit.fill(true, i, i + t.length);
  const out: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && hit[j] === hit[i]) j++;
    out.push(hit[i] ? <mark key={i}>{text.slice(i, j)}</mark> : text.slice(i, j));
    i = j;
  }
  return out;
}

export const amountBundle = (c: Candidate) => (c.unitAmount ? `${formatAmount(c.unitAmount)}×${c.bundleCount}` : `×${c.bundleCount}`);
const originWord = (c: Candidate) => (!c.origin ? '' : c.origin.type === 'domestic' ? '국산' : c.origin.country ? `수입(${c.origin.country})` : '수입');

function CandidateRow({ c, query, now, onSelect }: { c: Candidate; query: string; now?: Date; onSelect: (c: Candidate) => void }) {
  const thumb = usePhotoUrl(c.photoId);
  const line2 = [c.itemName, c.brand ?? '', originWord(c)].filter(Boolean).join(' · ');
  return (
    <li role="option" aria-selected="false" data-testid="candidate">
      <button type="button" className="cand" onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(c)}>
        {thumb ? <img className="cand-thumb" src={thumb} alt="" /> : <span className="cand-thumb" aria-hidden="true" />}
        <span className="cand-body">
          <strong className="cand-l1">{highlight(c.productName ?? c.itemName, query)}</strong>
          <span className="cand-l2">{line2}</span>
          <span className="cand-l3">
            <span className="nowrap">{amountBundle(c)}</span> · <span className="nowrap">{formatWon(c.price)}</span>
            {c.unitPrice && (
              <>
                {' · '}
                <span className="nowrap">{formatUnitPrice(c.unitPrice)}</span>
              </>
            )}
          </span>
          <span className="cand-l4">
            <span className="cand-store">{c.storeName}</span>
            {c.isOnline && <OnlineBadge />}
            <span> · {relativeDay(c.purchasedAt, now)}</span>
            {isOld(c.purchasedAt, now) && <span className="badge badge-old">오래된 가격</span>}
            <span> · 기록 {c.recordCount}건</span>
          </span>
        </span>
      </button>
    </li>
  );
}

interface ListProps {
  items: Candidate[];
  more: number;
  query: string;
  onSelect: (c: Candidate) => void;
  onMore: () => void;
  now?: Date;
}

// 요구 16.3, 16.9, 16.14: 사진 + 4줄 정보, 더 보기, 후보 없음 안내 (design.md CandidateList)
export function CandidateList({ items, more, query, onSelect, onMore, now }: ListProps) {
  if (items.length === 0) return <p className="cand-none hint" role="status">{NO_CANDIDATE}</p>;
  return (
    <ul className="ac-list cand-list" role="listbox" aria-label="자동완성 후보">
      {items.map((c) => (
        <CandidateRow key={c.key} c={c} query={query} now={now} onSelect={onSelect} />
      ))}
      {more > 0 && (
        <li>
          <button type="button" className="link-btn cand-more" onMouseDown={(e) => e.preventDefault()} onClick={onMore}>
            더 보기 ({more}개)
          </button>
        </li>
      )}
    </ul>
  );
}

interface InputProps {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSelect: (c: Candidate) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 품명이 N/A일 때 품목으로 찾는다: 품명 없는 상품만 (요구 3.5) */
  naOnly?: boolean;
}

// 요구 16.2, 16.13: 입력 150ms 뒤 후보 목록을 연다. 홈과 등록 화면이 같이 쓴다
export function CandidateInput(p: InputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [limit, setLimit] = useState(8);
  const [res, setRes] = useState<{ q: string; items: Candidate[]; more: number } | null>(null);
  const { value, naOnly } = p;
  useEffect(() => setLimit(8), [value]);
  useEffect(() => {
    if (!focused || !value.trim()) return setRes(null);
    let alive = true;
    const t = setTimeout(async () => {
      const recs = (await listAllRecordViews()).filter((r) => !naOnly || r.productName?.kind !== 'value');
      if (alive) setRes({ q: value, ...findCandidates(recs, value, limit) });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value, focused, limit, naOnly]);
  return (
    <div className="ac">
      <label htmlFor={id}>{p.label}</label>
      <input
        id={id}
        value={value}
        placeholder={p.placeholder}
        disabled={p.disabled}
        autoComplete="off"
        onChange={(e) => p.onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {focused && res && (
        <CandidateList
          items={res.items}
          more={res.more}
          query={res.q}
          onMore={() => setLimit((l) => l + 8)}
          onSelect={(c) => {
            p.onSelect(c);
            setRes(null);
            setFocused(false);
          }}
        />
      )}
    </div>
  );
}
