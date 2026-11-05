import React, { useCallback, useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, SectionHeader, T } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { NumberField, parseNum } from '@/components/NumberField';
import { useUnits } from '@/hooks/useUnits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import * as healthRepo from '@/db/healthRepo';
import { inToCm } from '@/services/health/aggregate';
import { fromDateKey, todayKey } from '@/utils/date';
import { haptic } from '@/utils/haptics';

const PRESETS = ['Waist', 'Chest', 'Arms', 'Hips', 'Thighs', 'Neck'];

export default function Measurements() {
  const { colors } = useTheme();
  const u = useUnits();
  const [rows, setRows] = useState<healthRepo.MeasurementRow[]>([]);
  const [kind, setKind] = useState('Waist');
  const [custom, setCustom] = useState('');
  const [input, setInput] = useState('');

  const load = useCallback(async () => setRows(await healthRepo.listMeasurements()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const kinds = useMemo(() => [...new Set([...PRESETS, ...rows.map((r) => r.kind)])], [rows]);
  const name = custom.trim() || kind;
  const series = rows.filter((r) => r.kind === kind);
  const v = parseNum(input);

  const save = async () => {
    if (v === null || v > 1000) return;
    await healthRepo.addMeasurement(todayKey(), name, u.units.length === 'cm' ? v : inToCm(v));
    setInput(''); setCustom(''); setKind(name); haptic.success(); load();
  };
  const remove = (id: number) =>
    Alert.alert('Delete this measurement?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await healthRepo.deleteMeasurement(id); load(); } },
    ]);

  return (
    <Screen>
      <Header title="Measurements" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {kinds.map((k) => <Pill key={k} label={k} active={!custom.trim() && kind === k} onPress={() => { setKind(k); setCustom(''); }} />)}
        </View>
        <View style={{ gap: 6 }}>
          <T variant="caption" secondary>Or a custom area</T>
          <TextInput value={custom} onChangeText={setCustom} placeholder="e.g. Calves" placeholderTextColor={colors.textSecondary} maxLength={24}
            style={{ color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17 }} />
        </View>
        <NumberField label={`${name} (${u.units.length})`} value={input} onChange={setInput} />
        <Press onPress={save} style={{ backgroundColor: v ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' }}>
          <T variant="headline" style={{ color: v ? colors.accentText : colors.textSecondary }}>Save measurement</T>
        </Press>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">{kind} over time</T>
        {series.length >= 2 ? (
          <LineChart points={series.map((r) => ({ x: fromDateKey(r.date).getTime() / 86400000, y: u.length(r.cm) }))} formatValue={(x) => x.toFixed(1)} summary={`${kind} measurements over time`} />
        ) : <T variant="body" secondary>{series.length === 1 ? 'One entry so far; add another to see a graph.' : `No ${kind.toLowerCase()} entries yet.`}</T>}
        {series.length >= 2 && (
          <T variant="body" secondary>
            Change since first entry: {(u.length(series[series.length - 1].cm) - u.length(series[0].cm) > 0 ? '+' : '')}
            {(u.length(series[series.length - 1].cm) - u.length(series[0].cm)).toFixed(1)} {u.units.length}
          </T>
        )}
      </Card>

      <SectionHeader title="History" />
      {rows.length === 0 ? <Card><T variant="body" secondary>Nothing logged yet.</T></Card> :
        [...rows].reverse().slice(0, 60).map((r) => (
          <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md }}>
            <View>
              <T variant="headline">{r.kind}: {u.lengthLabel(r.cm)}</T>
              <T variant="caption" secondary>{fromDateKey(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</T>
            </View>
            <Press onPress={() => remove(r.id)} accessibilityLabel="Delete measurement"><T variant="body" style={{ color: colors.danger }}>Delete</T></Press>
          </Card>
        ))}
    </Screen>
  );
}
