import type { CSSProperties } from 'react';

// 요구 15.8: 데모 모드에서만 맨 위 오른쪽 구석에 작고 옅게 보인다 (하단 바와 겹치지 않음).
// 스타일을 여기에 두어 일반 빌드 CSS에도 남지 않게 한다.
const style: CSSProperties = {
  position: 'fixed',
  top: 'calc(4px + env(safe-area-inset-top))',
  right: 6,
  zIndex: 60,
  padding: '1px 6px',
  borderRadius: 8,
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--text-sub)',
  background: 'var(--surface, #fff)',
  border: '1px solid var(--line)',
  opacity: 0.85,
  pointerEvents: 'none',
};

export function DemoBadge() {
  return (
    <div style={style} data-testid="demo-badge">
      데모 데이터
    </div>
  );
}
