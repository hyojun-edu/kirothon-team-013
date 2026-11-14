import { pwaOptions } from './pwaOptions';

// 요구 13.1: 홈 화면에 설치할 수 있는 매니페스트.
describe('PWA 매니페스트', () => {
  const m = pwaOptions.manifest;
  if (!m) throw new Error('manifest 없음');

  it('설치에 필요한 이름, 시작 주소, standalone 표시를 가진다', () => {
    expect(m.name).toBe('장보기 도우미');
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.lang).toBe('ko');
  });

  it('192px, 512px 아이콘과 maskable 아이콘이 있다', () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

// 요구 13.2: 앱 셸을 미리 캐시해서 오프라인에서 열린다.
describe('오프라인 캐시', () => {
  it('앱 셸 파일을 미리 캐시하고 화면 이동은 index.html로 돌린다', () => {
    const w = pwaOptions.workbox!;
    const glob = (w.globPatterns ?? []).join(',');
    for (const ext of ['js', 'css', 'html']) expect(glob).toContain(ext);
    expect(w.navigateFallback).toBe('/index.html');
  });
});
