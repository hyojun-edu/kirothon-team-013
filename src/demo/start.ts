import { prepareDemo } from './seed';
export { DemoBadge } from './DemoBadge';

/** 데모 진입점. `?reset=1`이면 초기화하고 주소에서 reset을 지운다 (요구 15.4). */
export async function startDemo(): Promise<void> {
  const url = new URL(window.location.href);
  const reset = url.searchParams.get('reset') === '1';
  await prepareDemo({ reset });
  if (url.searchParams.has('reset')) {
    url.searchParams.delete('reset');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
}
