import { Food } from '@/types/food';
import { getJson } from './http';

// USDA FoodData Central: free reference data for generic foods (banana, cooked rice, eggs...).
// A free personal key from https://fdc.nal.usda.gov/api-key-signup.html is recommended;
// without one the shared DEMO_KEY works but is heavily rate-limited. Never commit a real key.
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';
const URL_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

type UsdaNutrient = { nutrientNumber?: string; nutrientId?: number; value?: number; unitName?: string };
export type UsdaFood = { fdcId: number; description: string; brandOwner?: string; foodNutrients?: UsdaNutrient[] };

const idOf = (n: UsdaNutrient) => String(n.nutrientNumber ?? n.nutrientId ?? '');

function pick(nutrients: UsdaNutrient[], ids: string[], unit?: string): number | null {
  for (const id of ids) {
    const n = nutrients.find((x) => idOf(x) === id && (!unit || (x.unitName ?? '').toUpperCase() === unit));
    if (n && typeof n.value === 'number' && n.value >= 0) return n.value;
  }
  return null;
}

/** Reference values are per 100 g. Energy: 1008 (kcal), or Atwater estimates 2047/2048 when absent. */
export function parseUsdaFood(f: UsdaFood): Food | null {
  const ns = f.foodNutrients ?? [];
  const kcal = pick(ns, ['208', '1008'], 'KCAL') ?? pick(ns, ['957', '958', '2047', '2048'], 'KCAL');
  if (kcal === null || !f.description) return null;
  const per = (ids: string[]) => {
    const v = pick(ns, ids);
    return v === null ? null : v / 100;
  };
  return {
    source: 'usda',
    extId: String(f.fdcId),
    name: titleCase(f.description),
    brand: f.brandOwner ?? null,
    unit: 'g',
    kcalPerUnit: kcal / 100,
    proteinPerUnit: per(['203', '1003']) ?? 0,
    carbsPerUnit: per(['205', '1005']) ?? 0,
    fatPerUnit: per(['204', '1004']) ?? 0,
    sugarPerUnit: per(['269', '2000']),
    fibrePerUnit: per(['291', '1079']),
    servingQty: 100,
  };
}

function titleCase(s: string) {
  const t = s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export async function searchUsda(query: string, page = 1, pageSize = 15): Promise<{ foods: Food[]; hasMore: boolean }> {
  const url =
    `${URL_BASE}?query=${encodeURIComponent(query.trim())}` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy')}&pageSize=${pageSize}&pageNumber=${page}&api_key=${encodeURIComponent(API_KEY)}`;
  const data = await getJson<{ foods?: UsdaFood[]; totalPages?: number }>(url, { timeoutMs: 12000 });
  const foods = (data.foods ?? []).map(parseUsdaFood).filter((x): x is Food => x !== null);
  return { foods, hasMore: page < (data.totalPages ?? 1) };
}
