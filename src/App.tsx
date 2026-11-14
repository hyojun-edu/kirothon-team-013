import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './features/home/HomePage';

// 화면은 작업 5~8에서 채운다. 지금은 홈만 있다.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
