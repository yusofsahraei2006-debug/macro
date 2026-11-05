import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { MEALS, MealType } from '@/types';
import { SavedMeal } from '@/types/food';
import { round0 } from '@/utils/nutrition';
import { mealTotals } from '@/utils/mealTotals';
import { defaultMeal } from '@/utils/meal';
import { haptic } from '@/utils/haptics';
import * as foodRepo from '@/db/foodRepo';

export default function Meals() {
  const { colors } = useTheme();
  const router = useRouter();
  const d = useDiary();
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [slot, setSlot] = useState<MealType>(defaultMeal());
  const [loggedId, setLoggedId] = useState<number | null>(null);

  const load = useCallback(async () => setMeals(await foodRepo.listSavedMeals()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const log = async (m: SavedMeal) => {
    if (!m.items.length) return;
    await foodRepo.logSavedMeal(m, d.date, slot);
    await d.refresh(); // totals update immediately
    haptic.success();
    setLoggedId(m.id);
    setTimeout(() => setLoggedId((cur) => (cur === m.id ? null : cur)), 2200);
  };

  const remove = (m: SavedMeal) =>
    Alert.alert(`Delete “${m.name}”?`, 'Entries already logged in your diary are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await foodRepo.deleteMeal(m.id); haptic.warning(); load(); } },
    ]);

  return (
    <Screen>
      <Header title="Saved meals" />
      <View style={{ gap: spacing.sm }}>
        <T variant="caption" secondary>LOG TO</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MEALS.map((m) => <Pill key={m.key} label={m.label} active={slot === m.key} onPress={() => { haptic.select(); setSlot(m.key); }} />)}
        </View>
      </View>

      {meals.length === 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <T variant="headline">No saved meals yet</T>
          <T variant="body" secondary>Combine several foods, like chicken, rice and vegetables, into one meal you can log in a single tap.</T>
        </Card>
      ) : null}

      {meals.map((m) => {
        const t = mealTotals(m);
        const justLogged = loggedId === m.id;
        return (
          <Card key={m.id} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <T variant="headline" numberOfLines={2}>{m.name}</T>
                <T variant="caption" secondary>
                  {m.items.length} item{m.items.length === 1 ? '' : 's'} · {round0(t.kcal)} kcal · {round0(t.protein)} g P · {round0(t.carbs)} g C · {round0(t.fat)} g F
                </T>
              </View>
              <Press onPress={() => log(m)} accessibilityLabel={`Log ${m.name} to ${slot}`}
                style={{ backgroundColor: justLogged ? colors.success : colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 9 }}>
                <T variant="body" style={{ color: colors.accentText, fontWeight: '700' }}>{justLogged ? 'Logged' : 'Log'}</T>
              </Press>
            </View>
            <T variant="caption" secondary numberOfLines={2}>{m.items.map((i) => `${i.food.name} ${i.quantity}${i.food.unit === 'g' || i.food.unit === 'ml' ? i.food.unit : ' ' + i.food.unit}`).join(' · ')}</T>
            <View style={{ flexDirection: 'row', gap: spacing.xl, paddingTop: 4 }}>
              <Press onPress={() => router.push({ pathname: '/meal-edit', params: { id: String(m.id) } })} accessibilityLabel={`Edit ${m.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="pencil" size={14} color={colors.accent} /><T variant="caption" accent>Edit</T></View>
              </Press>
              <Press onPress={async () => { await foodRepo.duplicateMeal(m.id); haptic.success(); load(); }} accessibilityLabel={`Duplicate ${m.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="plus.square.on.square" size={14} color={colors.accent} /><T variant="caption" accent>Duplicate</T></View>
              </Press>
              <Press onPress={() => remove(m)} accessibilityLabel={`Delete ${m.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="trash" size={14} color={colors.danger} /><T variant="caption" style={{ color: colors.danger }}>Delete</T></View>
              </Press>
            </View>
          </Card>
        );
      })}

      <Press onPress={() => router.push('/meal-edit')}
        style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
        <T variant="headline" style={{ color: colors.accentText }}>New saved meal</T>
      </Press>
    </Screen>
  );
}
