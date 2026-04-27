import { useEffect, useRef, useState } from 'react';
import type { AccountRow, CategoryRow, TransactionRow } from '@/lib/types';
import { parseAmountInput, todayISO } from '@/lib/utils';

type TxType = TransactionRow['type'];

export type TransactionDraft = {
  date: string;
  type: TxType;
  amount: number;
  account_id: string;
  category_id: string | null;
  memo: string;
  tags: string;
};

function emptyDraft(defaults?: Partial<TransactionDraft>): TransactionDraft {
  return {
    date: defaults?.date ?? todayISO(),
    type: defaults?.type ?? 'expense',
    amount: defaults?.amount ?? 0,
    account_id: defaults?.account_id ?? '',
    category_id: defaults?.category_id ?? null,
    memo: defaults?.memo ?? '',
    tags: defaults?.tags ?? '',
  };
}

export function TransactionModal({
  open,
  initial,
  accounts,
  categories,
  onClose,
  onSubmit,
  mode = 'create',
}: {
  open: boolean;
  initial?: Partial<TransactionDraft>;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onClose: () => void;
  onSubmit: (draft: TransactionDraft) => Promise<void>;
  mode?: 'create' | 'edit';
}) {
  const [draft, setDraft] = useState<TransactionDraft>(() => emptyDraft(initial));
  const [amountStr, setAmountStr] = useState<string>(initial?.amount ? String(initial.amount) : '');
  const [continuous, setContinuous] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft({ ...initial, account_id: initial?.account_id ?? accounts[0]?.id ?? '' }));
      setAmountStr(initial?.amount ? String(initial.amount) : '');
      setError(null);
      // 모달 열리면 금액 입력에 포커스
      setTimeout(() => amountRef.current?.focus(), 30);
    }
  }, [open, initial, accounts]);

  if (!open) return null;

  const expCats = categories.filter((c) => c.kind === 'expense');
  const incCats = categories.filter((c) => c.kind === 'income');
  const cats = draft.type === 'income' ? incCats : draft.type === 'expense' ? expCats : [];

  async function submit() {
    setError(null);
    const amt = parseAmountInput(amountStr);
    if (!amt || amt === 0) {
      setError('금액을 입력하세요');
      amountRef.current?.focus();
      return;
    }
    if (!draft.account_id) {
      setError('계좌를 선택하세요');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ ...draft, amount: amt });
      if (continuous && mode === 'create') {
        setDraft((d) => ({ ...d, amount: 0, memo: '', tags: '' }));
        setAmountStr('');
        setTimeout(() => amountRef.current?.focus(), 30);
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-bg border border-line w-[480px] max-w-[90vw] text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      >
        <div className="border-b border-line px-4 py-2 flex items-center">
          <h2 className="font-medium">{mode === 'edit' ? '거래 수정' : '거래 추가'}</h2>
          <div className="flex-1" />
          <button className="text-sub hover:text-ink px-1" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* 타입 */}
          <div className="flex gap-1">
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                className="flex-1 border border-line py-1 hover:bg-hover"
                style={{
                  background: draft.type === t ? 'var(--c-ink)' : undefined,
                  color: draft.type === t ? 'var(--c-bg)' : undefined,
                }}
                onClick={() => setDraft((d) => ({ ...d, type: t, category_id: null }))}
              >
                {t === 'expense' ? '지출' : t === 'income' ? '수입' : '이체'}
              </button>
            ))}
          </div>

          {/* 날짜 + 금액 */}
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <input
              type="date"
              className="border border-line px-2 py-1"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
            <input
              ref={amountRef}
              className="border border-line px-2 py-1 text-right font-mono"
              placeholder="금액"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          {/* 계좌 + 카테고리 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border border-line px-2 py-1"
              value={draft.account_id}
              onChange={(e) => setDraft((d) => ({ ...d, account_id: e.target.value }))}
            >
              <option value="">계좌 선택</option>
              {accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            {draft.type !== 'transfer' && (
              <select
                className="border border-line px-2 py-1"
                value={draft.category_id ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category_id: e.target.value === '' ? null : e.target.value }))
                }
              >
                <option value="">카테고리 (선택)</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 메모 */}
          <input
            className="w-full border border-line px-2 py-1"
            placeholder="메모"
            value={draft.memo}
            onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
          />

          {/* 태그 */}
          <input
            className="w-full border border-line px-2 py-1"
            placeholder="태그 (쉼표 구분)"
            value={draft.tags}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
          />

          {error && <div className="text-cat-red text-xs">{error}</div>}
        </div>

        <div className="border-t border-line px-4 py-2 flex items-center gap-2">
          {mode === 'create' && (
            <label className="flex items-center gap-1 text-xs text-sub cursor-pointer">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
              />
              연속 입력
            </label>
          )}
          <div className="flex-1" />
          <button className="border border-line px-3 py-1 hover:bg-hover" onClick={onClose}>
            취소
          </button>
          <button
            className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? '저장 중…' : mode === 'edit' ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
