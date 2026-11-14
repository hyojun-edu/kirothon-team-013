// 요구 15.7: 샘플 사진은 앱이 직접 그린다 (색 배경 + 상품명). 외부 이미지를 쓰지 않는다.
export async function drawPhoto({ label, bg }: { label: string; bg: string }, size = 600): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 사용 불가');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(size * 0.1, size * 0.3, size * 0.8, size * 0.4, 32);
  ctx.fill();
  ctx.fillStyle = '#1f2933';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let px = 64;
  ctx.font = `700 ${px}px sans-serif`;
  while (px > 20 && ctx.measureText(label).width > size * 0.72) ctx.font = `700 ${(px -= 4)}px sans-serif`;
  ctx.fillText(label, size / 2, size / 2);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('이미지 변환 실패');
  return blob;
}
