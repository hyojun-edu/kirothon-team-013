import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Autocomplete } from '../../components/Autocomplete';
import { useAsync } from '../../components/useAsync';
import type { Item } from '../../data/db';
import { findItemByName, recentRecords, searchItems } from '../../data/repositories';
import { formatUnitPrice, formatWon, unitPrice } from '../../domain/unitPrice';
import { fmtDate, nameText } from '../results/format';

// 화면 1. 홈: 품목 검색, 최근 기록, 가격 등록
export function HomePage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [notFound, setNotFound] = useState(false);
  const recent = useAsync(() => recentRecords(10), []);
  const fetchItems = useCallback((s: string) => searchItems(s), []);
  const go = async () => {
    const item = await findItemByName(q);
    if (item) nav(`/items/${item.id}`);
    else setNotFound(true);
  };
  return (
    <main className="page">
      <h1>장보기 도우미</h1>
      <p className="hint">할인가가 정말 싼지 단위가격으로 비교해요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <Autocomplete<Item>
          label="품목 검색"
          value={q}
          onChange={(v) => {
            setQ(v);
            setNotFound(false);
          }}
          fetch={fetchItems}
          itemKey={(i) => i.id}
          render={(i) => i.name}
          onSelect={(i) => nav(`/items/${i.id}`)}
          placeholder="예: 두부"
        />
      </form>
      {notFound && (
        <div className="empty">
          <p>아직 기록이 없어요</p>
          <button type="button" className="primary" onClick={() => nav(`/register?item=${encodeURIComponent(q)}`)}>
            가격 등록
          </button>
        </div>
      )}

      <h2>최근 기록</h2>
      {recent && recent.length === 0 && <p className="hint">아직 기록이 없어요. 첫 가격을 등록해 보세요.</p>}
      <ul className="recent">
        {recent?.map((r) => {
          const up = unitPrice(r);
          return (
            <li key={r.id}>
              <Link to={`/items/${r.itemId}`}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{r.itemName}</strong> · {nameText(r)}
                  <br />
                  <span className="sub">
                    {formatWon(r.price)} {up && `· ${formatUnitPrice(up)}`} · {r.storeName} · {fmtDate(r.purchasedAt)}
                  </span>
                </span>
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
