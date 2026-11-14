import { buildSearchQuery, googleUrl } from './searchQuery';

describe('buildSearchQuery (요구 9.3, 11.3)', () => {
  it('브랜드 + 품명 + 단위용량 + 가격', () => {
    expect(
      buildSearchQuery({
        itemName: '두부',
        brand: { kind: 'value', value: '노브랜드' },
        productName: { kind: 'value', value: '국산콩으로 만든 두부' },
        unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
      }),
    ).toBe('노브랜드 국산콩으로 만든 두부 300g 가격');
  });
  it('N/A 항목은 빼고 품명이 없으면 품목명을 쓴다', () => {
    expect(
      buildSearchQuery({ itemName: '양파', productName: { kind: 'na' }, brand: { kind: 'na' }, unitAmount: { kind: 'na' } }),
    ).toBe('양파 가격');
  });
  it('판매처 이름이 있으면 넣는다', () => {
    expect(buildSearchQuery({ itemName: '두부' }, '쿠팡')).toBe('두부 쿠팡 가격');
  });
});

describe('googleUrl (요구 9.2, 9.5)', () => {
  it('구글 검색 주소를 인코딩해서 만든다', () => {
    const url = googleUrl('노브랜드 두부 300g 가격');
    expect(url).toBe('https://www.google.com/search?q=' + encodeURIComponent('노브랜드 두부 300g 가격'));
    expect(new URL(url).hostname).toBe('www.google.com');
    expect(new URL(url).searchParams.get('q')).toBe('노브랜드 두부 300g 가격');
  });
});
