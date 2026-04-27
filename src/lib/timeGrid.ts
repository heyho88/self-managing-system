export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 24 * 60;
export const SLOT_MIN = 30;
export const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;
export const TOTAL_SLOTS = TOTAL_MIN / SLOT_MIN;
export const TIME_LABEL_W = 56;

export function minToPct(min: number): number {
  return ((min - DAY_START_MIN) / TOTAL_MIN) * 100;
}

export function pxToMin(px: number, containerPx: number): number {
  if (containerPx <= 0) return DAY_START_MIN;
  const ratio = Math.max(0, Math.min(1, px / containerPx));
  const raw = DAY_START_MIN + ratio * TOTAL_MIN;
  return Math.round(raw / SLOT_MIN) * SLOT_MIN;
}

export function clampMin(min: number): number {
  if (min < DAY_START_MIN) return DAY_START_MIN;
  if (min > DAY_END_MIN) return DAY_END_MIN;
  return min;
}
