import { connect, loadDaily, healthkitCrashedLastTime, HealthStore } from '@/services/health/service';
import { ActivitySource, DayActivity, HealthBackend } from '@/services/health/types';

class MemStore implements HealthStore {
  daily = new Map<string, DayActivity>();
  flags = new Map<string, string>();
  async upsertDaily(source: Exclude<ActivitySource, 'none'>, rows: DayActivity[]) { rows.forEach((r) => this.daily.set(`${source}:${r.date}`, r)); }
  async cachedDaily(source: Exclude<ActivitySource, 'none'>, from: string, to: string) {
    return [...this.daily.entries()].filter(([k, v]) => k.startsWith(source + ':') && v.date >= from && v.date <= to).map(([, v]) => v).sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  async getFlag(k: string) { return this.flags.get(k) ?? null; }
  async setFlag(k: string, v: string) { this.flags.set(k, v); }
}

function fakeBackend(over: Partial<HealthBackend> & { rows?: DayActivity[]; history?: number } = {}): HealthBackend {
  const rows = over.rows ?? [];
  return {
    id: over.id ?? 'healthkit',
    capabilities: { steps: true, distance: true, activeEnergy: true, workouts: true, weight: true, hourly: true, historyDays: over.history ?? Infinity },
    isAvailable: over.isAvailable ?? (async () => true),
    requestPermission: over.requestPermission ?? (async () => {}),
    getDailyActivity: over.getDailyActivity ?? (async (f, t) => rows.filter((r) => r.date >= f && r.date <= t)),
    getHourlySteps: async () => [],
    getWorkouts: async () => [],
    getWeights: async () => [],
  };
}
const d = (date: string, steps: number): DayActivity => ({ date, steps, distanceM: steps * 0.75, activeKcal: steps / 20 });

describe('connect', () => {
  it('reports connected when data comes back and clears the crash guard', async () => {
    const store = new MemStore();
    const r = await connect(fakeBackend({ rows: [d('2026-11-05', 4000)] }), store, '2026-11-05');
    expect(r).toEqual({ ok: true, status: 'connected' });
    expect(await healthkitCrashedLastTime(store)).toBe(false);
    expect(store.flags.get('healthkitGuard')).toBe('ok');
  });
  it('reports no-data (possible denied read access) when everything is empty', async () => {
    const r = await connect(fakeBackend({ rows: [] }), new MemStore(), '2026-11-05');
    expect(r).toEqual({ ok: true, status: 'no-data' });
  });
  it('unavailable device/build is explained, not thrown', async () => {
    const r = await connect(fakeBackend({ isAvailable: async () => false }), new MemStore(), '2026-11-05');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.status).toBe('unavailable');
  });
  it('explicit denial maps to denied', async () => {
    const r = await connect(fakeBackend({ id: 'motion', requestPermission: async () => { throw Object.assign(new Error('nope'), { code: 'denied' }); } }), new MemStore(), '2026-11-05');
    expect(r.ok === false && r.status).toBe('denied');
  });
  it('a failure inside the native call becomes an error result and resets the guard', async () => {
    const store = new MemStore();
    const r = await connect(fakeBackend({ requestPermission: async () => { throw new Error('boom'); } }), store, '2026-11-05');
    expect(r.ok === false && r.status).toBe('error');
    expect(store.flags.get('healthkitGuard')).toBe('idle');
  });
  it('a hard crash leaves the guard on "attempting" so the next launch can detect it', async () => {
    const store = new MemStore();
    // simulate the process dying inside requestPermission: the promise never settles; we only inspect the flag
    void connect(fakeBackend({ requestPermission: () => new Promise<void>(() => {}) }), store, '2026-11-05');
    await new Promise((r) => setTimeout(r, 20));
    expect(await healthkitCrashedLastTime(store)).toBe(true);
  });
});

describe('loadDaily', () => {
  it('HealthKit-style source: missing days are real zeros', async () => {
    const out = await loadDaily(fakeBackend({ rows: [d('2026-11-04', 3000)] }), new MemStore(), '2026-11-03', '2026-11-05', '2026-11-05');
    expect(out.map((x) => x.steps)).toEqual([0, 3000, 0]);
  });
  it('limited-history source: old days come from cache, unknown days stay null', async () => {
    const store = new MemStore();
    await store.upsertDaily('motion', [d('2026-10-20', 7000)]); // cached on an earlier launch
    const backend = fakeBackend({ id: 'motion', history: 7, rows: [d('2026-11-04', 5000), d('2026-11-05', 1000)] });
    const out = await loadDaily(backend, store, '2026-10-19', '2026-11-05', '2026-11-05');
    expect(out.find((x) => x.date === '2026-10-20')?.steps).toBe(7000);
    expect(out.find((x) => x.date === '2026-10-19')?.steps).toBeNull();
    expect(out.find((x) => x.date === '2026-11-05')?.steps).toBe(1000);
    // live rows were written back to the cache
    expect((await store.cachedDaily('motion', '2026-11-04', '2026-11-05')).length).toBe(2);
  });
  it('only asks a limited source for days inside its window', async () => {
    let asked: [string, string] | null = null;
    const backend = fakeBackend({ id: 'motion', history: 7, getDailyActivity: async (f, t) => { asked = [f, t]; return []; } });
    await loadDaily(backend, new MemStore(), '2026-09-01', '2026-11-05', '2026-11-05');
    expect(asked).toEqual(['2026-10-30', '2026-11-05']);
  });
  it('source failure falls back to cached data, and throws only when there is nothing cached', async () => {
    const store = new MemStore();
    const failing = fakeBackend({ getDailyActivity: async () => { throw new Error('offline'); } });
    let threw = false;
    try { await loadDaily(failing, store, '2026-11-04', '2026-11-05', '2026-11-05'); } catch { threw = true; }
    expect(threw).toBe(true);
    await store.upsertDaily('healthkit', [d('2026-11-04', 2500)]);
    const out = await loadDaily(failing, store, '2026-11-04', '2026-11-05', '2026-11-05');
    expect(out[0].steps).toBe(2500);
  });
});

