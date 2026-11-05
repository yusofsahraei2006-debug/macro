import { Food } from '@/types/food';
import { kjToKcal } from '@/utils/nutrition';
import { getJson } from './http';

// Free, no API key. OFF asks clients to identify themselves.
const HEADERS = { 'User-Agent': 'Macro/0.1 (private personal nutrition app)' };
const BASE = 'https://world.openfoodfacts.org';
const FIELDS =
  'code,product_name,brands,image_front_small_url,image_url,nutriments,serving_size,serving_quantity,quantity,nutrition_data_per';

type Nutriments = Record<string, number | string | undefined>;
export type OffProduct = {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_url?: string;
  nutriments?: Nutriments;
  serving_size?: string;
  serving_quantity?: number | string;
  quantity?: string;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Energy per 100 g/ml in kcal.
 * Prefer the explicit kcal field. Fall back to kJ / 4.184. NOTE: OFF's bare `energy_100g`
 * is in kilojoules, never kcal, so it must be converted.
 */
export function energyKcalPer100(n: Nutriments): number | null {
  const kcal = num(n['energy-kcal_100g']);
  if (kcal !== null) return kcal;
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  return kj !== null ? kjToKcal(kj) : null;
}

/** Is this a liquid (per 100 ml) product? */
function isLiquid(p: OffProduct): boolean {
  const s = `${p.serving_size ?? ''} ${p.quantity ?? ''}`.toLowerCase();
  return /\b\d+([.,]\d+)?\s?(ml|cl|dl|l|litre|liter)\b/.test(s) && !/\b\d+([.,]\d+)?\s?(g|kg)\b/.test(s);
}

/**
 * Normalise an OFF product. Returns null if there is no usable nutrition
 * (we never invent values for missing energy).
 */
export function parseOffProduct(p: OffProduct): Food | null {
  const name = (p.product_name || p.generic_name || '').trim();
  const n = p.nutriments ?? {};
  const kcal = energyKcalPer100(n);
  if (!name || kcal === null) return null;

  const liquid = isLiquid(p);
  const unit = liquid ? 'ml' : 'g';
  const servingQty = num(p.serving_quantity) && (num(p.serving_quantity) as number) > 0 ? (num(p.serving_quantity) as number) : 100;
  const brand = p.brands?.split(',')[0]?.trim() || null;
  const per = (key: string) => {
    const v = num(n[`${key}_100g`]);
    return v === null ? null : v / 100;
  };

  return {
    source: 'openfoodfacts',
    extId: p.code ?? null,
    barcode: p.code ?? null,
    name,
    brand,
    imageUri: p.image_front_small_url || p.image_url || null,
    unit,
    kcalPerUnit: kcal / 100,
    proteinPerUnit: per('proteins') ?? 0,
    carbsPerUnit: per('carbohydrates') ?? 0,
    fatPerUnit: per('fat') ?? 0,
    sugarPerUnit: per('sugars'),
    fibrePerUnit: per('fiber'),
    servingQty,
  };
}

export async function lookupBarcode(codes: string[]): Promise<Food | null> {
  // Ask for every variant of the code at once (UPC-A / EAN-13 forms) instead of one after another.
  const results = await Promise.allSettled(
    codes.map((code) =>
      getJson<{ status?: number; product?: OffProduct }>(
        `${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
        { headers: HEADERS, timeoutMs: 7000 },
      ).then((data) => ({ code, data })),
    ),
  );
  let missingNutrition = false;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { code, data } = r.value;
    if (data.status === 1 && data.product) {
      const food = parseOffProduct({ ...data.product, code: data.product.code ?? code });
      if (food) return food;
      missingNutrition = true;
    }
  }
  if (missingNutrition) throw Object.assign(new Error('Product found but nutrition values are missing'), { kind: 'missing-nutrition' });
  // Nothing found. If every request failed (offline/timeout), surface that rather than "not found".
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length === results.length && failed.length > 0) throw failed[0].reason;
  return null;
}

export async function searchOff(query: string, page = 1, pageSize = 24): Promise<{ foods: Food[]; hasMore: boolean }> {
  const q = encodeURIComponent(query.trim());
  const data = await getJson<{ products?: OffProduct[]; count?: number; page_count?: number }>(
    `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page=${page}&page_size=${pageSize}&fields=${FIELDS}`,
    { headers: HEADERS, timeoutMs: 15000 },
  );
  const products = data.products ?? [];
  const foods = products.map(parseOffProduct).filter((f): f is Food => f !== null);
  return { foods, hasMore: products.length >= pageSize };
}
