// 요구 13.7: 색만이 아니라 글자와 아이콘을 함께
export function CheapestBadge() {
  return (
    <span className="badge badge-cheapest">
      <span aria-hidden="true">🏆</span> 최저가
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
