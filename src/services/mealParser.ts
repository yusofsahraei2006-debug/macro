/**
 * Free, offline meal-text parser: "3 eggs, 2 slices of toast with butter and a latte"
 *   -> [{count 3, name "egg"}, {count 2, unit slice, name "toast"}, {name "butter"}, {count 1, name "latte"}]
 * No AI: rules for quantities/units + a small table of typical portion weights.
 * Nutrition always comes from a real food database lookup afterwards; this file only reads amounts.
 */

import type { Food } from '@/types/food';

export type ParsedItem = {
  raw: string;
  /** Search text for the food database (singular, no quantity words). */
  name: string;
  /** Explicit weight/volume the user said, converted to grams or millilitres. */
  amount: { value: number; unit: 'g' | 'ml' } | null;
  /** A count of things ("3 eggs", "2 slices"), when no weight was given. */
  count: number | null;
  /** The counted unit, e.g. "slice", "cup", or null for plain things ("3 eggs"). */
  countUnit: string | null;
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, half: 0.5, quarter: 0.25, couple: 2, few: 3, dozen: 12, some: 1,
};

/** Units that convert straight to grams or millilitres. */
const MASS_VOLUME: Record<string, { unit: 'g' | 'ml'; factor: number }> = {
  g: { unit: 'g', factor: 1 }, gram: { unit: 'g', factor: 1 }, grams: { unit: 'g', factor: 1 }, gr: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 }, kilo: { unit: 'g', factor: 1000 }, kilos: { unit: 'g', factor: 1000 },
  oz: { unit: 'g', factor: 28.35 }, ounce: { unit: 'g', factor: 28.35 }, ounces: { unit: 'g', factor: 28.35 },
  lb: { unit: 'g', factor: 453.6 }, lbs: { unit: 'g', factor: 453.6 }, pound: { unit: 'g', factor: 453.6 }, pounds: { unit: 'g', factor: 453.6 },
  ml: { unit: 'ml', factor: 1 }, millilitre: { unit: 'ml', factor: 1 }, millilitres: { unit: 'ml', factor: 1 }, milliliter: { unit: 'ml', factor: 1 }, milliliters: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 }, litre: { unit: 'ml', factor: 1000 }, litres: { unit: 'ml', factor: 1000 }, liter: { unit: 'ml', factor: 1000 }, liters: { unit: 'ml', factor: 1000 },
};

/** Household units: kept as a count, converted with typical sizes later. */
const COUNT_UNITS: Record<string, string> = {
  cup: 'cup', cups: 'cup', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  slice: 'slice', slices: 'slice', piece: 'piece', pieces: 'piece', serving: 'serving', servings: 'serving', portion: 'serving', portions: 'serving',
  bowl: 'bowl', bowls: 'bowl', glass: 'glass', glasses: 'glass', can: 'can', cans: 'can', bottle: 'bottle', bottles: 'bottle',
  handful: 'handful', handfuls: 'handful', scoop: 'scoop', scoops: 'scoop', bar: 'bar', bars: 'bar', mug: 'mug', mugs: 'mug',
  plate: 'plate', plates: 'plate', pot: 'pot', pots: 'pot', packet: 'packet', packets: 'packet', bag: 'bag', bags: 'bag',
};

/** Typical sizes of household units (g or ml). */
export const UNIT_SIZES: Record<string, number> = {
  cup: 240, tbsp: 15, tsp: 5, glass: 250, can: 330, bottle: 500, bowl: 300, handful: 30, scoop: 30, mug: 300,
  plate: 350, pot: 150, packet: 40, bag: 40, bar: 45,
};

/**
 * Typical weight in grams (or ml) of ONE of these foods, for counts like "3 eggs".
 * Rough averages for estimates only; the review screen shows them and lets the user correct them.
 */
const TYPICAL: [RegExp, number][] = [
  [/\begg/, 50], [/\b(toast|bread)\b/, 30], [/\bbagel/, 100], [/\b(tortilla|wrap)\b/, 45], [/\bcroissant/, 60],
  [/\bbanana/, 118], [/\bapple/, 182], [/\borange/, 131], [/\bpear/, 178], [/\bkiwi/, 75], [/\bpeach/, 150],
  [/\bavocado/, 150], [/\bpotato/, 173], [/\btomato/, 123], [/\bcarrot/, 61],
  [/\bchicken breast/, 170], [/\bchicken thigh/, 110], [/\bsausage/, 45], [/\bbacon/, 8], [/\b(burger|patty)\b/, 115],
  [/\bsteak/, 225], [/\bsalmon/, 150], [/\bpizza/, 107], [/\bcookie|\bbiscuit/, 15], [/\bmuffin/, 115], [/\bdonut|\bdoughnut/, 60],
  [/\blatte|\bcappuccino|\bflat white/, 350], [/\bcoffee|\btea\b/, 240], [/\bmilk/, 250], [/\bjuice/, 250],
  [/\b(cola|coke|soda|pepsi)\b/, 330], [/\bbeer/, 500], [/\byog(h)?urt/, 150], [/\bprotein shake|\bshake/, 300],
];

export function typicalPortion(name: string): number | null {
  const n = name.toLowerCase();
  for (const [re, g] of TYPICAL) if (re.test(n)) return g;
  return null;
}

const FILLER = new Set(['of', 'some', 'my', 'the', 'had', 'ate', 'i', 'drank', 'with', 'x']);

/** Very small singulariser so "eggs" also matches a saved "Egg". */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

function parseNumberToken(tok: string): number | null {
  if (/^\d+([.,]\d+)?$/.test(tok)) return parseFloat(tok.replace(',', '.'));
  const frac = tok.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  if (tok in NUMBER_WORDS) return NUMBER_WORDS[tok];
  return null;
}

