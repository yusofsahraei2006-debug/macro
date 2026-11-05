import { getDb } from './database';
import { Food, SavedMeal, SavedMealItem } from '@/types/food';
import { DiaryEntry, MealType } from '@/types';

type Row = Record<string, any>;

const toFood = (r: Row): Food => ({
  id: r.id,
  source: r.source,
  extId: r.ext_id,
  barcode: r.barcode,
  name: r.name,
  brand: r.brand,
  imageUri: r.image_uri,
  unit: r.unit,
  kcalPerUnit: r.kcal_per_unit,
  proteinPerUnit: r.protein_per_unit,
  carbsPerUnit: r.carbs_per_unit,
  fatPerUnit: r.fat_per_unit,
  sugarPerUnit: r.sugar_per_unit,
  fibrePerUnit: r.fibre_per_unit,
  servingQty: r.serving_qty,
  isFavourite: !!r.is_favourite,
});

// ---------- Foods ----------
export async function insertFood(f: Food): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO foods (name, brand, barcode, ext_id, source, unit, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit,
       sugar_per_unit, fibre_per_unit, serving_qty, serving_unit, image_uri, is_favourite, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    f.name, f.brand ?? null, f.barcode ?? null, f.extId ?? null, f.source, f.unit,
    f.kcalPerUnit, f.proteinPerUnit, f.carbsPerUnit, f.fatPerUnit,
    f.sugarPerUnit ?? null, f.fibrePerUnit ?? null, f.servingQty, f.unit, f.imageUri ?? null,
    f.isFavourite ? 1 : 0, Date.now(),
  );
  return res.lastInsertRowId;
}

export async function updateFood(f: Food) {
  if (f.id == null) throw new Error('updateFood needs an id');
  const db = await getDb();
  await db.runAsync(
    `UPDATE foods SET name=?, brand=?, unit=?, kcal_per_unit=?, protein_per_unit=?, carbs_per_unit=?, fat_per_unit=?,
       sugar_per_unit=?, fibre_per_unit=?, serving_qty=?, serving_unit=?, image_uri=? WHERE id=?`,
    f.name, f.brand ?? null, f.unit, f.kcalPerUnit, f.proteinPerUnit, f.carbsPerUnit, f.fatPerUnit,
    f.sugarPerUnit ?? null, f.fibrePerUnit ?? null, f.servingQty, f.unit, f.imageUri ?? null, f.id,
  );
}

export async function deleteFood(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM foods WHERE id = ?', id);
}

export async function getFood(id: number): Promise<Food | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>('SELECT * FROM foods WHERE id = ?', id);
  return r ? toFood(r) : null;
}

/**
 * Save an online food locally (so it works offline and can be favourited), de-duplicating
 * by barcode / (source, ext_id). Returns the saved row. Existing nutrition is refreshed.
 */
export async function upsertRemoteFood(f: Food): Promise<Food> {
  const db = await getDb();
  const existing = f.extId
    ? await db.getFirstAsync<Row>('SELECT * FROM foods WHERE source = ? AND ext_id = ?', f.source, f.extId)
    : null;
  if (existing) {
    await db.runAsync(
      `UPDATE foods SET name=?, brand=?, unit=?, kcal_per_unit=?, protein_per_unit=?, carbs_per_unit=?, fat_per_unit=?,
         sugar_per_unit=?, fibre_per_unit=?, serving_qty=?, serving_unit=?, image_uri=? WHERE id=?`,
      f.name, f.brand ?? null, f.unit, f.kcalPerUnit, f.proteinPerUnit, f.carbsPerUnit, f.fatPerUnit,
      f.sugarPerUnit ?? null, f.fibrePerUnit ?? null, f.servingQty, f.unit, f.imageUri ?? null, existing.id,
    );
    return (await getFood(existing.id)) as Food;
  }
  const id = await insertFood({ ...f, isFavourite: false });
  return (await getFood(id)) as Food;
}

