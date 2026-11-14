import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../data/db';
import { saveRecord } from '../../data/repositories';
import { emptyDraft, type RegisterDraft } from '../../domain/types';
import { NO_CANDIDATE } from '../../components/CandidateList';
import { HomePage } from './HomePage';

const photo = { blob: new Blob(['a']), thumb: new Blob(['t']), width: 1, height: 1 };
const base = (p: Partial<RegisterDraft> = {}): RegisterDraft => ({
  ...emptyDraft(),
  itemName: '두부',
  productName: { kind: 'value', value: '국산콩 두부' },
  brand: { kind: 'value', value: '풀무원' },
  origin: { kind: 'value', value: { type: 'domestic' } },
  unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
  packUnit: '모',
  bundleCount: 2,
  price: 3480,
  storeName: '이마트',
  ...p,
});

let lastState: unknown;
function Where() {
  const l = useLocation();
  lastState = l.state;
  return <div data-testid="where">{l.pathname}</div>;
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
  lastState = undefined;
});

describe('홈 빠른 비교 (요구 16)', () => {
  it('16.1: 홈 맨 위 첫 입력칸이 품명', () => {
    renderHome();
    const first = document.querySelector('main input');
    expect(first).toBe(screen.getByLabelText('품명'));
  });

  it('16.2, 16.6, 16.7, 16.10: 후보를 고르면 한 번에 채우고 "비교하기"로 저장 없이 이동', async () => {
    await saveRecord(base({ bundleCount: 4, price: 6200, storeName: '쿠팡', storeIsOnline: true }), photo);
    await saveRecord(base(), photo);
    const u = userEvent.setup();
    renderHome();
    await u.type(screen.getByLabelText('품명'), '국산');
    const opts = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(opts).toHaveLength(2); // 16.4: 번들이 다르면 별개 후보
    await u.click(screen.getByRole('button', { name: /국산콩 두부.*300g×2/ }));
    expect(screen.getByLabelText('품명')).toHaveValue('국산콩 두부');
    expect(screen.getByLabelText(/^품목 필수/)).toHaveValue('두부');
    expect(screen.getByLabelText('브랜드')).toHaveValue('풀무원');
    expect(screen.getByLabelText('포장단위')).toHaveValue('모');
    expect(screen.getByLabelText('단위용량')).toHaveValue(300);
    expect(screen.getByLabelText('번들묶음')).toHaveValue(2);
    expect(screen.getByLabelText(/^가격/)).toHaveValue(3480);
    expect(screen.getByTestId('prev-price')).toHaveTextContent('이전 가격');
    expect(screen.getByText('원산지: 국산')).toBeInTheDocument();
    // 고치면 "이전 가격" 표시가 사라진다
    await u.clear(screen.getByLabelText(/^가격/));
    await u.type(screen.getByLabelText(/^가격/), '3000');
    expect(screen.queryByTestId('prev-price')).not.toBeInTheDocument();
    // 원산지 바꾸기
    await u.click(screen.getByRole('button', { name: '원산지 바꾸기' }));
    await u.selectOptions(screen.getByLabelText('원산지'), 'import');
    expect(screen.getByText('원산지: 수입')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: '비교하기' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/items\//));
    const st = lastState as { draftAnchor: { unitPrice: { value: number } }; quick: boolean; registerDraft: RegisterDraft };
    expect(st.quick).toBe(true);
    expect(st.draftAnchor.unitPrice.value).toBe(500);
    expect(st.registerDraft.origin).toEqual({ kind: 'value', value: { type: 'import' } });
    expect(await db.records.count()).toBe(2);
  });

  it('16.8, 16.9: 후보가 없으면 안내, 품목만 입력해도 비교할 수 있다', async () => {
    await saveRecord(base({ productName: { kind: 'na' } }), photo);
    const u = userEvent.setup();
    renderHome();
    expect(screen.getByRole('button', { name: '비교하기' })).toBeDisabled();
    await u.type(screen.getByLabelText('품명'), '우유');
    expect(await screen.findByText(NO_CANDIDATE)).toBeInTheDocument();
    await u.type(screen.getByLabelText(/^품목 필수/), '두부');
    await u.click(screen.getByRole('button', { name: '비교하기' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/items\//));
  });

  it('16.12: "이 가격으로 등록"은 값과 이전 사진을 등록 화면으로 넘긴다', async () => {
    await saveRecord(base(), photo);
    const photoId = (await db.records.toArray())[0].photoId;
    const u = userEvent.setup();
    renderHome();
    await u.type(screen.getByLabelText('품명'), '풀무원');
    await u.click(await screen.findByRole('button', { name: /국산콩 두부/ }));
    await u.click(screen.getByRole('button', { name: '이 가격으로 등록' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/register'));
    const st = lastState as { registerDraft: RegisterDraft; priceIsPrevious: boolean };
    expect(st.registerDraft.price).toBe(3480);
    expect(st.registerDraft.bundleCount).toBe(2);
    expect(st.registerDraft.photo).toEqual({ kind: 'reused', photoId });
    expect(st.priceIsPrevious).toBe(true);
  });
});
