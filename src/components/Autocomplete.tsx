import { useEffect, useId, useState, type ReactNode } from 'react';

interface Props<T> {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  fetch: (q: string) => Promise<T[]>;
  render: (t: T) => ReactNode;
  itemKey: (t: T) => string;
  onSelect: (t: T) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

// 요구 3: 입력 150ms 뒤 기존 값을 목록으로 보여준다
export function Autocomplete<T>(p: Props<T>) {
  const id = useId();
  const [list, setList] = useState<T[]>([]);
  const [focused, setFocused] = useState(false);
  const { value, fetch } = p;
  useEffect(() => {
    if (!focused || !value.trim()) return setList([]);
    let alive = true;
    const t = setTimeout(() => {
      fetch(value).then((r) => alive && setList(r));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value, focused, fetch]);
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
      {focused && list.length > 0 && (
        <ul className="ac-list" role="listbox">
          {list.map((t) => (
            <li key={p.itemKey(t)} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  p.onSelect(t);
                  setList([]);
                  setFocused(false);
                }}
              >
                {p.render(t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
