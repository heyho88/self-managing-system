import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayKo(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return WEEKDAY_KO[d.getDay()];
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${WEEKDAY_KO[d.getDay()]}`;
}

export function fromISO(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// 월요일 시작 주의 시작 ISO. 입력이 일요일이면 6일 전 월요일.
export function startOfWeekMonday(iso: string): string {
  const d = fromISO(iso);
  const dow = d.getDay(); // 0=일, 1=월, ..., 6=토
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}

// ISO-8601 주차 키 'YYYY-Www' (월요일 기준, 그 주의 목요일이 속한 해를 사용).
export function isoWeekKey(iso: string): string {
  const d = fromISO(iso);
  const day = d.getDay() || 7; // 월=1 … 일=7
  d.setDate(d.getDate() + 4 - day); // 그 주의 목요일
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${pad2(week)}`;
}

export function startOfMonth(iso: string): string {
  const d = fromISO(iso);
  d.setDate(1);
  return toISO(d);
}

export function endOfMonth(iso: string): string {
  const d = fromISO(iso);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISO(d);
}

export function formatKRW(n: number): string {
  const v = Math.abs(Math.round(n));
  const sign = n < 0 ? '-' : '';
  return `${sign}₩${v.toLocaleString('ko-KR')}`;
}

export function parseAmountInput(s: string): number {
  // 쉼표·공백 제거, 숫자만 추출
  const v = s.replace(/[,\s₩]/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
