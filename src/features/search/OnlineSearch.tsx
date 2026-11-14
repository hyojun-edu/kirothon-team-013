import { useState } from 'react';
import { googleUrl } from '../../domain/searchQuery';

interface Props {
  query: string;
  label?: string;
  onOpened?: () => void;
}

// 요구 9: 검색어를 고친 뒤 구글 검색 결과를 새 탭으로 연다. 팝업이 막히면 링크를 보여준다.
export function OnlineSearch({ query, label = '온라인 가격 검색', onOpened }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(query);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const go = () => {
    const url = googleUrl(q);
    const w = window.open(url, '_blank');
    if (w) {
      w.opener = null;
      setBlockedUrl(null);
    } else {
      setBlockedUrl(url);
    }
    onOpened?.();
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setQ(query);
          setOpen(true);
        }}
      >
        🔎 {label}
      </button>
    );
  return (
    <div className="search-panel">
      <label className="lbl" htmlFor="search-q">
        검색어
      </label>
      <input id="search-q" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row-btns" style={{ marginTop: 8 }}>
        <button type="button" className="primary" onClick={go} disabled={!q.trim()}>
          구글에서 열기
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      {blockedUrl && (
        <p className="hint">
          새 탭이 막혔어요.{' '}
          <a href={blockedUrl} target="_blank" rel="noopener noreferrer">
            여기를 눌러 직접 여세요
          </a>
        </p>
      )}
    </div>
  );
}

// 요구 10.1: 검색 후 돌아오면 "온라인 가격 등록"을 보여주기 위해 기억해 둔다
const KEY = 'pending-online-search';
export interface PendingSearch {
  from?: string; // 기록 id
  mode: 'search' | 'refresh';
  itemName?: string;
}
export function rememberSearch(p: PendingSearch) {
  sessionStorage.setItem(KEY, JSON.stringify(p));
}
export function pendingSearch(): PendingSearch | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
export function clearPendingSearch() {
  sessionStorage.removeItem(KEY);
}
export function registerUrl(p: PendingSearch): string {
  if (p.from) return `/register?from=${encodeURIComponent(p.from)}&mode=${p.mode}`;
  return `/register${p.itemName ? `?item=${encodeURIComponent(p.itemName)}` : ''}`;
}
