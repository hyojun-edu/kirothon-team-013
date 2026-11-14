status: ready

# 질문과 답 — 저장 구조 변경 제안

구현 봇의 제안 네 건에 모두 추천안(a)으로 답한다. 답은 `design.md` "데이터 모델"에 반영했다.

| # | 질문 | 답 |
|---|---|---|
| 1 | `PriceRecord[photoId]` 인덱스 추가 | (a) 추가. Dexie version 2, 데이터 이전 없음 |
| 2 | `PriceRecord[productId+purchasedAt]` 복합 인덱스 추가 | (a) 추가. 1번과 같은 version 2 |
| 3 | `Store.chain`/`branch` 채우는 규칙 | (a) MVP는 이름만 받고 둘 다 비워 둔다. `design.md`에 명시함 |
| 4 | `design.md`를 실제 저장 구조에 맞추기 | (a) 문서를 구조에 맞춤. 구현은 바꾸지 않는다 |

## 4번 세부 반영 내용
- `Product.key`: 품목 + 품명 + 브랜드 + 단위용량 + 원산지 + 포장단위. 비교 프리셋은 키가 아니라 품명 + 브랜드 + 단위용량만 본다.
- `Photo.thumb`: 목록용 썸네일 Blob.
- `PriceRecord.shippingFeeNA`: 배송비 "해당사항 없음".
- `Field<T>`의 미입력: 칸 자체가 없는 것(undefined). `value | na`는 그대로.

이 변경으로 `requirements.md`, `spec.md`의 요구와 인수 기준은 바뀌지 않는다. 작업 11번을 계속 진행해도 된다.
