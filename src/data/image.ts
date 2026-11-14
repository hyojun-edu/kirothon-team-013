// 요구 13.5: 저장 전에 긴 변 1280px로 줄이고, 목록용 썸네일(200px)을 만든다.
export const MAX_SIDE = 1280;
export const THUMB_SIDE = 200;

export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const s = max / long;
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

async function draw(bmp: ImageBitmap, max: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 사용 불가');
  ctx.drawImage(bmp, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
  if (!blob) throw new Error('이미지 변환 실패');
  return { blob, width, height };
}

export interface ProcessedPhoto {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** 실패하면 예외. 원본은 저장하지 않는다 (design.md 오류 처리). */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const bmp = await createImageBitmap(file);
  try {
    const main = await draw(bmp, MAX_SIDE);
    const thumb = await draw(bmp, THUMB_SIDE);
    return { blob: main.blob, thumb: thumb.blob, width: main.width, height: main.height };
  } finally {
    bmp.close();
  }
}
