import React, { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card, Pill, Press, T } from '@/components/ui';
import { useUnits } from '@/hooks/useUnits';
import { Reveal } from '@/components/motion';
import { getUnits, saveUnits } from '@/db/repositories';
import { Units } from '@/types';
import { kgToLb, lbToKg } from '@/services/health/aggregate';
import { useDiary } from '@/hooks/useDiary';
import { useHealth } from '@/hooks/useHealth';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Goals } from '@/types';
import { deleteAllData } from '@/db/database';
import { DEFAULT_GOALS } from '@/types';
import { haptic } from '@/utils/haptics';

type NumKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'steps' | 'waterMl';
const FIELDS: { key: NumKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Daily calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'steps', label: 'Daily steps', unit: 'steps' },
  { key: 'waterMl', label: 'Water', unit: 'ml' },
];

export default function Profile() {
  const { colors } = useTheme();
  const d = useDiary();
  const [draft, setDraft] = useState<Record<NumKey, string>>({} as any);
  const uh = useUnits();
  const health = useHealth();
  const [targetDraft, setTargetDraft] = useState('');
  useEffect(() => {
    const t = d.goals.targetWeightKg;
    setTargetDraft(t == null ? '' : (uh.units.weight === 'kg' ? t : kgToLb(t)).toFixed(1));
  }, [d.goals.targetWeightKg, uh.units.weight]);
  const setUnit = async (patch: Partial<Units>) => { await saveUnits({ ...(await getUnits()), ...patch }); uh.reload(); };
  const commitTarget = () => {
    const n = parseFloat(targetDraft.replace(',', '.'));
    if (targetDraft.trim() === '') { d.saveGoals({ ...d.goals, targetWeightKg: null }); return; }
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return;
    d.saveGoals({ ...d.goals, targetWeightKg: uh.units.weight === 'kg' ? n : lbToKg(n) });
  };

  useEffect(() => {
    const next = {} as Record<NumKey, string>;
    FIELDS.forEach((f) => (next[f.key] = String(d.goals[f.key])));
    setDraft(next);
  }, [d.goals]);

  const commit = (key: NumKey) => {
    const n = Math.round(parseFloat((draft[key] ?? '').replace(',', '.')));
    if (!Number.isFinite(n) || n <= 0) {
      setDraft((p) => ({ ...p, [key]: String(d.goals[key]) })); // reject invalid input, restore
      return;
    }
    d.saveGoals({ ...d.goals, [key]: n } as Goals);
  };

  const wipe = () =>
    Alert.alert('Delete all data?', 'This permanently removes your diary, water log, foods and settings from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything', style: 'destructive',
        onPress: async () => {
          await deleteAllData();
          await health.disconnect();
          uh.reload();
          await d.saveGoals(DEFAULT_GOALS);
          await d.refresh();
          haptic.warning();
        },
      },
    ]);

  return (
    <Screen>
      <T variant="largeTitle">Profile</T>
      <Reveal i={0}><Card style={{ gap: spacing.md }}>
        <T variant="headline">Daily goals</T>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="body">{f.label}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={draft[f.key] ?? ''}
                onChangeText={(v) => setDraft((p) => ({ ...p, [f.key]: v }))}
                onBlur={() => commit(f.key)}
                onSubmitEditing={() => commit(f.key)}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
                accessibilityLabel={f.label}
                style={{
                  minWidth: 84, textAlign: 'right', color: colors.text, backgroundColor: colors.elevated,
                  borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 17, fontWeight: '600',
                }}
              />
              <T variant="caption" secondary style={{ width: 38 }}>{f.unit}</T>
            </View>
          </View>
        ))}
      </Card></Reveal>

      <Reveal i={1}><Card style={{ gap: spacing.md }}>
        <T variant="headline">Body & units</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="body">Target weight ({uh.units.weight})</T>
          <TextInput value={targetDraft} onChangeText={setTargetDraft} onBlur={commitTarget} onSubmitEditing={commitTarget}
            keyboardType="decimal-pad" placeholder="Not set" placeholderTextColor={colors.textSecondary} accessibilityLabel="Target weight"
            style={{ minWidth: 100, textAlign: 'right', color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 17, fontWeight: '600' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="body">Weight</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill label="kg" active={uh.units.weight === 'kg'} onPress={() => setUnit({ weight: 'kg' })} />
            <Pill label="lb" active={uh.units.weight === 'lb'} onPress={() => setUnit({ weight: 'lb' })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="body">Measurements</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill label="cm" active={uh.units.length === 'cm'} onPress={() => setUnit({ length: 'cm' })} />
            <Pill label="in" active={uh.units.length === 'in'} onPress={() => setUnit({ length: 'in' })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T variant="body">Distance</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill label="km" active={uh.units.distance === 'km'} onPress={() => setUnit({ distance: 'km' })} />
            <Pill label="mi" active={uh.units.distance === 'mi'} onPress={() => setUnit({ distance: 'mi' })} />
          </View>
        </View>
      </Card></Reveal>

      <Reveal i={2}><Card style={{ gap: spacing.sm }}>
        <T variant="headline">Privacy</T>
        <T variant="body" secondary>No account, no ads, no analytics. Everything is stored on this device.</T>
        <Press onPress={wipe} style={{ paddingVertical: spacing.sm }}>
          <T variant="body" style={{ color: colors.danger, fontWeight: '600' }}>Delete all data</T>
        </Press>
      </Card></Reveal>
    </Screen>
  );
}
