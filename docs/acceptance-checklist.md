# 인수 기준 점검표 (spec.md 11절, 작업 10.5)

| # | 인수 기준 | 결과 | 확인한 테스트 |
|---|---|---|---|
| 1 | 사진 없이 저장할 수 없다 | 통과 | `src/features/register/RegisterPage.test.tsx` "요구 1.1, 1.2", `validate.test.ts` |
| 2 | 필수 7항목 외는 "해당사항 없음"으로 저장 | 통과 | `RegisterPage.test.tsx` "요구 2.4", `src/data/repositories.test.ts` "요구 2.3", `validate.test.ts` "요구 2.2" |
| 3 | 기존 품명을 고르면 품목/원산지/브랜드/단위용량/번들 자동 입력 | 통과 | `RegisterPage.test.tsx` "요구 3.1~3.4", "요구 3.5" |
| 4 | 300g×2 3,480원 = 580원/100g, 400g×1 2,900원 = 725원/100g, 580원이 위 | 통과 | `src/domain/unitPrice.test.ts`, `compare.test.ts`, `ResultsPage.test.tsx`, E2E `flow.spec.ts` "전체 흐름" |
| 5 | 브랜드·원산지·번들 필터 여러 개 → 조건에 맞는 기록만, 최저가 강조 | 통과 | `compare.test.ts` "필터", `ResultsPage.test.tsx` "요구 6", E2E "전체 흐름" |
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
| 18 | 1위 행에 색과 "최저가" 배지 | 통과 | `ResultsPage.test.tsx` "요구 5.1, 5.4", `components.test.tsx` "요구 13.7", E2E |
| 19 | 등록 화면에서 진입하면 비교 바에 순위와 최저가 차이 | 통과 | `RegisterPage.test.tsx` "요구 8.1, 8.2", `ResultsPage.test.tsx` "요구 1.7, 8.3", E2E |
| 20 | 기록 0건, 필터 0건 안내와 버튼 | 통과 | `ResultsPage.test.tsx` "요구 5.9", "요구 6" |
| 21 | 90일 넘은 기록은 흐리게 + "오래된 가격" | 통과 | `compare.test.ts` "isOld", `ResultsPage.test.tsx` "요구 5.3, 5.5, 5.6" |
| 22 | 단위가 다른 기록은 순위에 섞이지 않고 "비교 불가" 구역 | 통과 | `compare.test.ts` "단위 타입 분리", `ResultsPage.test.tsx` "요구 5.11, 5.12" |

추가 확인
- 요구 6.7 (1,000건 필터 300ms): `compare.test.ts` "성능", E2E "1,000건에서 필터 변경이…"
- 요구 13.4 (터치 대상 44px): E2E `touchTargetsOk` (홈, 등록, 결과, 필터 열림, 상세)
- 요구 13.5 (사진 긴 변 1280px): `src/data/image.test.ts`, E2E에서 실제 사진 업로드

## 구현 중 정한 것 (스펙에 적혀 있지 않은 부분)
- 홈에서 품목으로 들어오면 "내 상품"이 없어서 "똑같은 상품", "같은 상품, 용량 무관" 탭은 비활성이다. 등록 저장 후, "저장 없이 비교만", 상세의 "비교 목록 보기"로 들어오면 쓸 수 있다.
- 결과 화면의 온라인 검색어와 "온라인 가격 등록" 미리 채우기 기준은 내 상품 → 현재 조건부 최저가 기록 → 품목명 순서다.
- 같은 상품 재사용 키에는 품명·브랜드·단위용량 외에 원산지와 포장단위도 넣었다. 복제 등록에서 원산지를 바꿔도 원래 기록이 바뀌지 않게 하려는 것이다 (요구 10.5). 프리셋 비교는 spec대로 품명·브랜드·단위용량만 본다.
- 등록 화면 필드 순서는 design.md(품명 → … → 사진)를 따랐다. spec.md 10절은 "사진 → 품명"이지만 요구 1.4("품명부터")와 design.md가 일치한다.
