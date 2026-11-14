import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 요구 14.9, 인수 30: 토큰으로 쓰는 글자/배경 쌍의 명암비
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
const alias = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)\s*;/g)].map((m) => [m[1], m[2]]));
const color = (name: string): string => tokens[name] ?? color(alias[name]);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [글자, 배경, 큰 글자인지] — 화면에서 실제로 쓰는 조합
const PAIRS: [string, string, boolean][] = [
  ['text', 'bg', false],
  ['text', 'surface', false],
  ['text', 'primary-soft', false],
  ['text-sub', 'bg', false],
  ['text-sub', 'surface', false],
  ['text-sub', 'primary-soft', false],
  ['text-sub', 'line', false], // 오래된 가격 배지
  ['primary', 'surface', false], // 보조 버튼, 링크
  ['primary', 'primary-soft', false], // 칩, 선택된 필터
  ['on-primary', 'primary', false], // 주요 버튼, 선택된 탭, 내 상품 배지
  ['on-accent', 'accent', false], // 최저가 배지
  ['danger', 'surface', false], // 오류, 삭제
  ['surface', 'text', false], // 순위 번호 배지
];

describe('명암비 (요구 14.9)', () => {
  it('계산이 맞다: 흰 바탕 검정 21:1', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });
  it.each(PAIRS)('%s 글자 / %s 배경', (fg, bg, large) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });
});
