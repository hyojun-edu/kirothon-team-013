# 인수 기준 점검표 (spec.md 11절, 14.5절, 작업 10.5, 11.6, 12.9, 14.7)

| # | 인수 기준 | 결과 | 확인한 테스트 |
|---|---|---|---|
| 1 | 사진 없이 저장할 수 없다 | 통과 | `src/features/register/RegisterPage.test.tsx` "요구 1.1, 1.2", `validate.test.ts` |
| 2 | 필수 7항목 외는 "해당사항 없음"으로 저장 | 통과 | `RegisterPage.test.tsx` "요구 2.4", `src/data/repositories.test.ts` "요구 2.3", `validate.test.ts` "요구 2.2" |
| 3 | 기존 품명을 고르면 품목/원산지/브랜드/단위용량/번들 자동 입력 | 통과 | `RegisterPage.test.tsx` "요구 3.1~3.4", "요구 3.5" |
| 4 | 300g×2 3,480원 = 580원/100g, 400g×1 2,900원 = 725원/100g, 580원이 위 | 통과 | `src/domain/unitPrice.test.ts`, `compare.test.ts`, `ResultsPage.test.tsx`, E2E `flow.spec.ts` "전체 흐름" |
| 5 | 브랜드·원산지·번들 필터 여러 개 → 조건에 맞는 기록만, 최저가 강조 | 통과 | 작업 13: 따로 된 최저가 카드 없이 목록 1위 카드가 "조건 내 최저가" 배지로 강조 (요구 5.2, 6.5). `compare.test.ts` "필터", `ResultsPage.test.tsx` "요구 6", E2E "전체 흐름" |
| 6 | 온라인 판매처에서만 배송비 입력란, 단위가격에 반영 | 통과 | `RegisterPage.test.tsx` "요구 1.5, 1.6", `unitPrice.test.ts` "요구 4.2", `repositories.test.ts`, E2E "전체 흐름"(667원/100g) |
| 7 | 네트워크 없이 등록과 조회 | 통과 | E2E `flow.spec.ts` "네트워크 없이 등록하고 조회한다", `pwa.spec.ts` |
| 8 | 360px에서 가로 스크롤 없음 | 통과 | E2E "모든 화면이 360px 안에…", "전체 흐름" |
| 9 | 온라인 기록이 없는 품목에서도 온라인 가격 검색, 검색어 = 브랜드+품명+단위용량 | 통과 | `flow.test.tsx` "온라인 기록이 없는 품목에서도…", `searchQuery.test.ts`, E2E |
| 10 | "온라인 가격 등록" → 상품 정보 채움, 가격·판매처·배송비·사진 비움 | 통과 | `flow.test.tsx` "돌아와서 등록", `prefill.test.ts`, E2E |
| 11 | "이 기록으로 새로 등록"도 같은 방식 | 통과 | `flow.test.tsx` "이 기록으로 새로 등록…", `RegisterPage.test.tsx` "요구 10.4, 11.4" |
| 12 | 미리 채운 값을 수정해도 원래 기록은 그대로 | 통과 | `prefill.test.ts` "요구 10.5", `repositories.test.ts`, `flow.test.tsx` |
| 13 | 온라인 가격 검색은 구글 검색 결과를 새 탭으로 | 통과 | `searchQuery.test.ts`, `flow.test.tsx`, E2E 팝업 주소 확인 |
| 14 | 최신가격 다시 검색 → 판매처·배송비 채움, 가격·사진만 비움 | 통과 | `flow.test.tsx` "최신가격 다시 검색", E2E |
| 15 | 갱신 후 최신 기록만, "이전 기록 보기"로 날짜순 | 통과 | `compare.test.ts` "최신 기록만과 이력", `ResultsPage.test.tsx` "요구 5.7", `flow.test.tsx`, E2E |
| 16 | 오프라인 기록 상세에는 "최신가격 다시 검색" 없음 | 통과 | `flow.test.tsx` "오프라인 기록에는 없다", E2E |
| 17 | 모든 행에 사진·단위가격·가격·용량×번들·판매처·날짜, 단위가격이 가장 큼 | 통과 | `ResultsPage.test.tsx` "요구 5.3, 5.5, 5.6", E2E "전체 흐름"(글자 크기 비교) |
| 18 | 1위 행에 색과 "최저가" 배지 | 통과 | 필터 없으면 "최저가", 있으면 "조건 내 최저가" (작업 13). `ResultsPage.test.tsx` "요구 5.1, 5.4"(배지 글자, 최저가 카드 없음), `components.test.tsx` "요구 13.7", E2E "전체 흐름" |
| 19 | 등록 화면에서 진입하면 비교 바에 순위와 최저가 차이 | 통과 | `RegisterPage.test.tsx` "요구 8.1, 8.2", `ResultsPage.test.tsx` "요구 1.7, 8.3", E2E |
| 20 | 기록 0건, 필터 0건 안내와 버튼 | 통과 | `ResultsPage.test.tsx` "요구 5.9", "요구 6" |
| 21 | 90일 넘은 기록은 흐리게 + "오래된 가격" | 통과 | `compare.test.ts` "isOld", `ResultsPage.test.tsx` "요구 5.3, 5.5, 5.6" |
| 22 | 단위가 다른 기록은 순위에 섞이지 않고 "비교 불가" 구역 | 통과 | `compare.test.ts` "단위 타입 분리", `ResultsPage.test.tsx` "요구 5.11, 5.12" |
| 23 | 사진이 있는 기존 상품을 품명 자동완성으로 고르면 가장 최근 사진이 "이전 사진"으로 채워지고, 새로 올리지 않아도 저장 | 통과 | `RegisterPage.test.tsx` "인수 23, 요구 3.7, 3.8", `repositories.test.ts` "이전 사진 불러오기", `validate.test.ts` "요구 3.8", E2E `flow.spec.ts` "품명 자동완성으로 이전 사진을…" |
| 24 | 불러온 사진을 "다시 촬영"/"갤러리에서 선택"으로 바꾸면 새 사진 저장, 이전 기록 사진은 그대로 | 통과 | `RegisterPage.test.tsx` "인수 24, 요구 3.9", `repositories.test.ts` "다른 기록이 쓰는 사진은 삭제·수정해도 남는다", E2E `flow.spec.ts` "품명 자동완성으로 이전 사진을…" |
| 25 | 이전 사진이 없는 상품을 고르면 사진 칸이 비어 있고 사진 없이는 저장 불가 | 통과 | `RegisterPage.test.tsx` "인수 25, 요구 3.10", `repositories.test.ts` "기록이 없거나 사진이 지워졌으면 undefined" |
| 26 | "온라인 가격 등록", "이 기록으로 새로 등록", "최신가격 다시 검색"으로 연 등록 화면은 사진 칸이 비어 있다 | 통과 | `RegisterPage.test.tsx` "인수 26, 요구 3.11" (search, clone, refresh), `prefill.test.ts`, E2E `flow.spec.ts` "전체 흐름" |
| 27 | 360px에서 프리셋 탭 3개, 필터 버튼 3개, 하단 버튼 글자가 한 줄이고 잘리지 않는다 | 통과 | E2E `tests/e2e/design.spec.ts` "프리셋 탭, 필터 버튼, 하단 버튼이 한 줄이고 1위 카드가 구분된다" |
| 28 | 탭 이름 "똑같은 상품"/"용량 무관"/"품목 전체", 아래 한 줄 설명 | 통과 | `ResultsPage.test.tsx` "요구 7.1, 14.3, 14.4", E2E `design.spec.ts` 두 테스트 |
| 29 | 결과는 카드, 1위 카드는 색·테두리·"최저가" 배지로 구분 | 통과 | E2E `design.spec.ts` (배경색, 2px 테두리, 배지 비교), `ResultsPage.test.tsx` "요구 5.1, 5.4, 4.4" |
| 30 | 모든 글자/배경 명암비 4.5:1 이상 (큰 글자 3:1) | 통과 | `src/styles/contrast.test.ts` (토큰 쌍 13개) |
| 31 | 홈, 등록, 결과, 상세가 13절 색·글자·간격을 같이 쓴다 | 통과 | 토큰은 `src/styles/tokens.css` 한 곳. 다른 CSS와 TSX에 색 값·인라인 스타일 없음 (`grep`으로 확인), 캡처 4장 |
| 32 | 360px 캡처 4장이 `docs/screenshots/`에 있다 | 통과 | `docs/screenshots/{home,register,results,detail}.png`, 만든 스크립트 `docs/presentation/shots.spec.ts` (`npx playwright test -c docs/presentation/shots.config.ts`) |
| 33 | `npm run demo`를 실행하면 4174번 포트에서 앱이 열리고 첫 화면에 샘플 품목 5개 이상이 보인다 | 통과 | E2E `tests/demo/demo.spec.ts` "데모: 첫 화면에 샘플 품목 5개 이상…" (`npx playwright test -c playwright.demo.config.ts`, 서버 `npm run demo`), `src/demo/seed.test.ts` "요구 15.2" |
| 34 | 두부 비교 목록에 번들 다름, 브랜드 3개 이상, 온라인 2건 이상, 오래된 가격, 비교 불가, 이력이 모두 보인다 | 통과 | `src/demo/seed.test.ts` "요구 15.6: 두부 구성표" (`buildResult`로 확인, 국산 필터로 1위가 바뀜), "두부 300g×2 3,480원을 넣으면 4~5위" |
| 35 | `?reset=1`로 열면 데이터가 초기 샘플 상태로 돌아간다 | 통과 | E2E `tests/demo/demo.spec.ts` "데모: ?reset=1로 열면…", `seed.test.ts` "요구 15.3", "요구 15.4" |
| 36 | 일반 빌드와 일반 미리보기(4173)에는 샘플 데이터가 없다 | 통과 | E2E `tests/e2e/demo-build.spec.ts` (`dist/`에서 샘플 글자열 검색, 4173에 "데모 데이터" 없음). 데모 빌드는 `dist-demo/`로 따로 나간다 |
| 37 | 샘플 기록에는 모두 사진이 있고 외부 이미지 파일을 쓰지 않는다 | 통과 | `seed.test.ts` "요구 15.2" (모든 기록의 사진 확인), `src/demo/drawPhoto.ts` (캔버스로 그림), E2E `demo.spec.ts` (외부 이미지 요청 없음) |

