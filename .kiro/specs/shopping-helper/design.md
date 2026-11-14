status: ready

# 설계 문서 — 장보기 도우미

## 개요
기기 안에서만 동작하는 모바일 우선 PWA. 서버 없이 IndexedDB에 저장한다.
핵심 로직(단위환산, 단위가격, 필터, 정렬, 순위)은 화면과 분리된 순수 함수로 만든다. 테스트하기 쉽고 나중에 서버로 옮기기 쉽다.

요구사항 문서(`requirements.md`)의 번호를 "(요구 N)"으로 가리킨다.

## 기술 선택 (가정, 변경 가능)
| 영역 | 선택 | 이유 |
|---|---|---|
| 언어/UI | TypeScript + React + Vite | 모바일 웹앱에 흔하고 PWA 도구가 많다 |
| PWA | vite-plugin-pwa | 설치, 오프라인 캐시 |
| 저장 | IndexedDB + Dexie | 사진(Blob) 저장, 인덱스 조회 |
| 상태 | React 상태 + Dexie liveQuery | 별도 상태 라이브러리 불필요 |
| 라우팅 | React Router | 화면 5개 |
| 테스트 | Vitest + React Testing Library + Playwright(모바일 뷰포트) | 로직 단위, 화면, 흐름 |

## 구조
```
src/
  domain/        순수 로직 (UI, DB 의존 없음)
    units.ts        단위 파싱·환산
    unitPrice.ts    단위가격 계산
    compare.ts      그룹핑, 필터, 정렬, 순위, 프리셋
    searchQuery.ts  구글 검색어 조합
    prefill.ts      미리 채우기 규칙
  data/          저장소
    db.ts           Dexie 스키마
    repositories.ts Item/Product/PriceRecord/Store/Photo CRUD
    image.ts        사진 리사이즈
  features/      화면 단위
    home/ register/ results/ detail/ settings(없음, MVP 제외)
  components/    공통 UI (Chip, MultiSelect, PhotoPicker, NAField 등)
  pwa/           서비스 워커 설정
```

## 화면 흐름
```
홈 ──품목 선택──▶ 결과 화면 ──행 탭──▶ 기록 상세
 │                  │  │                  │
 │                  │  └─"온라인 가격 검색"─▶ (새 탭: 구글) ─돌아옴─▶ 등록(미리 채움)
 └─"가격 등록"──▶ 등록 ◀─"이 기록으로 새로 등록"/"최신가격 다시 검색"──┘
                    └─저장──▶ 결과 화면 (새 기록 순위 표시)
```

## 컴포넌트와 인터페이스

### domain/units.ts (요구 4)
```ts
type UnitType = 'g' | 'ml' | 'ea';
function toBase(amount: number, unit: 'g'|'kg'|'ml'|'L'|'ea'): { value: number; type: UnitType };
```
- kg→g ×1000, L→ml ×1000. 그 외는 그대로.

### domain/unitPrice.ts (요구 4)
```ts
interface UnitPrice { value: number; per: 100 | 1; type: UnitType } // 100g, 100ml, 1개
function unitPrice(rec: PriceRecordView): UnitPrice | null;
```
- 총가격 = price + (shippingFee ?? 0).
- 총용량 = unitAmount × bundleCount. unitAmount가 N/A이면 총용량 = bundleCount, type = 'ea'.
- g/ml는 100 단위, ea는 1 단위로 환산. 반올림은 표시할 때만 한다.

### domain/compare.ts (요구 5, 6, 7, 8)
```ts
interface ResultQuery {
  itemId: string;
  preset: 'exact' | 'sameProduct' | 'allItem';
  anchor?: ProductKey;            // 내 상품 (preset 기준)
  filters: { brands: Set<string|NA>; origins: Set<OriginKey>; bundles: Set<number> };
  sort: 'unitPrice' | 'recent';
  showHistory: boolean;
}
interface ResultView {
  rows: Row[];             // 순위 포함
  incomparable: Row[];     // 단위 타입이 다른 기록
  cheapest: Row | null;    // 조건부 최저가
  facets: { brands: Facet[]; origins: Facet[]; bundles: Facet[] }; // 존재하는 값만
  anchorSummary?: { unitPrice; rank; total; diffWon; diffPct };
}
function buildResult(records: PriceRecordView[], q: ResultQuery): ResultView;
```
- 처리 순서: 프리셋 → 최신 기록만(이력 숨김이면) → 필터 → 단위 타입 분리 → 정렬 → 순위.
- 비교 기준 단위 타입은 anchor의 타입. anchor가 없으면 기록이 가장 많은 타입이 기준이고 나머지는 incomparable.
- 필터: 서로 다른 필터는 AND, 같은 필터 안은 OR.
- facets는 프리셋 적용 후 기록에서 계산한다. 선택지는 존재하는 값만이다.
- 최신 기록만 표시 규칙의 키: `productId + storeId`.

