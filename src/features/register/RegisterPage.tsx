import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Autocomplete } from '../../components/Autocomplete';
import { NAField } from '../../components/NAField';
import { PhotoPicker } from '../../components/PhotoPicker';
import { buildResult, emptyFilters } from '../../domain/compare';
import { prefill, type PrefillMode } from '../../domain/prefill';
import { buildSearchQuery } from '../../domain/searchQuery';
import { emptyDraft, type InputUnit, type PriceRecordView, type RegisterDraft } from '../../domain/types';
import { formatUnitPrice, formatWon, unitPrice } from '../../domain/unitPrice';
import { INPUT_UNITS } from '../../domain/units';
import { getPhoto, getRecordView, findItemByName, listRecordViews, saveRecord, searchItems, searchProducts, searchStores, updateRecord } from '../../data/repositories';
import { processPhoto, type ProcessedPhoto } from '../../data/image';
import type { Item, Store } from '../../data/db';
import { OnlineSearch } from '../search/OnlineSearch';
import { validateDraft } from './validate';

const PACK_UNITS = ['개', '팩', '봉', '병', '캔', '박스', 'kg', '단'];
const num = (s: string) => (s.trim() === '' ? null : Number(s));

/** 고른 기존 상품으로 상품 정보만 채운다. 가격, 판매처, 날짜, 사진은 그대로 (요구 3.2, 3.4) */
function applyProduct(d: RegisterDraft, rec: PriceRecordView): RegisterDraft {
  const p = prefill(rec, 'clone');
  return { ...d, productName: p.productName, itemName: p.itemName, origin: p.origin, brand: p.brand, packUnit: p.packUnit, unitAmount: p.unitAmount, bundleCount: p.bundleCount };
}

