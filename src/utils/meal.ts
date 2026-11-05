import { MealType } from '@/types';

/** Sensible default meal slot for the current local time. */
export function defaultMeal(now = new Date()): MealType {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}

/** Parse a user-typed decimal ('1,5' or '1.5'); returns null for empty/invalid/negative. */
export function parseDecimal(s: string): number | null {
  const n = parseFloat((s ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
