import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { TransactionModal, type TransactionDraft } from '@/components/TransactionModal';
import { useAccounts, useCategories, useTransactions } from '@/lib/hooks';
import type { TransactionRow } from '@/lib/types';
import {
  addDays,
  endOfMonth,
  formatKRW,
  fromISO,
  pad2,
  startOfMonth,
  todayISO,
  toISO,
  weekdayKo,
} from '@/lib/utils';

export function BudgetPage() {
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);

  const { transactions, loading, error, create, update, remove } = useTransactions({
    from: monthStart,
    to: monthEnd,
  });
  const { accounts } = useAccounts();
  const expCats = useCategories('expense');
  const incCats = useCategories('income');
  const allCats = useMemo(() => [...expCats, ...incCats], [expCats, incCats]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setModalOpen(true);
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
  }, [params, setParams]);

  // 합계 계산
  const totals = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of transactions) {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
    }
    return { income: inc, expense: exp, net: inc - exp };
  }, [transactions]);

  // 카테고리별 지출
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const k = t.category_id ?? '__none__';
      m.set(k, (m.get(k) ?? 0) + t.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  // 예산 합계 (월간)
  const totalBudget = useMemo(() => {
    return expCats.reduce((sum, c) => sum + (c.budget_monthly ?? 0), 0);
  }, [expCats]);

  const budgetPct = totalBudget > 0 ? Math.min(200, Math.round((totals.expense / totalBudget) * 100)) : 0;

  // 일별 그룹
  const byDate = useMemo(() => {
    const m = new Map<string, TransactionRow[]>();
    for (const t of transactions) {
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(allCats.map((c) => [c.id, c])), [allCats]);

  const anchorDate = fromISO(anchor);
  const yearMonth = `${anchorDate.getFullYear()}년 ${pad2(anchorDate.getMonth() + 1)}월`;

  function jumpMonth(delta: number) {
    const d = fromISO(anchor);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setAnchor(toISO(d));
  }

  async function handleSubmit(draft: TransactionDraft) {
    if (editing) {
      await update(editing.id, {
        date: draft.date,
        type: draft.type,
        amount: draft.amount,
        account_id: draft.account_id,
        category_id: draft.category_id,
        memo: draft.memo || null,
        tags: draft.tags || null,
      });
      setEditing(null);
    } else {
      await create({
        date: draft.date,
        type: draft.type,
        amount: draft.amount,
        account_id: draft.account_id,
        category_id: draft.category_id,
        memo: draft.memo || null,
        tags: draft.tags || null,
      });
    }
  }

  function openEdit(t: TransactionRow) {
    setEditing(t);
    setModalOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="가계부"
        subtitle={yearMonth}
        right={
          <div className="flex items-center gap-2">
            <button className="text-sub hover:text-ink px-1" onClick={() => jumpMonth(-1)}>
              〈
            </button>
            <button
              className="text-sm border border-line px-2 py-0.5 hover:bg-hover"
              onClick={() => setAnchor(today)}
            >
              이번달
            </button>
            <button className="text-sub hover:text-ink px-1" onClick={() => jumpMonth(1)}>
              〉
            </button>
            {error ? (
              <span className="text-xs text-cat-red ml-2">오류: {error}</span>
            ) : loading ? (
              <span className="text-xs text-sub ml-2">로딩…</span>
            ) : (
              <span className="text-xs text-sub ml-2">{transactions.length}건</span>
            )}
            <button
              className="text-sm border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90 ml-2"
              onClick={openCreate}
            >
              + 거래
            </button>
          </div>
        }
      />

      {/* 월 요약 바 */}
      <div className="border-b border-line px-4 py-2 flex gap-6 text-sm items-center">
        <div>
          수입 <span className="text-ink font-medium font-mono">{formatKRW(totals.income)}</span>
        </div>
        <div>
          지출 <span className="text-ink font-medium font-mono">{formatKRW(totals.expense)}</span>
        </div>
        <div>
          잔액{' '}
          <span
            className="font-medium font-mono"
            style={{ color: totals.net < 0 ? '#d44c47' : 'var(--c-ink)' }}
          >
            {formatKRW(totals.net)}
          </span>
        </div>
        {totalBudget > 0 && (
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="text-sub text-xs">예산 {formatKRW(totalBudget)}</span>
            <div className="flex-1 h-2 border border-line">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, budgetPct)}%`,
                  background: budgetPct > 100 ? '#d44c47' : 'var(--c-ink)',
                }}
              />
            </div>
            <span className="text-sub text-xs w-10 text-right">{budgetPct}%</span>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-[1fr_280px] min-h-0">
        {/* 좌: 일별 거래 리스트 */}
        <div className="overflow-auto border-r border-line">
          {byDate.length === 0 ? (
            <div className="px-4 py-6 text-sm text-sub">
              <div className="border border-dashed border-line px-4 py-6">이번 달 거래 없음</div>
            </div>
          ) : (
            byDate.map(([date, list]) => {
              const dayInc = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
              const dayExp = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date}>
                  <div className="sticky top-0 bg-panel border-b border-line px-4 py-1 flex items-center text-xs">
                    <span className="text-sub">
                      {date.slice(5).replace('-', '.')} {weekdayKo(date)}
                    </span>
                    <div className="flex-1" />
                    {dayInc > 0 && (
                      <span className="text-cat-green font-mono mr-3">+{formatKRW(dayInc)}</span>
                    )}
                    {dayExp > 0 && (
                      <span className="text-cat-red font-mono">-{formatKRW(dayExp)}</span>
                    )}
                  </div>
                  {list.map((t) => {
                    const acc = accountById.get(t.account_id);
                    const cat = t.category_id ? categoryById.get(t.category_id) : null;
                    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '⇄';
                    const color =
                      t.type === 'income' ? '#5a8f5a' : t.type === 'expense' ? '#d44c47' : 'var(--c-sub)';
                    return (
                      <button
                        key={t.id}
                        className="w-full text-left border-b border-line px-4 py-1.5 flex items-center gap-3 text-sm hover:bg-hover group"
                        onClick={() => openEdit(t)}
                      >
                        <span
                          className="inline-block w-2 h-2 shrink-0"
                          style={{ background: cat?.color ?? 'var(--c-muted)' }}
                        />
                        <span className="w-16 text-xs text-sub truncate shrink-0">
                          {cat?.name ?? '—'}
                        </span>
                        <span className="flex-1 truncate">{t.memo || cat?.name || '(무제)'}</span>
                        <span className="text-xs text-sub shrink-0 w-20 text-right truncate">
                          {acc?.name ?? '—'}
                        </span>
                        <span
                          className="font-mono font-medium shrink-0 w-28 text-right"
                          style={{ color }}
                        >
                          {sign}
                          {formatKRW(t.amount)}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-cat-red text-xs px-1 hover:bg-bg"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('이 거래를 삭제하시겠습니까?')) remove(t.id);
                          }}
                        >
                          ✕
                        </button>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 우: 카테고리별 지출 */}
        <aside className="overflow-auto flex flex-col min-h-0">
          <div className="border-b border-line px-3 py-2 text-xs uppercase tracking-wider text-sub">
            카테고리별 지출
          </div>
          {byCategory.length === 0 ? (
            <div className="px-3 py-3 text-xs text-sub">데이터 없음</div>
          ) : (
            <ul>
              {byCategory.map(([cid, amt]) => {
                const cat = categoryById.get(cid);
                const pct = totals.expense > 0 ? Math.round((amt / totals.expense) * 100) : 0;
                return (
                  <li key={cid} className="border-b border-line px-3 py-1.5">
                    <div className="flex items-baseline gap-2 mb-1 text-xs">
                      <span
                        className="inline-block w-2 h-2 shrink-0"
                        style={{ background: cat?.color ?? 'var(--c-muted)' }}
                      />
                      <span className="flex-1 truncate">{cat?.name ?? '(미분류)'}</span>
                      <span className="font-mono text-sub">{pct}%</span>
                      <span className="font-mono">{formatKRW(amt)}</span>
                    </div>
                    <div className="h-1 bg-line">
                      <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                    {cat?.budget_monthly ? (
                      <div className="text-xs text-sub mt-0.5 font-mono">
                        예산 {formatKRW(cat.budget_monthly)} (
                        {Math.round((amt / cat.budget_monthly) * 100)}%)
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {/* 빠른 통계 */}
          <div className="border-t border-line px-3 py-2 text-xs text-sub mt-auto">
            일평균 지출{' '}
            <span className="font-mono text-ink">
              {formatKRW(
                Math.round(
                  totals.expense /
                    Math.max(
                      1,
                      Math.min(
                        fromISO(today) > fromISO(monthEnd)
                          ? 31
                          : fromISO(today) >= fromISO(monthStart)
                          ? fromISO(today).getDate()
                          : fromISO(monthEnd).getDate(),
                        fromISO(monthEnd).getDate()
                      )
                    )
                )
              )}
            </span>
          </div>
        </aside>
      </div>

      <TransactionModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initial={
          editing
            ? {
                date: editing.date,
                type: editing.type,
                amount: editing.amount,
                account_id: editing.account_id,
                category_id: editing.category_id,
                memo: editing.memo ?? '',
                tags: editing.tags ?? '',
              }
            : { date: anchor === today ? today : addDays(monthStart, 0) }
        }
        accounts={accounts}
        categories={allCats}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
