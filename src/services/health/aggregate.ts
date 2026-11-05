import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { DayActivity, WeightSample } from './types';

// ---------- Day ranges ----------
export function enumerateDays(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 800) break; // safety against inverted/huge ranges
  }
  return out;
}

export type Period = 'day' | 'week' | 'month';

/** Inclusive date range ending today: week = last 7 days, month = last 30 days. */
export function rangeFor(period: Exclude<Period, 'day'>, todayKey: string): { from: string; to: string } {
  return { from: addDays(todayKey, period === 'week' ? -6 : -29), to: todayKey };
}

/** Ensure one row per day. Missing days become `fill` (0 where the source reports zero, null where it can't know). */
export function fillDays(rows: DayActivity[], days: string[], fill: 0 | null): DayActivity[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return days.map(
    (date) => byDate.get(date) ?? { date, steps: fill, distanceM: fill, activeKcal: fill },
  );
}

// ---------- Summaries ----------
export type Metric = 'steps' | 'distanceM' | 'activeKcal';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Average over days that actually have a value (null days are unknown, not zero). */
export function averageOf(days: DayActivity[], metric: Metric): number | null {
  return avg(days.map((d) => d[metric]).filter((v): v is number => v !== null));
}
export function totalOf(days: DayActivity[], metric: Metric): number {
  return days.reduce((a, d) => a + (d[metric] ?? 0), 0);
}
export function bestDay(days: DayActivity[], metric: Metric): DayActivity | null {
  let best: DayActivity | null = null;
  for (const d of days) if (d[metric] !== null && (best === null || (d[metric] as number) > (best[metric] as number))) best = d;
  return best;
}

/** Share of days that met the goal (0..1), counting only days with data. */
export function goalHitRate(days: DayActivity[], metric: Metric, goal: number): number | null {
  const vals = days.map((d) => d[metric]).filter((v): v is number => v !== null);
  if (!vals.length || !(goal > 0)) return null;
  return vals.filter((v) => v >= goal).length / vals.length;
}

// ---------- Exercise calories (no double counting) ----------
/**
 * Calories that may be added back to the budget.
 *  - Only ACTIVE energy is ever considered (resting energy is already inside the goal).
 *  - `baseline` removes the usual activity the goal already assumes, so only the excess counts.
 *  - `creditPct` scales what's credited (activity estimates run high).
 */
export function eligibleExerciseKcal(activeKcal: number | null, creditPct: number, baseline = 0): number {
  if (activeKcal === null || !(activeKcal > 0)) return 0;
  const pct = Math.min(100, Math.max(0, creditPct)) / 100;
  return Math.max(0, activeKcal - Math.max(0, baseline)) * pct;
}

// ---------- Weight ----------
export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (i: number) => i * 2.54;
export const mToKm = (m: number) => m / 1000;
export const mToMiles = (m: number) => m / 1609.344;

/** One value per day (the latest of that day wins). Input must be sorted oldest->newest. */
export function dailyLatest(samples: WeightSample[]): WeightSample[] {
  const m = new Map<string, WeightSample>();
  for (const s of [...samples].sort((a, b) => a.atMs - b.atMs)) m.set(s.date, s);
  return [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Monday-based week start key for a date. */
export function weekStart(dateKey: string): string {
  const d = fromDateKey(dateKey);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toDateKey(d);
}

/** Average weight per week (daily values averaged within each Monday-start week). */
export function weeklyAverages(samples: WeightSample[]): { weekStart: string; kg: number }[] {
  const groups = new Map<string, number[]>();
  for (const s of dailyLatest(samples)) {
    const k = weekStart(s.date);
    groups.set(k, [...(groups.get(k) ?? []), s.kg]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => ({ weekStart: k, kg: v.reduce((a, b) => a + b, 0) / v.length }));
}

/** Change between the oldest and newest daily value in the window, or null with fewer than 2 days. */
export function weightChange(samples: WeightSample[], fromKey: string, toKey: string): number | null {
  const w = dailyLatest(samples).filter((s) => s.date >= fromKey && s.date <= toKey);
  return w.length >= 2 ? w[w.length - 1].kg - w[0].kg : null;
}

/** Least-squares trend in kg per week over the supplied daily values; null with fewer than 3 points or 7 days of span. */
export function trendKgPerWeek(samples: WeightSample[]): number | null {
  const pts = dailyLatest(samples).map((s) => ({ x: fromDateKey(s.date).getTime() / 86400000, y: s.kg }));
  if (pts.length < 3) return null;
  if (pts[pts.length - 1].x - pts[0].x < 7) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den === 0 ? null : (num / den) * 7;
}

/**
 * Progress from `start` to `target` (0..1). Works for losing or gaining; null if start === target or any input missing.
 */
export function goalProgress(startKg: number | null, currentKg: number | null, targetKg: number | null): number | null {
  if (startKg === null || currentKg === null || targetKg === null || startKg === targetKg) return null;
  const p = (startKg - currentKg) / (startKg - targetKg);
  return Math.min(1, Math.max(0, p));
}

// ---------- Display helpers ----------
export function formatDuration(min: number): string {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
