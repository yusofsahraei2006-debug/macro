import { Pedometer } from 'expo-sensors';
import { HealthBackend, DayActivity, HourBucket } from './types';
import { addDays, fromDateKey } from '@/utils/date';
import { enumerateDays } from './aggregate';

/**
 * Phone-motion steps via Core Motion (expo-sensors Pedometer). Needs NO HealthKit entitlement, so it works in
 * a free-Apple-ID sideloaded build. Limits, by design of the platform: steps only (no distance, active energy,
 * workouts or weight) and roughly 7 days of history. Older days come from the local cache (activity_daily),
 * which fills up as the app is opened.
 */
const HISTORY_DAYS = 7;
const startOfDay = (key: string) => new Date(fromDateKey(key).setHours(0, 0, 0, 0));

async function stepsBetween(start: Date, end: Date): Promise<number> {
  const r = await Pedometer.getStepCountAsync(start, end);
  return Math.max(0, Math.round(r.steps));
}

export function createMotionBackend(): HealthBackend {
  return {
    id: 'motion',
    capabilities: { steps: true, distance: false, activeEnergy: false, workouts: false, weight: false, hourly: true, historyDays: HISTORY_DAYS },

    async isAvailable() {
      try { return await Pedometer.isAvailableAsync(); } catch { return false; }
    },

    async requestPermission() {
      const p = await Pedometer.requestPermissionsAsync();
      if (!p.granted) throw Object.assign(new Error('Motion & Fitness access was denied'), { code: 'denied' });
    },

    async getDailyActivity(fromKey, toKey): Promise<DayActivity[]> {
      const now = new Date();
      const days = enumerateDays(fromKey, toKey);
      const rows = await Promise.all(
        days.map(async (date) => {
          const start = startOfDay(date);
          const end = new Date(Math.min(startOfDay(addDays(date, 1)).getTime(), now.getTime()));
          if (end <= start) return { date, steps: 0 };
          return { date, steps: await stepsBetween(start, end) };
        }),
      );
      return rows.map((r) => ({ date: r.date, steps: r.steps, distanceM: null, activeKcal: null }));
    },

    async getHourlySteps(dateKey): Promise<HourBucket[]> {
      const now = Date.now();
      const base = startOfDay(dateKey);
      return Promise.all(
        Array.from({ length: 24 }, async (_, hour) => {
          const start = new Date(base.getTime() + hour * 3600000);
          const end = new Date(Math.min(start.getTime() + 3600000, now));
          return { hour, steps: end > start ? await stepsBetween(start, end) : 0 };
        }),
      );
    },

    async getWorkouts() { return []; },
    async getWeights() { return []; },

    subscribe(onChange) {
      let last = 0;
      const sub = Pedometer.watchStepCount(() => {
        const t = Date.now();
        if (t - last > 5000) { last = t; onChange(); } // throttle: at most one refresh per 5 s
      });
      return () => sub.remove();
    },
  };
}
