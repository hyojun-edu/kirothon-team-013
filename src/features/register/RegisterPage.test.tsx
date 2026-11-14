import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../../data/db';
import { getRecordView, saveRecord } from '../../data/repositories';
import { emptyDraft, todayISO, type RegisterDraft } from '../../domain/types';
import { RegisterPage } from './RegisterPage';

vi.mock('../../data/image', () => ({
  processPhoto: vi.fn(async () => ({ blob: new Blob(['m']), thumb: new Blob(['t']), width: 1, height: 1 })),
}));

const photo = { blob: new Blob(['a']), thumb: new Blob(['t']), width: 1, height: 1 };
const base = (p: Partial<RegisterDraft> = {}): RegisterDraft => ({
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
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/records/:id/edit" element={<RegisterPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const user = () => userEvent.setup();

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

async function fillRequired(u: ReturnType<typeof user>, opts: { photo?: boolean } = {}) {
  await u.type(screen.getByLabelText(/^품목/), '두부');
  await u.type(screen.getByLabelText(/^가격/), '2900');
  await u.type(screen.getByLabelText(/^판매처/), '동네마트');
  if (opts.photo !== false) fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
}

describe('가격 등록 화면 (작업 5)', () => {
  it('요구 1.4: 품명부터 시작하고 design 순서를 따른다', () => {
    renderAt('/register');
    const labels = [...document.querySelectorAll('form legend, form label.lbl, form .ac > label')].map((e) => e.textContent!.trim());
    const order = ['품명', '품목', '원산지', '브랜드', '포장단위', '단위용량', '번들묶음', '가격', '판매처', '날짜', '사진'];
    const idx = order.map((w) => labels.findIndex((l) => l.startsWith(w)));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(idx.every((v) => v >= 0)).toBe(true);
  });

  it('요구 1.3: 날짜는 오늘로 자동 입력되고 고칠 수 있다', async () => {
    renderAt('/register');
    const date = screen.getByLabelText(/^날짜/) as HTMLInputElement;
    expect(date.value).toBe(todayISO());
    fireEvent.change(date, { target: { value: '2026-01-02' } });
    expect(date.value).toBe('2026-01-02');
  });

  it('요구 1.1, 1.2: 사진 없이는 저장 버튼이 막히고 안내가 보인다', async () => {
    const u = user();
    renderAt('/register');
    await fillRequired(u, { photo: false });
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText('사진이 있어야 저장할 수 있어요')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
  });

  it('요구 2.4: 필수 항목에는 해당사항 없음이 없다, 선택 항목에는 있다', () => {
    renderAt('/register');
    const legends = [...document.querySelectorAll('fieldset')].filter((f) => f.textContent!.includes('해당사항 없음')).map((f) => f.querySelector('legend')!.textContent);
    expect(legends.join(',')).toMatch(/품명.*원산지.*브랜드.*단위용량/);
    expect(legends.some((l) => /품목|가격|판매처|날짜|사진/.test(l!))).toBe(false);
  });

  it('요구 1.5, 1.6: 온라인 판매처일 때만 배송비 입력란', async () => {
    const u = user();
    renderAt('/register');
    expect(screen.queryByLabelText('배송비')).toBeNull();
    await u.click(screen.getByLabelText('온라인 판매처'));
    expect(screen.getByLabelText('배송비')).toBeInTheDocument();
    await u.click(screen.getByLabelText('온라인 판매처'));
    expect(screen.queryByLabelText('배송비')).toBeNull();
  });

  it('요구 1.5: 이전에 온라인으로 등록한 판매처를 고르면 배송비가 열린다 (요구 3.6)', async () => {
    await saveRecord(base({ storeName: '쿠팡', storeIsOnline: true }), photo);
    const u = user();
    renderAt('/register');
    await u.type(screen.getByLabelText(/^판매처/), '쿠');
    await u.click(await screen.findByRole('button', { name: '쿠팡 (온라인)' }));
    expect(screen.getByLabelText('배송비')).toBeInTheDocument();
  });

  it('요구 3.1~3.4, 16.13: 품명 자동완성 후보를 고르면 상품 정보와 이전 가격을 채우고 판매처는 비운다', async () => {
    await saveRecord(base(), photo);
    const u = user();
    renderAt('/register');
    await u.type(screen.getByLabelText('품명 입력'), '국산');
    await u.click(await screen.findByRole('button', { name: /국산콩 두부.*풀무원.*300g×2/ }));
    expect(screen.getByLabelText(/^품목/)).toHaveValue('두부');
    expect(screen.getByLabelText('브랜드 입력')).toHaveValue('풀무원');
    expect(screen.getByLabelText('단위용량')).toHaveValue(300);
    expect(screen.getByLabelText(/^번들묶음/)).toHaveValue(2);
    expect(screen.getByLabelText(/^포장단위/)).toHaveValue('팩');
    expect(screen.getByLabelText('국산')).toBeChecked();
    // 요구 3.4(변경): 가격은 "이전 가격"으로 채우고, 고치면 표시를 뗀다
    expect(screen.getByLabelText(/^가격/)).toHaveValue(3480);
    expect(screen.getByTestId('prev-price')).toHaveTextContent('이전 가격');
    expect(screen.getByLabelText(/^판매처/)).toHaveValue('');
    await u.clear(screen.getByLabelText(/^가격/));
    await u.type(screen.getByLabelText(/^가격/), '3000');
    expect(screen.queryByTestId('prev-price')).not.toBeInTheDocument();
    // 요구 3.3: 고칠 수 있다
    await u.clear(screen.getByLabelText(/^번들묶음/));
    await u.type(screen.getByLabelText(/^번들묶음/), '6');
    expect(screen.getByLabelText(/^번들묶음/)).toHaveValue(6);
  });

  it('요구 3.5: 품명이 N/A이면 품목으로 같은 자동완성', async () => {
    await saveRecord(base({ itemName: '양파', productName: { kind: 'na' }, packUnit: '망' }), photo);
    const u = user();
    renderAt('/register');
    await u.click(screen.getAllByLabelText('해당사항 없음')[0]);
    await u.type(screen.getByLabelText(/^품목/), '양');
    await u.click(await screen.findByRole('button', { name: /^양파/ }));
    expect(screen.getByLabelText(/^포장단위/)).toHaveValue('망');
  });

  it('요구 8.1, 8.2: 가격을 넣으면 저장 전에 순위와 최저가 차이를 보여준다', async () => {
    await saveRecord(base({ price: 3480 }), photo); // 580원/100g
    await saveRecord(base({ price: 2900, bundleCount: 1, unitAmount: { kind: 'value', value: { amount: 400, unit: 'g' } }, storeName: '롯데' }), photo); // 725
    const u = user();
    renderAt('/register');
    await u.type(screen.getByLabelText(/^품목/), '두부');
    await u.type(screen.getByLabelText('단위용량'), '100');
    await u.type(screen.getByLabelText(/^가격/), '650');
    const bar = await screen.findByRole('region', { name: '지금 이 가격' });
    expect(bar).toHaveTextContent('650원/100g');
    await waitFor(() => expect(bar).toHaveTextContent('3건 중 2위'));
    expect(bar).toHaveTextContent('최저가보다 70원 비싸요 (+12%)');
    await u.click(screen.getByRole('button', { name: '저장 없이 비교만' }));
    expect(screen.getByTestId('where').textContent).toMatch(/^\/items\//);
    expect(await db.records.count()).toBe(2);
  });

  it('요구 1.7: 저장하면 비교 목록으로 가고 내 기록을 넘긴다', async () => {
    const u = user();
    renderAt('/register');
    await fillRequired(u);
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await u.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/items\/[\w-]+\?mine=[\w-]+$/));
    expect(await db.records.count()).toBe(1);
  });

  it('요구 10.4, 11.4: 미리 채운 등록 (clone은 판매처 비움, refresh는 판매처·배송비 채움)', async () => {
    const { id } = await saveRecord(base({ storeName: '쿠팡', storeIsOnline: true, shippingFee: { kind: 'value', value: 3000 } }), photo);
    const { unmount } = renderAt(`/register?from=${id}&mode=clone`);
    await waitFor(() => expect(screen.getByLabelText(/^품목/)).toHaveValue('두부'));
    expect(screen.getByLabelText(/^판매처/)).toHaveValue('');
    expect(screen.getByLabelText(/^가격/)).toHaveValue(null);
    unmount();
    renderAt(`/register?from=${id}&mode=refresh`);
    await waitFor(() => expect(screen.getByLabelText(/^판매처/)).toHaveValue('쿠팡'));
    expect(screen.getByLabelText('배송비')).toHaveValue(3000);
    expect(screen.getByLabelText(/^가격/)).toHaveValue(null);
    expect(screen.getByText('사진 없음')).toBeInTheDocument();
  });

  it('요구 12.1: 수정 화면은 기존 값으로 열리고 저장하면 바뀐다', async () => {
    const { id } = await saveRecord(base(), photo);
    const u = user();
    renderAt(`/records/${id}/edit`);
    await waitFor(() => expect(screen.getByLabelText(/^가격/)).toHaveValue(3480));
    await u.clear(screen.getByLabelText(/^가격/));
    await u.type(screen.getByLabelText(/^가격/), '3000');
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await u.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain(`mine=${id}`));
    expect((await getRecordView(id))!.price).toBe(3000);
  });

  describe('이전 사진 불러오기 (작업 11, 요구 3.7~3.11)', () => {
    const pickTofu = async (u: ReturnType<typeof user>) => {
      await u.type(screen.getByLabelText('품명 입력'), '국산');
      await u.click(await screen.findByRole('button', { name: /국산콩 두부.*풀무원.*300g×2/ }));
    };
    const fillPriceStore = async (u: ReturnType<typeof user>) => {
      await u.clear(screen.getByLabelText(/^가격/)); // 요구 3.4: 이전 가격이 채워져 있다
      await u.type(screen.getByLabelText(/^가격/), '2900');
      await u.type(screen.getByLabelText(/^판매처/), '동네마트');
    };

    it('인수 23, 요구 3.7, 3.8: 가장 최근 사진을 "이전 사진"으로 채우고 새로 올리지 않아도 저장한다', async () => {
      const old = await saveRecord(base({ purchasedAt: '2026-01-01' }), photo);
      const latest = await saveRecord(base({ purchasedAt: '2026-10-01', storeName: '롯데' }), { ...photo, thumb: new Blob(['latest']) });
      const latestPhoto = (await getRecordView(latest.id))!.photoId;
      expect((await getRecordView(old.id))!.photoId).not.toBe(latestPhoto);
      const u = user();
      renderAt('/register');
      await pickTofu(u);
      expect(await screen.findByTestId('reused-photo')).toHaveTextContent('이전 사진');
      expect(await screen.findByRole('img', { name: '이전 사진' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /다시 촬영/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /갤러리에서 선택/ })).toBeInTheDocument();
      await fillPriceStore(u);
      await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
      await u.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/mine=/));
      const mine = screen.getByTestId('where').textContent!.split('mine=')[1];
      expect((await getRecordView(mine))!.photoId).toBe(latestPhoto);
      expect(await db.photos.count()).toBe(2); // 새 Photo를 만들지 않았다
    });

    it('인수 24, 요구 3.9: 갤러리에서 바꾸면 새 사진으로 저장하고 이전 기록 사진은 그대로', async () => {
      const old = await saveRecord(base(), photo);
      const oldPhoto = (await getRecordView(old.id))!.photoId;
      const u = user();
      renderAt('/register');
      await pickTofu(u);
      await screen.findByTestId('reused-photo');
      fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
      await waitFor(() => expect(screen.queryByTestId('reused-photo')).toBeNull());
      await fillPriceStore(u);
      await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
      await u.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/mine=/));
      const mine = screen.getByTestId('where').textContent!.split('mine=')[1];
      expect((await getRecordView(mine))!.photoId).not.toBe(oldPhoto);
      expect((await getRecordView(old.id))!.photoId).toBe(oldPhoto);
      expect(await db.photos.get(oldPhoto)).toBeDefined();
      expect(await db.photos.count()).toBe(2);
    });

    it('인수 25, 요구 3.10: 이전 사진이 없으면 빈 칸이고 사진 없이는 저장할 수 없다', async () => {
      const old = await saveRecord(base(), photo);
      await db.photos.delete((await getRecordView(old.id))!.photoId);
      const u = user();
      renderAt('/register');
      await pickTofu(u);
      await fillPriceStore(u);
      expect(screen.getByLabelText(/^품목/)).toHaveValue('두부');
      expect(screen.getByText('사진 없음')).toBeInTheDocument();
      expect(screen.queryByTestId('reused-photo')).toBeNull();
      expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
      expect(screen.getByText('사진이 있어야 저장할 수 있어요')).toBeInTheDocument();
    });

    for (const mode of ['search', 'clone', 'refresh'] as const) {
      it(`인수 26, 요구 3.11: ${mode} 경로로 연 등록 화면은 사진이 비어 있다`, async () => {
        const { id } = await saveRecord(base({ storeName: '쿠팡', storeIsOnline: true }), photo);
        renderAt(`/register?from=${id}&mode=${mode}`);
        await waitFor(() => expect(screen.getByLabelText(/^품목/)).toHaveValue('두부'));
        expect(screen.getByText('사진 없음')).toBeInTheDocument();
        expect(screen.queryByTestId('reused-photo')).toBeNull();
      });
    }
  });
});
