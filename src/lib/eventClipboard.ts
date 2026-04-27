// 일정 카피·페이스트용 인메모리 클립보드 (탭 내에서만 유지)
import { useEffect, useState } from 'react';

export type EventClip = {
  title: string;
  category: string | null;
  notes: string | null;
  duration_min: number;
};

let clip: EventClip | null = null;
const listeners = new Set<() => void>();

export function setEventClip(c: EventClip | null) {
  clip = c;
  for (const l of listeners) l();
}

export function getEventClip(): EventClip | null {
  return clip;
}

export function useEventClip(): EventClip | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((t) => t + 1);
    listeners.add(h);
    return () => {
      listeners.delete(h);
    };
  }, []);
  return clip;
}

// 입력 컨트롤에 포커스 있을 땐 단축키 무시
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function hasTextSelection(): boolean {
  const sel = window.getSelection();
  return !!sel && sel.toString().trim().length > 0;
}
