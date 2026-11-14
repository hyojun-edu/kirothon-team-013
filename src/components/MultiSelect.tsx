import { useState } from 'react';

export interface Option<K> {
  key: K;
  label: string;
  count?: number;
}
interface Props<K> {
  label: string;
  options: Option<K>[];
  selected: Set<K>;
  onChange: (next: Set<K>) => void;
}

// 요구 6.1: 여러 개 고르는 필터
export function MultiSelect<K>({ label, options, selected, onChange }: Props<K>) {
  const [open, setOpen] = useState(false);
  const toggle = (k: K) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  return (
    <>
      {/* 요구 14.2: 알약 버튼, 고른 개수는 배지로 */}
      <button type="button" className={'pill' + (selected.size ? ' on' : '')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {label}
        {selected.size > 0 && <span className="pill-count">{selected.size}</span>} <span aria-hidden="true">▾</span>
      </button>
      {/* 하단 시트: 아래에서 올라와 위쪽 칩과 "전체 해제"를 가리지 않는다. 열린 채로 목록을 볼 수 있게 모달이 아니다 */}
      {open && (
        <div className="sheet" role="dialog" aria-label={`${label} 선택`} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <h2>{label}</h2>
          <div className="sheet-list" role="group" aria-label={`${label} 목록`}>
            {options.map((o) => (
              <label key={String(o.key)} className="multi-opt">
                <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
                <span>{o.label}</span>
                {o.count !== undefined && <span className="count">{o.count}</span>}
              </label>
            ))}
          </div>
          <div className="row-btns">
            <button type="button" onClick={() => setOpen(false)}>
              닫기
            </button>
            <button type="button" className="primary" onClick={() => setOpen(false)}>
              적용
            </button>
          </div>
        </div>
      )}
    </>
  );
}
