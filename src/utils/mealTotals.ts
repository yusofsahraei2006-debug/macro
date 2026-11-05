import { SavedMeal, foodMacros } from '@/types/food';
import { Macros, scale, sum } from '@/utils/nutrition';

/** Combined nutrition of a saved meal, always recomputed from per-unit base values x quantity. */
export const mealTotals = (m: SavedMeal): Macros => sum(m.items.map((i) => scale(foodMacros(i.food), i.quantity)));
