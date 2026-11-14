import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DetailPage } from './features/detail/DetailPage';
import { HomePage } from './features/home/HomePage';
import { RegisterPage } from './features/register/RegisterPage';
import { ResultsPage } from './features/results/ResultsPage';

// design.md "화면 흐름"
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/items/:itemId" element={<ResultsPage />} />
      <Route path="/records/:id" element={<DetailPage />} />
      <Route path="/records/:id/edit" element={<RegisterPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
