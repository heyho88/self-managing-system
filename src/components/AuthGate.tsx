import { useEffect, useState } from 'react';
import {
  clearAppPassword,
  getAppPassword,
  setAppPassword,
  verifyAppPassword,
} from '@/lib/api';

type Status = 'checking' | 'open' | 'locked' | 'verifying';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 초기: 저장된 비번 있으면 검증, 없으면 잠금화면
  useEffect(() => {
    let alive = true;
    const stored = getAppPassword();
    if (!stored) {
      setStatus('locked');
      return;
    }
    verifyAppPassword(stored).then((ok) => {
      if (!alive) return;
      if (ok) setStatus('open');
      else {
        clearAppPassword();
        setStatus('locked');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // 401 이벤트 → 다시 잠금
  useEffect(() => {
    function onUnauthorized() {
      setStatus('locked');
      setError('세션이 만료되었습니다. 다시 입력해 주세요.');
    }
    window.addEventListener('app:unauthorized', onUnauthorized);
    return () => window.removeEventListener('app:unauthorized', onUnauthorized);
  }, []);

  async function submit() {
    const pw = input.trim();
    if (!pw) return;
    setStatus('verifying');
    setError(null);
    const ok = await verifyAppPassword(pw);
    if (ok) {
      setAppPassword(pw);
      setInput('');
      setStatus('open');
    } else {
      setStatus('locked');
      setError('비밀번호가 틀렸습니다.');
    }
  }

  if (status === 'open') return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-sub">
        확인 중…
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-bg">
      <div className="w-[360px] max-w-[90vw] border border-line bg-bg">
        <div className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-sub">
          잠금됨
        </div>
        <div className="px-4 py-4 space-y-3">
          <div className="text-sm">비밀번호를 입력하세요.</div>
          <input
            autoFocus
            type="password"
            className="w-full border border-line px-2 py-1 text-sm"
            placeholder="비밀번호"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            disabled={status === 'verifying'}
          />
          {error && <div className="text-xs text-cat-red">{error}</div>}
          <button
            className="w-full border border-line bg-ink text-bg px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            onClick={submit}
            disabled={status === 'verifying' || input.trim() === ''}
          >
            {status === 'verifying' ? '확인 중…' : '잠금 해제'}
          </button>
          <div className="text-xs text-sub">
            한 번 입력하면 이 브라우저에 저장되어 다음에 자동 입장합니다.
          </div>
        </div>
      </div>
    </div>
  );
}