### domain/searchQuery.ts (요구 9, 11)
```ts
function buildSearchQuery(p: ProductView, store?: string): string; // "노브랜드 국산콩으로 만든 두부 300g 가격"
function googleUrl(q: string): string; // https://www.google.com/search?q=<encoded>
```
- 품명이 N/A이면 품목명을 쓴다. 브랜드, 단위용량이 N/A이면 뺀다.
- `encodeURIComponent`로 인코딩하고 `window.open(url, '_blank', 'noopener')`로 연다.

### domain/prefill.ts (요구 10, 11)
```ts
type PrefillMode = 'search' | 'clone' | 'refresh';
function prefill(rec: PriceRecordView, mode: PrefillMode): RegisterDraft;
```
| 모드 | 채움 | 비움 |
|---|---|---|
| search | 품명, 품목, 원산지, 브랜드, 포장단위, 단위용량, 번들묶음 | 가격, 판매처, 배송비, 사진, 메모 |
| clone | search와 같음 | search와 같음 |
| refresh | search + 판매처, 배송비 | 가격, 사진, 메모 |
- 날짜는 항상 오늘. 원래 기록 객체는 수정하지 않는다 (복사본으로 draft를 만든다).

### features/register (요구 1, 2, 3, 8)
- 필드 순서: 품명 → 품목 → 원산지 → 브랜드 → 포장단위 → 단위용량 → 번들묶음 → 가격 → 판매처 → (배송비) → 날짜 → 사진.
- `NAField`: 값 입력과 "해당사항 없음" 체크를 한 컴포넌트로 묶는다. 상태는 `{ kind: 'value', value } | { kind: 'na' } | { kind: 'empty' }`.
- 품명 자동완성: 입력 150ms debounce 후 Dexie 인덱스로 prefix 검색. 선택 시 `prefill`과 같은 규칙으로 채운다.
- 이전 사진 불러오기 (요구 3.7~3.11): 자동완성 선택 시 해당 `productId`의 `PriceRecord`를 `purchasedAt` 내림차순으로 찾아 첫 기록의 `photoId`를 draft의 `photo`에 넣는다.
  - draft의 사진 상태: `{ kind: 'reused', photoId } | { kind: 'new', blob } | { kind: 'empty' }`. 스키마 변경은 없다.
  - `reused`이면 저장 시 새 `Photo`를 만들지 않고 같은 `photoId`를 새 `PriceRecord`가 가리킨다. 사진 칸에 "이전 사진" 표시를 붙인다.
  - 사용자가 사진을 바꾸면 `new`로 바뀌고 저장 시 새 `Photo`가 생긴다. 이전 기록은 바뀌지 않는다.
  - `reused`는 필수 사진 검증을 통과한 것으로 본다.
  - 이전 기록의 사진이 삭제되어 없으면 `empty`로 둔다.
  - `prefill`의 `search`, `clone`, `refresh` 모드는 사진을 계속 비운다 (위 표). 자동완성 경로만 사진을 불러온다.
  - 사진을 가진 기록을 삭제할 때, 다른 기록이 같은 `photoId`를 쓰고 있으면 `Photo`는 지우지 않는다.
- 하단 비교 바: 가격과 용량이 유효해지면 `buildResult`를 호출해 순위와 차이를 표시한다. 저장하지 않는다.
- 저장 버튼은 필수 7개가 유효할 때만 활성화한다.

### features/results (요구 5, 6, 7)
- 영역 순서는 요구 5.2와 같다.
- 목록은 20건씩 무한 스크롤 (IntersectionObserver).
- 필터 상태와 프리셋은 품목별로 `sessionStorage`에 저장해서 복귀 시 유지한다 (요구 6.8).
- 1위 강조는 색 + "최저가" 배지 + 아이콘. 90일 초과는 `opacity` 낮춤 + "오래된 가격" 라벨.

