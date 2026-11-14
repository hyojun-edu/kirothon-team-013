import { db } from '../data/db';
import { processPhoto, type ProcessedPhoto } from '../data/image';
import { saveRecord } from '../data/repositories';
import { emptyDraft, todayISO, type FieldState, type InputUnit, type Origin, type RegisterDraft } from '../domain/types';
import { drawPhoto } from './drawPhoto';

// spec.md 14.2 샘플 데이터. 날짜는 오늘 기준 상대값 (요구 15.5).
export interface SeedRow {
  item: string;
  name?: string;
  brand?: string;
  origin?: Origin;
  amount?: [number, InputUnit];
  pack: string;
  bundle: number;
  price: number;
  store: string;
  online?: boolean;
  ship?: number;
  daysAgo: number;
  bg: string;
}

export function daysAgo(n: number, now: Date = new Date()): string {
  return todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
}

const KR: Origin = { type: 'domestic' };
const imp = (country: string): Origin => ({ type: 'import', country });

// 두부 구성표 (요구 15.6). 100g당: 노브랜드 451(수입, 전체 1위) → 맑은물에 500(국산 1위, 120일 전)
// → 쿠팡 517 → CJ 560 → 롯데 623 → 이마트 663 → 컬리 1,100. 순두부(1개 단위)는 비교 불가.
// "두부 300g×2 3,480원"(580/100g)을 넣으면 8건 중 5위.
export const TOFU: SeedRow[] = [
  { item: '두부', name: '부침두부', brand: '노브랜드', origin: imp('미국'), amount: [550, 'g'], pack: '모', bundle: 1, price: 2480, store: '이마트 구로점', daysAgo: 5, bg: '#f3d1d1' },
  { item: '두부', name: '찌개두부', brand: '맑은물에', origin: KR, amount: [300, 'g'], pack: '모', bundle: 1, price: 1500, store: '동네시장', daysAgo: 120, bg: '#dde3f6' },
  { item: '두부', name: '국산콩 두부', brand: '풀무원', origin: KR, amount: [300, 'g'], pack: '모', bundle: 4, price: 6900, store: '쿠팡', online: true, ship: 0, daysAgo: 33, bg: '#cfe8d8' },
  { item: '두부', name: '국산콩 두부', brand: '풀무원', origin: KR, amount: [300, 'g'], pack: '모', bundle: 4, price: 6200, store: '쿠팡', online: true, ship: 0, daysAgo: 2, bg: '#cfe8d8' },
  { item: '두부', name: '행복한콩 두부', brand: 'CJ', origin: imp('캐나다'), amount: [300, 'g'], pack: '모', bundle: 1, price: 1680, store: '홈플러스 신도림점', daysAgo: 12, bg: '#f6e3c3' },
  { item: '두부', name: '국산콩 두부', brand: '풀무원', origin: KR, amount: [400, 'g'], pack: '모', bundle: 1, price: 2490, store: '롯데마트 신도림', daysAgo: 60, bg: '#cfe8d8' },
  { item: '두부', name: '국산콩 두부', brand: '풀무원', origin: KR, amount: [300, 'g'], pack: '모', bundle: 2, price: 3980, store: '이마트 구로점', daysAgo: 0, bg: '#cfe8d8' },
  { item: '두부', name: '유기농 두부', brand: '맑은물에', origin: KR, amount: [300, 'g'], pack: '모', bundle: 2, price: 3600, store: '마켓컬리', online: true, ship: 3000, daysAgo: 12, bg: '#dde3f6' },
  { item: '두부', name: '순두부', brand: '풀무원', origin: KR, pack: '봉', bundle: 1, price: 1200, store: '동네시장', daysAgo: 5, bg: '#fff1c9' },
];

