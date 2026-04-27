import { useSyncExternalStore } from 'react';

type State = {
  threadId: string | null;
  version: number;
};

let state: State = { threadId: null, version: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): State {
  return state;
}

export function useAgentStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setAgentThread(threadId: string | null) {
  if (state.threadId === threadId) return;
  state = { ...state, threadId };
  emit();
}

export function bumpAgent() {
  state = { ...state, version: state.version + 1 };
  emit();
}

export function setAgentThreadAndBump(threadId: string | null) {
  state = { threadId, version: state.version + 1 };
  emit();
}
