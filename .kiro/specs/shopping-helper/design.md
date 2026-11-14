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
