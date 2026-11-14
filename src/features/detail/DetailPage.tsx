import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OnlineBadge } from '../../components/Badges';
import { PhotoZoom, usePhotoUrl } from '../../components/Thumb';
import { useAsync } from '../../components/useAsync';
import { buildSearchQuery } from '../../domain/searchQuery';
import { formatUnitPrice, formatWon, unitPrice } from '../../domain/unitPrice';
import { formatAmount } from '../../domain/units';
import { deleteRecord, getRecordView } from '../../data/repositories';
import { OnlineSearch, pendingSearch, rememberSearch, type PendingSearch } from '../search/OnlineSearch';
import { ReturnBar } from '../search/ReturnBar';
import { fmtDate, originText } from '../results/format';

const show = (f: { kind: string; value?: unknown } | undefined, fmt: (v: never) => string = (v) => String(v)) =>
  !f ? '미입력' : f.kind === 'na' ? '해당사항 없음' : fmt(f.value as never);

// 요구 11, 12: 상세, 사진 확대, 수정, 삭제 확인, 새로 등록, 다시 검색
export function DetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const rec = useAsync(() => getRecordView(id), [id]);
  const photoUrl = usePhotoUrl(rec?.photoId, true);
  const [zoom, setZoom] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<PendingSearch | null>(() => pendingSearch());

  if (rec === undefined) return <main className="page"><div className="skeleton" /></main>;
  if (!rec)
    return (
      <main className="page">
        <p>기록을 찾을 수 없어요.</p>
        <button type="button" onClick={() => nav('/')}>홈으로</button>
      </main>
    );
  const up = unitPrice(rec);
  const searched = (mode: 'search' | 'refresh') => () => {
    const p: PendingSearch = { from: rec.id, mode, itemName: rec.itemName };
    rememberSearch(p);
    setPending(p);
  };

  return (
    <main className="page">
      <div className="header">
        <button type="button" className="back" aria-label="뒤로" onClick={() => nav(-1)}>
          ←
        </button>
        <h1>기록 상세</h1>
      </div>
      {pending && <ReturnBar pending={pending} onClose={() => setPending(null)} />}

      <button type="button" className="detail-photo" aria-label="사진 크게 보기" onClick={() => setZoom(true)}>
        {photoUrl ? <img src={photoUrl} alt="상품 사진" style={{ width: '100%', borderRadius: 10 }} /> : '사진'}
      </button>
      {zoom && <PhotoZoom photoId={rec.photoId} onClose={() => setZoom(false)} />}

      {up && <p className="unit-price">{formatUnitPrice(up)}</p>}
      <dl className="fields">
        <dt>품목</dt><dd>{rec.itemName}</dd>
        <dt>품명</dt><dd>{show(rec.productName)}</dd>
        <dt>브랜드</dt><dd>{show(rec.brand)}</dd>
        <dt>원산지</dt><dd>{rec.origin?.kind === 'value' ? originText(rec) : show(rec.origin)}</dd>
        <dt>포장단위</dt><dd>{rec.packUnit}</dd>
        <dt>단위용량</dt><dd>{show(rec.unitAmount, formatAmount)}</dd>
        <dt>번들묶음</dt><dd>{rec.bundleCount}개</dd>
        <dt>가격</dt><dd>{formatWon(rec.price)}</dd>
        <dt>판매처</dt><dd>{rec.storeName} {rec.isOnline && <OnlineBadge />}</dd>
        {rec.isOnline && (<><dt>배송비</dt><dd>{rec.shippingFee !== undefined ? formatWon(rec.shippingFee) : '없음'}</dd></>)}
        <dt>날짜</dt><dd>{fmtDate(rec.purchasedAt)}</dd>
        {rec.note && (<><dt>메모</dt><dd>{rec.note}</dd></>)}
      </dl>

      <div className="row-btns" style={{ flexDirection: 'column' }}>
        <button type="button" className="primary" onClick={() => nav(`/register?from=${rec.id}&mode=clone`)}>
          이 기록으로 새로 등록
        </button>
        {rec.isOnline && (
          <OnlineSearch label="최신가격 다시 검색" query={buildSearchQuery(rec, rec.storeName)} onOpened={searched('refresh')} />
        )}
        <OnlineSearch query={buildSearchQuery(rec)} onOpened={searched('search')} />
        <button type="button" onClick={() => nav(`/items/${rec.itemId}?mine=${rec.id}`)}>
          비교 목록 보기
        </button>
        <div className="row-btns">
          <button type="button" onClick={() => nav(`/records/${rec.id}/edit`)}>
            수정
          </button>
          <button type="button" className="danger" onClick={() => setConfirm(true)}>
            삭제
          </button>
        </div>
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="삭제 확인" className="search-panel">
          <p>이 기록을 삭제할까요? 삭제하면 되돌릴 수 없어요.</p>
          <div className="row-btns">
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await deleteRecord(rec.id);
                nav(`/items/${rec.itemId}`, { replace: true });
              }}
            >
              삭제하기
            </button>
            <button type="button" onClick={() => setConfirm(false)}>
              취소
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
