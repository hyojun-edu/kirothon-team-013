import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

// 작업 12.9 캡처 전용 (360px). 종단 테스트와 같은 서버 설정을 쓴다.
export default defineConfig({ ...base, testDir: '.', testMatch: 'shots.spec.ts' });