### features/detail (요구 11, 12)
- 버튼: 수정, 삭제(확인 대화상자), "이 기록으로 새로 등록", 온라인일 때만 "최신가격 다시 검색", "온라인 가격 검색".

## 데이터 모델 (요구 13.6)
```ts
interface Item { id; name; ownerId; createdAt; updatedAt }
interface Product {
  id; itemId;
  key: string;                             // 같은 상품 판단용 키 (아래 설명)
  name: Field<string>;                     // value | na
  brand: Field<string>;
  origin: Field<{ type: 'domestic' } | { type: 'import'; country?: string }>;
  packUnit: string;
  unitAmount: Field<{ amount: number; unit: 'g'|'kg'|'ml'|'L'|'ea' }>;
  ownerId; createdAt; updatedAt
}
interface PriceRecord {
  id; productId; storeId;
  bundleCount: number; price: number;
  shippingFee?: number;
  shippingFeeNA?: boolean;  // 배송비 "해당사항 없음" (요구 2.1, 2.3)
  purchasedAt: string;      // ISO date
  photoId: string; note?: string;
  ownerId; createdAt; updatedAt
}
interface Store { id; name; chain?; branch?; isOnline: boolean }  // MVP는 chain, branch를 비워 둔다
interface Photo { id; blob: Blob; thumb: Blob; width; height; createdAt }  // thumb: 목록용 썸네일
type Field<T> = { kind: 'value'; value: T } | { kind: 'na' };      // 미입력은 칸 자체가 없는 것(undefined)
```
- 인덱스 (Dexie version 2, 기존 데이터 이전 없음):
  - `Product[itemId]`, `Product[name.value]`, `Product[key]`
  - `PriceRecord[productId]`, `PriceRecord[storeId+productId]`
  - `PriceRecord[photoId]`: 삭제 시 같은 사진을 쓰는 다른 기록이 있는지 확인 (요구 3.7~3.11)
  - `PriceRecord[productId+purchasedAt]`: 상품의 가장 최근 기록 사진, 최신 기록만 표시(요구 5.7), 가격 이력(요구 11.6)
  - `Store[name]`
- 같은 상품 판단 (`Product.key`): 품목 + 품명 + 브랜드 + 단위용량 + 원산지 + 포장단위가 모두 같으면 같은 Product를 재사용한다. 원산지와 포장단위를 키에 넣은 이유는 복제 등록 후 값을 바꿨을 때 원래 기록이 바뀌지 않게 하려는 것이다 (요구 10.5).
- 비교 프리셋("똑같은 상품", "같은 상품, 용량 무관")은 키가 아니라 품명 + 브랜드 + 단위용량(또는 품명 + 브랜드)만 비교한다 (요구 7).
- `Store.chain`, `Store.branch`는 MVP에서 항상 비워 둔다. 판매처는 이름 하나만 받는다. "이마트 구로점" → 체인/지점 정규화는 향후 통합 DB 단계에서 한다.
- 단위가격은 저장하지 않는다 (요구 4.7).
- `ownerId`는 MVP에서 고정값 `local`. 향후 계정 도입 시 채운다.

## 오류 처리
| 상황 | 처리 |
|---|---|
| 사진 없음 | 저장 버튼 비활성 + 필드 아래 안내 (요구 1.2) |
| 가격/번들/용량이 0 이하 또는 숫자 아님 | 입력 즉시 필드 오류 표시, 저장 불가 |
| 사진 리사이즈 실패 | 다시 시도 안내, 원본은 저장하지 않음 |
| IndexedDB 용량 초과/쓰기 실패 | 저장 실패 안내, 입력값 유지, 재시도 버튼 |
| 구글 새 탭이 팝업 차단됨 | 같은 URL을 링크로 보여주고 직접 열게 한다 |
| 서로 다른 단위 타입 | 순위에서 제외하고 비교 불가 구역에 표시 |
| 삭제 | 확인 대화상자. 삭제는 되돌릴 수 없다는 문구 |

