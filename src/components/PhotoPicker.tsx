import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 미리보기용 (새로 고른 파일 또는 기존 사진) */
  preview: Blob | null;
  onPick: (file: File) => void;
  error?: string;
}

// 사진: 카메라 촬영 또는 갤러리/캡처 선택 (spec 4, 7 "앱 안에서 바로 캡처 업로드")
export function PhotoPicker({ preview, onPick, error }: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!preview) return setUrl(null);
    const u = URL.createObjectURL(preview);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [preview]);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = '';
  };
  return (
    <fieldset className="field photo-picker">
      <legend>
        사진 <span className="req">필수</span>
      </legend>
      {url ? <img className="photo-preview" src={url} alt="고른 사진" /> : <div className="photo-empty">사진 없음</div>}
      <div className="row-btns">
        <button type="button" onClick={() => camRef.current?.click()}>
          📷 촬영
        </button>
        <button type="button" onClick={() => galRef.current?.click()}>
          🖼 앨범·캡처
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} data-testid="photo-camera" />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={pick} data-testid="photo-input" aria-label="사진 파일" />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
