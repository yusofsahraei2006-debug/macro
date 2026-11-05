import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { HEALTHKIT_BUILD } from '@/config';
import { getRaw, setRaw } from '@/db/repositories';
import { sqliteHealthStore as store } from '@/db/healthStoreAdapter';
import { addDays, todayKey } from '@/utils/date';
import { createMotionBackend } from '@/services/health/motionBackend';
import { createHealthKitBackend } from '@/services/health/healthkitBackend';
import * as svc from '@/services/health/service';
import { ActivitySource, DayActivity, HealthBackend, HourBucket, WeightSample, Workout } from '@/services/health/types';

export type HealthStatus =
  | 'loading' | 'disconnected' | 'connecting' | 'connected' | 'no-data' | 'unavailable' | 'denied' | 'error' | 'crash-recovered';

type Health = {
  source: ActivitySource;
  status: HealthStatus;
  message: string | null;
  lastSync: number | null;
  refreshing: boolean;
  backend: HealthBackend | null;
  today: DayActivity | null;
  workouts: Workout[];
  weights: WeightSample[];
  connectSource: (s: Exclude<ActivitySource, 'none'>) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  getDaily: (from: string, to: string) => Promise<DayActivity[]>;
  getHourly: (date: string) => Promise<HourBucket[]>;
};

const Ctx = createContext<Health | null>(null);
const makeBackend = (s: ActivitySource): HealthBackend | null =>
  s === 'motion' ? createMotionBackend() : s === 'healthkit' && HEALTHKIT_BUILD ? createHealthKitBackend() : null;

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<ActivitySource>('none');
  const [status, setStatus] = useState<HealthStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<DayActivity | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightSample[]>([]);
  const backendRef = useRef<HealthBackend | null>(null);
  const [backend, setBackend] = useState<HealthBackend | null>(null);

  const useBackend = (b: HealthBackend | null) => { backendRef.current = b; setBackend(b); };

  const refresh = useCallback(async () => {
    const b = backendRef.current;
    if (!b) return;
    setRefreshing(true);
    try {
      const t = todayKey();
      const [days, w, ws] = await Promise.all([
        svc.loadDaily(b, store, t, t, t),
        svc.loadWorkouts(b, addDays(t, -29), t).catch(() => [] as Workout[]),
        svc.loadWeights(b, addDays(t, -179), t).catch(() => [] as WeightSample[]),
      ]);
      setToday(days[0] ?? null);
      setWorkouts(w);
      setWeights(ws);
      setLastSync(Date.now());
      setMessage(null);
      setStatus((cur) => (cur === 'error' || cur === 'loading' ? 'connected' : cur));
    } catch (e: any) {
      setStatus('error');
      setMessage(String(e?.message ?? e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Restore the saved source on launch, detecting a HealthKit crash from the previous run.
  useEffect(() => {
    (async () => {
      const saved = ((await getRaw('activitySource')) as ActivitySource | null) ?? 'none';
      if (await svc.healthkitCrashedLastTime(store)) {
        await svc.markHealthkitCrashed(store);
        await setRaw('activitySource', 'none');
        setStatus('crash-recovered');
        setMessage('Apple Health closed the app last time, which usually means this install does not have the HealthKit entitlement. HealthKit is switched off. Phone-motion steps still work.');
        return;
      }
      const b = makeBackend(saved);
      if (!b) { setSource('none'); setStatus('disconnected'); return; }
      setSource(saved);
      useBackend(b);
      setStatus('connected');
      refresh();
    })();
  }, [refresh]);

  // Sync when the app returns to the foreground (no background polling).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  // Live updates while the app is open, if the source supports change notifications.
  useEffect(() => {
    if (!backend?.subscribe) return;
    return backend.subscribe(() => { refresh(); });
  }, [backend, refresh]);

  const connectSource = useCallback(async (s: Exclude<ActivitySource, 'none'>) => {
    const b = makeBackend(s);
    if (!b) {
      setStatus('unavailable');
      setMessage('This build does not include Apple Health. Use phone-motion steps, or install a HealthKit-enabled build.');
      return;
    }
    setStatus('connecting');
    setMessage(null);
    if (s === 'healthkit') await svc.clearHealthkitGuard(store); // the user explicitly chose to (re)try
    const r = await svc.connect(b, store, todayKey());
    if (!r.ok) { setStatus(r.status); setMessage(r.message); return; }
    await setRaw('activitySource', s);
    setSource(s);
    useBackend(b);
    setStatus(r.status);
    setMessage(r.status === 'no-data'
      ? s === 'healthkit'
        ? 'Connected, but no data came back. If you declined access, enable it in Settings → Health → Data Access & Devices → Macro. It can also just mean there is no data yet today.'
        : 'Connected, but no steps were reported yet. Walk a little with your phone and pull to refresh.'
      : null);
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    await setRaw('activitySource', 'none');
    setSource('none'); useBackend(null);
    setToday(null); setWorkouts([]); setWeights([]); setLastSync(null);
    setStatus('disconnected'); setMessage(null);
  }, []);

  const getDaily = useCallback(async (from: string, to: string) => {
    const b = backendRef.current;
    if (!b) return [];
    return svc.loadDaily(b, store, from, to, todayKey());
  }, []);
  const getHourly = useCallback(async (date: string) => {
    const b = backendRef.current;
    return b ? b.getHourlySteps(date) : [];
  }, []);

  const value = useMemo<Health>(
    () => ({ source, status, message, lastSync, refreshing, backend, today, workouts, weights, connectSource, disconnect, refresh, getDaily, getHourly }),
    [source, status, message, lastSync, refreshing, backend, today, workouts, weights, connectSource, disconnect, refresh, getDaily, getHourly],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHealth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHealth must be used inside HealthProvider');
  return v;
}
