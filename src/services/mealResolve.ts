import { Food } from '@/types/food';
import * as foodRepo from '@/db/foodRepo';
import { searchUsda } from '@/services/usda';
import { searchOff } from '@/services/openFoodFacts';
import { FetchError } from '@/services/http';
import { rankFoods } from '@/services/mealParser';

/** Saved foods first (offline), then USDA generic foods, then Open Food Facts if still thin. */
export async function findCandidates(name: string): Promise<{ foods: Food[]; error?: string }> {
  const out: Food[] = [];
  let error: string | undefined;
  try {
    out.push(...(await foodRepo.searchLocalFoods(name, 4)));
  } catch { /* local search failing shouldn't block the online lookups */ }

  const online = async (fn: () => Promise<{ foods: Food[] }>) => {
    try {
      return (await fn()).foods;
    } catch (e) {
      if (e instanceof FetchError && (e.kind === 'offline' || e.kind === 'timeout')) error = 'No internet connection, and no saved food matched.';
      return [];
    }
  };
  if (out.length < 3) out.push(...(await online(() => searchUsda(name, 1, 6))));
  if (out.length < 2) out.push(...(await online(() => searchOff(name, 1, 6))));

  // de-duplicate by source+external id / name
  const seen = new Set<string>();
  const unique = out.filter((f) => {
    const k = `${f.source}:${f.extId ?? f.id ?? f.name.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { foods: rankFoods(name, unique).slice(0, 6), error: unique.length ? undefined : error };
}