/** Split "a, b and c with d" into parts. */
export function splitMeal(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .split(/\s*(?:,|;|\n|\+|&|\band\b|\bwith\b|\bplus\b|\balso\b|\bthen\b)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parsePart(raw: string): ParsedItem | null {
  // "200g chicken" -> "200 g chicken"; "chicken 200g" handled by trailing pass below.
  const words = raw.replace(/(\d)([a-z])/g, '$1 $2').split(/\s+/).filter(Boolean);
  let qty: number | null = null;
  let amount: ParsedItem['amount'] = null;
  let countUnit: string | null = null;
  const rest: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const n = parseNumberToken(w);
    // "a few", "a couple of", "half a": combine
    if (n !== null && qty === null && rest.length === 0) {
      const next = words[i + 1];
      if ((w === 'a' || w === 'an') && next && (next === 'few' || next === 'couple' || next === 'dozen' || next === 'half')) continue;
      if (w === 'half' && (next === 'a' || next === 'an')) { qty = 0.5; i++; continue; }
      qty = n;
      continue;
    }
    if (n !== null && rest.length === 0 && qty !== null && (w === 'half')) { qty += 0.5; continue; }
    if (MASS_VOLUME[w] && amount === null && countUnit === null) {
      const mv = MASS_VOLUME[w];
      amount = { value: (qty ?? 1) * mv.factor, unit: mv.unit };
      qty = null;
      continue;
    }
    if (COUNT_UNITS[w] && countUnit === null && amount === null && rest.length === 0) {
      countUnit = COUNT_UNITS[w];
      continue;
    }
    // trailing amount: "chicken breast 200 g"
    const tn = parseNumberToken(w);
    if (tn !== null && rest.length > 0 && words[i + 1] && MASS_VOLUME[words[i + 1]]) {
      const mv = MASS_VOLUME[words[i + 1]];
      amount = { value: tn * mv.factor, unit: mv.unit };
      i++;
      continue;
    }
    if (FILLER.has(w) && rest.length === 0) continue;
    rest.push(w);
  }

  const cleaned = rest.filter((w) => w !== 'of');
  if (cleaned.length === 0) return null;
  const name = cleaned.map((w, i) => (i === cleaned.length - 1 ? singular(w) : w)).join(' ');
  return {
    raw,
    name,
    amount,
    count: amount ? null : qty ?? 1,
    countUnit: amount ? null : countUnit,
  };
}

export function parseMealText(text: string): ParsedItem[] {
  return splitMeal(text).map(parsePart).filter((x): x is ParsedItem => x !== null).slice(0, 15);
}

/**
 * How much of `food` (in the food's own unit) the parsed item means.
 *  - grams/ml said explicitly -> use them (ml and g treated 1:1 for drinks and the like).
 *  - a count of a household unit ("2 cups") -> typical unit size.
 *  - a plain count ("3 eggs") -> remembered serving size, else the product's labelled serving, else a typical portion.
 * Returns `estimated` when a typical size was assumed so the UI can say so.
 */
export function baseQuantityFor(
  item: ParsedItem,
  food: { unit: string; servingQty: number },
  rememberedServing: number | null,
): { qty: number; estimated: boolean; note: string } {
  const weighed = food.unit === 'g' || food.unit === 'ml';
  if (!weighed) {
    // Food counted per piece/serving: a count maps directly; a weight can't be converted reliably.
    if (item.amount) return { qty: 1, estimated: true, note: `${item.amount.value} ${item.amount.unit} said, logged as 1 ${food.unit}` };
    return { qty: item.count ?? 1, estimated: false, note: `${item.count ?? 1} ${food.unit}` };
  }
  if (item.amount) {
    const note = item.amount.unit !== food.unit ? `${item.amount.value} ${item.amount.unit} ≈ ${item.amount.value} ${food.unit}` : `${item.amount.value} ${food.unit}`;
    return { qty: item.amount.value, estimated: item.amount.unit !== food.unit, note };
  }
  const n = item.count ?? 1;
  if (item.countUnit && UNIT_SIZES[item.countUnit]) {
    const per = UNIT_SIZES[item.countUnit];
    return { qty: n * per, estimated: true, note: `${n} ${item.countUnit} ≈ ${n * per} ${food.unit}` };
  }
  const per = rememberedServing ?? (food.servingQty && food.servingQty !== 100 ? food.servingQty : null);
  if (per) return { qty: n * per, estimated: false, note: `${n} × ${per} ${food.unit}` };
  const typical = typicalPortion(item.name);
  if (typical) return { qty: n * typical, estimated: true, note: `${n} × ~${typical} ${food.unit} (typical)` };
  return { qty: n * 100, estimated: true, note: `${n} × 100 ${food.unit} (no portion size known, please check)` };
}

/** Rank matches: more query words present and shorter, plainer names first; saved foods win ties. */
export function rankFoods(query: string, foods: Food[]): Food[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (f: Food) => {
    const name = f.name.toLowerCase();
    const hits = words.filter((w) => name.includes(w)).length;
    const starts = words[0] && name.startsWith(words[0]) ? 1 : 0;
    const plain = /\braw\b|\bwhole\b|\bplain\b|\bcooked\b/.test(name) ? 0.3 : 0;
    const saved = f.source === 'custom' || f.id ? 0.8 : 0;
    return hits * 3 + starts * 1.5 + plain + saved - name.split(/[\s,]+/).length * 0.08;
  };
  return foods
    .map((f, i) => ({ f, s: score(f), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

