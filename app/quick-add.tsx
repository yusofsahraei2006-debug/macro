import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card, Press, T } from '@/components/ui';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { MealType } from '@/types';
import { haptic } from '@/utils/haptics';

/** Minimal manual entry so the diary is usable in Phase 1. Full search/scan/custom foods arrive in Phase 2. */
export default function QuickAdd() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addEntry } = useDiary();
  const { meal, date } = useLocalSearchParams<{ meal: MealType; date: string }>();

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const num = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const valid = name.trim().length > 0 && num(kcal) > 0;

  const save = async () => {
    if (!valid) return;
    // One serving: base values are per 1 serving, quantity starts at 1.
    await addEntry({
      date, meal, foodId: null, name: name.trim(), brand: null,
      quantity: 1, unit: 'serving',
      kcalPerUnit: num(kcal), proteinPerUnit: num(protein), carbsPerUnit: num(carbs), fatPerUnit: num(fat),
    });
    haptic.success();
    router.back();
  };

  const field = (label: string, value: string, set: (s: string) => void, numeric = true) => (
    <View style={{ gap: 6 }}>
      <T variant="caption" secondary>{label}</T>
      <TextInput
        value={value}
        onChangeText={set}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={colors.textSecondary}
        style={{
          color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md,
          paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17,
        }}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <Screen>
      <T variant="largeTitle">Quick add</T>
      <Card style={{ gap: spacing.md }}>
        {field('Food name', name, setName, false)}
        {field('Calories (kcal)', kcal, setKcal)}
        {field('Protein (g)', protein, setProtein)}
        {field('Carbohydrates (g)', carbs, setCarbs)}
        {field('Fat (g)', fat, setFat)}
      </Card>
      <Press onPress={save} style={{ backgroundColor: valid ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' }}>
        <T variant="headline" style={{ color: valid ? colors.accentText : colors.textSecondary }}>Add to diary</T>
      </Press>
      <Press onPress={() => router.back()} style={{ alignItems: 'center', padding: spacing.md }}>
        <T variant="body" secondary>Cancel</T>
      </Press>
    </Screen>
  );
}
