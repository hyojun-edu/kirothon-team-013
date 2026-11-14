import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('앱 뼈대', () => {
  it('홈 화면이 그려진다', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '장보기 도우미' })).toBeInTheDocument();
  });
});
