import { HealthBackend, DayActivity, HourBucket, Workout, WeightSample } from './types';
import { addDays, fromDateKey, toDateKey } from '@/utils/date';
import { HEALTHKIT_BUILD } from '@/config';

/**
 * Apple HealthKit via @kingstinct/react-native-healthkit.
 *
 * UNVERIFIED AGAINST THE LIBRARY: this machine had no network access to install the package or read its
 * current docs, and the library's API changed between major versions. Every native call therefore lives in
 * THIS FILE ONLY, uses defensive result parsing and tries both known call shapes. If a call fails on first
 * run, the message is surfaced on the Activity screen ("Details") so it can be fixed here in one place.
 *
 * Only READ access is requested. Active energy is read, never basal/resting energy, so resting energy can't
 * leak into exercise credit.
 */

const ID = {
  steps: 'HKQuantityTypeIdentifierStepCount',
  distance: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  active: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  weight: 'HKQuantityTypeIdentifierBodyMass',
  workout: 'HKWorkoutTypeIdentifier',
} as const;

// Raw values of HKWorkoutActivityType (Apple's enum).
const WORKOUT_NAMES: Record<number, string> = {
  13: 'Cycling', 16: 'Elliptical', 20: 'Functional strength', 24: 'Hiking', 35: 'Rowing', 37: 'Running',
  44: 'Stair climbing', 46: 'Swimming', 50: 'Strength training', 52: 'Walking', 57: 'Yoga', 63: 'HIIT',
  66: 'Pilates', 11: 'Cross training', 14: 'Dance', 28: 'Martial arts', 41: 'Soccer', 48: 'Tennis', 6: 'Basketball',
  73: 'Mixed cardio', 59: 'Core training', 62: 'Flexibility', 64: 'Jump rope', 65: 'Kickboxing', 8: 'Boxing',
};

let modPromise: Promise<any> | null = null;
const load = () => (modPromise ??= import('@kingstinct/react-native-healthkit').then((m: any) => m.default ?? m));