## 접근성과 성능
- 터치 대상 44px 이상. 순위 강조는 색만 쓰지 않는다 (요구 13.4, 13.7).
- 필터 변경은 메모리 계산이다. 기록 1,000건에서 300ms 이내 (요구 6.7). 필요하면 품목 단위로 기록을 한 번 읽어 메모리에 둔다.
- 사진은 목록에서 썸네일(긴 변 200px 정도)을 쓰고, 상세에서만 원본을 연다. 썸네일은 저장 시 함께 만든다.

## 테스트 전략
**단위 테스트 (Vitest, domain/)**
- 요구 4.4 예시: 300g×2 3,480원 = 580원/100g, 400g×1 2,900원 = 725원/100g.
- kg/L 환산, 배송비 합산, 단위용량 N/A는 개당 계산, g와 ml 분리.
- `buildResult`: 정렬 동률 처리, 필터 AND/OR, facets 존재하는 값만, 최신 기록만, 90일 판정, 순위와 차이.
- `prefill`: 세 모드의 채움/비움 표, 원본 불변.
- `buildSearchQuery`: N/A 항목 생략, 인코딩.

**컴포넌트 테스트**
- NAField 세 상태, 필수 7개 미충족 시 저장 비활성, 온라인 판매처에서만 배송비 표시, 자동완성 선택 시 채움.

**E2E (Playwright, 폭 360px)**
- 등록 → 결과 순위 확인 → 필터 → 온라인 검색(새 탭 URL 확인) → 미리 채운 등록 → 갱신 이력.
- 오프라인 모드에서 등록과 조회.
- 가로 스크롤 없음 확인.

## 설계 결정과 대안
| 결정 | 대안 | 선택 이유 |
|---|---|---|
| 서버 없이 IndexedDB | 처음부터 서버 | MVP 속도, 오프라인 요구 |
| 단위가격을 조회 시 계산 | 저장 | 용량/배송비 수정 시 불일치 방지 |
| 구글 검색 새 탭 | 쇼핑몰 직접 연동 | 사용자가 정한 범위. 구현이 가볍다 |
| 순수 함수로 비교 로직 분리 | 컴포넌트 안에 계산 | 테스트 용이, 서버 이전 시 재사용 |
| 갱신은 새 기록 추가 | 기존 기록 덮어쓰기 | 가격 이력 보존 |

## 시각 디자인 (요구 14)
규칙의 값과 이유는 `spec.md` 13절을 따른다. 여기서는 구현 방법만 정한다.

- **토큰**: `src/styles/tokens.css`에 CSS 변수(`--primary`, `--primary-soft`, `--accent`, `--bg`, `--surface`, `--text`, `--text-sub`, `--line`, `--danger`, 간격 `--sp-1`~`--sp-6`, 모서리 `--r-card`, `--r-ctrl`, `--r-pill`)를 한 번만 정의한다. 컴포넌트 CSS와 TSX는 값을 직접 쓰지 않고 변수만 쓴다 (요구 14.1).
- **파일 나누기**: 현재 `src/styles.css` 하나를 `tokens.css`(토큰), `base.css`(리셋, 글자), `components.css`(버튼, 탭, 칩, 카드), `pages.css`(화면별)로 나눈다. 동작은 바꾸지 않는다.
- **프리셋 탭**: `role="tablist"`인 3열 그리드(`grid-template-columns: repeat(3, 1fr)`), 각 탭 `white-space: nowrap`. 탭 이름은 `PRESET_LABELS` 상수 한 곳에서 관리하고 전체 뜻은 `PRESET_HINTS`로 분리한다 (요구 14.3). 비활성 탭은 `aria-disabled`와 탭 시 안내 문구를 쓴다 (요구 14.4).
- **줄바꿈 방지**: `.btn`, `.tab`, `.chip`, `.pill`에 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. 폭이 모자라면 이름을 줄이고 글자 크기는 줄이지 않는다.
- **결과 카드**: `ResultCard` 컴포넌트로 분리한다. 구조는 사진(64px) + 본문 열. 1위는 `data-rank="1"`과 클래스로 구분하고 색 외에 배지 글자를 함께 쓴다.
- **필터 선택 시트**: 기존 MultiSelect 목록을 하단 시트(`dialog` 또는 `aria-modal`)로 연다. 닫기 버튼과 적용 버튼 44px 이상.
- **하단 바**: `position: fixed; bottom: 0; padding-bottom: calc(12px + env(safe-area-inset-bottom))`. 본문에는 바 높이만큼 아래 여백을 준다. `index.html`에 `viewport-fit=cover`를 넣는다.
- **등록 화면**: 카드 세 개(`<section>`)로 묶는다. 필드 순서, 검증, 자동완성 동작은 바꾸지 않는다 (요구 1, 2, 3).
- **움직임**: 전환은 `transition: 150ms ease`만 쓰고 `@media (prefers-reduced-motion: reduce)`에서 모두 `none` (요구 14.10).
- **검증**: 폭 360px 종단 테스트에 (a) 프리셋 탭, 필터 버튼, 하단 버튼의 높이가 한 줄 높이(줄 높이 × 1.2 이하)인지, (b) 1위 카드 요소 존재, (c) 가로 스크롤 없음을 추가한다. 명암비는 토큰 값 쌍을 계산하는 단위 테스트로 확인한다 (요구 14.9). 캡처는 Playwright로 `docs/screenshots/`에 저장한다 (요구 14.11).
- **기존 동작 보호**: 이 작업은 모양만 바꾼다. 기존 단위, 컴포넌트, 종단 테스트가 그대로 통과해야 한다. 테스트가 글자 이름("같은 상품, 용량 무관")을 찾는 곳은 새 이름에 맞게 고친다.

