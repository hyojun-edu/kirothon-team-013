import { useEffect, useState } from 'react';
import { getPhoto } from '../data/repositories';

/** 저장된 사진을 보여준다. full이면 원본, 아니면 썸네일 */
export function usePhotoUrl(photoId: string | undefined, full = false): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoId) return;
    let u: string | null = null;
    let alive = true;
    getPhoto(photoId).then((p) => {
      if (!alive || !p) return;
      u = URL.createObjectURL(full ? p.blob : p.thumb);
      setUrl(u);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [photoId, full]);
  return url;
}

export function PhotoZoom({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const url = usePhotoUrl(photoId, true);
  return (
    <button type="button" className="zoom" onClick={onClose} aria-label="사진 닫기">
      {url && <img src={url} alt="상품 사진 크게" />}
    </button>
  );
}
