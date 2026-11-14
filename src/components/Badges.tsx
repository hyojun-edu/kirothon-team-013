// 요구 13.7: 색만이 아니라 글자와 아이콘을 함께
// 요구 6.5: 필터가 있으면 "조건 내 최저가", 없으면 "최저가"
export function CheapestBadge({ label = '최저가' }: { label?: string }) {
  return (
    <span className="badge badge-cheapest">
      <span aria-hidden="true">🏆</span> {label}
    </span>
  );
}
export function OnlineBadge() {
  return <span className="badge badge-online">온라인</span>;
}
export function MineBadge() {
  return (
    <span className="badge badge-mine">
      <span aria-hidden="true">★</span> 내 상품
    </span>
  );
}
