import { defaultMeal, parseDecimal } from '@/utils/meal';
import { mealTotals } from '@/utils/mealTotals';
import { SavedMeal } from '@/types/food';

const food = (name: string, unit: string, kcal: number, p: number, c: number, f: number) => ({
  source: 'custom' as const, name, unit, kcalPerUnit: kcal, proteinPerUnit: p, carbsPerUnit: c, fatPerUnit: f, servingQty: 100,
});

describe('saved meal totals', () => {
  // Chicken and Rice example from the spec (values per gram)
  const meal: SavedMeal = {
    id: 1,
    name: 'Chicken and rice',
    items: [
      { food: food('Chicken breast', 'g', 1.65, 0.31, 0, 0.036), quantity: 200 },
      { food: food('Cooked rice', 'g', 1.3, 0.027, 0.28, 0.003), quantity: 250 },
      { food: food('Vegetables', 'g', 0.35, 0.02, 0.07, 0.004), quantity: 100 },
      { food: food('Olive oil', 'g', 8.84, 0, 0, 1), quantity: 10 },
    ],
  };
  it('sums ingredients exactly from per-unit values', () => {
    const t = mealTotals(meal);
    expect(t.kcal).toBeCloseTo(330 + 325 + 35 + 88.4, 6);
    expect(t.protein).toBeCloseTo(62 + 6.75 + 2, 6);
    expect(t.fat).toBeCloseTo(7.2 + 0.75 + 0.4 + 10, 6);
  });
  it('is zero for an empty meal', () => {
    expect(mealTotals({ id: 2, name: 'x', items: [] }).kcal).toBe(0);
  });
  it('scales a changed quantity without drift', () => {
    const m2: SavedMeal = { ...meal, items: [{ ...meal.items[0], quantity: 300 }] };
    expect(mealTotals(m2).kcal).toBeCloseTo(495, 9);
  });
});

describe('input parsing', () => {
  it('parses decimals with comma or dot', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal(' 2.25 ')).toBe(2.25);
  });
  it('rejects empty, negative and non-numeric input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('default meal slot', () => {
  it('follows the time of day', () => {
    expect(defaultMeal(new Date(2026, 10, 5, 8))).toBe('breakfast');
    expect(defaultMeal(new Date(2026, 10, 5, 12))).toBe('lunch');
    expect(defaultMeal(new Date(2026, 10, 5, 18))).toBe('dinner');
    expect(defaultMeal(new Date(2026, 10, 5, 23))).toBe('snacks');
  });
});
