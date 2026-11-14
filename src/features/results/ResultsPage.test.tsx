import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../data/db';
import { saveRecord } from '../../data/repositories';
import { emptyDraft, todayISO, type RegisterDraft } from '../../domain/types';
import { ResultsPage } from './ResultsPage';

const photo = { blob: new Blob(['a']), thumb: new Blob(['t']), width: 1, height: 1 };
const d = (p: Partial<RegisterDraft> = {}): RegisterDraft => ({
  ...emptyDraft(),
  itemName: '두부',
  productName: { kind: 'value', value: '국산콩 두부' },
  brand: { kind: 'value', value: '풀무원' },
  origin: { kind: 'value', value: { type: 'domestic' } },
  unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
  packUnit: '팩',
  bundleCount: 2,
  price: 3480,
  storeName: '이마트',
  ...p,
});

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}
function renderAt(url: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: url.split('?')[0], search: url.includes('?') ? '?' + url.split('?')[1] : '', state }]}>
      <Routes>
        <Route path="/items/:itemId" element={<ResultsPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const rowsText = () => screen.getAllByTestId('row').map((r) => within(r).getByTestId('unit-price').textContent);

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  sessionStorage.clear();
});

describe('검색 결과 화면 (작업 6)', () => {
  it('요구 5.1, 5.4, 4.4: 580원이 725원 위, 1위에 색과 최저가 배지', async () => {
    const { itemId } = await saveRecord(d({ price: 2900, bundleCount: 1, unitAmount: { kind: 'value', value: { amount: 400, unit: 'g' } }, storeName: '롯데' }), photo);
    await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(rowsText()).toEqual(['580원/100g', '725원/100g']);
    const first = screen.getAllByTestId('row')[0];
    expect(first.querySelector('.row')).toHaveClass('cheapest');
    expect(within(first).getByText(/최저가/)).toBeInTheDocument();
    expect(within(screen.getAllByTestId('row')[1]).queryByText(/최저가/)).toBeNull();
    expect(screen.getByText('전체 2건')).toBeInTheDocument();
  });

  it('요구 5.2: 영역이 위에서 아래 순서로 있다', async () => {
    const { id, itemId } = await saveRecord(d(), photo);
    await saveRecord(d({ price: 4000, storeName: '롯데' }), photo);
    await saveRecord(d({ unitAmount: { kind: 'na' }, storeName: '시장' }), photo);
    renderAt(`/items/${itemId}?mine=${id}`);
    await screen.findByRole('region', { name: '비교 불가' });
    const order = [
      screen.getByRole('heading', { name: '두부' }),
      screen.getByRole('region', { name: '내 상품 비교' }),
      screen.getByRole('tablist'),
      screen.getByRole('button', { name: /브랜드/ }),
      screen.getByRole('region', { name: '조건부 최저가' }),
      screen.getByRole('list', { name: '기록 목록' }),
      screen.getByRole('region', { name: '비교 불가' }),
      screen.getAllByRole('button', { name: '가격 등록' }).at(-1)!,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('요구 5.3, 5.5, 5.6: 행 내용, 온라인·배송비 포함, 90일 넘은 기록', async () => {
    const { itemId } = await saveRecord(d({ storeName: '쿠팡', storeIsOnline: true, shippingFee: { kind: 'value', value: 3000 }, origin: { kind: 'value', value: { type: 'import', country: '미국' } } }), photo);
    await saveRecord(d({ purchasedAt: '2020-01-01', storeName: '롯데' }), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    const [oldRow, online] = screen.getAllByTestId('row');
    expect(online).toHaveTextContent('3,480원 · 300g×2');
    expect(online).toHaveTextContent('국산콩 두부 · 풀무원 · 수입(미국)');
    expect(online).toHaveTextContent('쿠팡');
    expect(within(online).getByText('온라인')).toBeInTheDocument();
    expect(within(online).getByText('배송비 포함')).toBeInTheDocument();
    expect(online).toHaveTextContent(todayISO().replaceAll('-', '.'));
    expect(within(online).getByRole('button', { name: '사진 크게 보기' })).toBeInTheDocument();
    expect(within(oldRow).getByText('오래된 가격')).toBeInTheDocument();
    expect(oldRow.querySelector('.row')).toHaveClass('old');
    expect(within(online).queryByText('오래된 가격')).toBeNull();
  });

  it('요구 5.7, 11.6: 같은 상품+판매처는 최신만, 이전 기록 보기로 날짜순 이력', async () => {
    const { itemId } = await saveRecord(d({ purchasedAt: '2026-09-01', price: 3000 }), photo);
    await saveRecord(d({ purchasedAt: '2026-10-01', price: 3200 }), photo);
    await saveRecord(d({ purchasedAt: '2026-11-01', price: 3480 }), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: '이전 기록 보기 (2)' }));
    const hist = screen.getByRole('list', { name: '이전 기록' });
    expect(within(hist).getAllByRole('listitem').map((l) => l.textContent!.slice(0, 10))).toEqual(['2026.09.01', '2026.10.01']);
  });

  it('요구 5.8: 최신순 정렬', async () => {
    const { itemId } = await saveRecord(d({ price: 1000, purchasedAt: '2026-10-01' }), photo);
    await saveRecord(d({ price: 5000, purchasedAt: '2026-11-01', storeName: '롯데' }), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    await userEvent.selectOptions(screen.getByLabelText('정렬'), 'recent');
    expect(rowsText()[0]).toBe('833원/100g');
  });

  it('요구 6: 필터 여러 개 → 조건부 최저가, 칩 해제, 0건이면 필터 해제', async () => {
    const { itemId } = await saveRecord(d({ brand: { kind: 'value', value: 'CJ' }, price: 1000 }), photo);
    await saveRecord(d({ brand: { kind: 'value', value: '풀무원' }, price: 2000, storeName: 'a' }), photo);
    await saveRecord(d({ brand: { kind: 'na' }, price: 3000, storeName: 'b', bundleCount: 1 }), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /브랜드/ }));
    await u.click(screen.getByRole('checkbox', { name: /^풀무원/ }));
    await u.click(screen.getByRole('checkbox', { name: /^해당사항 없음/ }));
    expect(screen.getAllByTestId('row')).toHaveLength(2);
    expect(screen.getByRole('region', { name: '조건부 최저가' })).toHaveTextContent('2,000원');
    await u.click(screen.getByRole('button', { name: /번들/ }));
    await u.click(screen.getByRole('checkbox', { name: /^2개/ }));
    expect(screen.getAllByTestId('row')).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: '풀무원 필터 해제' }));
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
    expect(screen.getByText('조건에 맞는 기록이 없어요')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: '필터 해제' }));
    expect(screen.getAllByTestId('row')).toHaveLength(3);
  });

  it('요구 6.8: 다시 들어와도 필터와 프리셋 유지', async () => {
    const { id, itemId } = await saveRecord(d({ brand: { kind: 'value', value: 'CJ' } }), photo);
    await saveRecord(d({ storeName: 'a' }), photo);
    const first = renderAt(`/items/${itemId}?mine=${id}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    const u = userEvent.setup();
    await u.click(screen.getByRole('tab', { name: '똑같은 상품' }));
    expect(screen.getAllByTestId('row')).toHaveLength(1);
    first.unmount();
    renderAt(`/items/${itemId}?mine=${id}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    expect(screen.getByRole('tab', { name: '똑같은 상품' })).toHaveAttribute('aria-selected', 'true');
  });

  it('요구 7.1, 14.3, 14.4: 기본은 품목 전체, 내 상품이 없으면 다른 프리셋은 비활성이고 탭하면 이유를 알린다', async () => {
    const { itemId } = await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`);
    await screen.findAllByTestId('row');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['똑같은 상품', '용량 무관', '품목 전체']);
    expect(screen.getByRole('tab', { name: '품목 전체' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('같은 품목의 모든 기록을 비교해요');
    const exact = screen.getByRole('tab', { name: '똑같은 상품' });
    expect(exact).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(exact);
    expect(exact).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: '품목 전체' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('등록하거나 고른 상품이 있을 때 쓸 수 있어요');
  });

  it('요구 1.7, 8.3: 저장 후 내 상품 순위와 행 표시', async () => {
    const { itemId } = await saveRecord(d({ price: 1000 }), photo);
    const mine = await saveRecord(d({ price: 2000, storeName: 'a' }), photo);
    await saveRecord(d({ price: 3000, storeName: 'b' }), photo);
    renderAt(`/items/${itemId}?mine=${mine.id}`);
    const bar = await screen.findByRole('region', { name: '내 상품 비교' });
    expect(bar).toHaveTextContent('3건 중 2위');
    expect(bar).toHaveTextContent('최저가보다 167원 비싸요 (+100%)');
    expect(within(screen.getAllByTestId('row')[1]).getByText(/내 상품/)).toBeInTheDocument();
  });

  it('요구 8.4: 등록 화면 밖에서 오면 비교 바가 없다', async () => {
    const { itemId } = await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`);
    await screen.findAllByTestId('row');
    expect(screen.queryByRole('region', { name: '내 상품 비교' })).toBeNull();
  });

  it('저장 없이 비교만: 입력값이 내 상품 비교 바에 나온다', async () => {
    const { itemId } = await saveRecord(d({ price: 3480 }), photo);
    renderAt(`/items/${itemId}`, { draftAnchor: { unitPrice: { value: 500, per: 100, type: 'g' } } });
    const bar = await screen.findByRole('region', { name: '내 상품 비교' });
    expect(bar).toHaveTextContent('2건 중 1위');
    expect(bar).toHaveTextContent('80원 싸요');
  });

  it('요구 5.9: 기록 0건이면 안내와 두 버튼', async () => {
    const { id, itemId } = await saveRecord(d(), photo);
    await db.records.delete(id);
    renderAt(`/items/${itemId}`);
    expect(await screen.findByText('아직 기록이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가격 등록' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /온라인 가격 검색/ })).toBeInTheDocument();
  });

  it('요구 5.11, 5.12: 1건 안내, 단위 다른 기록은 비교 불가 구역', async () => {
    const { itemId } = await saveRecord(d(), photo);
    await saveRecord(d({ unitAmount: { kind: 'value', value: { amount: 500, unit: 'ml' } }, storeName: 'x' }), photo);
    renderAt(`/items/${itemId}`);
    expect(await screen.findByText('비교할 기록이 더 필요해요')).toBeInTheDocument();
    const g = screen.getByRole('region', { name: '비교 불가' });
    expect(g).toHaveTextContent('단위가 달라 비교할 수 없어요');
    expect(within(g).getAllByTestId('row')).toHaveLength(1);
    expect(within(g).queryByText(/최저가/)).toBeNull();
  });

  it('요구 5.13: 행을 누르면 상세로', async () => {
    const { id, itemId } = await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`);
    await userEvent.click((await screen.findAllByTestId('row'))[0].querySelector('.row')!);
    expect(screen.getByTestId('where')).toHaveTextContent(`/records/${id}`);
  });

  it('요구 5.14: 20건씩 보여주고 더 불러온다', async () => {
    let itemId = '';
    for (let i = 0; i < 45; i++) itemId = (await saveRecord(d({ price: 1000 + i, storeName: `s${i}` }), photo)).itemId;
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(20));
    await userEvent.click(screen.getByRole('button', { name: /더 보기/ }));
    expect(screen.getAllByTestId('row')).toHaveLength(40);
    await userEvent.click(screen.getByRole('button', { name: /더 보기/ }));
    expect(screen.getAllByTestId('row')).toHaveLength(45);
  });
});