## 최저가 카드 중복 제거 (요구 5.2, 6.5)
- 결과 화면에서 별도의 "조건부 최저가 카드"(영역 E)를 없앤다. 맨 위 1위 카드가 최저가를 대신한다.
- `buildResult`의 `cheapest`는 그대로 두고, 화면은 `rows[0]`의 배지 글자만 정한다: 필터가 하나라도 있으면 "조건 내 최저가", 없으면 "최저가".
- 1위 카드는 `spec.md` 13.5의 결과 카드 규칙(배경, 테두리 2px, 배지)을 그대로 쓴다. 단위가격 22px 크기도 그대로다.
- 영역 이름은 E 기록 목록, F 비교 불가 구역, G 하단 고정 버튼으로 바뀐다.

## 데모 모드 (요구 15)
- **켜는 방법**: Vite 모드 `demo`. `package.json`에 `"demo": "vite build --mode demo && vite preview --mode demo --host 127.0.0.1 --port 4174 --strictPort"`를 추가한다. 코드에서는 `import.meta.env.MODE === 'demo'`로만 판단한다 (요구 15.1).
- **파일**: `src/demo/seed.ts`(샘플 정의와 넣기), `src/demo/drawPhoto.ts`(캔버스로 사진 그리기), `src/demo/DemoBadge.tsx`(작은 표시). 앱 진입점은 데모 모드일 때만 동적 `import()`로 불러온다. 일반 빌드에서 이 코드가 번들에 들어가지 않아야 한다 (요구 15.9). 빌드 결과 `dist/`에서 샘플 글자열을 검색하는 테스트로 확인한다.
- **넣는 시점**: 앱 시작 시 `Item` 테이블이 비어 있으면 `seed()` 실행 (요구 15.2, 15.3). `?reset=1`이면 모든 테이블을 비우고 `seed()` 후 주소에서 `reset`을 지운다 (요구 15.4).
- **날짜**: `today`에서 `daysAgo(n)`으로 계산한다 (예: 0, 2, 5, 12, 33, 60, 120일 전). 90일 초과 기록이 하나 이상 (요구 15.5).
- **사진**: `drawPhoto({ label, bg })`가 캔버스에 색 배경과 상품명 글자를 그려 Blob을 만들고, 기존 사진 저장 경로(리사이즈, 썸네일)를 그대로 쓴다 (요구 15.7). 같은 상품의 여러 기록은 사진을 공유해도 된다.
- **두부 구성표**: `spec.md` 14.2의 항목을 모두 만족하도록 `seed.ts`에 표로 정의하고, 단위 테스트에서 `buildResult`로 각 항목(번들 다름, 브랜드 3개 이상, 국산·수입, 온라인 2건 이상, 이력, 오래된 가격, 비교 불가, 필터에 따라 1위가 바뀜)을 확인한다 (요구 15.6).
- **데모 표시**: `DemoBadge`는 데모 모드에서만 렌더하고, 하단 바와 겹치지 않는 맨 위 구석에 작고 옅게 둔다 (요구 15.8).
- **테스트**: 단위(구성표, 날짜 상대값, 비어 있을 때만 넣기, reset), 종단(`demo` 모드 서버에서 품목 5개 이상 표시, `?reset=1` 복원), 빌드 검사(일반 `dist/`에 샘플 없음).

