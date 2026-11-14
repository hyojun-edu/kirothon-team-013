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
    <div className="multi">
      <button
        type="button"
        className={'multi-btn' + (selected.size ? ' on' : '')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        {selected.size > 0 && ` (${selected.size})`} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="multi-panel" role="group" aria-label={`${label} 선택`}>
          {options.map((o) => (
            <label key={String(o.key)} className="multi-opt">
              <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
              <span>{o.label}</span>
              {o.count !== undefined && <span className="count">{o.count}</span>}
            </label>
          ))}
          <button type="button" className="link-btn" onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