const startOfDay = (key: string) => new Date(fromDateKey(key).setHours(0, 0, 0, 0));
const nextDay = (key: string) => startOfDay(addDays(key, 1));
const num = (q: any): number | null => {
  const v = q?.quantity ?? q?.value ?? (typeof q === 'number' ? q : null);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const asDate = (v: any) => (v instanceof Date ? v : new Date(v));
const toArray = (r: any): any[] => (Array.isArray(r) ? r : Array.isArray(r?.samples) ? r.samples : []);

/** Daily or hourly cumulative statistics. Tries the current call shape, then the older positional one. */
async function collection(hk: any, id: string, unit: string, from: Date, to: Date, interval: { day: 1 } | { hour: 1 }) {
  try {
    return await hk.queryStatisticsCollectionForQuantity(id, ['cumulativeSum'], from, interval, { filter: { startDate: from, endDate: to }, unit });
  } catch (first) {
    try {
      return await hk.queryStatisticsCollectionForQuantity(id, ['cumulativeSum'], from, interval, { from, to }, unit);
    } catch {
      throw first;
    }
  }
}

function dayRows(entries: any[], pick: (e: any) => number | null) {
  const out = new Map<string, number | null>();
  for (const e of entries ?? []) out.set(toDateKey(asDate(e.startDate)), pick(e));
  return out;
}

export function createHealthKitBackend(): HealthBackend {
  return {
    id: 'healthkit',
    capabilities: { steps: true, distance: true, activeEnergy: true, workouts: true, weight: true, hourly: true, historyDays: Infinity },

    async isAvailable() {
      if (!HEALTHKIT_BUILD) return false;
      try {
        return !!(await (await load()).isHealthDataAvailable());
      } catch {
        return false;
      }
    },

    async requestPermission() {
      const hk = await load();
      const read = [ID.steps, ID.distance, ID.active, ID.weight, ID.workout];
      try {
        await hk.requestAuthorization({ toRead: read, toShare: [] });
      } catch (e) {
        if (!(e instanceof TypeError)) throw e;
        await hk.requestAuthorization(read, []); // older positional signature
      }
    },

    async getDailyActivity(fromKey, toKey): Promise<DayActivity[]> {
      const hk = await load();
      const from = startOfDay(fromKey);
      const to = nextDay(toKey);
      const [s, d, a] = await Promise.all([
        collection(hk, ID.steps, 'count', from, to, { day: 1 }),
        collection(hk, ID.distance, 'm', from, to, { day: 1 }),
        collection(hk, ID.active, 'kcal', from, to, { day: 1 }),
      ]);
      const sum = (e: any) => num(e.sumQuantity) ?? 0;
      const steps = dayRows(toArray(s), sum), dist = dayRows(toArray(d), sum), act = dayRows(toArray(a), sum);
      const keys = new Set([...steps.keys(), ...dist.keys(), ...act.keys()]);
      return [...keys].sort().map((date) => ({
        date,
        steps: Math.round(steps.get(date) ?? 0),
        distanceM: dist.get(date) ?? 0,
        activeKcal: act.get(date) ?? 0,
      }));
    },

    async getHourlySteps(dateKey): Promise<HourBucket[]> {
      const hk = await load();
      const from = startOfDay(dateKey);
      const r = toArray(await collection(hk, ID.steps, 'count', from, nextDay(dateKey), { hour: 1 }));
      const byHour = new Map<number, number>();
      for (const e of r) byHour.set(asDate(e.startDate).getHours(), Math.round(num(e.sumQuantity) ?? 0));
      return Array.from({ length: 24 }, (_, hour) => ({ hour, steps: byHour.get(hour) ?? 0 }));
    },

    async getWorkouts(fromKey, toKey): Promise<Workout[]> {
      const hk = await load();
      const from = startOfDay(fromKey), to = nextDay(toKey);
      let res: any;
      try {
        res = await hk.queryWorkoutSamples({ filter: { startDate: from, endDate: to }, limit: 100, ascending: false });
      } catch (first) {
        try { res = await hk.queryWorkoutSamples({ from, to, limit: 100, ascending: false }); } catch { throw first; }
      }
      return toArray(res).map((w: any, i: number): Workout => {
        const start = asDate(w.startDate).getTime(), end = asDate(w.endDate).getTime();
        const t = w.workoutActivityType;
        const durSec = num(w.duration);
        return {
          id: String(w.uuid ?? `${start}-${i}`),
          type: typeof t === 'string' ? t.replace(/([A-Z])/g, ' $1').trim() : WORKOUT_NAMES[t as number] ?? 'Workout',
          startMs: start,
          endMs: end,
          durationMin: durSec !== null ? durSec / 60 : (end - start) / 60000,
          kcal: num(w.totalEnergyBurned),
          distanceM: num(w.totalDistance),
        };
      });
    },

    async getWeights(fromKey, toKey): Promise<WeightSample[]> {
      const hk = await load();
      const from = startOfDay(fromKey), to = nextDay(toKey);
      let res: any;
      try {
        res = await hk.queryQuantitySamples(ID.weight, { filter: { startDate: from, endDate: to }, unit: 'kg', limit: 1000, ascending: true });
      } catch (first) {
        try { res = await hk.queryQuantitySamples(ID.weight, { from, to, unit: 'kg', limit: 1000, ascending: true }); } catch { throw first; }
      }
      return toArray(res)
        .map((s: any) => ({ kg: num(s) as number, d: asDate(s.startDate) }))
        .filter((s) => Number.isFinite(s.kg) && s.kg > 0)
        .map((s) => ({ date: toDateKey(s.d), kg: s.kg, atMs: s.d.getTime() }));
    },

    subscribe(onChange) {
      let off: (() => void) | null = null;
      let cancelled = false;
      load()
        .then(async (hk) => {
          const r = await hk.subscribeToChanges(ID.steps, () => onChange());
          if (cancelled) (typeof r === 'function' ? r : r?.remove)?.call(r);
          else off = typeof r === 'function' ? r : () => r?.remove?.();
        })
        .catch(() => {});
      return () => { cancelled = true; off?.(); };
    },
  };
}