## 홈 빠른 비교와 자동완성 후보 (요구 16)
- **후보 조회** (`domain/candidates.ts`, 순수 함수):
  ```ts
  interface Candidate {
    productId; bundleCount; record: PriceRecordView; // 그 조합의 가장 최근 기록
    productName: string | null; itemName; brand; origin; packUnit; unitAmount;
    price: number; unitPrice: UnitPrice | null;
    storeName; isOnline; purchasedAt; recordCount: number; photoId?: string;
  }
  function findCandidates(records: PriceRecordView[], text: string, limit = 8): { items: Candidate[]; more: number };
  ```
  - 묶는 키: `productId + bundleCount`. 키마다 `purchasedAt`이 가장 늦은 기록이 대표다. `recordCount`는 그 키의 기록 수 (요구 16.4).
  - 일치: `text`를 공백으로 나눠 모든 조각이 품명, 품목, 브랜드 중 하나에 들어 있으면 후보 (요구 16.5). 점수: 품명 앞부분 일치 > 품명 안 일치 > 품목/브랜드 일치.
  - 정렬: 점수 → `purchasedAt` 내림차순 → `recordCount` 내림차순. 앞의 `limit`개만 `items`, 나머지 수는 `more`.
  - 품명이 N/A이면 `productName`은 `null`이고 화면은 `itemName`을 1줄에 쓴다.
- **조회 방법**: 입력 150ms debounce 후 Dexie에서 품명/품목/브랜드 인덱스(또는 메모리에 읽은 목록)로 찾는다. 기록 1,000건에서 100ms 안에 끝나야 한다.
- **`CandidateList` 컴포넌트**: 홈과 등록 화면이 같이 쓴다 (요구 16.13). `role="listbox"`, 각 줄 `role="option"`, 높이 56px 이상. 1줄 품명(일치 글자 `<mark>` 강조), 2줄 품목·브랜드·원산지, 3줄 용량×번들·가격·단위가격(말줄임 없음), 4줄 판매처·날짜·기록 건수. 날짜는 "3일 전"처럼 상대값 + 90일 넘으면 "오래된 가격" 작은 라벨. 길어지는 1, 2, 4줄만 말줄임 (요구 16.14).
- **홈 빠른 비교 폼** (`features/home/QuickCompare.tsx`):
  - 상태: `QuickDraft = { productName: Field<string>; itemName: string; brand: Field<string>; packUnit: string; unitAmount: Field<...>; bundleCount: number; price: number | null; origin: ...; priceIsPrevious: boolean }`.
  - 후보 선택 → `draftFromCandidate(c)`로 채우고 `priceIsPrevious = true`. 사용자가 가격을 고치면 `false`로 바꿔 "이전 가격" 표시를 뗀다 (요구 16.6).
  - "비교하기": `anchor`(내 상품)를 라우터 상태로 넘겨 결과 화면으로 이동. 저장하지 않는다 (요구 16.10).
  - "이 가격으로 등록": `RegisterDraft`를 만들어 등록 화면으로. 사진은 후보의 `photoId`를 `reused`로 넣는다 (요구 16.12).
  - 후보 없이 직접 입력: 품목만 있으면 "비교하기" 활성 (요구 16.8).
- **결과 화면 시작 탭**: `anchor`가 있으면 `anchorMatches = records.some(sameProduct(anchor))`. 있으면 `exact`, 없으면 `allItem`으로 시작 (요구 16.11). `anchor`가 있으면 프리셋 탭 두 개가 켜지고 내 상품 비교 바가 보인다 (요구 16.10, 8.4).
- **등록 화면**: 품명 자동완성을 `CandidateList`로 바꾼다. 후보 선택 시 `prefill`(자동완성 모드)에 가격과 `priceIsPrevious`를 더한다 (요구 3.4, 16.13). `prefill`의 `search`, `clone`, `refresh` 모드는 그대로 가격을 비운다.
- **테스트**: 단위(`findCandidates`: 키 묶기, 번들 다름은 별개 후보, 일치, 정렬, 8개 제한, 품명 N/A), 컴포넌트(`CandidateList`의 모든 정보 표시, 가격 "이전 가격" 표시가 가격 수정 시 사라짐, 후보 없음 안내), 종단(홈에서 품명 입력 → 후보 선택 → 칸 채움 → 비교하기 → 탭 두 개 켜짐, 내 상품 비교 바 보임; 폭 360px에서 후보 줄이 가로 스크롤 없이 보임).

