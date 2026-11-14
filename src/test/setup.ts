import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom에는 없는 브라우저 API
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
}
