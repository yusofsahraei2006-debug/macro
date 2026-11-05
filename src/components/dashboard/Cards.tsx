import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Press, T } from '@/components/ui';
import { Ring } from '@/components/Ring';
import { Bar } from '@/components/Bar';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { Goals } from '@/types';
import { useHealth } from '@/hooks/useHealth';
import { useUnits } from '@/hooks/useUnits';
import { Macros, progress, remainingCalories, round0 } from '@/utils/nutrition';

const fmt = (n: number) => Math.round(n).toLocaleString();

export function CalorieCard({ totals, goals, compact, exerciseKcal = 0 }: { totals: Macros; goals: Goals; compact: boolean; exerciseKcal?: number }) {
  const { colors } = useTheme();
  // exerciseKcal is already 0 unless the user enabled adjustment AND a real source reported active energy.
  const remaining = remainingCalories(goals.calories, totals.kcal, exerciseKcal, exerciseKcal > 0);
  const over = remaining < 0;
  const size = compact ? 150 : 214;

  return (
    <Card style={{ alignItems: 'center' }}>
      <View style={[styles.rowBetween, { width: '100%' }]}>
        <T variant="headline">Calories</T>
        <T variant="caption" secondary>Goal {fmt(goals.calories)} kcal</T>
      </View>
      <View style={{ marginVertical: spacing.lg }}>
        <Ring progress={progress(totals.kcal, goals.calories + exerciseKcal)} size={size} stroke={compact ? 12 : 16} color={over ? colors.danger : colors.accent}>
          <T variant={compact ? 'title' : 'metric'} accessibilityLabel={`${fmt(Math.abs(remaining))} calories ${over ? 'over' : 'remaining'}`}>
            {fmt(Math.abs(remaining))}
          </T>
          <T variant="caption" secondary>{over ? 'kcal over' : 'kcal remaining'}</T>
        </Ring>
      </View>
      <View style={[styles.rowBetween, { width: '100%' }]}>
        <Stat label="Consumed" value={fmt(totals.kcal)} />
        <Stat label="Goal" value={fmt(goals.calories)} />
        {exerciseKcal > 0 && <Stat label="Exercise" value={`+${fmt(exerciseKcal)}`} />}
        <Stat label={over ? 'Over' : 'Left'} value={fmt(Math.abs(remaining))} accent={!over} />
      </View>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T variant="metricSmall" accent={accent}>{value}</T>
      <T variant="caption" secondary>{label}</T>
    </View>
  );
}

export function MacroCard({ totals, goals, compact }: { totals: Macros; goals: Goals; compact: boolean }) {
  const { colors } = useTheme();
  const rows = [
    { label: 'Protein', v: totals.protein, g: goals.protein, color: colors.protein },
    { label: 'Carbs', v: totals.carbs, g: goals.carbs, color: colors.carbs },
    { label: 'Fat', v: totals.fat, g: goals.fat, color: colors.fat },
  ];
  return (
    <Card style={{ gap: compact ? spacing.md : spacing.lg }}>
      <T variant="headline">Macros</T>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 6 }}>
          <View style={styles.rowBetween}>
            <T variant="body" style={{ fontWeight: '600' }}>{r.label}</T>
            <T variant="body" secondary>
              <T variant="body">{round0(r.v)}</T> / {r.g} g
            </T>
          </View>
          <Bar progress={progress(r.v, r.g)} color={r.color} />
          {!compact && (
            <T variant="caption" secondary>
              {Math.max(0, round0(r.g - r.v))} g remaining
            </T>
          )}
        </View>
      ))}
    </Card>
  );
}

export function HydrationCard({
  ml, goal, onAdd,
}: { ml: number; goal: number; onAdd: (ml: number) => void }) {
  const { colors } = useTheme();
  const left = Math.max(0, goal - ml);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Icon name="drop.fill" size={18} color={colors.water} />
          <T variant="headline">Hydration</T>
        </View>
        <Press onPress={() => onAdd(250)} accessibilityLabel="Add 250 millilitres of water" style={[styles.quickAdd, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={14} color={colors.accentText} weight="bold" />
          <T variant="caption" style={{ color: colors.accentText, fontWeight: '700' }}>250 ml</T>
        </Press>
      </View>
      <Bar progress={progress(ml, goal)} color={colors.water} height={10} />
      <View style={styles.rowBetween}>
        <T variant="body"><T variant="body" style={{ fontWeight: '700' }}>{(ml / 1000).toFixed(2)}</T> / {(goal / 1000).toFixed(1)} L</T>
        <T variant="caption" secondary>{(left / 1000).toFixed(2)} L to go</T>
      </View>
    </Card>
  );
}

export function ActivityCard({ goals, onPress }: { goals: Goals; onPress?: () => void }) {
  const { colors } = useTheme();
  const h = useHealth();
  const { units, distanceLabel } = useUnits();
  const t = h.today;
  const connected = h.source !== 'none' && t;
  return (
    <Press onPress={onPress} accessibilityLabel="Open activity">
      <Card style={{ gap: spacing.sm }}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon name="figure.walk" size={18} color={colors.accent} />
            <T variant="headline">Activity</T>
          </View>
          <T variant="caption" secondary>Goal {fmt(goals.steps)} steps</T>
        </View>
        {connected ? (
          <>
            <Bar progress={progress(t!.steps ?? 0, goals.steps)} color={colors.accent} height={10} />
            <View style={styles.rowBetween}>
              <T variant="body"><T variant="body" style={{ fontWeight: '700' }}>{fmt(t!.steps ?? 0)}</T> steps</T>
              <T variant="caption" secondary>
                {t!.distanceM != null ? distanceLabel(t!.distanceM) : '— ' + units.distance}
                {t!.activeKcal != null ? ` · ${fmt(t!.activeKcal)} active kcal` : ''}
              </T>
            </View>
          </>
        ) : (
          <T variant="body" secondary>Connect a step source on the Activity tab to see steps, distance and active calories.</T>
        )}
      </Card>
    </Press>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
});
