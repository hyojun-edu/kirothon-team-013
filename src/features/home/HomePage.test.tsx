import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../data/db';
import { listItems, saveRecord } from '../../data/repositories';
import { emptyDraft, type RegisterDraft } from '../../domain/types';
import { HomePage } from './HomePage';

// 작업 17: 홈 정리 (요구 16.15~16.18, 인수 기준 51~53)
const photo = { blob: new Blob(['a']), thumb: new Blob(['t']), width: 1, height: 1 };
const d = (p: Partial<RegisterDraft> = {}): RegisterDraft => ({
  ...emptyDraft(),
  itemName: '두부',
  productName: { kind: 'value', value: '행복한콩' },
  brand: { kind: 'value', value: 'CJ' },
  unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
  packUnit: '모',
  bundleCount: 1,
  price: 1980,
  storeName: '이마트',
  ...p,
});
function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}
const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('홈 정리 (작업 17)', () => {
  it('16.15: 품목 검색칸이 없다', async () => {
    renderHome();
    await screen.findByText('아직 품목이 없어요. 첫 가격을 등록해 보세요');
    expect(screen.queryByLabelText('품목 검색')).not.toBeInTheDocument();
    expect(screen.queryByText('품목 검색')).not.toBeInTheDocument();
  });

  it('16.15, 인수 기준 53: 빠른 비교에 품목 이름만 입력해도 후보가 나온다', async () => {
    await saveRecord(d(), photo);
    const u = userEvent.setup();
    renderHome();
    await u.type(screen.getByLabelText('품명'), '두부');
    expect(within(await screen.findByRole('listbox')).getByRole('button', { name: /행복한콩/ })).toBeInTheDocument();
  });

  it('16.16: 칩은 품목 이름 + 건수, 최근 구매 순, 링크, 같은 이름은 한 번', async () => {
    const a = await saveRecord(d({ purchasedAt: '2026-10-01' }), photo);
    await saveRecord(d({ purchasedAt: '2026-09-01', price: 2000 }), photo);
    const b = await saveRecord(d({ itemName: '우유', productName: { kind: 'value', value: '서울우유' }, purchasedAt: '2026-11-01' }), photo);
    await saveRecord(d({ itemName: '계란', productName: { kind: 'value', value: '왕란' }, purchasedAt: '2026-08-01' }), photo);
    expect((await listItems()).map((i) => [i.name, i.recordCount])).toEqual([
      ['우유', 1],
      ['두부', 2],
      ['계란', 1],
    ]);
    renderHome();
    const chips = await screen.findAllByRole('link', { name: /기록 \d+건$/ });
    expect(chips.map((c) => c.textContent)).toEqual(['우유 1', '두부 2', '계란 1']);
    expect(chips[0]).toHaveAttribute('href', `/items/${b.itemId}`);
    expect(chips[1]).toHaveAttribute('href', `/items/${a.itemId}`);
    expect(chips[1]).toHaveAccessibleName('두부 기록 2건');
  });

  it('16.17: 칩을 누르면 그 품목 결과 화면으로 (anchor 없이)', async () => {
    const { itemId } = await saveRecord(d(), photo);
    const u = userEvent.setup();
    renderHome();
    await u.click(await screen.findByRole('link', { name: '두부 기록 1건' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/items/${itemId}`);
  });

  it('16.18: 기록 0건이면 안내와 가격 등록 버튼', async () => {
    const u = userEvent.setup();
    renderHome();
    expect(await screen.findByText('아직 품목이 없어요. 첫 가격을 등록해 보세요')).toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /기록 \d+건$/ })).toHaveLength(0);
    await u.click(screen.getAllByRole('button', { name: '가격 등록' })[0]);
    expect(screen.getByTestId('where')).toHaveTextContent('/register');
  });

  it('15.6: 순서는 빠른 비교 → 내 품목 → 최근 기록 → 하단 가격 등록', async () => {
    await saveRecord(d(), photo);
    renderHome();
    await screen.findByRole('link', { name: '두부 기록 1건' });
    const order = [screen.getByLabelText('품명'), screen.getByRole('heading', { name: '내 품목' }), screen.getByRole('heading', { name: '최근 기록' }), document.querySelector('.bottom-bar')!];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
