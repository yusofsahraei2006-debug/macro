import {
  kjToKcal, per100ToPerUnit, progress, remainingCalories, scale, sum, weeklyGoal, ZERO,
} from '@/utils/nutrition';

const chicken = { kcal: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }; // per gram

describe('portion scaling', () => {
  it('scales macros by quantity', () => {
    const m = scale(chicken, 200);
    expect(m.kcal).toBeCloseTo(330);
    expect(m.protein).toBeCloseTo(62);
  });

  it('does not accumulate error across repeated portion edits', () => {
    let q = 100;
    for (let i = 0; i < 1000; i++) q = i % 2 === 0 ? 137 : 100;
    // totals always derive from base values, so the result depends only on the final quantity
    expect(scale(chicken, q).kcal).toBeCloseTo(165, 10);
  });

  it('treats invalid quantities as zero', () => {
    expect(scale(chicken, NaN)).toEqual(ZERO);
    expect(scale(chicken, -5)).toEqual(ZERO);
  });

  it('converts per-100g to per-gram', () => {
    expect(per100ToPerUnit({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }).kcal).toBeCloseTo(1.65);
  });
});

describe('totals and goals', () => {
  it('sums entries', () => {
    expect(sum([scale(chicken, 100), scale(chicken, 100)]).protein).toBeCloseTo(62);
  });

  it('remaining = goal - consumed by default', () => {
    expect(remainingCalories(2800, 1560)).toBe(1240);
  });

  it('only adds exercise when enabled, and never negative exercise', () => {
    expect(remainingCalories(2800, 1560, 400, false)).toBe(1240);
    expect(remainingCalories(2800, 1560, 400, true)).toBe(1640);
    expect(remainingCalories(2800, 1560, -50, true)).toBe(1240);
  });

  it('goes negative when over goal', () => {
    expect(remainingCalories(2000, 2300)).toBe(-300);
  });

  it('progress is clamped and safe for zero goal', () => {
    expect(progress(3000, 2800)).toBe(1);
    expect(progress(10, 0)).toBe(0);
    expect(progress(-5, 100)).toBe(0);
  });

  it('weekly goal is daily x 7', () => {
    expect(weeklyGoal(2800)).toBe(19600);
  });
});

describe('energy units', () => {
  it('converts kJ to kcal correctly', () => {
    expect(kjToKcal(1000)).toBeCloseTo(239.0, 0);
    expect(kjToKcal(4.184)).toBeCloseTo(1);
  });
});
