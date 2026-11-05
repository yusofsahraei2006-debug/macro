import { Macros } from '@/utils/nutrition';

export type FoodSource = 'custom' | 'openfoodfacts' | 'usda';

/**
 * A food, normalised from any source.
 * Nutrient values are stored PER ONE `unit` (e.g. per 1 g, per 1 ml, per 1 piece).
 * `servingQty` + `unit` describe one labelled serving (e.g. 30 g, or 1 packet).
 */
export type Food = {
  id?: number; // set once saved in SQLite
  source: FoodSource;
  extId?: string | null; // barcode for OFF, fdcId for USDA
  barcode?: string | null;
  name: string;
  brand?: string | null;
  imageUri?: string | null;
  unit: string;
  kcalPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  sugarPerUnit?: number | null;
  fibrePerUnit?: number | null;
  servingQty: number;
  isFavourite?: boolean;
};

export const foodMacros = (f: Food): Macros => ({
  kcal: f.kcalPerUnit,
  protein: f.proteinPerUnit,
  carbs: f.carbsPerUnit,
  fat: f.fatPerUnit,
});

export const isMassOrVolume = (unit: string) => unit === 'g' || unit === 'ml';

export type SavedMealItem = { food: Food; quantity: number };
export type SavedMeal = { id: number; name: string; items: SavedMealItem[] };

export const UNIT_CHOICES = ['g', 'ml', 'serving', 'piece', 'packet'] as const;
