import { getDb } from './database';
import { DayActivity, ActivitySource } from '@/services/health/types';

type Row = Record<string, any>;

// ---------- Cached daily activity ----------
export async function upsertDaily(source: Exclude<ActivitySource, 'none'>, rows: DayActivity[]) {
  if (!rows.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO activity_daily (date, source, steps, distance_m, active_kcal, updated_at) VALUES (?,?,?,?,?,?)
         ON CONFLICT(date, source) DO UPDATE SET steps=excluded.steps, distance_m=excluded.distance_m,
           active_kcal=excluded.active_kcal, updated_at=excluded.updated_at`,
        r.date, source, r.steps, r.distanceM, r.activeKcal, Date.now(),
      );
    }
  });
}

export async function cachedDaily(source: Exclude<ActivitySource, 'none'>, from: string, to: string): Promise<DayActivity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM activity_daily WHERE source = ? AND date BETWEEN ? AND ? ORDER BY date',
    source, from, to,
  );
  return rows.map((r) => ({ date: r.date, steps: r.steps, distanceM: r.distance_m, activeKcal: r.active_kcal }));
}

// ---------- Weight (canonical kg) ----------
export type WeightRow = { id: number; date: string; kg: number };

export async function addWeight(date: string, kg: number) {
  const db = await getDb();
  await db.runAsync('INSERT INTO weight_entries (date, kg, created_at) VALUES (?,?,?)', date, kg, Date.now());
}
export async function listWeights(from = '0000-01-01', to = '9999-12-31'): Promise<WeightRow[]> {
  const db = await getDb();
  return db.getAllAsync<WeightRow>('SELECT id, date, kg FROM weight_entries WHERE date BETWEEN ? AND ? ORDER BY date, id', from, to);
}
export async function deleteWeight(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', id);
}

// ---------- Measurements (canonical cm) ----------
export type MeasurementRow = { id: number; date: string; kind: string; cm: number };

export async function addMeasurement(date: string, kind: string, cm: number) {
  const db = await getDb();
  await db.runAsync('INSERT INTO measurements (date, kind, cm, created_at) VALUES (?,?,?,?)', date, kind, cm, Date.now());
}
export async function listMeasurements(): Promise<MeasurementRow[]> {
  const db = await getDb();
  return db.getAllAsync<MeasurementRow>('SELECT id, date, kind, cm FROM measurements ORDER BY date, id');
}
export async function deleteMeasurement(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM measurements WHERE id = ?', id);
}
