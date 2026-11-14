import { useEffect, useState } from 'react';

/** 비동기 값을 읽는다. 아직이면 undefined. reloadKey가 바뀌면 다시 읽는다. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setV(undefined);
    fn().then((r) => alive && setV(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}
