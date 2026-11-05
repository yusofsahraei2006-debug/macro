import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as repo from '@/db/repositories';
import { DEFAULT_DASHBOARD, DEFAULT_GOALS, DashboardPrefs, DiaryEntry, Goals, WaterEntry } from '@/types';
import { Macros, scale, sum } from '@/utils/nutrition';
import { addDays, todayKey } from '@/utils/date';

type Store = {
  ready: boolean;
  date: string;
  setDate: (d: string) => void;
  shiftDate: (days: number) => void;
  entries: DiaryEntry[];
  water: WaterEntry[];
  goals: Goals;
  prefs: DashboardPrefs;
  totals: Macros;
  waterMl: number;
  entryMacros: (e: DiaryEntry) => Macros;
  refresh: () => Promise<void>;
  addEntry: (e: repo.NewEntry) => Promise<void>;
  updateQuantity: (id: number, q: number) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  duplicate: (id: number) => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  removeWater: (id: number) => Promise<void>;
  saveGoals: (g: Goals) => Promise<void>;
  savePrefs: (p: DashboardPrefs) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export const entryMacros = (e: DiaryEntry): Macros =>
  scale({ kcal: e.kcalPerUnit, protein: e.proteinPerUnit, carbs: e.carbsPerUnit, fat: e.fatPerUnit }, e.quantity);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [water, setWater] = useState<WaterEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_DASHBOARD);

  const refresh = useCallback(async () => {
    const [e, w] = await Promise.all([repo.getEntries(date), repo.getWater(date)]);
    setEntries(e);
    setWater(w);
  }, [date]);

  useEffect(() => {
    (async () => {
      const [g, p] = await Promise.all([repo.getGoals(), repo.getDashboardPrefs()]);
      setGoals(g);
      setPrefs(p);
    })();
  }, []);

  useEffect(() => {
    refresh().then(() => setReady(true));
  }, [refresh]);

  // Re-sync when returning to foreground; also rolls "today" over after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const totals = useMemo(() => sum(entries.map(entryMacros)), [entries]);
  const waterMl = useMemo(() => water.reduce((a, w) => a + w.ml, 0), [water]);

  const value: Store = {
    ready,
    date,
    setDate,
    shiftDate: (d) => setDate((cur) => addDays(cur, d)),
    entries,
    water,
    goals,
    prefs,
    totals,
    waterMl,
    entryMacros,
    refresh,
    addEntry: async (e) => { await repo.addEntry(e); await refresh(); },
    updateQuantity: async (id, q) => { await repo.updateEntryQuantity(id, q); await refresh(); },
    removeEntry: async (id) => { await repo.deleteEntry(id); await refresh(); },
    duplicate: async (id) => { await repo.duplicateEntry(id); await refresh(); },
    addWater: async (ml) => { await repo.addWater(date, ml); await refresh(); },
    removeWater: async (id) => { await repo.deleteWater(id); await refresh(); },
    saveGoals: async (g) => { setGoals(g); await repo.saveGoals(g); },
    savePrefs: async (p) => { setPrefs(p); await repo.saveDashboardPrefs(p); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDiary() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDiary must be used inside DiaryProvider');
  return v;
}
