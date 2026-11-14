import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { findCandidates } from '../domain/candidates';
import type { PriceRecordView } from '../domain/types';
import { CandidateList, NO_CANDIDATE } from './CandidateList';

const base: PriceRecordView = {
  id: 'r1',
  productId: 'p1',
  storeId: 's1',
  itemId: 'i1',
  itemName: '두부',
  productName: { kind: 'value', value: '국산콩으로 만든 두부' },
  brand: { kind: 'value', value: '노브랜드' },
  origin: { kind: 'value', value: { type: 'domestic' } },
  packUnit: '모',
  unitAmount: { kind: 'value', value: { amount: 300, unit: 'g' } },
  bundleCount: 2,
  price: 3480,
  purchasedAt: '2026-11-11',
  photoId: '',
  storeName: '이마트 구로점',
  isOnline: false,
  createdAt: '2026-11-11T00:00:00Z',
};
const now = new Date(2026, 10, 14);

describe('CandidateList (요구 16.3, 16.9, 16.14)', () => {
  it('한 줄에 품명, 품목·브랜드·원산지, 용량×번들·가격·단위가격, 판매처·날짜·기록 수', () => {
    const { items } = findCandidates([base, { ...base, id: 'r0', purchasedAt: '2026-10-01', createdAt: '2026-10-01' }], '두부');
    render(<CandidateList items={items} more={0} query="두부" now={now} onSelect={() => {}} onMore={() => {}} />);
    const row = within(screen.getByRole('listbox')).getByRole('option');
    expect(row).toHaveTextContent('국산콩으로 만든 두부');
    expect(row.querySelector('mark')).toHaveTextContent('두부');
    expect(row).toHaveTextContent('두부 · 노브랜드 · 국산');
    expect(row).toHaveTextContent('300g×2 · 3,480원 · 580원/100g');
    expect(row).toHaveTextContent('이마트 구로점 · 3일 전 · 기록 2건');
    expect(row).not.toHaveTextContent('오래된 가격');
  });

  it('온라인 배지, 90일 넘으면 오래된 가격 라벨', () => {
    const { items } = findCandidates([{ ...base, isOnline: true, storeName: '쿠팡', purchasedAt: '2026-07-01' }], '두부');
    render(<CandidateList items={items} more={0} query="두부" now={now} onSelect={() => {}} onMore={() => {}} />);
    expect(screen.getByText('온라인')).toBeInTheDocument();
    expect(screen.getByText('오래된 가격')).toBeInTheDocument();
  });

  it('더 보기와 선택', async () => {
    const onMore = vi.fn();
    const onSelect = vi.fn();
    const { items } = findCandidates([base], '두부');
    render(<CandidateList items={items} more={3} query="두부" now={now} onSelect={onSelect} onMore={onMore} />);
    await userEvent.click(screen.getByRole('button', { name: '더 보기 (3개)' }));
    expect(onMore).toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('option')).getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('후보가 없으면 안내', () => {
    render(<CandidateList items={[]} more={0} query="우유" onSelect={() => {}} onMore={() => {}} />);
    expect(screen.getByText(NO_CANDIDATE)).toBeInTheDocument();
  });
});
