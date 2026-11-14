import { useId, type ReactNode } from 'react';
import type { FieldState } from '../domain/types';

interface Props<T> {
  label: string;
  state: FieldState<T>;
  onChange: (next: FieldState<T>) => void;
  /** 값 입력 UI. N/A이면 숨긴다. */
  children: ReactNode;
  hint?: string;
}

// 요구 2.1~2.3: 값 입력과 "해당사항 없음" 체크를 한 덩어리로. 상태: value | na | empty
export function NAField<T>({ label, state, onChange, children, hint }: Props<T>) {
  const id = useId();
  const na = state.kind === 'na';
  return (
    <fieldset className="field" data-state={state.kind}>
      <legend>{label}</legend>
      {!na && children}
      <label className="na-check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={na}
          onChange={(e) => onChange(e.target.checked ? { kind: 'na' } : { kind: 'empty' })}
        />
        해당사항 없음
      </label>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}
