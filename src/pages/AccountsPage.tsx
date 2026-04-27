import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useAccounts, useTransactions } from '@/lib/hooks';
import type { AccountRow } from '@/lib/types';
import { formatKRW, parseAmountInput } from '@/lib/utils';

function daysUntilNextPayment(payDay: number, todayMs = Date.now()): number {
  const now = new Date(todayMs);
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  let target = new Date(y, m, payDay);
  // 이번달 결제일이 이미 지났거나, 해당 월에 그 날짜가 없으면 (예: 2월 30일) 다음달
  if (target.getMonth() !== m || payDay < today) {
    target = new Date(y, m + 1, payDay);
    while (target.getMonth() !== (m + 1) % 12) target = new Date(target.getTime() - 86400000);
  }
  const startOfToday = new Date(y, m, today);
  const ms = target.getTime() - startOfToday.getTime();
  return Math.round(ms / 86400000);
}

const TYPE_LABEL: Record<AccountRow['type'], string> = {
  cash: '현금',
  bank: '은행',
  card: '카드',
  invest: '투자',
  etc: '기타',
};

const TYPE_ORDER: AccountRow['type'][] = ['cash', 'bank', 'card', 'invest', 'etc'];

export function AccountsPage() {
  const { accounts, loading, error, create, update, remove } = useAccounts();
  // 잔액 계산을 위해 모든 거래 (월 필터 없이)
  const { transactions } = useTransactions();

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    type: 'bank' as AccountRow['type'],
    opening_balance: '',
    payment_day: '',
  });

  // 계좌별 잔액
  const balanceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) m.set(a.id, a.opening_balance);
    for (const t of transactions) {
      const cur = m.get(t.account_id) ?? 0;
      // 카드는 지출이 음수, 다른 계좌는 지출이 음수, 수입은 양수
      // (이체는 단방향 기록만 있어 별도 처리 필요시 향후 확장)
      const delta = t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0;
      m.set(t.account_id, cur + delta);
    }
    return m;
  }, [accounts, transactions]);

  const total = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      if (a.archived) continue;
      sum += balanceMap.get(a.id) ?? 0;
    }
    return sum;
  }, [accounts, balanceMap]);

  // 타입별 그룹
  const byType = useMemo(() => {
    const m = new Map<AccountRow['type'], AccountRow[]>();
    for (const a of accounts) {
      const arr = m.get(a.type) ?? [];
      arr.push(a);
      m.set(a.type, arr);
    }
    return TYPE_ORDER.filter((t) => m.has(t)).map((t) => [t, m.get(t)!] as const);
  }, [accounts]);

  async function handleAdd() {
    if (!draft.name.trim()) return;
    const ob = parseAmountInput(draft.opening_balance);
    let payment_day: number | null = null;
    if (draft.type === 'card' && draft.payment_day.trim()) {
      const n = parseInt(draft.payment_day, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 31) payment_day = n;
    }
    await create({ name: draft.name.trim(), type: draft.type, opening_balance: ob, payment_day });
    setDraft({ name: '', type: 'bank', opening_balance: '', payment_day: '' });
    setAdding(false);
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="자산"
        right={
          <div className="flex items-center gap-3">
            {error ? (
              <span className="text-xs text-cat-red">오류: {error}</span>
            ) : loading ? (
              <span className="text-xs text-sub">로딩…</span>
            ) : null}
            <span className="text-sm text-sub">
              총자산 <span className="text-ink font-mono font-medium">{formatKRW(total)}</span>
            </span>
            <button
              className="text-sm border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90"
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? '취소' : '+ 계좌'}
            </button>
          </div>
        }
      />

      {adding && (
        <div className="border-b border-line px-4 py-2 flex gap-2 text-sm items-center">
          <input
            autoFocus
            className="border border-line px-2 py-1 flex-1"
            placeholder="계좌명"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select
            className="border border-line px-2 py-1"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as AccountRow['type'] }))}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            className="border border-line px-2 py-1 w-32 text-right font-mono"
            placeholder="시작 잔액"
            value={draft.opening_balance}
            onChange={(e) => setDraft((d) => ({ ...d, opening_balance: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          {draft.type === 'card' && (
            <input
              className="border border-line px-2 py-1 w-20 text-right font-mono"
              placeholder="결제일"
              value={draft.payment_day}
              onChange={(e) => setDraft((d) => ({ ...d, payment_day: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              title="카드 결제일 (1-31)"
            />
          )}
          <button
            className="border border-line px-3 py-1 hover:bg-hover bg-ink text-bg"
            onClick={handleAdd}
          >
            추가
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {accounts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-sub">
            <div className="border border-dashed border-line px-4 py-6">계좌 없음 — 우측 상단 [+ 계좌]로 추가</div>
          </div>
        ) : (
          byType.map(([type, list]) => {
            const subtotal = list.reduce(
              (s, a) => s + (a.archived ? 0 : balanceMap.get(a.id) ?? 0),
              0
            );
            return (
              <div key={type}>
                <div className="bg-panel border-b border-line px-4 py-1 flex items-center text-xs text-sub uppercase tracking-wider">
                  <span>{TYPE_LABEL[type]}</span>
                  <div className="flex-1" />
                  <span className="font-mono text-ink">{formatKRW(subtotal)}</span>
                </div>
                {list.map((a) => (
                  <AccountRowItem
                    key={a.id}
                    account={a}
                    balance={balanceMap.get(a.id) ?? 0}
                    onUpdate={(patch) => update(a.id, patch)}
                    onDelete={() => {
                      if (confirm(`'${a.name}' 계좌를 삭제하시겠습니까?\n(거래가 있으면 보관처리됩니다)`))
                        remove(a.id).catch(async (e: unknown) => {
                          const msg = e instanceof Error ? e.message : String(e);
                          if (msg.includes('archive')) {
                            // 거래 있으면 archived 처리
                            await update(a.id, { archived: 1 });
                          } else {
                            alert(msg);
                          }
                        });
                    }}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AccountRowItem({
  account,
  balance,
  onUpdate,
  onDelete,
}: {
  account: AccountRow;
  balance: number;
  onUpdate: (patch: Partial<Omit<AccountRow, 'id'>>) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [ob, setOb] = useState(String(account.opening_balance));
  const [pday, setPday] = useState(account.payment_day == null ? '' : String(account.payment_day));

  async function commit() {
    if (!name.trim()) {
      setName(account.name);
      setEditing(false);
      return;
    }
    const newOb = parseAmountInput(ob);
    const patch: Partial<Omit<AccountRow, 'id'>> = {};
    if (name.trim() !== account.name) patch.name = name.trim();
    if (newOb !== account.opening_balance) patch.opening_balance = newOb;
    if (account.type === 'card') {
      const trimmed = pday.trim();
      let next: number | null = null;
      if (trimmed) {
        const n = parseInt(trimmed, 10);
        if (Number.isInteger(n) && n >= 1 && n <= 31) next = n;
      }
      if (next !== account.payment_day) patch.payment_day = next;
    }
    if (Object.keys(patch).length > 0) await onUpdate(patch);
    setEditing(false);
  }

  return (
    <div
      className="border-b border-line px-4 py-2 flex items-center gap-3 text-sm hover:bg-hover group"
      style={{ opacity: account.archived ? 0.5 : 1 }}
    >
      {editing ? (
        <>
          <input
            autoFocus
            className="border border-line px-2 py-0.5 flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setName(account.name);
                setOb(String(account.opening_balance));
                setEditing(false);
              }
            }}
          />
          <input
            className="border border-line px-2 py-0.5 w-32 text-right font-mono"
            value={ob}
            onChange={(e) => setOb(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            placeholder="시작 잔액"
          />
          {account.type === 'card' && (
            <input
              className="border border-line px-2 py-0.5 w-16 text-right font-mono"
              value={pday}
              onChange={(e) => setPday(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="결제일"
              title="카드 결제일 (1-31)"
            />
          )}
          <button className="text-xs border border-line px-2 py-0.5 hover:bg-bg" onClick={commit}>
            저장
          </button>
        </>
      ) : (
        <>
          <button
            className="flex-1 text-left truncate"
            onClick={() => setEditing(true)}
          >
            {account.name}
            {account.archived ? <span className="text-xs text-sub ml-2">(보관)</span> : null}
            {account.type === 'card' && account.payment_day != null && (
              <span className="text-xs text-sub ml-2 font-mono">
                결제일 {account.payment_day}일
                {(() => {
                  const d = daysUntilNextPayment(account.payment_day);
                  return ` · ${d === 0 ? '오늘' : `${d}일 후`}`;
                })()}
              </span>
            )}
          </button>
          <span className="text-xs text-sub font-mono w-32 text-right">
            시작 {formatKRW(account.opening_balance)}
          </span>
          <span
            className="font-mono font-medium w-28 text-right"
            style={{ color: balance < 0 ? '#d44c47' : 'var(--c-ink)' }}
          >
            {formatKRW(balance)}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            <button
              className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg"
              onClick={() => onUpdate({ archived: account.archived ? 0 : 1 })}
            >
              {account.archived ? '복원' : '보관'}
            </button>
            <button
              className="text-xs border border-line px-1.5 py-0.5 hover:bg-bg text-cat-red"
              onClick={onDelete}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
