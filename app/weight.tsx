import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, SectionHeader, T } from '@/components/ui';
import { Bar } from '@/components/Bar';
import { LineChart } from '@/components/charts';
import { NumberField, parseNum } from '@/components/NumberField';
import { useDiary } from '@/hooks/useDiary';
import { useHealth } from '@/hooks/useHealth';
import { useUnits } from '@/hooks/useUnits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import * as healthRepo from '@/db/healthRepo';
import { WeightSample } from '@/services/health/types';
import { dailyLatest, goalProgress, lbToKg, trendKgPerWeek, weeklyAverages, weightChange } from '@/services/health/aggregate';
import { addDays, fromDateKey, todayKey } from '@/utils/date';
import { haptic } from '@/utils/haptics';

type Row = { key: string; date: string; kg: number; source: 'manual' | 'health'; id?: number };

export default function WeightScreen() {
  const { colors } = useTheme();
  const d = useDiary();
  const h = useHealth();
  const u = useUnits();
  const [manual, setManual] = useState<healthRepo.WeightRow[]>([]);
  const [input, setInput] = useState('');
  const [windowDays, setWindowDays] = useState<30 | 90 | 180>(90);

  const load = useCallback(async () => setManual(await healthRepo.listWeights()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows: Row[] = useMemo(() => {
    const a: Row[] = manual.map((m) => ({ key: `m${m.id}`, date: m.date, kg: m.kg, source: 'manual', id: m.id }));
    const b: Row[] = h.weights.map((w) => ({ key: `h${w.atMs}`, date: w.date, kg: w.kg, source: 'health' }));
    return [...a, ...b].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  }, [manual, h.weights]);

  const samples: WeightSample[] = useMemo(
    () => rows.map((r) => ({ date: r.date, kg: r.kg, atMs: fromDateKey(r.date).getTime() })),
    [rows],
  );
  const daily = useMemo(() => dailyLatest(samples), [samples]);
  const from = addDays(todayKey(), -(windowDays - 1));
  const shown = daily.filter((s) => s.date >= from);
  const latest = daily[daily.length - 1];
  const start = daily[0];
  const target = d.goals.targetWeightKg;
  const prog = goalProgress(start?.kg ?? null, latest?.kg ?? null, target);
  const trend = trendKgPerWeek(shown);
  const change = weightChange(samples, from, todayKey());
  const toUnit = (kg: number) => u.weight(kg);

  const save = async () => {
    const v = parseNum(input);
    if (v === null || v > 1000) { Alert.alert('Enter a valid weight'); return; }
    const kg = u.units.weight === 'kg' ? v : lbToKg(v);
    await healthRepo.addWeight(todayKey(), kg);
    await d.saveGoals({ ...d.goals, currentWeightKg: kg });
    setInput(''); haptic.success(); load();
  };
  const remove = (r: Row) =>
    Alert.alert('Delete this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await healthRepo.deleteWeight(r.id!); load(); } },
    ]);

  return (
    <Screen>
      <Header title="Weight" />
      <Card style={{ gap: spacing.md }}>
        <NumberField label={`Today’s weight (${u.units.weight})`} value={input} onChange={setInput} placeholder={latest ? toUnit(latest.kg).toFixed(1) : undefined} />
        <Press onPress={save} style={{ backgroundColor: parseNum(input) ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' }}>
          <T variant="headline" style={{ color: parseNum(input) ? colors.accentText : colors.textSecondary }}>Log weight</T>
        </Press>
      </Card>

      {daily.length === 0 ? (
        <Card><T variant="body" secondary>No weight entries yet. Log one above{h.backend?.capabilities.weight ? ', or log it in Apple Health and it will appear here' : ''}.</T></Card>
      ) : (
        <>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([30, 90, 180] as const).map((w) => <Pill key={w} label={`${w}d`} active={windowDays === w} onPress={() => setWindowDays(w)} />)}
            </View>
            <T variant="title">{u.weightLabel(latest.kg)}</T>
            {shown.length >= 2 ? (
              <LineChart
                points={shown.map((s) => ({ x: fromDateKey(s.date).getTime() / 86400000, y: toUnit(s.kg) }))}
                target={target != null ? toUnit(target) : null}
                formatValue={(v) => v.toFixed(1)} summary="Weight over time"
              />
            ) : <T variant="caption" secondary>Log at least two days in this window to see a graph.</T>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stat label={`Change (${windowDays}d)`} value={change === null ? '—' : `${change > 0 ? '+' : ''}${toUnit(change).toFixed(1)} ${u.units.weight}`} />
              <Stat label="Trend / week" value={trend === null ? 'need 7+ days' : `${trend > 0 ? '+' : ''}${toUnit(trend).toFixed(2)} ${u.units.weight}`} />
            </View>
          </Card>

          <Card style={{ gap: spacing.sm }}>
            <T variant="headline">Goal</T>
            {target != null ? (
              <>
                <T variant="body" secondary>Target {u.weightLabel(target)}{start ? ` · started ${u.weightLabel(start.kg)}` : ''}</T>
                {prog !== null ? <Bar progress={prog} color={colors.accent} height={10} /> : <T variant="caption" secondary>Progress needs a starting weight different from your target.</T>}
                {prog !== null && <T variant="caption" secondary>{Math.round(prog * 100)}% of the way</T>}
              </>
            ) : <T variant="body" secondary>Set a target weight in Profile → Goals to see progress here.</T>}
          </Card>

          {weeklyAverages(samples).length > 1 && (
            <Card style={{ gap: spacing.sm }}>
              <T variant="headline">Weekly averages</T>
              {weeklyAverages(samples).slice(-8).reverse().map((w) => (
                <View key={w.weekStart} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T variant="body" secondary>Week of {fromDateKey(w.weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</T>
                  <T variant="body" style={{ fontWeight: '600' }}>{u.weightLabel(w.kg)}</T>
                </View>
              ))}
            </Card>
          )}

          <SectionHeader title="History" />
          {rows.slice(0, 60).map((r) => (
            <Card key={r.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md }}>
              <View>
                <T variant="headline">{u.weightLabel(r.kg)}</T>
                <T variant="caption" secondary>{fromDateKey(r.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {r.source === 'health' ? 'Apple Health' : 'Logged in Macro'}</T>
              </View>
              {r.source === 'manual' && <Press onPress={() => remove(r)} accessibilityLabel="Delete weight entry"><T variant="body" style={{ color: colors.danger }}>Delete</T></Press>}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View><T variant="headline">{value}</T><T variant="caption" secondary>{label}</T></View>;
}
