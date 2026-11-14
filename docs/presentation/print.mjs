// PRESENTATION.pdf 만들기: node docs/presentation/print.mjs
// deck.html은 ../screenshots/ (작업 12.9 캡처)와 filter.png를 쓴다.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../PRESENTATION.pdf');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + path.join(here, 'deck.html'), { waitUntil: 'networkidle' });
await p.pdf({ path: out, width: '1280px', height: '720px', printBackground: true });
console.log('wrote', out, 'slides', await p.locator('section').count());
await b.close();