## 기간 필터 (요구 6.9~6.14)
- `ResultQuery`에 `period: 'all' | '1y' | '90d' | '30d'`를 더한다 (기본 `'all'`). 브랜드/원산지/번들처럼 Set이 아니라 값 하나다.
- `buildResult` 처리 순서: 프리셋 → **기간** → 같은 상품+판매처의 최신 기록만 → 브랜드/원산지/번들 → 단위 타입 분리 → 정렬 → 순위. 기간으로 빠진 기록은 `anchorSummary`(순위, 차이) 계산에도 쓰지 않는다.
- 기간 기준: `daysBetween(today, record.purchasedAt) <= N` (1년 365, 90일 90, 30일 30). 경계일은 포함한다. 오늘은 인자로 받아 테스트에서 고정한다.
- `ResultView`에 `hiddenByPeriod: number`를 더한다 (프리셋 적용 후, 기간으로 빠진 기록 수. 안내 문구에 쓴다).
- `isOld`(90일 초과 라벨)은 그대로 유지한다. 기간이 "전체"일 때 라벨이 계속 보이고, "오래된 가격" 라벨 탭은 기간을 `'90d'`로 바꾼다.
- 선택 유지: 기존 필터 유지 저장(`sessionStorage`, 품목별)에 `period`를 같이 넣는다.
- UI: 필터 바의 "기간" 알약은 하단 시트에서 라디오 한 개를 고른다. 선택값이 알약에 글자로 보인다 ("기간" → "최근 90일"). `spec.md` 13.5의 필터 바 규칙(한 줄, 44px)을 따른다.
- 테스트: 단위(기간별 경계, 순서 규칙, 최신 기록이 기간 밖이면 상품+판매처가 통째로 빠짐, 순위와 차이 재계산, `hiddenByPeriod`), 컴포넌트(안내 문구, 모두 보기, 칩 해제, 0건 안내), 종단(데모 샘플에서 "최근 90일" 선택 시 오래된 두부 기록이 사라짐, 폭 360px에서 알약 4개가 한 줄로 보이거나 가로 스크롤 없이 줄바꿈).

## 홈 정리: 품목 검색칸 제거와 내 품목 (요구 16.15~16.18)
- `features/home/HomePage`에서 기존 품목 검색 입력(제목 "품목 검색")과 그 결과 목록을 삭제한다. 품명 자동완성(`QuickCompare`)의 `findCandidates`는 이미 품목과 브랜드로도 찾는다 (요구 16.5). 품목 이름만 입력했을 때 후보가 나오는지 테스트로 확인한다.
- `ItemChips` 컴포넌트: `listItems()`(품목별 `{ itemId, name, recordCount, lastPurchasedAt }`)를 받아 칩을 렌더한다. 정렬은 `lastPurchasedAt` 내림차순. 칩은 `<a href="/items/:id">`처럼 링크로 만들어 키보드와 스크린 리더에서 쓸 수 있게 한다. `flex-wrap: wrap`으로 줄바꿈하고 칩 높이는 44px 이상.
- 칩을 눌러 연 결과 화면은 `anchor` 없이 연다. 그래서 기존 규칙(요구 7, 8.4)대로 프리셋 두 개가 꺼지고 "품목 전체"로 시작한다.
- 기록 0건: `listItems()`가 빈 배열이면 `ItemChips` 대신 `EmptyHome`(한 줄 안내와 "가격 등록" 버튼)을 렌더한다.
- 같은 이름의 품목이 둘일 수 없다(저장소가 품목 이름으로 합친다). 칩에 같은 이름이 두 번 나오면 버그다.
- 테스트: 컴포넌트(칩 정렬, 건수, 링크, 빈 상태, 품목 검색칸이 없음), 종단(폭 360px에서 칩 줄바꿈, 가로 스크롤 없음, 칩을 눌러 "품목 전체" 탭과 비활성 탭 확인, 빠른 비교에 "두부"만 입력해 후보 확인).