export async function setFavourite(id: number, on: boolean) {
  const db = await getDb();
  await db.runAsync('UPDATE foods SET is_favourite = ? WHERE id = ?', on ? 1 : 0, id);
}

export async function listCustomFoods(): Promise<Food[]> {
  const db = await getDb();
  return (await db.getAllAsync<Row>("SELECT * FROM foods WHERE source = 'custom' ORDER BY name COLLATE NOCASE")).map(toFood);
}

export async function listFavourites(): Promise<Food[]> {
  const db = await getDb();
  return (await db.getAllAsync<Row>('SELECT * FROM foods WHERE is_favourite = 1 ORDER BY name COLLATE NOCASE')).map(toFood);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Offline search across everything saved on the device (custom, favourited and previously logged foods). */
export async function searchLocalFoods(query: string, limit = 20): Promise<Food[]> {
  const db = await getDb();
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return [];
  const where = words.map(() => "(name LIKE ? ESCAPE '\\' OR IFNULL(brand,'') LIKE ? ESCAPE '\\')").join(' AND ');
  const args = words.flatMap((w) => [`%${escapeLike(w)}%`, `%${escapeLike(w)}%`]);
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM foods WHERE ${where} ORDER BY is_favourite DESC, name COLLATE NOCASE LIMIT ?`,
    ...args, limit,
  );
  return rows.map(toFood);
}

export async function findFoodByBarcode(codes: string[]): Promise<Food | null> {
  const db = await getDb();
  for (const c of codes) {
    const r = await db.getFirstAsync<Row>('SELECT * FROM foods WHERE barcode = ?', c);
    if (r) return toFood(r);
  }
  return null;
}

/** Foods logged most recently / most often, collapsed by name+brand. Uses diary snapshots so it works offline. */
export async function recentlyLogged(limit = 12): Promise<Food[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT d.food_id AS id, d.name, d.brand, d.unit, d.kcal_per_unit, d.protein_per_unit, d.carbs_per_unit, d.fat_per_unit,
            MAX(d.created_at) AS last_at
     FROM diary_entries d GROUP BY d.name, IFNULL(d.brand,''), d.unit
     ORDER BY last_at DESC LIMIT ?`,
    limit,
  );
  return rows.map(snapshotToFood);
}

