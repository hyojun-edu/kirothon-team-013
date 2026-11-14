import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../../App';
import { db } from '../../data/db';
import { getRecordView, listRecordViews, saveRecord } from '../../data/repositories';
import { emptyDraft, todayISO, type RegisterDraft } from '../../domain/types';

vi.mock('../../data/image', () => ({
  processPhoto: vi.fn(async () => ({ blob: new Blob(['m']), thumb: new Blob(['t']), width: 1, height: 1 })),
}));

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
  note: '세일',
  ...p,
});
function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}
const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <Where />
    </MemoryRouter>,
  );
const where = () => screen.getByTestId('where').textContent!;
let opened: string[] = [];
let blockPopup = false;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  sessionStorage.clear();
  opened = [];
  blockPopup = false;
  vi.spyOn(window, 'open').mockImplementation(((url: string) => {
    opened.push(url);
    return blockPopup ? null : ({ opener: window } as unknown as Window);
  }) as typeof window.open);
});

describe('기록 상세 (작업 7.1, 요구 12)', () => {
  it('모든 필드, 사진 확대, 수정 화면 이동', async () => {
    const { id } = await saveRecord(d(), photo);
    renderAt(`/records/${id}`);
    await screen.findByText('기록 상세');
    for (const t of ['두부', '국산콩 두부', '풀무원', '국산', '팩', '300g', '2개', '3,480원', '이마트', '세일']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: '사진 크게 보기' }));
    expect(screen.getByRole('button', { name: '사진 닫기' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '사진 닫기' }));
    await userEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(where()).toBe(`/records/${id}/edit`);
  });

  it('요구 12.2, 12.3: 삭제는 확인 후, 목록 순위와 최저가가 다시 계산된다', async () => {
    const cheap = await saveRecord(d({ price: 1000 }), photo);
    await saveRecord(d({ price: 3000, storeName: '롯데' }), photo);
    renderAt(`/records/${cheap.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
    const dlg = screen.getByRole('dialog', { name: '삭제 확인' });
    expect(dlg).toHaveTextContent('되돌릴 수 없어요');
    await userEvent.click(within(dlg).getByRole('button', { name: '취소' }));
    expect(await db.records.count()).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
    await waitFor(() => expect(where()).toBe(`/items/${cheap.itemId}`));
    expect(await db.records.count()).toBe(1);
    await waitFor(() => expect(screen.getByRole('region', { name: '조건부 최저가' })).toHaveTextContent('3,000원'));
  });
});

describe('온라인 가격 검색 (작업 7.2, 요구 9)', () => {
  it('온라인 기록이 없는 품목에서도 검색어를 고쳐 구글 새 탭을 연다', async () => {
    const { itemId } = await saveRecord(d(), photo);
    renderAt(`/items/${itemId}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /온라인 가격 검색/ }));
    const input = screen.getByLabelText('검색어');
    expect(input).toHaveValue('풀무원 국산콩 두부 300g 가격');
    await u.clear(input);
    await u.type(input, '풀무원 두부 가격');
    await u.click(screen.getByRole('button', { name: '구글에서 열기' }));
    expect(opened).toEqual(['https://www.google.com/search?q=' + encodeURIComponent('풀무원 두부 가격')]);
    expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/www\.google\.com\/search\?q=/), '_blank');
  });

  it('팝업이 막히면 같은 주소를 링크로 보여준다', async () => {
    blockPopup = true;
    const { id } = await saveRecord(d(), photo);
    renderAt(`/records/${id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /온라인 가격 검색/ }));
    await u.click(screen.getByRole('button', { name: '구글에서 열기' }));
    const link = screen.getByRole('link', { name: /직접 여세요/ });
    expect(link).toHaveAttribute('href', opened[0]);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('등록 화면에도 온라인 가격 검색이 있다 (요구 9.1)', async () => {
    renderAt('/register');
    expect(screen.getByRole('button', { name: /온라인 가격 검색/ })).toBeInTheDocument();
  });
});

describe('돌아와서 등록 (작업 7.3, 요구 10)', () => {
  it('검색 후 "온라인 가격 등록"을 누르면 상품 정보만 채운 등록 화면', async () => {
    const { itemId } = await saveRecord(d({ shippingFee: { kind: 'value', value: 2500 }, storeIsOnline: true, storeName: '쿠팡' }), photo);
    renderAt(`/items/${itemId}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /온라인 가격 검색/ }));
    await u.click(screen.getByRole('button', { name: '구글에서 열기' }));
    await u.click(screen.getByRole('button', { name: '온라인 가격 등록' }));
    expect(where()).toMatch(/^\/register\?from=.+&mode=search$/);
    await waitFor(() => expect(screen.getByLabelText(/^품목/)).toHaveValue('두부'));
    expect(screen.getByLabelText('품명 입력')).toHaveValue('국산콩 두부');
    expect(screen.getByLabelText('브랜드 입력')).toHaveValue('풀무원');
    expect(screen.getByLabelText('국산')).toBeChecked();
    expect(screen.getByLabelText(/^포장단위/)).toHaveValue('팩');
    expect(screen.getByLabelText('단위용량')).toHaveValue(300);
    expect(screen.getByLabelText(/^번들묶음/)).toHaveValue(2);
    expect(screen.getByLabelText(/^가격/)).toHaveValue(null);
    expect(screen.getByLabelText(/^판매처/)).toHaveValue('');
    expect(screen.queryByLabelText('배송비')).toBeNull();
    expect(screen.getByText('사진 없음')).toBeInTheDocument();
    expect(screen.getByLabelText(/^메모/)).toHaveValue('');
    expect(screen.getByLabelText(/^날짜/)).toHaveValue(todayISO());
  });

  it('"이 기록으로 새로 등록"도 같고, 고쳐 저장해도 원래 기록은 그대로 (요구 10.4, 10.5)', async () => {
    const { id } = await saveRecord(d(), photo);
    const before = await getRecordView(id);
    renderAt(`/records/${id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: '이 기록으로 새로 등록' }));
    await waitFor(() => expect(screen.getByLabelText(/^번들묶음/)).toHaveValue(2));
    expect(screen.getByLabelText(/^가격/)).toHaveValue(null);
    expect(screen.getByLabelText(/^판매처/)).toHaveValue('');
    await u.clear(screen.getByLabelText(/^번들묶음/));
    await u.type(screen.getByLabelText(/^번들묶음/), '6');
    await u.type(screen.getByLabelText(/^가격/), '9000');
    await u.type(screen.getByLabelText(/^판매처/), '홈플러스');
    fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await u.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(where()).toMatch(/^\/items\//));
    expect(await getRecordView(id)).toEqual(before);
    expect(await db.records.count()).toBe(2);
  });
});

describe('최신가격 다시 검색 (작업 7.4, 요구 11)', () => {
  it('오프라인 기록에는 없다', async () => {
    const { id } = await saveRecord(d(), photo);
    renderAt(`/records/${id}`);
    await screen.findByRole('button', { name: '이 기록으로 새로 등록' });
    expect(screen.queryByRole('button', { name: /최신가격 다시 검색/ })).toBeNull();
  });

  it('온라인 기록: 판매처를 넣어 검색, 돌아와 등록하면 판매처·배송비 채움, 새 기록 추가, 이력', async () => {
    const orig = await saveRecord(d({ storeName: '쿠팡', storeIsOnline: true, shippingFee: { kind: 'value', value: 3000 }, purchasedAt: '2026-10-01' }), photo);
    const before = await getRecordView(orig.id);
    renderAt(`/records/${orig.id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /최신가격 다시 검색/ }));
    expect(screen.getByLabelText('검색어')).toHaveValue('풀무원 국산콩 두부 300g 쿠팡 가격');
    await u.click(screen.getByRole('button', { name: '구글에서 열기' }));
    expect(new URL(opened[0]).hostname).toBe('www.google.com');
    await u.click(screen.getByRole('button', { name: '온라인 가격 등록' }));
    await waitFor(() => expect(screen.getByLabelText(/^판매처/)).toHaveValue('쿠팡'));
    expect(screen.getByLabelText('배송비')).toHaveValue(3000);
    expect(screen.getByLabelText(/^가격/)).toHaveValue(null);
    expect(screen.getByText('사진 없음')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^가격/), '3200');
    fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await u.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(where()).toMatch(/^\/items\/.+\?mine=/));
    expect(await getRecordView(orig.id)).toEqual(before);
    const all = await listRecordViews(orig.itemId);
    expect(all).toHaveLength(2);
    expect(all.every((r) => r.productId === before!.productId && r.storeId === before!.storeId)).toBe(true);
    // 목록에는 최신 1건만, 이력으로 이전 가격
    await waitFor(() => expect(screen.getAllByTestId('row')).toHaveLength(1));
    expect(screen.getAllByTestId('row')[0]).toHaveTextContent('3,200원');
    await u.click(screen.getByRole('button', { name: '이전 기록 보기 (1)' }));
    expect(screen.getByRole('list', { name: '이전 기록' })).toHaveTextContent('2026.10.01 · 3,480원');
  });
});

describe('홈 (작업 8)', () => {
  it('최근 기록, 품목 검색으로 결과 화면, 가격 등록 버튼', async () => {
    const { itemId } = await saveRecord(d(), photo);
    renderAt('/');
    expect(await screen.findByRole('link', { name: /두부/ })).toHaveAttribute('href', `/items/${itemId}`);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('품목 검색'), '두');
    await u.click(await screen.findByRole('button', { name: '두부' }));
    expect(where()).toBe(`/items/${itemId}`);
  });
  it('없는 품목이면 안내와 가격 등록', async () => {
    renderAt('/');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('품목 검색'), '사과{Enter}');
    expect(await screen.findByText('아직 기록이 없어요')).toBeInTheDocument();
    await u.click(screen.getAllByRole('button', { name: '가격 등록' })[0]);
    expect(where()).toBe('/register?item=' + encodeURIComponent('사과'));
  });
});
