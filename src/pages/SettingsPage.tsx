import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { apiClient, clearAppPassword } from '@/lib/api';
import { minToHHMM } from '@/lib/utils';

const TIME_KEYS: { key: string; label: string }[] = [
  { key: 'user.wake_min', label: '기상' },
  { key: 'user.sleep_min', label: '취침' },
  { key: 'user.focus_start_min', label: '집중 시작' },
  { key: 'user.focus_end_min', label: '집중 종료' },
  { key: 'user.lunch_min', label: '점심' },
  { key: 'user.dinner_min', label: '저녁' },
];

function parseHHMM(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (h < 0 || h > 24 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

type UsageData = Awaited<ReturnType<typeof apiClient.agentUsage>>;

export function SettingsPage() {
  const [settings, setSettings] = useState<Map<string, string | null>>(new Map());
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    try {
      const [list, u] = await Promise.all([apiClient.listSettings(), apiClient.agentUsage().catch(() => null)]);
      setSettings(new Map(list.map((s) => [s.key, s.value])));
      setUsage(u);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function setTime(key: string, hhmm: string) {
    const m = parseHHMM(hhmm);
    if (m == null) {
      alert('HH:MM 형식 (예: 07:00)');
      return;
    }
    await apiClient.setSetting(key, String(m));
    reload();
  }

  async function exportJSON() {
    setBusy(true);
    try {
      const data = await apiClient.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dumb-secretary-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importJSON(file: File) {
    if (
      !confirm(
        `'${file.name}'을 가져오면 일정·할일·목표·일기·자산·거래·카테고리·템플릿·설정이 전부 덮어쓰여집니다.\n(에이전트 대화는 유지) 계속하시겠습니까?`
      )
    )
      return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed?.data;
      if (!data || typeof data !== 'object')
        throw new Error('형식 오류 — { data: { table: [...] } } 필요');
      const r = await apiClient.importAll({ data });
      const lines = Object.entries(r.imported)
        .map(([t, n]) => `${t}: ${n}`)
        .join('\n');
      alert(`가져오기 완료\n${lines}${r.skipped.length ? `\n\n건너뜀: ${r.skipped.join(', ')}` : ''}`);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  async function exportTxCSV() {
    setBusy(true);
    try {
      const txs = await apiClient.listTransactions({});
      const accounts = await apiClient.listAccounts();
      const cats = await apiClient.listCategories();
      const accMap = new Map(accounts.map((a) => [a.id, a.name]));
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      const header = ['date', 'type', 'amount', 'account', 'category', 'memo', 'tags'];
      const rows = txs.map((t) => [
        t.date,
        t.type,
        String(t.amount),
        accMap.get(t.account_id) ?? t.account_id,
        t.category_id ? catMap.get(t.category_id) ?? t.category_id : '',
        (t.memo ?? '').replace(/"/g, '""'),
        (t.tags ?? '').replace(/"/g, '""'),
      ]);
      const csv = [header, ...rows]
        .map((r) => r.map((c) => `"${c}"`).join(','))
        .join('\n');
      // BOM 추가 — Excel에서 한글 깨짐 방지
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="설정" />
      <div className="flex-1 overflow-auto px-4 py-3 text-sm text-ink space-y-4 max-w-2xl">
        <section className="border border-line">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            시간 선호
          </div>
          <div className="px-3 py-2 grid grid-cols-[120px_1fr_60px] gap-y-2 gap-x-2 items-center">
            {TIME_KEYS.map((t) => {
              const cur = settings.get(t.key);
              const min = cur == null ? null : Number(cur);
              const display = min == null || Number.isNaN(min) ? '—' : minToHHMM(min);
              return (
                <TimeRow
                  key={t.key}
                  label={t.label}
                  value={display}
                  onSave={(v) => setTime(t.key, v)}
                />
              );
            })}
          </div>
        </section>

        <section className="border border-line">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            에이전트
          </div>
          <div className="px-3 py-2 space-y-1">
            <div>모델 — gpt-5-mini (OpenAI)</div>
            <div className="text-sub text-xs">
              적용은 항상 [적용] 클릭이 필요합니다 (자동 실행 없음). 모델은 'propose' 도구로만
              변경을 제안할 수 있고, 실제 반영은 워커 내부 라우트에서만 수행됩니다.
            </div>
            <div className="text-sub text-xs">
              운영에서 사용하려면{' '}
              <code className="font-mono bg-panel px-1">
                wrangler secret put OPENAI_API_KEY
              </code>{' '}
              로 키를 설정하세요.
            </div>
          </div>
        </section>

        {usage && (
          <section className="border border-line">
            <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub flex items-center justify-between">
              <span>토큰·비용</span>
              <span className="text-sub normal-case">
                단가 ${usage.pricing.input}/M·${usage.pricing.cached}/M(캐시)·${usage.pricing.output}/M
              </span>
            </div>
            <div className="px-3 py-2 space-y-2 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <Stat label="누적 입력" value={fmtN(usage.total.input)} />
                <Stat label="누적 출력" value={fmtN(usage.total.output)} />
                <Stat label="캐시 히트" value={fmtN(usage.total.cache_read)} />
                <Stat label="추정 비용" value={`$${usage.total.cost_usd.toFixed(4)}`} />
              </div>
              {usage.monthly.length > 0 && (
                <div>
                  <div className="text-sub mb-1">월별</div>
                  <table className="w-full text-xs font-mono">
                    <thead className="text-sub">
                      <tr>
                        <th className="text-left">월</th>
                        <th className="text-right">메시지</th>
                        <th className="text-right">입력</th>
                        <th className="text-right">출력</th>
                        <th className="text-right">캐시</th>
                        <th className="text-right">$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.monthly.map((m) => (
                        <tr key={m.month} className="border-t border-line">
                          <td>{m.month}</td>
                          <td className="text-right">{m.msgs}</td>
                          <td className="text-right">{fmtN(m.input)}</td>
                          <td className="text-right">{fmtN(m.output)}</td>
                          <td className="text-right">{fmtN(m.cache_read)}</td>
                          <td className="text-right">${m.cost_usd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {usage.threads.length > 0 && (
                <div>
                  <div className="text-sub mb-1">스레드 상위 ({usage.threads.length})</div>
                  <table className="w-full text-xs">
                    <thead className="text-sub font-mono">
                      <tr>
                        <th className="text-left">제목</th>
                        <th className="text-right">메시지</th>
                        <th className="text-right">토큰</th>
                        <th className="text-right">$</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {usage.threads.map((t) => (
                        <tr key={t.thread_id} className="border-t border-line">
                          <td className="truncate max-w-[200px]" title={t.title ?? ''}>
                            {t.title || '(제목없음)'}
                          </td>
                          <td className="text-right">{t.msgs}</td>
                          <td className="text-right">{fmtN(t.input + t.output)}</td>
                          <td className="text-right">${t.cost_usd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="border border-line">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            데이터
          </div>
          <div className="px-3 py-2 flex gap-2 flex-wrap items-center">
            <button
              className="border border-line px-3 py-1 hover:bg-hover disabled:opacity-50"
              disabled={busy}
              onClick={exportJSON}
            >
              JSON 내보내기
            </button>
            <button
              className="border border-line px-3 py-1 hover:bg-hover disabled:opacity-50"
              disabled={busy}
              onClick={exportTxCSV}
            >
              거래 CSV
            </button>
            <button
              className="border border-line px-3 py-1 hover:bg-hover disabled:opacity-50"
              disabled={busy}
              onClick={() => importInputRef.current?.click()}
            >
              JSON 가져오기…
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
              }}
            />
            <span className="text-xs text-sub">가져오기는 기존 데이터를 덮어씁니다 (에이전트 대화 제외)</span>
          </div>
        </section>

        <section className="border border-line">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            보안
          </div>
          <div className="px-3 py-2 space-y-2">
            <div className="text-sub text-xs">
              로그인 비밀번호는 이 브라우저의 localStorage에 저장됩니다. 공용 PC에서는 사용 후
              잠금하세요.
            </div>
            <button
              className="border border-line px-3 py-1 hover:bg-hover text-sm"
              onClick={() => {
                if (!confirm('이 브라우저에서 로그아웃하시겠습니까?')) return;
                clearAppPassword();
                location.reload();
              }}
            >
              잠금 / 로그아웃
            </button>
          </div>
        </section>

        <section className="border border-line">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            단축키
          </div>
          <div className="px-3 py-2 grid grid-cols-2 gap-y-1 text-sub text-xs">
            <span>⌘/Ctrl + K</span>
            <span>통합 검색</span>
            <span>⌘/Ctrl + J</span>
            <span>코파일럿 열기</span>
            <span>⌘/Ctrl + D</span>
            <span>다크모드 토글</span>
            <span>⌘/Ctrl + 1·2·3</span>
            <span>오늘 / 주간 / 월간</span>
            <span>⌘/Ctrl + N</span>
            <span>새 이벤트</span>
            <span>⌘/Ctrl + ⇧N</span>
            <span>새 거래</span>
            <span>⌘/Ctrl + .</span>
            <span>오늘로 이동</span>
            <span>J / K</span>
            <span>다음·이전 날짜</span>
            <span>[</span>
            <span>사이드바 토글</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line px-2 py-1">
      <div className="text-sub text-xs">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function fmtN(n: number): string {
  return n.toLocaleString('en-US');
}

function TimeRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <>
      <div className="text-sub">{label}</div>
      {editing ? (
        <input
          autoFocus
          className="border border-line px-2 py-0.5 font-mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={async () => {
            if (draft !== value) await onSave(draft);
            setEditing(false);
          }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              if (draft !== value) await onSave(draft);
              setEditing(false);
            }
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div className="font-mono">{value}</div>
      )}
      <button
        className="text-xs border border-line px-2 py-0.5 hover:bg-hover justify-self-end"
        onClick={() => {
          if (editing) return;
          setDraft(value);
          setEditing(true);
        }}
      >
        편집
      </button>
    </>
  );
}