export async function frequentlyLogged(limit = 12): Promise<Food[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT d.food_id AS id, d.name, d.brand, d.unit, d.kcal_per_unit, d.protein_per_unit, d.carbs_per_unit, d.fat_per_unit,
            COUNT(*) AS n
     FROM diary_entries d GROUP BY d.name, IFNULL(d.brand,''), d.unit
     HAVING n >= 2 ORDER BY n DESC LIMIT ?`,
    limit,
  );
  return rows.map(snapshotToFood);
}

function snapshotToFood(r: Row): Food {
  return {
    id: r.id ?? undefined,
    source: 'custom',
    name: r.name,
    brand: r.brand,
    unit: r.unit,
    kcalPerUnit: r.kcal_per_unit,
    proteinPerUnit: r.protein_per_unit,
    carbsPerUnit: r.carbs_per_unit,
    fatPerUnit: r.fat_per_unit,
    servingQty: r.unit === 'g' || r.unit === 'ml' ? 100 : 1,
  };
}

// ---------- Search history ----------
export async function addSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO search_history (query, searched_at) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at',
    q, Date.now(),
  );
  await db.runAsync('DELETE FROM search_history WHERE query NOT IN (SELECT query FROM search_history ORDER BY searched_at DESC LIMIT 15)');
}
export async function recentSearches(limit = 8): Promise<string[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ query: string }>('SELECT query FROM search_history ORDER BY searched_at DESC LIMIT ?', limit)).map((r) => r.query);
}
export async function clearSearches() {
  const db = await getDb();
  await db.runAsync('DELETE FROM search_history');
}

// ---------- Saved meals ----------
const toItem = (r: Row): SavedMealItem => ({
  quantity: r.quantity,
  food: {
    id: r.food_id ?? undefined,
    source: 'custom',
    name: r.name,
    brand: r.brand,
    unit: r.unit,
    kcalPerUnit: r.kcal_per_unit,
    proteinPerUnit: r.protein_per_unit,
    carbsPerUnit: r.carbs_per_unit,
    fatPerUnit: r.fat_per_unit,
    servingQty: r.unit === 'g' || r.unit === 'ml' ? 100 : 1,
  },
});

export async function listSavedMeals(): Promise<SavedMeal[]> {
  const db = await getDb();
  const meals = await db.getAllAsync<Row>('SELECT * FROM saved_meals ORDER BY name COLLATE NOCASE');
  const items = await db.getAllAsync<Row>('SELECT * FROM saved_meal_items ORDER BY meal_id, position, id');
  return meals.map((m) => ({ id: m.id, name: m.name, items: items.filter((i) => i.meal_id === m.id).map(toItem) }));
}

export async function getSavedMeal(id: number): Promise<SavedMeal | null> {
  return (await listSavedMeals()).find((m) => m.id === id) ?? null;
}

async function writeItems(mealId: number, items: SavedMealItem[]) {
  const db = await getDb();
  await db.runAsync('DELETE FROM saved_meal_items WHERE meal_id = ?', mealId);
  for (let i = 0; i < items.length; i++) {
    const { food: f, quantity } = items[i];
    await db.runAsync(
      `INSERT INTO saved_meal_items (meal_id, position, food_id, name, brand, unit, quantity, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      mealId, i, f.id ?? null, f.name, f.brand ?? null, f.unit, quantity, f.kcalPerUnit, f.proteinPerUnit, f.carbsPerUnit, f.fatPerUnit,
    );
  }
}

export async function saveMeal(name: string, items: SavedMealItem[], id?: number): Promise<number> {
  const db = await getDb();
  let mealId = id ?? 0;
  await db.withTransactionAsync(async () => {
    if (id) {
      await db.runAsync('UPDATE saved_meals SET name = ? WHERE id = ?', name, id);
    } else {
      mealId = (await db.runAsync('INSERT INTO saved_meals (name, created_at) VALUES (?, ?)', name, Date.now())).lastInsertRowId;
    }
    await writeItems(mealId, items);
  });
  return mealId;
}

export async function deleteMeal(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM saved_meals WHERE id = ?', id);
}

export async function duplicateMeal(id: number): Promise<number | null> {
  const m = await getSavedMeal(id);
  if (!m) return null;
  return saveMeal(`${m.name} (copy)`, m.items);
}

/** Log every ingredient of a saved meal into the diary in one transaction. */
export async function logSavedMeal(meal: SavedMeal, date: string, slot: MealType) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const { food: f, quantity } of meal.items) {
      await db.runAsync(
        `INSERT INTO diary_entries (date, meal, food_id, name, brand, quantity, unit, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit, created_at)
         VALUES (?,?,(SELECT id FROM foods WHERE id = ?),?,?,?,?,?,?,?,?,?)`,
        // food_id is resolved via subselect: it becomes NULL if the source food was deleted since the meal was saved
        date, slot, f.id ?? null, f.name, f.brand ?? null, quantity, f.unit, f.kcalPerUnit, f.proteinPerUnit, f.carbsPerUnit, f.fatPerUnit, Date.now(),
      );
    }
  });
}

/** Diary entry -> food-like record (used when editing a logged item). */
export const entryToFood = (e: DiaryEntry): Food => ({
  id: e.foodId ?? undefined,
  source: 'custom',
  name: e.name,
  brand: e.brand,
  unit: e.unit,
  kcalPerUnit: e.kcalPerUnit,
  proteinPerUnit: e.proteinPerUnit,
  carbsPerUnit: e.carbsPerUnit,
  fatPerUnit: e.fatPerUnit,
  servingQty: e.unit === 'g' || e.unit === 'ml' ? 100 : 1,
});
