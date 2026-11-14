import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../../components/useAsync';
import { listItems, recentRecords } from '../../data/repositories';
import { formatUnitPrice, formatWon, unitPrice } from '../../domain/unitPrice';
import { fmtDate, nameText } from '../results/format';
import { QuickCompare } from './QuickCompare';

// 화면 1. 홈 (spec.md 15.6): 빠른 비교(요구 16) → 내 품목 → 최근 기록 → 하단 가격 등록. 품목 검색칸은 없다 (요구 16.15).
export function HomePage() {
  const nav = useNavigate();
  const recent = useAsync(() => recentRecords(10), []);
  return (
    <main className="page">
      <div className="home-hero">
        <h1>장보기 도우미</h1>
        <p className="hint">할인가가 정말 싼지 단위가격으로 비교해요.</p>
      </div>
      <QuickCompare />
      <ItemChips />

      <h2>최근 기록</h2>
      {!recent && <div className="skeleton" aria-label="불러오는 중" />}
      {recent && recent.length === 0 && (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🧾</span>
          <p className="hint">아직 기록이 없어요. 첫 가격을 등록해 보세요.</p>
        </div>
      )}
      <ul className="recent">
        {recent?.map((r) => {
          const up = unitPrice(r);
          return (
            <li key={r.id}>
              <Link to={`/items/${r.itemId}`}>
                <span className="recent-body">
                  <strong>{r.itemName}</strong> · {nameText(r)}
                  <br />
                  <span className="sub">
                    {formatWon(r.price)} · {r.storeName} · {fmtDate(r.purchasedAt)}
                  </span>
                </span>
                {up && <span className="recent-up">{formatUnitPrice(up)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="bottom-bar">
        <button type="button" className="primary" onClick={() => nav('/register')}>
          가격 등록
        </button>
      </div>
    </main>
  );
}

/** "내 품목" 칩 (요구 16.16~16.18). 칩은 anchor 없이 결과 화면을 열어 "품목 전체"로 시작한다. */
function ItemChips() {
  const nav = useNavigate();
  const items = useAsync(() => listItems(), []);
  return (
    <section aria-labelledby="my-items">
      <h2 id="my-items">내 품목</h2>
      {!items && <div className="skeleton" aria-label="불러오는 중" />}
      {items && items.length === 0 && (
        <div className="empty">
          <p className="hint">아직 품목이 없어요. 첫 가격을 등록해 보세요</p>
          <button type="button" className="primary" onClick={() => nav('/register')}>
            가격 등록
          </button>
        </div>
      )}
      {items && items.length > 0 && (
        <ul className="item-chips">
          {items.map((i) => (
            <li key={i.itemId}>
              <Link className="chip item-chip" to={`/items/${i.itemId}`} aria-label={`${i.name} 기록 ${i.recordCount}건`}>
                {i.name} <span className="item-chip-count">{i.recordCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
