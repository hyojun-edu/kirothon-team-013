import { useState } from 'react';
import { CheapestBadge, MineBadge, OnlineBadge } from '../../components/Badges';
import { usePhotoUrl } from '../../components/Thumb';
import type { Row } from '../../domain/compare';
import { formatUnitPrice, formatWon, unitPrice } from '../../domain/unitPrice';
import { amountText, brandText, fmtDate, nameText, originText } from './format';

interface Props {
  row: Row;
  showRank: boolean;
  /** 1위 배지 글자 (요구 6.5) */
  cheapestLabel?: string;
  onOpen: (id: string) => void;
  onZoom: (photoId: string) => void;
}

// 요구 5.3~5.7, 14.5, 14.6: 사진(순위 배지) + 단위가격(가장 크게), 가격·용량×번들, 품명·브랜드, 원산지, 판매처, 날짜
export function ResultCard({ row, showRank, cheapestLabel, onOpen, onZoom }: Props) {
  const r = row.rec;
  const thumb = usePhotoUrl(r.photoId);
  const [histOpen, setHistOpen] = useState(false);
  const cls = ['row', row.isCheapest && showRank ? 'cheapest' : '', row.isMine ? 'mine' : '', row.isOld ? 'old' : ''].filter(Boolean).join(' ');
  return (
    <li data-testid="row" data-id={r.id}>
      <div className={cls} data-rank={showRank ? row.rank : undefined} role="link" tabIndex={0} aria-label={`${nameText(r)} ${formatUnitPrice(row.unitPrice)} 상세`} onClick={() => onOpen(r.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(r.id)}>
        <div className="photo-wrap">
          <button
            type="button"
            className="thumb"
            aria-label="사진 크게 보기"
            onClick={(e) => {
              e.stopPropagation();
              onZoom(r.photoId);
            }}
          >
            {thumb ? <img className="thumb" src={thumb} alt="" /> : null}
          </button>
          {showRank && <span className="rank">{row.rank}</span>}
        </div>
        <div className="row-body">
          <div className="row-top">
            <div className="unit-price" data-testid="unit-price">
              {formatUnitPrice(row.unitPrice)}
            </div>
            {row.isCheapest && showRank && <CheapestBadge label={cheapestLabel} />}
            {row.isMine && <MineBadge />}
          </div>
          <div className="sub">
            {formatWon(r.price)} · {amountText(r)}
          </div>
          <div className="sub">
            {nameText(r)}
            {brandText(r) && ` · ${brandText(r)}`}
            {originText(r) && ` · ${originText(r)}`}
          </div>
          <div className="meta">
            <span>{r.storeName}</span>
            {r.isOnline && <OnlineBadge />}
            {r.isOnline && r.shippingFee ? <span className="badge badge-old">배송비 포함</span> : null}
            <span className="date">{fmtDate(r.purchasedAt)}</span>
            {row.isOld && <span className="badge badge-old">오래된 가격</span>}
          </div>
        </div>
      </div>
      {row.history.length > 0 && (
        <>
          <button type="button" className="link-btn" aria-expanded={histOpen} onClick={() => setHistOpen(!histOpen)}>
            {histOpen ? '이전 기록 접기' : `이전 기록 보기 (${row.history.length})`}
          </button>
          {histOpen && (
            <ul className="history" aria-label="이전 기록">
              {row.history.map((h) => {
                const up = unitPrice(h);
                return (
                  <li key={h.id}>
                    {fmtDate(h.purchasedAt)} · {formatWon(h.price)}
                    {up && ` · ${formatUnitPrice(up)}`}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
