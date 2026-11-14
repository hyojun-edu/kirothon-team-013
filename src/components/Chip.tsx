interface Props {
  label: string;
  onRemove: () => void;
}

// 요구 6.6: 적용된 필터 칩, 개별 해제
export function Chip({ label, onRemove }: Props) {
  return (
    <button type="button" className="chip" onClick={onRemove} aria-label={`${label} 필터 해제`}>
      {label} <span aria-hidden="true">✕</span>
    </button>
  );
}
