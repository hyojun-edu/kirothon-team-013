import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CandidateInput } from '../../components/CandidateList';
import type { Candidate } from '../../domain/candidates';
import type { Anchor } from '../../domain/compare';
import { emptyDraft, type FieldState, type InputUnit, type Origin, type RegisterDraft, type UnitAmount } from '../../domain/types';
import { unitPrice } from '../../domain/unitPrice';
import { INPUT_UNITS } from '../../domain/units';
import { findItemByName } from '../../data/repositories';

/** 홈 빠른 비교 입력값 (design.md QuickDraft) */
export interface QuickDraft {
  productName: FieldState<string>;
  itemName: string;
  brand: FieldState<string>;
  packUnit: string;
  unitAmount: FieldState<UnitAmount>;
  bundleCount: number;
  price: number | null;
  origin: FieldState<Origin>;
  priceIsPrevious: boolean;
  photoId?: string;
}

export const emptyQuick = (): QuickDraft => ({
  productName: { kind: 'empty' },
  itemName: '',
  brand: { kind: 'empty' },
  packUnit: '개',
  unitAmount: { kind: 'empty' },
  bundleCount: 1,
  price: null,
  origin: { kind: 'empty' },
  priceIsPrevious: false,
});

// 요구 16.6, 16.7: 후보의 값을 한 번에 채운다. 품명·브랜드는 N/A를 그대로, 원산지는 숨겨서 가져간다
export function draftFromCandidate(c: Candidate): QuickDraft {
  const r = c.record;
  const keep = <T,>(f: { kind: 'value'; value: T } | { kind: 'na' } | undefined): FieldState<T> => f ?? { kind: 'empty' };
  return {
    productName: keep(r.productName),
    itemName: c.itemName,
    brand: keep(r.brand),
    packUnit: c.packUnit,
    unitAmount: keep(r.unitAmount),
    bundleCount: c.bundleCount,
    price: c.price,
    origin: keep(r.origin),
    priceIsPrevious: true,
    photoId: c.photoId,
  };
}

/** 등록 화면으로 넘길 입력값 (요구 16.12) */
export function toRegisterDraft(q: QuickDraft): RegisterDraft {
  return {
    ...emptyDraft(),
    productName: q.productName,
    itemName: q.itemName,
    origin: q.origin,
    brand: q.brand,
    packUnit: q.packUnit,
    unitAmount: q.unitAmount,
    bundleCount: q.bundleCount,
    price: q.price,
    photo: q.photoId ? { kind: 'reused', photoId: q.photoId } : { kind: 'empty' },
  };
}

export function toAnchor(q: QuickDraft): Anchor {
  const up = q.price && q.price > 0 && q.bundleCount > 0 ? unitPrice({ price: q.price, bundleCount: q.bundleCount, unitAmount: q.unitAmount }) : null;
  return { productName: q.productName, brand: q.brand, unitAmount: q.unitAmount, ...(up ? { unitPrice: up } : {}) };
}

const originWord = (o: FieldState<Origin>) =>
  o.kind === 'na' ? '해당사항 없음' : o.kind === 'empty' ? '모름' : o.value.type === 'domestic' ? '국산' : o.value.country ? `수입(${o.value.country})` : '수입';
const textOf = (f: FieldState<string>) => (f.kind === 'value' ? f.value : '');
const textField = (v: string): FieldState<string> => (v ? { kind: 'value', value: v } : { kind: 'empty' });
const num = (s: string) => (s.trim() === '' ? null : Number(s));