export function RegisterPage() {
  const nav = useNavigate();
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const mode = (params.get('mode') ?? 'clone') as PrefillMode;
  const [draft, setDraft] = useState<RegisterDraft>(() => ({ ...emptyDraft(), itemName: params.get('item') ?? '' }));
  const [photo, setPhoto] = useState<ProcessedPhoto | null>(null);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [itemRecords, setItemRecords] = useState<{ itemId: string; recs: PriceRecordView[] } | null>(null);

  // 미리 채우기 (요구 10, 11) 또는 수정 (요구 12)
  useEffect(() => {
    const id = editId ?? from;
    if (!id) return;
    getRecordView(id).then(async (rec) => {
      if (!rec) return;
      if (editId) {
        const d = prefill(rec, 'refresh');
        setDraft({ ...d, price: rec.price, purchasedAt: rec.purchasedAt, note: rec.note ?? '', photoId: rec.photoId });
        const ph = await getPhoto(rec.photoId);
        if (ph) {
          setPreview(ph.thumb);
          setHasExistingPhoto(true);
        }
      } else setDraft(prefill(rec, mode));
    });
  }, [editId, from, mode]);

  const set = <K extends keyof RegisterDraft>(k: K, v: RegisterDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // 판매처 이름이 기존 판매처와 같으면 온라인 여부를 가져온다 (요구 1.5, 1.6)
  useEffect(() => {
    const name = draft.storeName.trim();
    if (!name) return;
    let alive = true;
    searchStores(name).then((ss) => {
      const s = ss.find((x) => x.name === name);
      if (alive && s) setDraft((d) => ({ ...d, storeIsOnline: s.isOnline }));
    });
    return () => {
      alive = false;
    };
  }, [draft.storeName]);

  // 같은 품목 기록 (비교 바, 요구 8.1)
  useEffect(() => {
    const name = draft.itemName.trim();
    let alive = true;
    const t = setTimeout(async () => {
      const item = name ? await findItemByName(name) : undefined;
      const recs = item ? await listRecordViews(item.id) : [];
      if (alive) setItemRecords(item ? { itemId: item.id, recs: recs.filter((r) => r.id !== editId) } : null);
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draft.itemName, editId]);

  const myUnitPrice = draft.price && draft.bundleCount && draft.price > 0 && draft.bundleCount > 0
    ? unitPrice({ price: draft.price, bundleCount: draft.bundleCount, unitAmount: draft.unitAmount, shippingFee: draft.storeIsOnline && draft.shippingFee.kind === 'value' ? draft.shippingFee.value : undefined })
    : null;
  const summary = useMemo(() => {
    if (!myUnitPrice || !itemRecords) return undefined;
    return buildResult(itemRecords.recs, {
      preset: 'allItem',
      filters: emptyFilters(),
      sort: 'unitPrice',
      showHistory: false,
      anchor: { unitPrice: myUnitPrice },
    }).anchorSummary;
  }, [myUnitPrice, itemRecords]);

  const errors = validateDraft(draft, !!photo || hasExistingPhoto);
  const valid = Object.keys(errors).length === 0;

  const onPick = async (file: File) => {
    setPhotoError(null);
    try {
      const p = await processPhoto(file);
      setPhoto(p);
      setPreview(p.thumb);
    } catch {
      setPhotoError('사진을 처리하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = editId ? await updateRecord(editId, draft, photo) : await saveRecord(draft, photo!);
      nav(`/items/${r.itemId}?mine=${r.id}`, { replace: !!editId });
    } catch {
      // 입력값은 그대로 둔다 (design.md 오류 처리)
      setSaveError('저장하지 못했어요. 입력한 내용은 그대로 있어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const fetchProducts = useCallback((q: string) => searchProducts(q), []);
  const fetchItemProducts = useCallback((q: string) => searchProducts(q, { byItem: true }), []);
  const fetchItems = useCallback((q: string) => searchItems(q), []);
  const fetchStores = useCallback((q: string) => searchStores(q), []);
  const productLabel = (r: PriceRecordView) =>
    [r.brand?.kind === 'value' ? r.brand.value : '', r.productName?.kind === 'value' ? r.productName.value : r.itemName, r.unitAmount?.kind === 'value' ? `${r.unitAmount.value.amount}${r.unitAmount.value.unit === 'ea' ? '개' : r.unitAmount.value.unit}` : '', `×${r.bundleCount}`]
      .filter(Boolean)
      .join(' ');

  return (
    <main className="page">
      <div className="header">
        <button type="button" className="back" aria-label="뒤로" onClick={() => nav(-1)}>
          ←
        </button>
        <h1>{editId ? '기록 수정' : '가격 등록'}</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {/* 요구 1.4: 품명부터 */}
        <NAField label="품명" state={draft.productName} onChange={(s) => set('productName', s)} hint="농산품처럼 품명이 없으면 해당사항 없음">
          <Autocomplete<PriceRecordView>
            label={<span className="sr-only">품명 입력</span>}
            value={draft.productName.kind === 'value' ? draft.productName.value : ''}
            onChange={(v) => set('productName', v ? { kind: 'value', value: v } : { kind: 'empty' })}
            fetch={fetchProducts}
            itemKey={(r) => r.productId}
            render={productLabel}
            onSelect={(r) => setDraft((d) => applyProduct(d, r))}
            placeholder="예: 국산콩으로 만든 두부"
          />
        </NAField>

        {draft.productName.kind === 'na' ? (
          <Autocomplete<PriceRecordView>
            label={<>품목 <span className="req">필수</span></>}
            value={draft.itemName}
            onChange={(v) => set('itemName', v)}
            fetch={fetchItemProducts}
            itemKey={(r) => r.productId}
            render={productLabel}
            onSelect={(r) => setDraft((d) => ({ ...applyProduct(d, r), productName: { kind: 'na' } }))}
            placeholder="예: 양파"
          />
        ) : (
          <Autocomplete<Item>
            label={<>품목 <span className="req">필수</span></>}
            value={draft.itemName}
            onChange={(v) => set('itemName', v)}
            fetch={fetchItems}
            itemKey={(i) => i.id}
            render={(i) => i.name}
            onSelect={(i) => set('itemName', i.name)}
            placeholder="예: 두부"
          />
        )}

        <NAField label="원산지" state={draft.origin} onChange={(s) => set('origin', s)}>
          <div className="radio-row" role="radiogroup" aria-label="원산지 선택">
            <label>
              <input type="radio" name="origin" checked={draft.origin.kind === 'value' && draft.origin.value.type === 'domestic'} onChange={() => set('origin', { kind: 'value', value: { type: 'domestic' } })} />
              국산
            </label>
            <label>
              <input type="radio" name="origin" checked={draft.origin.kind === 'value' && draft.origin.value.type === 'import'} onChange={() => set('origin', { kind: 'value', value: { type: 'import' } })} />
              수입
            </label>
          </div>
          {draft.origin.kind === 'value' && draft.origin.value.type === 'import' && (
            <input
              aria-label="수입 국가"
              placeholder="국가 (예: 미국)"
              value={draft.origin.value.country ?? ''}
              onChange={(e) => set('origin', { kind: 'value', value: { type: 'import', country: e.target.value || undefined } })}
            />
          )}
        </NAField>

        <NAField label="브랜드" state={draft.brand} onChange={(s) => set('brand', s)}>
          <input aria-label="브랜드 입력" value={draft.brand.kind === 'value' ? draft.brand.value : ''} onChange={(e) => set('brand', e.target.value ? { kind: 'value', value: e.target.value } : { kind: 'empty' })} placeholder="예: 풀무원" />
        </NAField>

        <div className="field">
          <label className="lbl" htmlFor="packUnit">
            포장단위 <span className="req">필수</span>
          </label>
          <input id="packUnit" list="pack-units" value={draft.packUnit} onChange={(e) => set('packUnit', e.target.value)} />
          <datalist id="pack-units">
            {PACK_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <NAField label="단위용량 (1개의 양)" state={draft.unitAmount} onChange={(s) => set('unitAmount', s)} hint="없으면 1개당 가격으로 비교해요">
          <div className="inline">
            <input
              aria-label="단위용량"
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={draft.unitAmount.kind === 'value' ? String(draft.unitAmount.value.amount || '') : ''}
              onChange={(e) => {
                const unit = draft.unitAmount.kind === 'value' ? draft.unitAmount.value.unit : 'g';
                set('unitAmount', e.target.value === '' ? { kind: 'empty' } : { kind: 'value', value: { amount: Number(e.target.value), unit } });
              }}
              placeholder="300"
            />
            <select
              aria-label="용량 단위"
              value={draft.unitAmount.kind === 'value' ? draft.unitAmount.value.unit : 'g'}
              onChange={(e) => {
                const amount = draft.unitAmount.kind === 'value' ? draft.unitAmount.value.amount : 0;
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
        </NAField>

        <div className="field">
          <label className="lbl" htmlFor="bundle">
            번들묶음 (몇 개 묶음) <span className="req">필수</span>
          </label>
          <input id="bundle" type="number" inputMode="numeric" min="1" step="1" value={draft.bundleCount ?? ''} onChange={(e) => set('bundleCount', num(e.target.value))} />
        </div>

        <div className="field">
          <label className="lbl" htmlFor="price">
            가격 (원) <span className="req">필수</span>
          </label>
          <input id="price" type="number" inputMode="numeric" min="0" step="1" value={draft.price ?? ''} onChange={(e) => set('price', num(e.target.value))} placeholder="3480" />
        </div>

        <Autocomplete<Store>
          label={<>판매처 <span className="req">필수</span></>}
          value={draft.storeName}
          onChange={(v) => set('storeName', v)}
          fetch={fetchStores}
          itemKey={(s) => s.id}
          render={(s) => (s.isOnline ? `${s.name} (온라인)` : s.name)}
          onSelect={(s) => setDraft((d) => ({ ...d, storeName: s.name, storeIsOnline: s.isOnline }))}
          placeholder="예: 이마트 구로점"
        />
        <label className="na-check">
          <input type="checkbox" checked={draft.storeIsOnline} onChange={(e) => set('storeIsOnline', e.target.checked)} />
          온라인 판매처
        </label>

        {/* 요구 1.5, 1.6: 온라인 판매처에서만 배송비 */}
        {draft.storeIsOnline && (
          <NAField label="배송비 (원)" state={draft.shippingFee} onChange={(s) => set('shippingFee', s)} hint="단위가격에 더해서 계산해요">
            <input
              aria-label="배송비"
              type="number"
              inputMode="numeric"
              min="0"
              value={draft.shippingFee.kind === 'value' ? draft.shippingFee.value : ''}
              onChange={(e) => set('shippingFee', e.target.value === '' ? { kind: 'empty' } : { kind: 'value', value: Number(e.target.value) })}
            />
          </NAField>
        )}

        <div className="field">
          <label className="lbl" htmlFor="date">
            날짜 <span className="req">필수</span>
          </label>
          <input id="date" type="date" value={draft.purchasedAt} onChange={(e) => set('purchasedAt', e.target.value)} />
        </div>

        <div className="field">
          <label className="lbl" htmlFor="note">
            메모
          </label>
          <textarea id="note" rows={2} value={draft.note} onChange={(e) => set('note', e.target.value)} />
        </div>

        <PhotoPicker preview={preview} onPick={onPick} error={photoError ?? errors.photo} />

        <div className="field">
          <OnlineSearch query={buildSearchQuery({ itemName: draft.itemName, productName: draft.productName, brand: draft.brand, unitAmount: draft.unitAmount })} />
        </div>

        {/* 요구 8.1, 8.2: 저장 전 비교 */}
        {myUnitPrice && (
          <section className="compare-bar" aria-label="지금 이 가격">
            <div>
              지금 이 가격 <strong>{formatUnitPrice(myUnitPrice)}</strong>
            </div>
            {summary ? (
              <div>
                {summary.total}건 중 <strong>{summary.rank}위</strong> · 최저가보다{' '}
                {summary.diffWon > 0 ? `${formatWon(summary.diffWon)} 비싸요 (+${summary.diffPct.toFixed(0)}%)` : summary.diffWon < 0 ? `${formatWon(-summary.diffWon)} 싸요 (${summary.diffPct.toFixed(0)}%)` : '같아요'}
              </div>
            ) : (
              <div className="hint">{itemRecords ? '단위가 달라 비교할 수 없어요' : '이 품목의 첫 기록이에요'}</div>
            )}
            {itemRecords && (
              <button
                type="button"
                onClick={() =>
                  nav(`/items/${itemRecords.itemId}`, {
                    state: { draftAnchor: { unitPrice: myUnitPrice, productName: draft.productName, brand: draft.brand, unitAmount: draft.unitAmount } },
                  })
                }
              >
                저장 없이 비교만
              </button>
            )}
          </section>
        )}

        {!valid && (
          <p className="hint" data-testid="missing">
            저장하려면: {Object.entries(errors).filter(([k]) => k !== 'photo').map(([, v]) => v).concat(errors.photo ? ['사진을 올려 주세요'] : []).join(', ')}
          </p>
        )}
        {saveError && (
          <p className="error" role="alert">
            {saveError}
          </p>
        )}
        <div className="bottom-bar">
          <button type="submit" className="primary" disabled={!valid || saving}>
            {saving ? '저장 중…' : saveError ? '다시 저장' : '저장'}
          </button>
        </div>
      </form>
    </main>
  );
}
