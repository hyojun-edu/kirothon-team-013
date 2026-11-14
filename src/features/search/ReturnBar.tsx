import { useNavigate } from 'react-router-dom';
import { clearPendingSearch, registerUrl, type PendingSearch } from './OnlineSearch';

// 요구 10.1: 외부 검색 뒤 돌아오면 "온라인 가격 등록"
export function ReturnBar({ pending, onClose }: { pending: PendingSearch; onClose: () => void }) {
  const nav = useNavigate();
  return (
    <div className="return-bar" role="region" aria-label="검색에서 돌아옴">
      <span>온라인에서 가격을 찾았나요?</span>
      <button
        type="button"
        onClick={() => {
          clearPendingSearch();
          nav(registerUrl(pending));
        }}
      >
        온라인 가격 등록
      </button>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => {
          clearPendingSearch();
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}
