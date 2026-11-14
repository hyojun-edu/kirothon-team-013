import './demo.css';

// 요구 15.8: 데모 모드에서만 렌더한다. CSS도 데모 묶음에만 들어간다.
export function DemoBadge() {
  return (
    <div className="demo-badge" data-testid="demo-badge">
      데모 데이터
    </div>
  );
}
