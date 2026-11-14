import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { FieldState } from '../domain/types';
import { CheapestBadge } from './Badges';
import { Chip } from './Chip';
import { MultiSelect } from './MultiSelect';
import { NAField } from './NAField';
import { PhotoPicker } from './PhotoPicker';

function NAHarness({ onState }: { onState: (s: FieldState<string>) => void }) {
  const [s, setS] = useState<FieldState<string>>({ kind: 'empty' });
  const set = (n: FieldState<string>) => {
    setS(n);
    onState(n);
  };
  return (
    <NAField label="브랜드" state={s} onChange={set}>
      <input aria-label="브랜드 값" value={s.kind === 'value' ? s.value : ''} onChange={(e) => set(e.target.value ? { kind: 'value', value: e.target.value } : { kind: 'empty' })} />
    </NAField>
  );
}

describe('NAField (요구 2)', () => {
  it('empty → value → na → empty 세 상태', async () => {
    const states: FieldState<string>[] = [];
    render(<NAHarness onState={(s) => states.push(s)} />);
    await userEvent.type(screen.getByLabelText('브랜드 값'), 'C');
    expect(states.at(-1)).toEqual({ kind: 'value', value: 'C' });
    await userEvent.click(screen.getByLabelText('해당사항 없음'));
    expect(states.at(-1)).toEqual({ kind: 'na' });
    expect(screen.queryByLabelText('브랜드 값')).toBeNull();
    await userEvent.click(screen.getByLabelText('해당사항 없음'));
    expect(states.at(-1)).toEqual({ kind: 'empty' });
  });
});

describe('MultiSelect, Chip (요구 6.1, 6.6)', () => {
  it('여러 개를 고르고 다시 뺀다', async () => {
    let sel = new Set<string>();
    const { rerender } = render(
      <MultiSelect label="브랜드" options={[{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }]} selected={sel} onChange={(s) => (sel = s)} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /브랜드/ }));
    await userEvent.click(screen.getByLabelText('A'));
    expect([...sel]).toEqual(['A']);
    rerender(<MultiSelect label="브랜드" options={[{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }]} selected={sel} onChange={(s) => (sel = s)} />);
    await userEvent.click(screen.getByLabelText('B'));
    expect([...sel].sort()).toEqual(['A', 'B']);
  });
  it('칩을 누르면 해제', async () => {
    const fn = vi.fn();
    render(<Chip label="풀무원" onRemove={fn} />);
    await userEvent.click(screen.getByRole('button', { name: '풀무원 필터 해제' }));
    expect(fn).toHaveBeenCalled();
  });
});

describe('PhotoPicker', () => {
  it('파일을 고르면 넘겨주고, 오류를 보여준다', () => {
    const fn = vi.fn();
    render(<PhotoPicker preview={null} onPick={fn} error="사진이 필요해요" />);
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [file] } });
    expect(fn).toHaveBeenCalledWith(file);
    expect(screen.getByRole('alert')).toHaveTextContent('사진이 필요해요');
  });
});

describe('최저가 배지 (요구 13.7)', () => {
  it('색만이 아니라 글자와 아이콘이 있다', () => {
    render(<CheapestBadge />);
    expect(screen.getByText(/최저가/)).toBeInTheDocument();
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });
});