// 요구 16.1~16.12: 홈 맨 위 빠른 비교. 저장하지 않는다
export function QuickCompare() {
  const nav = useNavigate();
  const [q, setQ] = useState<QuickDraft>(emptyQuick);
  const [originOpen, setOriginOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const set = <K extends keyof QuickDraft>(k: K, v: QuickDraft[K]) => {
    setQ((d) => ({ ...d, [k]: v }));
    setNotFound(false);
  };
  const canCompare = q.itemName.trim() !== '';

  const compare = async () => {
    const item = await findItemByName(q.itemName);
    if (!item) return setNotFound(true);
    nav(`/items/${item.id}`, { state: { draftAnchor: toAnchor(q), quick: true, registerDraft: toRegisterDraft(q), priceIsPrevious: q.priceIsPrevious } });
  };
  const register = () => nav('/register', { state: { registerDraft: toRegisterDraft(q), priceIsPrevious: q.priceIsPrevious } });

  return (
    <section className="card quick" aria-label="빠른 비교">
      <h2>빠른 비교</h2>
      <CandidateInput
        label="품명"
        value={textOf(q.productName)}
        onChange={(v) => set('productName', textField(v))}
        onSelect={(c) => {
          setQ(draftFromCandidate(c));
          setNotFound(false);
        }}
        placeholder={q.productName.kind === 'na' ? '해당사항 없음' : '예: 국산콩 두부'}
      />
      <div className="quick-grid">
        <div className="field">
          <label className="lbl" htmlFor="q-item">
            품목 <span className="req">필수</span>
          </label>
          <input id="q-item" value={q.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="예: 두부" />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="q-brand">
            브랜드
          </label>
          <input id="q-brand" value={textOf(q.brand)} onChange={(e) => set('brand', textField(e.target.value))} placeholder={q.brand.kind === 'na' ? '해당사항 없음' : '예: 풀무원'} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="q-pack">
            포장단위
          </label>
          <input id="q-pack" value={q.packUnit} onChange={(e) => set('packUnit', e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="q-amount">
            단위용량
          </label>
          <div className="inline">
            <input
              id="q-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={q.unitAmount.kind === 'value' ? String(q.unitAmount.value.amount || '') : ''}
              onChange={(e) => {
                const unit = q.unitAmount.kind === 'value' ? q.unitAmount.value.unit : 'g';
                set('unitAmount', e.target.value === '' ? { kind: 'empty' } : { kind: 'value', value: { amount: Number(e.target.value), unit } });
              }}
              placeholder="300"
            />
            <select
              aria-label="빠른 비교 용량 단위"
              value={q.unitAmount.kind === 'value' ? q.unitAmount.value.unit : 'g'}
              onChange={(e) => {
                const amount = q.unitAmount.kind === 'value' ? q.unitAmount.value.amount : 0;
                set('unitAmount', { kind: 'value', value: { amount, unit: e.target.value as InputUnit } });
              }}
            >
              {INPUT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === 'ea' ? '개' : u}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="q-bundle">
            번들묶음
          </label>
          <input id="q-bundle" type="number" inputMode="numeric" min="1" step="1" value={q.bundleCount || ''} onChange={(e) => set('bundleCount', num(e.target.value) ?? 0)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="q-price">
            가격 (원) {q.priceIsPrevious && <span className="badge badge-old" data-testid="prev-price">이전 가격</span>}
          </label>
          <input
            id="q-price"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={q.price ?? ''}
            onChange={(e) => setQ((d) => ({ ...d, price: num(e.target.value), priceIsPrevious: false }))}
            placeholder="3480"
          />
        </div>
      </div>

      {/* 요구 16.7: 원산지는 숨겨서 쓰고 필요하면 바꾼다 */}
      <div className="quick-origin">
        <span className="hint">원산지: {originWord(q.origin)}</span>
        <button type="button" className="link-btn" aria-expanded={originOpen} onClick={() => setOriginOpen((o) => !o)}>
          원산지 바꾸기
        </button>
      </div>
      {originOpen && (
        <select
          aria-label="원산지"
          value={q.origin.kind === 'value' ? q.origin.value.type : q.origin.kind}
          onChange={(e) => {
            const v = e.target.value;
            set('origin', v === 'domestic' ? { kind: 'value', value: { type: 'domestic' } } : v === 'import' ? { kind: 'value', value: { type: 'import' } } : v === 'na' ? { kind: 'na' } : { kind: 'empty' });
          }}
        >
          <option value="empty">모름</option>
          <option value="domestic">국산</option>
          <option value="import">수입</option>
          <option value="na">해당사항 없음</option>
        </select>
      )}

      {notFound && (
        <p className="hint" role="status">
          이 품목은 아직 기록이 없어요. "이 가격으로 등록"으로 첫 기록을 남겨 보세요.
        </p>
      )}
      <div className="row-btns">
        <button type="button" className="primary" disabled={!canCompare} onClick={compare}>
          비교하기
        </button>
        <button type="button" disabled={!canCompare} onClick={register}>
          이 가격으로 등록
        </button>
      </div>
    </section>
  );
}