export const OTHERS: SeedRow[] = [
  { item: '우유', name: '1등급 우유', brand: '서울우유', origin: KR, amount: [1, 'L'], pack: '팩', bundle: 1, price: 2980, store: '이마트 구로점', daysAgo: 2, bg: '#e3f0fb' },
  { item: '우유', name: '1등급 우유', brand: '서울우유', origin: KR, amount: [900, 'ml'], pack: '팩', bundle: 2, price: 4980, store: '홈플러스 신도림점', daysAgo: 12, bg: '#e3f0fb' },
  { item: '우유', name: '맛있는우유', brand: '남양', origin: KR, amount: [900, 'ml'], pack: '팩', bundle: 1, price: 2650, store: '동네마트', daysAgo: 33, bg: '#e8f6e3' },
  { item: '우유', name: '저지방 우유', brand: '매일', origin: KR, amount: [1, 'L'], pack: '팩', bundle: 1, price: 2790, store: '쿠팡', online: true, ship: 0, daysAgo: 5, bg: '#f0e3fb' },
  { item: '우유', name: '1등급 우유', brand: '노브랜드', origin: KR, amount: [1, 'L'], pack: '팩', bundle: 1, price: 2380, store: '이마트 구로점', daysAgo: 60, bg: '#f3d1d1' },
  { item: '계란', name: '무항생제 계란', brand: '풀무원', origin: KR, amount: [30, 'ea'], pack: '판', bundle: 1, price: 8990, store: '이마트 구로점', daysAgo: 0, bg: '#fff1c9' },
  { item: '계란', name: '대란', brand: '노브랜드', origin: KR, amount: [30, 'ea'], pack: '판', bundle: 1, price: 6980, store: '이마트 구로점', daysAgo: 33, bg: '#f3d1d1' },
  { item: '계란', name: '동물복지 계란', brand: '해밀', origin: KR, amount: [15, 'ea'], pack: '판', bundle: 1, price: 5900, store: '마켓컬리', online: true, ship: 3000, daysAgo: 12, bg: '#fde7d4' },
  { item: '계란', name: '특란', origin: KR, amount: [10, 'ea'], pack: '판', bundle: 1, price: 3500, store: '동네시장', daysAgo: 120, bg: '#fff1c9' },
  { item: '사과', name: '부사', origin: KR, amount: [1.5, 'kg'], pack: '봉', bundle: 1, price: 12900, store: '동네시장', daysAgo: 5, bg: '#fbd9d9' },
  { item: '사과', name: '부사', origin: KR, amount: [2, 'kg'], pack: '봉', bundle: 1, price: 15900, store: '홈플러스 신도림점', daysAgo: 33, bg: '#fbd9d9' },
  { item: '사과', name: '홍로', origin: KR, amount: [1, 'kg'], pack: '봉', bundle: 1, price: 9900, store: '롯데마트 신도림', daysAgo: 60, bg: '#fbe0cf' },
  { item: '사과', name: '엔비 사과', origin: imp('뉴질랜드'), amount: [1, 'kg'], pack: '봉', bundle: 1, price: 14900, store: '쿠팡', online: true, ship: 0, daysAgo: 12, bg: '#f9d0d0' },
  { item: '라면', name: '진한 국물 라면', brand: '오뚜기', origin: KR, amount: [120, 'g'], pack: '봉', bundle: 5, price: 3980, store: '이마트 구로점', daysAgo: 2, bg: '#fde2c4' },
  { item: '라면', name: '매운 라면', brand: '농심', origin: KR, amount: [120, 'g'], pack: '봉', bundle: 5, price: 4480, store: '홈플러스 신도림점', daysAgo: 12, bg: '#fbd0c4' },
  { item: '라면', name: '매운 라면', brand: '농심', origin: KR, amount: [120, 'g'], pack: '봉', bundle: 20, price: 16900, store: '쿠팡', online: true, ship: 0, daysAgo: 33, bg: '#fbd0c4' },
  { item: '라면', name: '라면', brand: '노브랜드', origin: KR, amount: [115, 'g'], pack: '봉', bundle: 5, price: 2480, store: '이마트 구로점', daysAgo: 60, bg: '#f3d1d1' },
];

export const SAMPLE: SeedRow[] = [...OTHERS, ...TOFU];

const v = <T,>(value: T | undefined): FieldState<T> => (value === undefined ? { kind: 'na' } : { kind: 'value', value });

export function toDraft(r: SeedRow, now: Date = new Date()): RegisterDraft {
  return {
    ...emptyDraft(now),
    itemName: r.item,
    productName: v(r.name),
    brand: v(r.brand),
    origin: v(r.origin),
    packUnit: r.pack,
    unitAmount: r.amount ? { kind: 'value', value: { amount: r.amount[0], unit: r.amount[1] } } : { kind: 'na' },
    bundleCount: r.bundle,
    price: r.price,
    storeName: r.store,
    storeIsOnline: !!r.online,
    shippingFee: r.online ? { kind: 'value', value: r.ship ?? 0 } : { kind: 'empty' },
    purchasedAt: daysAgo(r.daysAgo, now),
  };
}

export type MakePhoto = (r: SeedRow) => Promise<ProcessedPhoto>;
const drawnPhoto: MakePhoto = async (r) => processPhoto(await drawPhoto({ label: r.name ?? r.item, bg: r.bg }));

/** 샘플을 기존 저장 경로(saveRecord, 리사이즈·썸네일)로 넣는다. 오래된 날짜부터 넣어 최근 목록에 품목이 고루 보이게 한다. */
export async function seed({ now = new Date(), makePhoto = drawnPhoto }: { now?: Date; makePhoto?: MakePhoto } = {}): Promise<void> {
  const photoIds = new Map<string, string>(); // 같은 사진(상품명+색)은 함께 쓴다
  const rows = [...SAMPLE].sort((a, b) => b.daysAgo - a.daysAgo);
  for (const r of rows) {
    const key = `${r.name ?? r.item}|${r.bg}`;
    const shared = photoIds.get(key);
    const { id } = await saveRecord(toDraft(r, now), shared ?? (await makePhoto(r)));
    if (!shared) photoIds.set(key, (await db.records.get(id))!.photoId);
  }
}

/** 요구 15.3, 15.4: 비어 있을 때만 넣는다. reset이면 모두 비우고 다시 넣는다. */
export async function prepareDemo({ reset = false, ...opts }: { reset?: boolean; now?: Date; makePhoto?: MakePhoto } = {}): Promise<void> {
  if (reset) await Promise.all(db.tables.map((t) => t.clear()));
  if ((await db.items.count()) === 0) await seed(opts);
}
