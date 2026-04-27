import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { apiClient } from '@/lib/api';
import type { AgentAction, AgentMessage, AgentProposal, AgentThread } from '@/lib/types';
import { minToHHMM, todayISO } from '@/lib/utils';
import { bumpAgent, setAgentThread, setAgentThreadAndBump, useAgentStore } from '@/lib/agentStore';

type Mode = 'daily' | 'weekly' | 'template' | 'review';

const MODE_LABEL: Record<Mode, string> = {
  daily: '하루',
  weekly: '주간',
  template: '템플릿',
  review: '회고',
};

const QUICK_PROMPTS: { mode: Mode; text: string; label: string }[] = [
  { mode: 'daily', text: '내일 하루 30분 단위로 계획을 짜줘. 미완 할일과 습관도 반영해.', label: '내일 계획' },
  { mode: 'weekly', text: '이번주 미할당 할일을 요일에 맞게 분배해줘.', label: '주간 분배' },
  { mode: 'daily', text: '어제 미완료된 일을 오늘로 이월하고 시간을 다시 잡아줘.', label: '어제 이월' },
  { mode: 'template', text: '지난 주의 반복 가능한 일정을 주간 템플릿 후보로 정리해줘.', label: '템플릿화' },
];

export function AgentPage() {
  const [mode, setMode] = useState<Mode>('daily');
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const { threadId, version } = useAgentStore();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuThreadId) return;
    const close = () => setMenuThreadId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuThreadId]);

  async function deleteThread(tid: string) {
    if (!confirm('이 대화를 삭제하시겠습니까? 메시지·제안이 함께 사라집니다.')) return;
    try {
      await apiClient.deleteThread(tid);
      setMenuThreadId(null);
      if (threadId === tid) {
        setAgentThreadAndBump(null);
      }
      await reloadThreads();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function renameThread(tid: string, currentTitle: string | null) {
    const next = prompt('대화 이름', currentTitle ?? '');
    if (next == null) return;
    const trimmed = next.trim();
    if (trimmed === '' || trimmed === currentTitle) {
      setMenuThreadId(null);
      return;
    }
    try {
      await apiClient.updateThread(tid, { title: trimmed });
      setMenuThreadId(null);
      await reloadThreads();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const reloadThreads = useCallback(async () => {
    try {
      setThreads(await apiClient.listThreads());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reloadThreads();
  }, [reloadThreads]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setProposals([]);
      return;
    }
    let alive = true;
    Promise.all([apiClient.listMessages(threadId), apiClient.listProposals(threadId)])
      .then(([m, p]) => {
        if (!alive) return;
        setMessages(m);
        setProposals(p);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [threadId, version]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function send(t: string) {
    const txt = t.trim();
    if (!txt || sending) return;
    setSending(true);
    setError(null);
    setStreamText('');

    // 사용자 메시지 즉시 표시 (낙관적)
    const optimisticUser: AgentMessage = {
      id: `tmp_${Date.now()}`,
      thread_id: threadId ?? '',
      role: 'user',
      content: txt,
      input_tokens: null,
      output_tokens: null,
      cache_read_tokens: null,
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setText('');

    try {
      const resp = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId ?? undefined,
          mode,
          text: txt,
          today: todayISO(),
        }),
      });
      if (!resp.ok || !resp.body) {
        const t2 = await resp.text().catch(() => '');
        throw new Error(`stream ${resp.status} ${t2.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let acc = '';
      let finalThreadId = threadId ?? '';
      let nl: number;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        while ((nl = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          const lines = chunk.split('\n');
          let event = '';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const j = JSON.parse(data);
            if (event === 'thread') {
              finalThreadId = j.thread_id;
            } else if (event === 'delta') {
              acc += j.content ?? '';
              setStreamText(acc);
            } else if (event === 'error') {
              setError(j.error ?? 'unknown');
            } else if (event === 'done') {
              finalThreadId = j.thread_id ?? finalThreadId;
              setStreamText('');
              setAgentThreadAndBump(finalThreadId);
              reloadThreads();
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStreamText('');
    } finally {
      setSending(false);
    }
  }

  async function applyProposal(p: AgentProposal) {
    if (!confirm('이 제안을 실제 캘린더/할일에 적용하시겠습니까?')) return;
    try {
      const r = await apiClient.applyProposal(p.id);
      alert(`적용됨: ${r.applied}건${r.errors.length ? ` (오류 ${r.errors.length}건)` : ''}`);
      bumpAgent();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function rejectProposal(p: AgentProposal) {
    try {
      await apiClient.rejectProposal(p.id);
      bumpAgent();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const pendingProposals = proposals.filter((p) => p.status === 'pending');

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="코파일럿"
        subtitle={`플래너 에이전트 — gpt-5-mini`}
        right={
          <div className="flex items-center gap-2 text-xs">
            <button
              className="border border-line px-2 py-0.5 hover:bg-hover"
              onClick={() => {
                setAgentThread(null);
              }}
            >
              새 대화
            </button>
            {error && <span className="text-cat-red">{error}</span>}
          </div>
        }
      />
      <div className="flex-1 grid grid-cols-[200px_1fr_380px] min-h-0">
        {/* 좌: 대화 목록 */}
        <aside className="border-r border-line overflow-auto">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            대화
          </div>
          {threads.length === 0 ? (
            <div className="px-3 py-3 text-xs text-sub">시작 전</div>
          ) : (
            <ul>
              {threads.map((t) => (
                <li key={t.id} className="relative border-b border-line">
                  <button
                    className="w-full text-left pl-3 pr-8 py-1.5 hover:bg-hover text-sm truncate"
                    style={{
                      background: threadId === t.id ? 'var(--c-hover)' : undefined,
                      fontWeight: threadId === t.id ? 500 : 400,
                    }}
                    onClick={() => setAgentThread(t.id)}
                  >
                    <div className="truncate">{t.title || '(제목없음)'}</div>
                    <div className="text-xs text-sub">{MODE_LABEL[(t.mode as Mode) ?? 'daily']}</div>
                  </button>
                  <button
                    className="absolute top-1 right-1 px-1.5 py-0.5 text-xs text-sub hover:bg-hover"
                    title="더보기"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuThreadId((cur) => (cur === t.id ? null : t.id));
                    }}
                  >
                    …
                  </button>
                  {menuThreadId === t.id && (
                    <div
                      className="absolute top-7 right-1 z-10 border border-line bg-bg shadow"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="block w-full text-left px-3 py-1 text-xs hover:bg-hover whitespace-nowrap"
                        onClick={() => renameThread(t.id, t.title)}
                      >
                        이름변경
                      </button>
                      <button
                        className="block w-full text-left px-3 py-1 text-xs text-cat-red hover:bg-hover whitespace-nowrap"
                        onClick={() => deleteThread(t.id)}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 가운데: 제안 미리보기 */}
        <section className="border-r border-line overflow-auto">
          <div className="px-3 py-2 border-b border-line text-xs uppercase tracking-wider text-sub">
            제안 미리보기
          </div>
          {pendingProposals.length === 0 ? (
            <div className="px-3 py-3 text-sm text-sub">
              <div className="border border-dashed border-line px-4 py-6">
                대기 중인 제안 없음. 우측에서 메시지를 보내세요.
              </div>
            </div>
          ) : (
            pendingProposals.map((p) => <ProposalCard key={p.id} proposal={p} onApply={applyProposal} onReject={rejectProposal} />)
          )}
          {/* 처리된 제안 */}
          {proposals.filter((p) => p.status !== 'pending').length > 0 && (
            <>
              <div className="px-3 py-2 border-y border-line text-xs uppercase tracking-wider text-sub mt-3">
                지난 제안
              </div>
              {proposals
                .filter((p) => p.status !== 'pending')
                .map((p) => (
                  <div key={p.id} className="border-b border-line px-3 py-2 text-xs text-sub">
                    <span
                      className="inline-block mr-2 px-1.5"
                      style={{
                        background:
                          p.status === 'applied'
                            ? '#5a8f5a'
                            : p.status === 'partial'
                            ? '#d98e3f'
                            : '#8a8a85',
                        color: '#ffffff',
                      }}
                    >
                      {p.status}
                    </span>
                    {(() => {
                      try {
                        const j = JSON.parse(p.payload);
                        return j.summary ?? '(요약없음)';
                      } catch {
                        return '(파싱오류)';
                      }
                    })()}
                  </div>
                ))}
            </>
          )}
        </section>

        {/* 우: 채팅 */}
        <section className="flex flex-col min-h-0">
          <div className="border-b border-line px-3 py-2 flex gap-1 text-sm">
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
              <button
                key={m}
                className="border border-line px-2 py-0.5 hover:bg-hover"
                style={{
                  background: mode === m ? 'var(--c-ink)' : undefined,
                  color: mode === m ? 'var(--c-bg)' : undefined,
                }}
                onClick={() => setMode(m)}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-3 text-sm">
            {messages.length === 0 && !streamText ? (
              <div className="text-sub border border-dashed border-line px-3 py-4">
                {!threadId
                  ? '아래 입력창에서 대화 시작 또는 빠른 프롬프트 클릭'
                  : '메시지 없음'}
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className="flex gap-2">
                    <span className="text-xs text-sub w-12 shrink-0 mt-0.5">
                      {m.role === 'user' ? '나' : 'AI'}
                    </span>
                    <div className="flex-1 whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
                {streamText && (
                  <div className="flex gap-2">
                    <span className="text-xs text-sub w-12 shrink-0 mt-0.5">AI</span>
                    <div className="flex-1 whitespace-pre-wrap">
                      {streamText}
                      <span className="inline-block w-1.5 h-3 bg-ink ml-0.5 align-middle animate-pulse" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-line px-3 py-2 flex gap-1 flex-wrap text-xs">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q.label}
                className="border border-line px-2 py-0.5 text-sub hover:bg-hover"
                onClick={() => {
                  setMode(q.mode);
                  send(q.text);
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="border-t border-line p-2 flex gap-2">
            <textarea
              className="flex-1 border border-line px-2 py-1 text-sm resize-none"
              rows={2}
              placeholder="메시지 입력 — 예: 내일 9시 회의, 저녁엔 운동 (Enter 전송, Shift+Enter 줄바꿈)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(text);
                }
              }}
            />
            <button
              className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50"
              disabled={sending || !text.trim()}
              onClick={() => send(text)}
            >
              {sending ? '…' : '전송'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onApply,
  onReject,
}: {
  proposal: AgentProposal;
  onApply: (p: AgentProposal) => void;
  onReject: (p: AgentProposal) => void;
}) {
  let parsed: { summary: string; actions: AgentAction[] } | null = null;
  try {
    parsed = JSON.parse(proposal.payload);
  } catch {
    // ignore
  }
  if (!parsed) return null;

  return (
    <div className="border-b border-line px-3 py-2">
      <div className="text-sm font-medium mb-2">{parsed.summary}</div>
      <ul className="space-y-1 mb-2">
        {parsed.actions.map((a, i) => (
          <li key={i} className="text-xs border border-line px-2 py-1 flex items-center gap-2">
            <span
              className="inline-block px-1.5 py-0.5 text-xs"
              style={{
                background: actionColor(a.kind),
                color: '#ffffff',
              }}
            >
              {a.kind}
            </span>
            <span className="flex-1 truncate">{actionLabel(a)}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          className="text-xs border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90"
          onClick={() => onApply(proposal)}
        >
          [적용]
        </button>
        <button
          className="text-xs border border-line px-2 py-0.5 hover:bg-hover"
          onClick={() => onReject(proposal)}
        >
          거부
        </button>
      </div>
    </div>
  );
}

function actionColor(kind: AgentAction['kind']): string {
  switch (kind) {
    case 'create_event':
      return '#3f5b8c';
    case 'create_task':
      return '#5a8f5a';
    case 'update_event':
      return '#d98e3f';
    case 'update_task':
      return '#7d5a8c';
    case 'delete_event':
      return '#d44c47';
    case 'template_save':
      return '#4a7aa8';
    case 'template_apply':
      return '#2b2b2a';
    default:
      return '#8a8a85';
  }
}

function actionLabel(a: AgentAction): string {
  switch (a.kind) {
    case 'create_event':
      return `${a.date} ${minToHHMM(a.start_min)}-${minToHHMM(a.end_min)} ${a.title}`;
    case 'create_task':
      return `${a.title}${a.scheduled_date ? ` (${a.scheduled_date})` : ''}`;
    case 'update_event':
      return `${a.id} ${JSON.stringify(a.patch)}`;
    case 'delete_event':
      return a.id;
    case 'update_task': {
      const parts: string[] = [];
      if (a.patch.scheduled_date !== undefined)
        parts.push(`날짜=${a.patch.scheduled_date ?? '인박스'}`);
      if (a.patch.priority !== undefined) parts.push(`우선순위=${a.patch.priority}`);
      if (a.patch.done !== undefined) parts.push(a.patch.done ? '완료' : '미완');
      return `${a.id} ${parts.join(' / ')}`;
    }
    case 'template_save':
      return `${a.name} (${a.blocks.length}블록${a.is_default ? ', 기본' : ''})`;
    case 'template_apply':
      return `${a.template_id} → ${a.week_start} (${a.mode ?? 'fill'})`;
    default:
      return JSON.stringify(a);
  }
}
