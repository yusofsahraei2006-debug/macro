import { baseQuantityFor, parseMealText, rankFoods, singular, splitMeal } from '@/services/mealParser';

describe('splitMeal', () => {
  it('splits on commas, and, with, plus', () => {
    expect(splitMeal('3 eggs, 2 slices of toast with butter and a latte')).toEqual(['3 eggs', '2 slices of toast', 'butter', 'a latte']);
  });
});

describe('parseMealText', () => {
  it('reads counts, household units and plain items', () => {
    const items = parseMealText('3 eggs, 2 slices of toast with butter and a latte');
    expect(items.map((i) => i.name)).toEqual(['egg', 'toast', 'butter', 'latte']);
    expect(items[0].count).toBe(3);
    expect(items[1].count).toBe(2);
    expect(items[1].countUnit).toBe('slice');
    expect(items[2].count).toBe(1);
    expect(items[3].count).toBe(1);
  });
  it('reads explicit weights before and after the food', () => {
    const [a, b] = parseMealText('200g chicken breast and rice 150 g');
    expect(a.name).toBe('chicken breast');
    expect(a.amount).toEqual({ value: 200, unit: 'g' });
    expect(b.name).toBe('rice');
    expect(b.amount).toEqual({ value: 150, unit: 'g' });
  });
  it('converts imperial units and litres', () => {
    const [a, b] = parseMealText('8 oz steak, 0.5 l milk');
    expect(a.amount?.value).toBeCloseTo(226.8, 1);
    expect(b.amount).toEqual({ value: 500, unit: 'ml' });
  });
  it('understands number words and fractions', () => {
    const [a, b, c] = parseMealText('two bananas, half a bagel, 1/2 cup oats');
    expect(a.count).toBe(2);
    expect(a.name).toBe('banana');
    expect(b.count).toBe(0.5);
    expect(c.count).toBe(0.5);
    expect(c.countUnit).toBe('cup');
    expect(c.name).toBe('oat');
  });
  it('ignores filler words and empty parts', () => {
    const items = parseMealText('I had some porridge, , and');
    expect(items.map((i) => i.name)).toEqual(['porridge']);
  });
});

describe('singular', () => {
  it('handles common plurals without mangling short words', () => {
    expect(singular('eggs')).toBe('egg');
    expect(singular('berries')).toBe('berry');
    expect(singular('potatoes')).toBe('potato');
    expect(singular('rice')).toBe('rice');
    expect(singular('hummus')).toBe('hummus');
  });
});

describe('baseQuantityFor', () => {
  const g = { unit: 'g', servingQty: 100 };
  it('explicit grams are used as-is', () => {
    const [i] = parseMealText('150g rice');
    expect(baseQuantityFor(i, g, null)).toEqual({ qty: 150, estimated: false, note: '150 g' });
  });
  it('a remembered serving size beats typical portions', () => {
    const [i] = parseMealText('3 eggs');
    expect(baseQuantityFor(i, g, 60).qty).toBe(180);
    expect(baseQuantityFor(i, g, 60).estimated).toBe(false);
  });
  it('falls back to a typical portion and flags it as an estimate', () => {
    const [i] = parseMealText('3 eggs');
    const r = baseQuantityFor(i, g, null);
    expect(r.qty).toBe(150);
    expect(r.estimated).toBe(true);
  });
  it('household units use typical sizes', () => {
    const [i] = parseMealText('2 cups milk');
    expect(baseQuantityFor(i, { unit: 'ml', servingQty: 100 }, null).qty).toBe(480);
  });
  it('per-piece foods take the count directly', () => {
    const [i] = parseMealText('2 protein bars');
    expect(baseQuantityFor(i, { unit: 'piece', servingQty: 1 }, null)).toEqual({ qty: 2, estimated: false, note: '2 piece' });
  });
  it('unknown foods get 100 g each and are flagged', () => {
    const [i] = parseMealText('1 mystery stew');
    const r = baseQuantityFor(i, g, null);
    expect(r.qty).toBe(100);
    expect(r.estimated).toBe(true);
  });
});

describe('rankFoods', () => {
  const f = (name: string, extra: any = {}) => ({ name, source: 'usda', unit: 'g', kcalPerUnit: 1, proteinPerUnit: 0, carbsPerUnit: 0, fatPerUnit: 0, servingQty: 100, ...extra });
  it('prefers names containing the query, plain forms and saved foods', () => {
    const out = rankFoods('egg', [f('Pasta, dry, enriched, egg noodles'), f('Egg, whole, raw, fresh'), f('Croissants, butter')]);
    expect(out[0].name).toBe('Egg, whole, raw, fresh');
    const saved = rankFoods('egg', [f('Egg, whole, raw, fresh'), f('Egg', { source: 'custom', id: 3 })]);
    expect(saved[0].name).toBe('Egg');
  });
});
