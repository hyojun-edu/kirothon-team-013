import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './pwa/registerSW';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

function render(Badge?: ComponentType) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      {Badge && <Badge />}
    </StrictMode>,
  );
}

// 요구 15.9: 데모 코드는 demo 모드에서만 동적으로 불러온다. 일반 빌드에서는 이 분기가 지워진다.
if (import.meta.env.MODE === 'demo') {
  import('./demo/start').then(async (demo) => {
    await demo.startDemo().catch((e) => console.error('데모 데이터 준비 실패', e));
    render(demo.DemoBadge);
  });
} else {
  render();
}

registerServiceWorker();
