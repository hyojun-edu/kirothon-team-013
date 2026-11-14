import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { processPhoto } from '../../data/image';
import * as repo from '../../data/repositories';
import { RegisterPage } from './RegisterPage';

vi.mock('../../data/image', () => ({ processPhoto: vi.fn() }));

const renderIt = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<div>moved</div>} />
      </Routes>
    </MemoryRouter>,
  );
const pick = () => fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });

describe('오류 처리 (작업 9)', () => {
  it('가격·번들이 0 이하이거나 정수가 아니면 바로 필드 오류, 저장 불가', async () => {
    const u = userEvent.setup();
    renderIt();
    await u.type(screen.getByLabelText(/^가격/), '0');
    expect(screen.getByText('0보다 큰 금액(원)을 입력해 주세요')).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/^번들묶음/));
    await u.type(screen.getByLabelText(/^번들묶음/), '0');
    expect(screen.getByText('1 이상의 정수를 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('사진 처리에 실패하면 다시 시도 안내, 사진은 비어 있다', async () => {
    vi.mocked(processPhoto).mockRejectedValueOnce(new Error('bad'));
    renderIt();
    pick();
    expect(await screen.findByText('사진을 처리하지 못했어요. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('사진 없음')).toBeInTheDocument();
  });

  it('저장에 실패하면 입력값을 그대로 두고 다시 저장할 수 있다', async () => {
    vi.mocked(processPhoto).mockResolvedValue({ blob: new Blob(['m']), thumb: new Blob(['t']), width: 1, height: 1 });
    const spy = vi.spyOn(repo, 'saveRecord').mockRejectedValueOnce(new Error('QuotaExceeded'));
    const u = userEvent.setup();
    renderIt();
    await u.type(screen.getByLabelText(/^품목/), '두부');
    await u.type(screen.getByLabelText(/^가격/), '2900');
    await u.type(screen.getByLabelText(/^판매처/), '동네마트');
    pick();
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    await u.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText(/저장하지 못했어요/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^품목/)).toHaveValue('두부');
    expect(screen.getByLabelText(/^가격/)).toHaveValue(2900);
    await u.click(screen.getByRole('button', { name: '다시 저장' }));
    expect(await screen.findByText('moved')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
