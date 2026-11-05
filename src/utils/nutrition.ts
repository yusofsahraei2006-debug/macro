// Nutrition maths. Every logged entry stores its BASE per-unit values and a quantity,
// and totals are always recomputed from those, so repeatedly editing a portion can
// never accumulate rounding error. Rounding happens only at display time.

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Macros for `quantity` units given per-unit base values. */
export function scale(basePerUnit: Macros, quantity: number): Macros {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  return {
    kcal: basePerUnit.kcal * q,
    protein: basePerUnit.protein * q,
    carbs: basePerUnit.carbs * q,
    fat: basePerUnit.fat * q,
  };
}

/** Convert per-100g values into per-gram base values. */
export function per100ToPerUnit(per100: Macros, gramsPerUnit = 1): Macros {
  const f = gramsPerUnit / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  };
}

export function sum(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
    }),
    { ...ZERO },
  );
}

/** kJ and kcal are different units: 1 kcal = 4.184 kJ. */
export function kjToKcal(kj: number): number {
  return kj / 4.184;
}

/**
 * Remaining calories.
 * Default: goal - consumed.
 * With exercise adjustment: goal + eligibleExercise - consumed.
 */
export function remainingCalories(
  goal: number,
  consumed: number,
  eligibleExercise = 0,
  includeExercise = false,
): number {
  return goal + (includeExercise ? Math.max(0, eligibleExercise) : 0) - consumed;
}

/** 0..1 progress, clamped, safe for goal = 0. */
export function progress(value: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return Math.min(1, Math.max(0, value / goal));
}

export const weeklyGoal = (dailyGoal: number) => dailyGoal * 7;

export const round0 = (n: number) => Math.round(n);
export const round1 = (n: number) => Math.round(n * 10) / 10;
