import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Card, Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { DiaryEntry, MEALS, MealType } from '@/types';
import { addDays, friendlyDate } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { round0, sum } from '@/utils/nutrition';
import * as repo from '@/db/repositories';

export default function Diary() {
  const { colors } = useTheme();
  const router = useRouter();
  const d = useDiary();

  const copyYesterday = async () => {
    const from = addDays(d.date, -1);
    await repo.copyDay(from, d.date);
    await d.refresh();
    haptic.success();
  };

  const entryActions = (e: DiaryEntry) => {
    const others = MEALS.filter((m) => m.key !== e.meal);
    Alert.alert(e.name, `${round0(d.entryMacros(e).kcal)} kcal`, [
      { text: 'Edit amount', onPress: () => router.push({ pathname: '/log', params: { entryId: String(e.id) } }) },
      { text: 'Duplicate', onPress: () => d.duplicate(e.id) },
      ...others.map((m) => ({
        text: `Move to ${m.label}`,
        onPress: async () => { await repo.moveEntry(e.id, m.key); await d.refresh(); },
      })),
      { text: 'Delete', style: 'destructive' as const, onPress: () => { haptic.warning(); d.removeEntry(e.id); } },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Press onPress={() => d.shiftDate(-1)} accessibilityLabel="Previous day" style={{ padding: spacing.sm }}>
          <Icon name="chevron.left" size={20} color={colors.accent} />
        </Press>
        <View style={{ alignItems: 'center' }}>
          <T variant="title">{friendlyDate(d.date)}</T>
          <T variant="caption" secondary>{round0(d.totals.kcal)} kcal · {round0(d.totals.protein)} g protein</T>
        </View>
        <Press onPress={() => d.shiftDate(1)} accessibilityLabel="Next day" style={{ padding: spacing.sm }}>
          <Icon name="chevron.right" size={20} color={colors.accent} />
        </Press>
      </View>

      {MEALS.map((m, idx) => {
        const items = d.entries.filter((e) => e.meal === m.key);
        const t = sum(items.map(d.entryMacros));
        return (
          <Animated.View key={m.key} entering={FadeInDown.delay(idx * 40).springify().damping(18)} layout={LinearTransition.springify()}>
            <Card style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name={m.icon as any} size={16} color={colors.accent} />
                  <T variant="headline">{m.label}</T>
                </View>
                <T variant="caption" secondary>{round0(t.kcal)} kcal · {round0(t.protein)} g P</T>
              </View>

              {items.map((e) => {
                const mac = d.entryMacros(e);
                return (
                  <Press key={e.id} onPress={() => entryActions(e)} haptics={false}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <T variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{e.name}</T>
                      <T variant="caption" secondary>{e.quantity} {e.unit}{e.brand ? ` · ${e.brand}` : ''}</T>
                    </View>
                    <T variant="body">{round0(mac.kcal)}</T>
                  </Press>
                );
              })}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingTop: 4 }}>
                <Press onPress={() => router.push({ pathname: '/search', params: { meal: m.key as MealType } })}
                  accessibilityLabel={`Add food to ${m.label}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="plus.circle.fill" size={18} color={colors.accent} />
                  <T variant="body" accent style={{ fontWeight: '600' }}>Add food</T>
                </Press>
                <Press onPress={() => router.push({ pathname: '/quick-add', params: { meal: m.key as MealType, date: d.date } })}
                  accessibilityLabel={`Quick add calories to ${m.label}`}>
                  <T variant="body" secondary style={{ fontWeight: '600' }}>Quick add</T>
                </Press>
              </View>
            </Card>
          </Animated.View>
        );
      })}

      <Press onPress={copyYesterday} accessibilityLabel="Copy yesterday's meals"
        style={{ alignItems: 'center', padding: spacing.md }}>
        <T variant="body" accent style={{ fontWeight: '600' }}>Copy yesterday’s meals</T>
      </Press>
    </Screen>
  );
}