추가 확인
- 요구 6.7 (1,000건 필터 300ms): `compare.test.ts` "성능", E2E "1,000건에서 필터 변경이…"
- 요구 13.4 (터치 대상 44px): E2E `touchTargetsOk` (홈, 등록, 결과, 필터 열림, 상세)
- 요구 13.5 (사진 긴 변 1280px): `src/data/image.test.ts`, E2E에서 실제 사진 업로드

## 구현 중 정한 것 (스펙에 적혀 있지 않은 부분)
- 홈에서 품목으로 들어오면 "내 상품"이 없어서 "똑같은 상품", "용량 무관" 탭은 비활성이다 (누르면 이유를 한 줄로 알린다). 등록 저장 후, "저장 없이 비교만", 상세의 "비교 목록 보기"로 들어오면 쓸 수 있다.
- 결과 화면의 온라인 검색어와 "온라인 가격 등록" 미리 채우기 기준은 내 상품 → 현재 조건의 1위 기록 → 품목명 순서다.
- 같은 상품 재사용 키에는 품명·브랜드·단위용량 외에 원산지와 포장단위도 넣었다. 복제 등록에서 원산지를 바꿔도 원래 기록이 바뀌지 않게 하려는 것이다 (요구 10.5). 프리셋 비교는 spec대로 품명·브랜드·단위용량만 본다.
- 등록 화면 필드 순서는 품명 → … → 사진이다. 스펙 변경(작업 11) 뒤로 spec.md 10절, 요구 1.4, design.md가 모두 같은 순서를 말한다.
- 이전 사진 불러오기 (작업 11): 이미 새 사진을 올린 뒤 자동완성으로 상품을 고르면 새 사진을 덮지 않는다 (입력 손실 방지). 기록 수정 화면은 그 기록의 사진을 그대로 보여 주고 "이전 사진" 표시는 붙이지 않는다.
- 시각 디자인 (작업 12): "최저가" 배지는 `--accent`(#E8590C) 바탕에 흰 글자가 아니라 `--text` 글자를 쓴다. 흰 글자는 명암비 3.6:1이라 요구 14.9를 못 맞춘다. 토큰 값은 스펙 그대로다.
- 필터 선택 시트는 모달이 아니다. 시트를 연 채로 위쪽 칩과 목록을 보고 누를 수 있다. "닫기"와 "적용"은 둘 다 시트를 닫는다 (체크하면 바로 반영된다).
- 등록 화면의 "지금 이 가격" 비교 바는 저장 버튼 위 하단 고정 바 안에 있다. 바가 보일 때는 본문 아래 여백을 늘려 입력칸을 가리지 않는다.
