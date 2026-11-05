import { getDb } from './database';
import {
  DEFAULT_DASHBOARD,
  DEFAULT_GOALS,
  DEFAULT_UNITS,
  Units,
  DashboardPrefs,
  DiaryEntry,
  Goals,
  MealType,
  WaterEntry,
} from '@/types';

type Row = Record<string, any>;

const toEntry = (r: Row): DiaryEntry => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  foodId: r.food_id,
  name: r.name,
  brand: r.brand,
  quantity: r.quantity,
  unit: r.unit,
  kcalPerUnit: r.kcal_per_unit,
  proteinPerUnit: r.protein_per_unit,
  carbsPerUnit: r.carbs_per_unit,
  fatPerUnit: r.fat_per_unit,
});

// ---------- Diary ----------
export async function getEntries(date: string): Promise<DiaryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM diary_entries WHERE date = ? ORDER BY created_at ASC, id ASC',
    date,
  );
  return rows.map(toEntry);
}

export type NewEntry = Omit<DiaryEntry, 'id'>;

export async function addEntry(e: NewEntry): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO diary_entries
     (date, meal, food_id, name, brand, quantity, unit, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    e.date, e.meal, e.foodId, e.name, e.brand, e.quantity, e.unit,
    e.kcalPerUnit, e.proteinPerUnit, e.carbsPerUnit, e.fatPerUnit, Date.now(),
  );
  return res.lastInsertRowId;
}

export async function updateEntryQuantity(id: number, quantity: number) {
  const db = await getDb();
  await db.runAsync('UPDATE diary_entries SET quantity = ? WHERE id = ?', quantity, id);
}

export async function moveEntry(id: number, meal: MealType) {
  const db = await getDb();
  await db.runAsync('UPDATE diary_entries SET meal = ? WHERE id = ?', meal, id);
}

export async function deleteEntry(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM diary_entries WHERE id = ?', id);
}

export async function duplicateEntry(id: number) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO diary_entries
     (date, meal, food_id, name, brand, quantity, unit, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit, created_at)
     SELECT date, meal, food_id, name, brand, quantity, unit, kcal_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit, ?
     FROM diary_entries WHERE id = ?`,
    Date.now(), id,
  );
}

/** Copy every entry (or just one meal) from one day to another. */
export async function copyDay(from: string, to: string, meal?: MealType) {
  const db = await getDb();
  const rows = await getEntries(from);
  await db.withTransactionAsync(async () => {
    for (const r of rows.filter((x) => !meal || x.meal === meal)) {
      const { id: _id, ...rest } = r;
      await addEntry({ ...rest, date: to });
    }
  });
}

// ---------- Water ----------
export async function getWater(date: string): Promise<WaterEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WaterEntry>(
    'SELECT id, date, ml FROM water_entries WHERE date = ? ORDER BY created_at DESC',
    date,
  );
}
export async function addWater(date: string, ml: number) {
  const db = await getDb();
  await db.runAsync('INSERT INTO water_entries (date, ml, created_at) VALUES (?,?,?)', date, ml, Date.now());
}
export async function deleteWater(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM water_entries WHERE id = ?', id);
}

// ---------- Settings (goals + dashboard prefs, JSON in key/value) ----------
async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return { ...(fallback as object), ...JSON.parse(row.value) } as T;
  } catch {
    return fallback;
  }
}
async function setSetting(key: string, value: unknown) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value),
  );
}

/** Raw string settings (flags/guards that aren't JSON objects). */
export async function getRaw(key: string): Promise<string | null> {
  const db = await getDb();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key))?.value ?? null;
}
export async function setRaw(key: string, value: string) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

export async function updateWater(id: number, ml: number) {
  const db = await getDb();
  await db.runAsync('UPDATE water_entries SET ml = ? WHERE id = ?', ml, id);
}

/** Daily water totals for [from, to] inclusive (days with no entries are absent). */
export async function waterTotals(from: string, to: string): Promise<{ date: string; ml: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ date: string; ml: number }>(
    'SELECT date, SUM(ml) AS ml FROM water_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
    from, to,
  );
}

/** Daily calorie/macro totals for [from, to] inclusive, computed from per-unit base values x quantity. */
export async function dailyIntake(from: string, to: string) {
  const db = await getDb();
  return db.getAllAsync<{ date: string; kcal: number; protein: number; carbs: number; fat: number }>(
    `SELECT date, SUM(kcal_per_unit*quantity) AS kcal, SUM(protein_per_unit*quantity) AS protein,
            SUM(carbs_per_unit*quantity) AS carbs, SUM(fat_per_unit*quantity) AS fat
     FROM diary_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    from, to,
  );
}

export const getUnits = () => getSetting<Units>('units', DEFAULT_UNITS);
export const saveUnits = (u: Units) => setSetting('units', u);

export const getGoals = () => getSetting<Goals>('goals', DEFAULT_GOALS);
export const saveGoals = (g: Goals) => setSetting('goals', g);
export const getDashboardPrefs = () => getSetting<DashboardPrefs>('dashboard', DEFAULT_DASHBOARD);
export const saveDashboardPrefs = (p: DashboardPrefs) => setSetting('dashboard', p);
