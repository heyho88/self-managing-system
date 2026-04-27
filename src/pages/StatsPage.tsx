import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useCategories, useTransactions } from '@/lib/hooks';
import {
  addDays,
  endOfMonth,
  formatKRW,
  fromISO,
  pad2,
  startOfMonth,
  todayISO,
  toISO,
} from '@/lib/utils';

const WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'];

function monthRangeBack(months: number): { from: string; to: string } {
  const today = todayISO();
  const d = fromISO(today);
  d.setMonth(d.getMonth() - (months - 1));
  d.setDate(1);
  return { from: toISO(d), to: endOfMonth(today) };
}

export function StatsPage() {
  const today = todayISO();
  const range = monthRangeBack(6);
  const { transactions, loading, error } = useTransactions({ from: range.from, to: range.to });
  const expCats = useCategories('expense');
  const incCats = useCategories('income');
  const allCats = useMemo(() => [...expCats, ...incCats], [expCats, incCats]);
  const categoryById = useMemo(() => new Map(allCats.map((c) => [c.id, c])), [allCats]);

  // 월별 추이 (6개월)
  const monthly = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    const cur = fromISO(range.from);
    for (let i = 0; i < 6; i++) {
      const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`;
      m.set(key, { income: 0, expense: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const t of transactions) {
      const key = t.date.slice(0, 7);
      const e = m.get(key);
      if (!e) continue;
      if (t.type === 'income') e.income += t.amount;
      else if (t.type === 'expense') e.expense += t.amount;
    }
    return [...m.entries()];
  }, [transactions, range.from]);

  // 이번 달 카테고리별 지출
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const thisMonth = useMemo(() => {
    return transactions.filter((t) => t.date >= thisMonthStart && t.date <= thisMonthEnd);
  }, [transactions, thisMonthStart, thisMonthEnd]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of thisMonth) {
      if (t.type !== 'expense') continue;
      const k = t.category_id ?? '__none__';
      m.set(k, (m.get(k) ?? 0) + t.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [thisMonth]);

  // 요일별 평균 (6개월)
  const byWeekday = useMemo(() => {
    const days = new Array<{ income: number; expense: number; count: number }>(7);
    for (let i = 0; i < 7; i++) days[i] = { income: 0, expense: 0, count: 0 };
    // 날짜별 합계 → 요일별
    const byDate = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const e = byDate.get(t.date) ?? { income: 0, expense: 0 };
      if (t.type === 'income') e.income += t.amount;
      else if (t.type === 'expense') e.expense += t.amount;
      byDate.set(t.date, e);
    }
    // 모든 날짜를 순회 (거래 없는 날도 카운트)
    let cur = range.from;
    while (cur <= range.to && cur <= today) {
      const dow = (fromISO(cur).getDay() + 6) % 7; // 월=0
      const e = byDate.get(cur) ?? { income: 0, expense: 0 };
      days[dow].income += e.income;
      days[dow].expense += e.expense;
      days[dow].count += 1;
      cur = addDays(cur, 1);
    }
    return days.map((d) => ({
      avgIncome: d.count > 0 ? d.income / d.count : 0,
      avgExpense: d.count > 0 ? d.expense / d.count : 0,
    }));
  }, [transactions, range.from, range.to, today]);

  const totalThisMonthExp = byCategory.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="통계"
        subtitle="6개월 추이 / 카테고리 / 요일 패턴"
        right={
          error ? (
            <span className="text-xs text-cat-red">오류: {error}</span>
          ) : loading ? (
            <span className="text-xs text-sub">로딩…</span>
          ) : (
            <span className="text-xs text-sub">데이터 {transactions.length}건</span>
          )
        }
      />

      <div className="flex-1 overflow-auto">
        <section className="border-b border-line">
          <div className="px-4 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            6개월 수입·지출 추이
          </div>
          <div className="px-4 py-3">
            <MonthlyChart data={monthly} />
          </div>
        </section>

        <section className="border-b border-line">
          <div className="px-4 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            이번 달 카테고리별 지출
          </div>
          <div className="px-4 py-3">
            {byCategory.length === 0 ? (
              <div className="text-sm text-sub">데이터 없음</div>
            ) : (
              <ul className="space-y-1.5">
                {byCategory.map(([cid, amt]) => {
                  const cat = categoryById.get(cid);
                  const pct = totalThisMonthExp > 0 ? (amt / totalThisMonthExp) * 100 : 0;
                  return (
                    <li key={cid}>
                      <div className="flex items-baseline gap-2 text-sm mb-0.5">
                        <span
                          className="inline-block w-2 h-2 shrink-0"
                          style={{ background: cat?.color ?? 'var(--c-muted)' }}
                        />
                        <span className="flex-1 truncate">{cat?.name ?? '(미분류)'}</span>
                        <span className="font-mono text-xs text-sub w-12 text-right">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="font-mono w-28 text-right">{formatKRW(amt)}</span>
                      </div>
                      <div className="h-1.5 bg-line">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            background: cat?.color ?? 'var(--c-ink)',
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section>
          <div className="px-4 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            요일 패턴 (일평균, 6개월)
          </div>
          <div className="px-4 py-3">
            <WeekdayChart data={byWeekday} />
          </div>
        </section>
      </div>
    </div>
  );
}

function MonthlyChart({ data }: { data: [string, { income: number; expense: number }][] }) {
  const W = 720;
  const H = 200;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const maxV = Math.max(
    1,
    ...data.flatMap(([, v]) => [v.income, v.expense])
  );

  const stepX = innerW / Math.max(1, data.length - 1);

  function y(v: number): number {
    return PAD_T + innerH - (v / maxV) * innerH;
  }

  function pathFor(key: 'income' | 'expense'): string {
    return data
      .map(([, v], i) => {
        const px = PAD_L + i * stepX;
        const py = y(v[key]);
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ');
  }

  const yTicks = [0, maxV * 0.5, maxV];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {/* y axis */}
        {yTicks.map((v, i) => {
          const py = y(v);
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={py}
                y2={py}
                style={{ stroke: 'var(--c-line)' }}
                strokeDasharray={i === 0 ? '' : '2 3'}
              />
              <text x={PAD_L - 6} y={py + 3} fontSize={10} style={{ fill: 'var(--c-sub)' }} textAnchor="end">
                {formatShortKRW(v)}
              </text>
            </g>
          );
        })}
        {/* lines */}
        <path d={pathFor('income')} fill="none" stroke="#5a8f5a" strokeWidth={1.5} />
        <path d={pathFor('expense')} fill="none" stroke="#d44c47" strokeWidth={1.5} />
        {/* points + x labels */}
        {data.map(([m, v], i) => {
          const px = PAD_L + i * stepX;
          return (
            <g key={m}>
              <rect
                x={px - 2}
                y={y(v.income) - 2}
                width={4}
                height={4}
                fill="#5a8f5a"
              />
              <rect
                x={px - 2}
                y={y(v.expense) - 2}
                width={4}
                height={4}
                fill="#d44c47"
              />
              <text
                x={px}
                y={H - 12}
                fontSize={10}
                style={{ fill: 'var(--c-sub)' }}
                textAnchor="middle"
              >
                {m.slice(5)}월
              </text>
            </g>
          );
        })}
        {/* legend */}
        <g>
          <rect x={W - PAD_R - 100} y={PAD_T - 4} width={8} height={8} fill="#5a8f5a" />
          <text x={W - PAD_R - 88} y={PAD_T + 3} fontSize={10} style={{ fill: 'var(--c-ink)' }}>
            수입
          </text>
          <rect x={W - PAD_R - 50} y={PAD_T - 4} width={8} height={8} fill="#d44c47" />
          <text x={W - PAD_R - 38} y={PAD_T + 3} fontSize={10} style={{ fill: 'var(--c-ink)' }}>
            지출
          </text>
        </g>
      </svg>
    </div>
  );
}

function WeekdayChart({ data }: { data: { avgIncome: number; avgExpense: number }[] }) {
  const W = 720;
  const H = 160;
  const PAD_L = 32;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const maxV = Math.max(1, ...data.map((d) => Math.max(d.avgIncome, d.avgExpense)));

  const colW = innerW / 7;
  const barW = Math.min(28, (colW - 8) / 2);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={PAD_T + innerH}
          y2={PAD_T + innerH}
          style={{ stroke: 'var(--c-line)' }}
        />
        {data.map((d, i) => {
          const cx = PAD_L + colW * i + colW / 2;
          const incH = (d.avgIncome / maxV) * innerH;
          const expH = (d.avgExpense / maxV) * innerH;
          return (
            <g key={i}>
              <rect
                x={cx - barW - 1}
                y={PAD_T + innerH - incH}
                width={barW}
                height={incH}
                fill="#5a8f5a"
              />
              <rect
                x={cx + 1}
                y={PAD_T + innerH - expH}
                width={barW}
                height={expH}
                fill="#d44c47"
              />
              <text x={cx} y={H - 12} fontSize={11} style={{ fill: 'var(--c-ink)' }} textAnchor="middle">
                {WEEKDAY[i]}
              </text>
              <text
                x={cx}
                y={PAD_T + innerH - Math.max(incH, expH) - 4}
                fontSize={9}
                style={{ fill: 'var(--c-sub)' }}
                textAnchor="middle"
              >
                {formatShortKRW(Math.max(d.avgIncome, d.avgExpense))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatShortKRW(n: number): string {
  if (n >= 10000) {
    const v = n / 10000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 0 : 1)}만`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}천`;
  }
  return Math.round(n).toString();
}
