import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, SectionHeader, T } from '@/components/ui';
import { BarChart } from '@/components/charts';
import { NumberField, parseNum } from '@/components/NumberField';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import * as repo from '@/db/repositories';
import { enumerateDays } from '@/services/health/aggregate';
import { addDays, fromDateKey, todayKey } from '@/utils/date';
import { haptic } from '@/utils/haptics';

export default function WaterHistory() {
  const { colors } = useTheme();
  const d = useDiary();
  const [days, setDays] = useState<14 | 30>(14);
  const [totals, setTotals] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState(todayKey());
  const [entries, setEntries] = useState<{ id: number; date: string; ml: number }[]>([]);
  const [custom, setCustom] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const from = addDays(todayKey(), -(days - 1));
  const keys = useMemo(() => enumerateDays(from, todayKey()), [from]);

  const load = useCallback(async () => {
    const t = await repo.waterTotals(from, todayKey());
    setTotals(new Map(t.map((x) => [x.date, x.ml])));
    setEntries(await repo.getWater(selected));
  }, [from, selected]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load, d.waterMl]);

  const mutate = async (fn: () => Promise<void>) => { await fn(); await load(); await d.refresh(); };
  const values = keys.map((k) => totals.get(k) ?? 0);
  const hit = values.filter((v) => v >= d.goals.waterMl).length;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const c = parseNum(custom);

  return (
    <Screen>
      <Header title="Water" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([14, 30] as const).map((n) => <Pill key={n} label={`${n} days`} active={days === n} onPress={() => setDays(n)} />)}
        </View>
        <BarChart
          values={values} labels={keys.map((k) => String(fromDateKey(k).getDate()))} goal={d.goals.waterMl}
          selected={keys.indexOf(selected)} onSelect={(i) => { haptic.select(); setSelected(keys[i]); }}
          formatValue={(v) => `${(v / 1000).toFixed(1)} L`} summary="Daily water intake"
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><T variant="headline">{(avg / 1000).toFixed(2)} L</T><T variant="caption" secondary>Daily average</T></View>
          <View><T variant="headline">{hit} / {days}</T><T variant="caption" secondary>Days at goal</T></View>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Daily goal: {(d.goals.waterMl / 1000).toFixed(1)} L</T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[2000, 2500, 3000, 3500, 4000].map((g) => <Pill key={g} label={`${g / 1000} L`} active={d.goals.waterMl === g} onPress={() => d.saveGoals({ ...d.goals, waterMl: g })} />)}
        </View>
        <NumberField label="Or a custom goal (ml)" value={goalInput} onChange={setGoalInput} />
        {parseNum(goalInput) !== null && (
          <Press onPress={() => { d.saveGoals({ ...d.goals, waterMl: Math.round(Math.min(10000, parseNum(goalInput)!)) }); setGoalInput(''); }}>
            <T variant="body" accent style={{ fontWeight: '600' }}>Set goal</T>
          </Press>
        )}
      </Card>

      <SectionHeader title={selected === todayKey() ? 'Today’s entries' : fromDateKey(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })} />
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[150, 250, 330, 500, 750].map((ml) => <Pill key={ml} label={`+${ml} ml`} onPress={() => mutate(() => repo.addWater(selected, ml))} />)}
        </View>
        <NumberField label="Custom amount (ml)" value={custom} onChange={setCustom} />
        <Press onPress={() => { if (c !== null && c <= 5000) mutate(async () => { await repo.addWater(selected, Math.round(c)); setCustom(''); }); }}
          style={{ backgroundColor: c ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' }}>
          <T variant="headline" style={{ color: c ? colors.accentText : colors.textSecondary }}>Add</T>
        </Press>
      </Card>
      {entries.length === 0 ? <Card><T variant="body" secondary>No water logged for this day.</T></Card> : entries.map((e) => (
        <Card key={e.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md }}>
          <T variant="headline">{e.ml} ml</T>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Press onPress={() => mutate(() => repo.updateWater(e.id, Math.max(50, e.ml - 50)))} accessibilityLabel="Decrease by 50 ml"><T variant="body" accent>−50</T></Press>
            <Press onPress={() => mutate(() => repo.updateWater(e.id, Math.min(5000, e.ml + 50)))} accessibilityLabel="Increase by 50 ml"><T variant="body" accent>+50</T></Press>
            <Press onPress={() => Alert.alert('Remove this entry?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => mutate(() => repo.deleteWater(e.id)) }])} accessibilityLabel="Remove water entry"><T variant="body" style={{ color: colors.danger }}>Remove</T></Press>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
