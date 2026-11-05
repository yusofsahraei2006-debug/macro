import {
  averageOf, bestDay, dailyLatest, eligibleExerciseKcal, enumerateDays, fillDays, goalHitRate, goalProgress,
  kgToLb, lbToKg, rangeFor, totalOf, trendKgPerWeek, weekStart, weeklyAverages, weightChange, cmToIn, inToCm, mToMiles,
} from '@/services/health/aggregate';
import { DayActivity, WeightSample } from '@/services/health/types';

const day = (date: string, steps: number | null, kcal: number | null = null): DayActivity => ({ date, steps, distanceM: null, activeKcal: kcal });
const w = (date: string, kg: number, h = 8): WeightSample => ({ date, kg, atMs: new Date(`${date}T${String(h).padStart(2, '0')}:00:00Z`).getTime() });

describe('date ranges', () => {
  it('week is 7 days and month is 30 days inclusive of today', () => {
    expect(enumerateDays(rangeFor('week', '2026-11-05').from, '2026-11-05').length).toBe(7);
    expect(enumerateDays(rangeFor('month', '2026-11-05').from, '2026-11-05').length).toBe(30);
    expect(rangeFor('week', '2026-11-05').from).toBe('2026-10-30');
  });
  it('fills missing days with the chosen fill (0 vs unknown)', () => {
    const rows = [day('2026-11-04', 5000)];
    const days = ['2026-11-03', '2026-11-04', '2026-11-05'];
    expect(fillDays(rows, days, 0).map((d) => d.steps)).toEqual([0, 5000, 0]);
    expect(fillDays(rows, days, null).map((d) => d.steps)).toEqual([null, 5000, null]);
  });
});

describe('summaries', () => {
  const days = [day('a', 8000), day('b', null), day('c', 12000), day('d', 10000)];
  it('averages ignore unknown days but not real zeros', () => {
    expect(averageOf(days, 'steps')).toBeCloseTo(10000);
    expect(averageOf([day('a', 0), day('b', 10000)], 'steps')).toBe(5000);
    expect(averageOf([day('a', null)], 'steps')).toBeNull();
  });
  it('totals, best day, goal hit rate', () => {
    expect(totalOf(days, 'steps')).toBe(30000);
    expect(bestDay(days, 'steps')?.date).toBe('c');
    expect(goalHitRate(days, 'steps', 10000)).toBeCloseTo(2 / 3);
    expect(goalHitRate(days, 'steps', 0)).toBeNull();
  });
});

describe('exercise calories never double count', () => {
  it('credits only the chosen share of active energy', () => {
    expect(eligibleExerciseKcal(600, 50)).toBe(300);
    expect(eligibleExerciseKcal(600, 100)).toBe(600);
  });
  it('removes the baseline the goal already includes', () => {
    expect(eligibleExerciseKcal(600, 100, 400)).toBe(200);
    expect(eligibleExerciseKcal(300, 100, 400)).toBe(0);
  });
  it('is zero for missing/negative data and clamps the percentage', () => {
    expect(eligibleExerciseKcal(null, 50)).toBe(0);
    expect(eligibleExerciseKcal(-20, 50)).toBe(0);
    expect(eligibleExerciseKcal(500, 250)).toBe(500);
    expect(eligibleExerciseKcal(500, -10)).toBe(0);
  });
});

describe('unit conversion', () => {
  it('round-trips weight and length', () => {
    expect(lbToKg(kgToLb(82.5))).toBeCloseTo(82.5, 10);
    expect(inToCm(cmToIn(91.4))).toBeCloseTo(91.4, 10);
    expect(kgToLb(1)).toBeCloseTo(2.2046, 3);
    expect(mToMiles(1609.344)).toBeCloseTo(1, 10);
  });
});

describe('weight', () => {
  it('keeps the latest reading per day', () => {
    const d = dailyLatest([w('2026-11-01', 81, 7), w('2026-11-01', 80.5, 20), w('2026-11-02', 80.4)]);
    expect(d.map((s) => s.kg)).toEqual([80.5, 80.4]);
  });
  it('week starts on Monday', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-02'); // Thursday
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday
  });
  it('averages by week', () => {
    const r = weeklyAverages([w('2026-11-02', 80), w('2026-11-04', 82), w('2026-11-09', 79)]);
    expect(r).toEqual([{ weekStart: '2026-11-02', kg: 81 }, { weekStart: '2026-11-09', kg: 79 }]);
  });
  it('change needs two days in the window', () => {
    const s = [w('2026-10-01', 85), w('2026-10-20', 83), w('2026-11-04', 82)];
    expect(weightChange(s, '2026-10-01', '2026-11-04')).toBe(-3);
    expect(weightChange(s, '2026-11-01', '2026-11-04')).toBeNull();
  });
  it('trend is kg per week, null for sparse data', () => {
    const s = [0, 7, 14, 21].map((d, i) => w(`2026-10-${String(1 + d).padStart(2, '0')}`, 85 - i));
    expect(trendKgPerWeek(s)).toBeCloseTo(-1, 6);
    expect(trendKgPerWeek([w('2026-10-01', 85), w('2026-10-02', 84)])).toBeNull();
    expect(trendKgPerWeek([w('2026-10-01', 85), w('2026-10-02', 84), w('2026-10-03', 84)])).toBeNull(); // < 7 days span
  });
  it('goal progress works for losing and gaining and clamps', () => {
    expect(goalProgress(90, 85, 80)).toBe(0.5);
    expect(goalProgress(60, 65, 70)).toBe(0.5);
    expect(goalProgress(90, 95, 80)).toBe(0);
    expect(goalProgress(90, 70, 80)).toBe(1);
    expect(goalProgress(80, 80, 80)).toBeNull();
    expect(goalProgress(null, 80, 70)).toBeNull();
  });
});
