import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import type { AgentMessage, AgentProposal } from '@/lib/types';
import { todayISO } from '@/lib/utils';
import { bumpAgent, setAgentThread, setAgentThreadAndBump, useAgentStore } from '@/lib/agentStore';

export function AgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { threadId, version } = useAgentStore();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [text, setText] = useState('');
  const [streamText, setStreamText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 최근 스레드를 자동 로드 (스토어가 비어있을 때만)
  const loadLatest = useCallback(async () => {
    try {
      const list = await apiClient.listThreads();
      if (list.length > 0) setAgentThread(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (open && !threadId) loadLatest();
  }, [open, threadId, loadLatest]);

  // threadId 또는 version 변경 시 메시지/제안 재로드
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, streamText]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    setStreamText('');
    const optimistic: AgentMessage = {
      id: `tmp_${Date.now()}`,
      thread_id: threadId ?? '',
      role: 'user',
      content: t,
      input_tokens: null,
      output_tokens: null,
      cache_read_tokens: null,
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    try {
      const resp = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId ?? undefined,
          mode: 'daily',
          text: t,
          today: todayISO(),
        }),
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`stream ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let acc = '';
      let finalThread = threadId ?? '';
      let nl: number;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        while ((nl = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          let event = '';
          let data = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          try {
            const j = JSON.parse(data);
            if (event === 'thread') finalThread = j.thread_id;
            else if (event === 'delta') {
              acc += j.content ?? '';
              setStreamText(acc);
            } else if (event === 'error') setError(j.error ?? 'unknown');
            else if (event === 'done') {
              finalThread = j.thread_id ?? finalThread;
              setStreamText('');
              setAgentThreadAndBump(finalThread);
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
    if (!confirm('이 제안을 적용하시겠습니까?')) return;
    try {
      const r = await apiClient.applyProposal(p.id);
      alert(`적용: ${r.applied}건${r.errors.length ? ` (오류 ${r.errors.length})` : ''}`);
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

  if (!open) return null;
  const pending = proposals.filter((p) => p.status === 'pending');
  const dotState = sending ? 'bg-cat-green' : threadId ? 'bg-ink' : 'bg-sub';

  // 미세 도트 그리드 — 터미널/스캔라인 느낌
  const scanBg = {
    backgroundImage:
      'radial-gradient(var(--c-line) 0.5px, transparent 0.5px)',
    backgroundSize: '14px 14px',
    backgroundPosition: '0 0',
  } as const;

  return (
    <aside
      className="w-[340px] shrink-0 bg-panel border-l border-line flex flex-col min-h-0 relative"
      aria-label="코파일럿"
    >
      {/* 좌측 1px 액센트 — 패널 정체성 */}
      <span className="absolute left-0 top-0 bottom-0 w-px bg-line pointer-events-none" />

      <div className="border-b border-line px-3 py-2 flex items-center text-sm bg-bg">
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 ${dotState} ${sending ? 'animate-pulse' : ''}`} />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            COPILOT
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-sub">
            · DAILY
          </span>
        </span>
        <div className="flex-1" />
        <button
          className="text-xs text-sub hover:text-ink px-1"
          onClick={() => {
            navigate('/agent');
            onClose();
          }}
          title="전체 보기"
        >
          ⤢
        </button>
        <button
          className="text-xs text-sub hover:text-ink px-1 ml-1"
          onClick={() => {
            setAgentThread(null);
          }}
          title="새 대화"
        >
          +
        </button>
        <button
          className="text-xs text-sub hover:text-ink px-1 ml-1"
          onClick={onClose}
          title="숨기기 (⌘J)"
        >
          ✕
        </button>
      </div>

      {pending.length > 0 && (
        <div className="border-b border-line max-h-[40%] overflow-auto bg-bg">
          <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-sub border-b border-line flex items-center gap-2">
            <span className="w-1 h-1 bg-cat-orange" />
            <span>PENDING · {pending.length}</span>
          </div>
          {pending.map((p) => {
            let summary = '(요약없음)';
            try {
              summary = JSON.parse(p.payload).summary ?? summary;
            } catch {
              // ignore
            }
            return (
              <div key={p.id} className="relative px-3 py-1.5 pl-4 border-b border-line text-xs">
                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-cat-orange" />
                <div className="mb-1 truncate">{summary}</div>
                <div className="flex gap-1">
                  <button
                    className="border border-line bg-ink text-bg px-2 py-0.5 hover:opacity-90 font-mono text-[11px] uppercase tracking-wider"
                    onClick={() => applyProposal(p)}
                  >
                    APPLY
                  </button>
                  <button
                    className="border border-line px-2 py-0.5 hover:bg-hover font-mono text-[11px] uppercase tracking-wider"
                    onClick={() => rejectProposal(p)}
                  >
                    REJECT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-3 py-3 space-y-3 text-sm bg-bg"
        style={scanBg}
      >
        {messages.length === 0 && !streamText ? (
          <div className="border border-dashed border-line p-3 font-mono text-[11px] leading-relaxed text-sub">
            <div className="text-ink mb-2 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-3 bg-ink animate-pulse align-middle" />
              <span className="uppercase tracking-[0.18em]">READY</span>
            </div>
            <div>&gt; 자연어로 일정을 시켜보세요</div>
            <div>&gt; 예: 내일 9-12시 집중작업</div>
            <div>&gt; 예: 다음주 매일 23시 취침</div>
            <div className="mt-2 text-[10px]">변경은 [APPLY] 후에만 반영됨</div>
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className="flex gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.18em] w-9 shrink-0 mt-0.5 ${
                      isUser ? 'text-sub' : 'text-ink'
                    }`}
                  >
                    {isUser ? 'USER' : 'AI'}
                  </span>
                  {!isUser && <span className="w-px bg-cat-blue shrink-0 self-stretch" />}
                  <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                    {m.content}
                  </div>
                </div>
              );
            })}
            {streamText && (
              <div className="flex gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] w-9 shrink-0 mt-0.5 text-ink">
                  AI
                </span>
                <span className="w-px bg-cat-blue shrink-0 self-stretch" />
                <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                  {streamText}
                  <span className="inline-block w-1.5 h-3 bg-cat-blue ml-0.5 align-middle animate-pulse" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="border-t border-line px-3 py-1 text-xs text-cat-red truncate font-mono bg-bg" title={error}>
          ! {error}
        </div>
      )}

      <div className="border-t border-line p-2 bg-bg">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-1.5 top-1 text-cat-blue font-mono text-xs select-none pointer-events-none">
              &gt;
            </span>
            <textarea
              className="w-full border border-line pl-5 pr-2 py-1 text-sm resize-none font-mono"
              rows={2}
              placeholder="메시지 입력…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
          </div>
          <button
            className="border border-line bg-ink text-bg px-3 py-1 hover:opacity-90 disabled:opacity-50 font-mono text-[11px] uppercase tracking-wider"
            disabled={sending || !text.trim()}
            onClick={() => send()}
          >
            {sending ? '...' : 'SEND'}
          </button>
        </div>
        <div className="mt-1 text-[10px] font-mono text-sub flex gap-3 px-0.5">
          <span>⏎ send</span>
          <span>⇧⏎ newline</span>
          <span className="ml-auto">⌘J close</span>
        </div>
      </div>
    </aside>
  );
}
