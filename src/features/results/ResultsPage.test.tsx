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
    // 요구 6.5: 필터가 없으면 배지는 "최저가" (조건 내 아님), 따로 된 최저가 카드는 없다 (요구 5.2)
    expect(first.querySelector('.badge-cheapest')).toHaveTextContent(/^\s*🏆\s*최저가$/);
    expect(screen.queryByRole('region', { name: '조건부 최저가' })).not.toBeInTheDocument();
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

  it('요구 6: 필터 여러 개 → 1위 카드가 조건 내 최저가, 칩 해제, 0건이면 필터 해제', async () => {
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
    // 요구 5.2, 6.5: 따로 된 최저가 카드는 없고, 1위 카드 배지가 "조건 내 최저가"
    expect(screen.queryByRole('region', { name: '조건부 최저가' })).not.toBeInTheDocument();
    const first = screen.getAllByTestId('row')[0];
    expect(first).toHaveTextContent('2,000원');
    expect(first).toHaveTextContent('조건 내 최저가');
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

describe('홈 빠른 비교에서 온 결과 화면 (요구 16.10, 16.11)', () => {
  const anchor = (amount: number) => ({
    productName: { kind: 'value', value: '국산콩 두부' },
    brand: { kind: 'value', value: '풀무원' },
    unitAmount: { kind: 'value', value: { amount, unit: 'g' } },
    unitPrice: { value: 500, per: 100, type: 'g' },
  });
  it('똑같은 상품 기록이 있으면 "똑같은 상품" 탭으로 시작하고 비교 바와 "이 가격으로 등록"', async () => {
    const { itemId } = await saveRecord(d(), photo);
    await saveRecord(d({ productName: { kind: 'value', value: '부침두부' }, storeName: '롯데' }), photo);
    renderAt(`/items/${itemId}`, { draftAnchor: anchor(300), quick: true, registerDraft: d({ storeName: '' }), priceIsPrevious: true });
    await waitFor(() => expect(screen.getByRole('tab', { name: '똑같은 상품' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: '용량 무관' })).not.toHaveAttribute('aria-disabled');
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    expect(screen.getByRole('region', { name: '내 상품 비교' })).toHaveTextContent('2건 중 1위');
    await userEvent.click(screen.getByRole('button', { name: '이 가격으로 등록' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/register');
  });
  it('똑같은 상품 기록이 없으면 "품목 전체" 탭으로 시작', async () => {
    const { itemId } = await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`, { draftAnchor: anchor(999), quick: true });
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    expect(screen.getByRole('tab', { name: '품목 전체' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '똑같은 상품' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('기간 필터 (요구 6.9~6.13, 작업 16)', () => {
  const ago = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return todayISO(d);
  };
  async function seed3() {
    const { itemId } = await saveRecord(d({ price: 2000, purchasedAt: ago(120), storeName: '시장' }), photo); // 333원
    await saveRecord(d({ price: 3480, purchasedAt: ago(5), storeName: '이마트' }), photo); // 580원
    await saveRecord(d({ price: 4000, purchasedAt: ago(40), storeName: '롯데' }), photo); // 667원
    return itemId;
  }
  const pickPeriod = async (label: string) => {
    await userEvent.click(screen.getByRole('button', { name: /^기간|^최근/, expanded: false }));
    await userEvent.click(within(screen.getByRole('dialog', { name: '기간 선택' })).getByRole('radio', { name: label }));
    await userEvent.click(screen.getByRole('button', { name: '적용' }));
  };

  it('6.9~6.12: 최근 90일을 고르면 오래된 기록이 빠지고, 알약 글자·칩·안내, 모두 보기로 전체', async () => {
    const itemId = await seed3();
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
    await pickPeriod('최근 90일');
    await waitFor(() => expect(rowsText()).toEqual(['580원/100g', '667원/100g']));
    expect(screen.getAllByTestId('row')[0].querySelector('.badge-cheapest')).toHaveTextContent('조건 내 최저가');
    expect(screen.getByRole('button', { name: /^최근 90일/, expanded: false })).toBeInTheDocument();
    expect(screen.getByText(/오래된 기록 1건을 숨겼어요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '모두 보기' }));
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
    // 칩에서 해제
    await pickPeriod('최근 30일');
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    const chips = screen.getByLabelText('적용된 필터');
    await userEvent.click(within(chips).getByRole('button', { name: /최근 30일/ }));
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
  });

  it('6.12: 같은 품목으로 다시 들어와도 기간 유지', async () => {
    const itemId = await seed3();
    const { unmount } = renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
    await pickPeriod('최근 90일');
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    unmount();
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getByRole('button', { name: /^최근 90일/, expanded: false })).toBeInTheDocument();
  });

  it('6.13: 기간 때문에 0건이면 안내와 모두 보기', async () => {
    const { itemId } = await saveRecord(d({ purchasedAt: ago(200) }), photo);
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    await pickPeriod('최근 30일');
    expect(await screen.findByText('이 기간에는 기록이 없어요')).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 기록이 없어요')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '모두 보기' }));
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
  });

  it('16.4: "오래된 가격" 라벨을 누르면 90일 넘은 기록 숨기기를 제안하고 누르면 최근 90일', async () => {
    const itemId = await seed3();
    renderAt(`/items/${itemId}`);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: '오래된 가격' }));
    expect(screen.queryByTestId('where')).toBeNull(); // 상세로 가지 않는다
    await userEvent.click(screen.getByRole('button', { name: '90일 넘은 기록 숨기기' }));
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(2));
    expect(screen.getByRole('button', { name: /^최근 90일/, expanded: false })).toBeInTheDocument();
  });
});

// 요구 9.3, 10.2: 저장 전 내 상품(빠른 비교, 저장 없이 비교만)으로 들어오면
// 온라인 검색어와 돌아와서 미리 채울 값은 최저가 기록이 아니라 내 상품을 따른다.
describe('저장 전 내 상품의 온라인 가격 검색', () => {
  const anchor = {
    productName: { kind: 'value', value: '국산콩 두부' },
    brand: { kind: 'value', value: '풀무원' },
    unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
    unitPrice: { value: 580, per: 100, type: 'g' },
  } as const;

  async function setup(state: unknown) {
    vi.spyOn(window, 'open').mockImplementation((() => ({ opener: window }) as unknown as Window) as typeof window.open);
    // 최저가는 다른 상품(노브랜드 부침두부)
    const { itemId } = await saveRecord(
      d({ productName: { kind: 'value', value: '부침두부' }, brand: { kind: 'value', value: '노브랜드' }, unitAmount: { kind: 'value', value: { amount: 550, unit: 'g' } }, bundleCount: 1, price: 2480 }),
      photo,
    );
    renderAt(`/items/${itemId}`, state);
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    const u = userEvent.setup();
    await u.click(screen.getAllByRole('button', { name: /온라인 가격 검색/ })[0]);
    return u;
  }

  it('빠른 비교: 검색어와 미리 채울 값이 내 상품이다', async () => {
    const u = await setup({ draftAnchor: anchor, quick: true, registerDraft: d({ price: 3480 }), priceIsPrevious: true });
    expect(screen.getByLabelText('검색어')).toHaveValue('풀무원 국산콩 두부 300g 가격');
    await u.click(screen.getByRole('button', { name: '구글에서 열기' }));
    const p = JSON.parse(sessionStorage.getItem([...Array(sessionStorage.length).keys()].map((i) => sessionStorage.key(i)!).find((k) => sessionStorage.getItem(k)!.includes('"mode"'))!)!);
    expect(p.from).toBeUndefined();
    expect(p.draft.productName).toEqual({ kind: 'value', value: '국산콩 두부' });
    expect(p.draft.bundleCount).toBe(2);
    // 요구 10.3: 가격, 판매처, 배송비, 사진은 비운다
    expect(p.draft.price).toBeNull();
    expect(p.draft.storeName).toBe('');
    expect(p.draft.photo).toEqual({ kind: 'empty' });
  });

  it('저장 없이 비교만: 입력값만 있어도 검색어가 내 상품이다', async () => {
    await setup({ draftAnchor: anchor });
    expect(screen.getByLabelText('검색어')).toHaveValue('풀무원 국산콩 두부 300g 가격');
  });
});
