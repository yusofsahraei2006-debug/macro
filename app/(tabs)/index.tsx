import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Press, Skeleton, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ActivityCard, CalorieCard, HydrationCard, MacroCard } from '@/components/dashboard/Cards';
import { useRouter } from 'expo-router';
import { useDiary } from '@/hooks/useDiary';
import { useExerciseCredit } from '@/hooks/useExerciseCredit';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { DashboardCardId } from '@/types';
import { friendlyDate } from '@/utils/date';
import { haptic } from '@/utils/haptics';

const NAMES: Record<DashboardCardId, string> = {
  calories: 'Calories',
  macros: 'Macros',
  hydration: 'Hydration',
  activity: 'Activity',
};

export default function Home() {
  const { colors } = useTheme();
  const d = useDiary();
  const router = useRouter();
  const credit = useExerciseCredit(d.date, d.goals);
  const [editing, setEditing] = useState(false);

  if (!d.ready) {
    return (
      <Screen>
        <Skeleton height={340} />
        <Skeleton height={190} />
        <Skeleton height={110} />
      </Screen>
    );
  }

  const move = (id: DashboardCardId, dir: -1 | 1) => {
    const order = [...d.prefs.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    haptic.select();
    d.savePrefs({ ...d.prefs, order });
  };
  const toggleHidden = (id: DashboardCardId) => {
    const hidden = d.prefs.hidden.includes(id) ? d.prefs.hidden.filter((x) => x !== id) : [...d.prefs.hidden, id];
    d.savePrefs({ ...d.prefs, hidden });
  };

  const render = (id: DashboardCardId) => {
    switch (id) {
      case 'calories': return <CalorieCard totals={d.totals} goals={d.goals} compact={d.prefs.compact} exerciseKcal={credit.eligible} />;
      case 'macros': return <MacroCard totals={d.totals} goals={d.goals} compact={d.prefs.compact} />;
      case 'hydration': return <HydrationCard ml={d.waterMl} goal={d.goals.waterMl} onAdd={d.addWater} />;
      case 'activity': return <ActivityCard goals={d.goals} onPress={() => router.navigate('/activity')} />;
    }
  };

  const visible = editing ? d.prefs.order : d.prefs.order.filter((id) => !d.prefs.hidden.includes(id));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <T variant="caption" secondary>{friendlyDate(d.date).toUpperCase()}</T>
          <T variant="largeTitle">Today</T>
        </View>
        <Press onPress={() => setEditing((e) => !e)} accessibilityLabel={editing ? 'Done customising' : 'Customise dashboard'}
          style={{ padding: spacing.sm }}>
          <T variant="body" accent style={{ fontWeight: '600' }}>{editing ? 'Done' : 'Customise'}</T>
        </Press>
      </View>

      {editing && (
        <Press onPress={() => d.savePrefs({ ...d.prefs, compact: !d.prefs.compact })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={d.prefs.compact ? 'rectangle.compress.vertical' : 'rectangle.expand.vertical'} size={16} color={colors.accent} />
          <T variant="body">{d.prefs.compact ? 'Compact view' : 'Expanded view'} · tap to switch</T>
        </Press>
      )}

      {visible.map((id, idx) => (
        <Animated.View key={id} entering={FadeInDown.delay(idx * 50).springify().damping(18)} layout={LinearTransition.springify().damping(20)}
          style={{ opacity: editing && d.prefs.hidden.includes(id) ? 0.4 : 1 }}>
          {editing && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <T variant="caption" secondary>{NAMES[id].toUpperCase()}</T>
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <Press onPress={() => move(id, -1)} accessibilityLabel={`Move ${NAMES[id]} up`}><Icon name="chevron.up" size={18} color={colors.accent} /></Press>
                <Press onPress={() => move(id, 1)} accessibilityLabel={`Move ${NAMES[id]} down`}><Icon name="chevron.down" size={18} color={colors.accent} /></Press>
                <Press onPress={() => toggleHidden(id)} accessibilityLabel={`${d.prefs.hidden.includes(id) ? 'Show' : 'Hide'} ${NAMES[id]}`}>
                  <Icon name={d.prefs.hidden.includes(id) ? 'eye.slash' : 'eye'} size={18} color={colors.accent} />
                </Press>
              </View>
            </View>
          )}
          {render(id)}
        </Animated.View>
      ))}
    </Screen>
  );
}
