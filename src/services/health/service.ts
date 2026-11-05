import { addDays } from '@/utils/date';
import { enumerateDays, fillDays } from './aggregate';
import { DayActivity, HealthBackend, Workout, WeightSample, ActivitySource } from './types';

/** Persistence the service needs (SQLite in the app, an in-memory fake in tests). */
export interface HealthStore {
  upsertDaily(source: Exclude<ActivitySource, 'none'>, rows: DayActivity[]): Promise<void>;
  cachedDaily(source: Exclude<ActivitySource, 'none'>, from: string, to: string): Promise<DayActivity[]>;
  getFlag(key: string): Promise<string | null>;
  setFlag(key: string, value: string): Promise<void>;
}

export type ConnectResult =
  | { ok: true; status: 'connected' | 'no-data' }
  | { ok: false; status: 'unavailable' | 'denied' | 'error'; message: string };

const GUARD_KEY = 'healthkitGuard';

/**
 * A missing HealthKit entitlement makes the native call raise an exception that JavaScript cannot catch: the
 * app simply terminates. So we write "attempting" BEFORE the risky call and "ok" after. If the next launch
 * finds "attempting", the last attempt crashed and HealthKit must stay off until the user chooses to retry.
 */
export async function healthkitCrashedLastTime(store: HealthStore): Promise<boolean> {
  return (await store.getFlag(GUARD_KEY)) === 'attempting';
}
export async function clearHealthkitGuard(store: HealthStore) {
  await store.setFlag(GUARD_KEY, 'idle');
}
export async function markHealthkitCrashed(store: HealthStore) {
  await store.setFlag(GUARD_KEY, 'crashed');
}

/** Ask for access and probe for data. Never throws; returns a status the UI can explain. */
export async function connect(backend: HealthBackend, store: HealthStore, today: string): Promise<ConnectResult> {
  try {
    if (!(await backend.isAvailable())) {
      return { ok: false, status: 'unavailable', message: backend.id === 'healthkit' ? 'Apple Health is not available in this build or on this device.' : 'Motion data is not available on this device.' };
    }
    if (backend.id === 'healthkit') await store.setFlag(GUARD_KEY, 'attempting');
    await backend.requestPermission();
    if (backend.id === 'healthkit') await store.setFlag(GUARD_KEY, 'ok');

    // HealthKit never reveals whether READ access was denied (a privacy feature), so we probe for data instead.
    const probe = await backend.getDailyActivity(addDays(today, -6), today);
    const any = probe.some((d) => (d.steps ?? 0) > 0 || (d.distanceM ?? 0) > 0 || (d.activeKcal ?? 0) > 0);
    return { ok: true, status: any ? 'connected' : 'no-data' };
  } catch (e: any) {
    if (backend.id === 'healthkit') await store.setFlag(GUARD_KEY, 'idle').catch(() => {});
    if (e?.code === 'denied') return { ok: false, status: 'denied', message: String(e.message ?? 'Access was denied') };
    return { ok: false, status: 'error', message: String(e?.message ?? e) };
  }
}

/**
 * One row per day in [from, to], merged from live data and the cache.
 * Sources with unlimited history report days they have no data for as 0 (genuinely nothing happened);
 * limited sources (phone motion) report days beyond their window as null (unknown), not 0.
 */
export async function loadDaily(backend: HealthBackend, store: HealthStore, from: string, to: string, today: string): Promise<DayActivity[]> {
  const days = enumerateDays(from, to);
  const window = backend.capabilities.historyDays;
  const liveFrom = Number.isFinite(window) ? maxKey(from, addDays(today, -(window - 1))) : from;

  let live: DayActivity[] = [];
  let liveError: unknown = null;
  if (liveFrom <= to) {
    try {
      live = await backend.getDailyActivity(liveFrom, to);
      await store.upsertDaily(backend.id, live);
    } catch (e) {
      liveError = e; // fall back to whatever we cached so the screen still works offline
    }
  }
  const cached = await store.cachedDaily(backend.id, from, to);
  if (liveError && cached.length === 0) throw liveError;

  const merged = new Map<string, DayActivity>(cached.map((r) => [r.date, r]));
  for (const r of live) merged.set(r.date, r);
  return fillDays([...merged.values()], days, Number.isFinite(window) ? null : 0);
}

const maxKey = (a: string, b: string) => (a > b ? a : b);

export async function loadWorkouts(backend: HealthBackend, from: string, to: string): Promise<Workout[]> {
  if (!backend.capabilities.workouts) return [];
  return (await backend.getWorkouts(from, to)).sort((a, b) => b.startMs - a.startMs);
}

export async function loadWeights(backend: HealthBackend, from: string, to: string): Promise<WeightSample[]> {
  if (!backend.capabilities.weight) return [];
  return backend.getWeights(from, to);
}
