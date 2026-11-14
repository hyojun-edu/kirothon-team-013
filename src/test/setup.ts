import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom에는 없는 브라우저 API
// Node의 createObjectURL은 진짜 Blob만 받는데, fake-indexeddb에서 읽은 Blob은 일반 객체가 된다.
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => {};
