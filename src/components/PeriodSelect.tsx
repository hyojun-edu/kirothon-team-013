import { useState } from 'react';
import type { Period } from '../domain/compare';

export const PERIODS: Period[] = ['all', '1y', '90d', '30d'];
export const PERIOD_LABELS: Record<Period, string> = { all: '전체', '1y': '최근 1년', '90d': '최근 90일', '30d': '최근 30일' };

interface Props {
  value: Period;
  onChange: (p: Period) => void;
}

// 요구 6.9, 6.12: 하나만 고르는 "기간" 알약. 고른 값이 알약 글자로 보인다
export function PeriodSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={'pill' + (value !== 'all' ? ' on' : '')} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {value === 'all' ? '기간' : PERIOD_LABELS[value]} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="sheet" role="dialog" aria-label="기간 선택" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <h2>기간</h2>
          <div className="sheet-list" role="radiogroup" aria-label="기간 목록">
            {PERIODS.map((p) => (
              <label key={p} className="multi-opt">
                <input type="radio" name="period" checked={value === p} onChange={() => onChange(p)} />
                <span>{PERIOD_LABELS[p]}</span>
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
