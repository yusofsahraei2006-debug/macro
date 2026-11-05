import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card, Pill, Press, SectionHeader, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { BarChart } from '@/components/charts';
import { HEALTHKIT_BUILD } from '@/config';
import { useDiary } from '@/hooks/useDiary';
import { useHealth } from '@/hooks/useHealth';
import { useUnits } from '@/hooks/useUnits';
import { useExerciseCredit } from '@/hooks/useExerciseCredit';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { DayActivity } from '@/services/health/types';
import { Metric, averageOf, bestDay, formatDuration, goalHitRate, rangeFor, totalOf } from '@/services/health/aggregate';
import { addDays, fromDateKey, todayKey } from '@/utils/date';
import { progress } from '@/utils/nutrition';
import { haptic } from '@/utils/haptics';

const fmt = (n: number) => Math.round(n).toLocaleString();
type Range = 'day' | 'week' | 'month';

export default function Activity() {
  const { colors } = useTheme();
  const router = useRouter();
  const h = useHealth();
  const d = useDiary();
  const u = useUnits();
  const credit = useExerciseCredit(todayKey(), d.goals);
  const [range, setRange] = useState<Range>('week');
  const [metric, setMetric] = useState<Metric>('steps');
  const [days, setDays] = useState<DayActivity[]>([]);
  const [hourly, setHourly] = useState<number[]>([]);
  const [sel, setSel] = useState<number | undefined>();
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const connected = h.source !== 'none';
  const today = todayKey();

  const load = useCallback(async () => {
    if (!connected) { setDays([]); setHourly([]); return; }
    try {
      setLoadErr(null);
      if (range === 'day') {
        const b = await h.getHourly(today);
        const arr = Array(24).fill(0);
        b.forEach((x) => { arr[x.hour] = x.steps; });
        setHourly(arr);
      } else {
        const r = rangeFor(range, today);
        setDays(await h.getDaily(r.from, r.to));
      }
      setSel(undefined);
    } catch (e: any) {
      setLoadErr(String(e?.message ?? e));
    }
  }, [connected, range, h.getDaily, h.getHourly, today]);

  useEffect(() => { load(); }, [load, h.lastSync]);

  const metricMeta: Record<Metric, { label: string; unit: string; goal?: number; fmt: (v: number) => string }> = {
    steps: { label: 'Steps', unit: 'steps', goal: d.goals.steps, fmt: (v) => fmt(v) },
    distanceM: { label: 'Distance', unit: u.units.distance, fmt: (v) => (u.units.distance === 'km' ? (v / 1000).toFixed(1) : (v / 1609.344).toFixed(1)) },
    activeKcal: { label: 'Active kcal', unit: 'kcal', fmt: (v) => fmt(v) },
  };
  const meta = metricMeta[metric];
  const conv = (v: number) => (metric === 'distanceM' ? (u.units.distance === 'km' ? v / 1000 : v / 1609.344) : v);

  const chart = useMemo(() => {
    if (range === 'day') {
      return { values: hourly as (number | null)[], labels: hourly.map((_, i) => (i % 6 === 0 ? String(i) : '')), goal: undefined as number | undefined };
    }
    const vals = days.map((x) => (x[metric] === null ? null : conv(x[metric] as number)));
    const labels = days.map((x) => (range === 'week' ? fromDateKey(x.date).toLocaleDateString(undefined, { weekday: 'narrow' }) : String(fromDateKey(x.date).getDate())));
    return { values: vals, labels, goal: metric === 'steps' ? d.goals.steps : undefined };
  }, [range, hourly, days, metric, d.goals.steps, u.units.distance]);

  const t = h.today;
  const showStepsOnly = range === 'day';
  const selDay = sel !== undefined && range !== 'day' ? days[sel] : undefined;

  // ---------- Not connected / problem states ----------
  const problem = h.status === 'crash-recovered' || h.status === 'unavailable' || h.status === 'denied' || h.status === 'error' || h.status === 'no-data';

  const toggleExercise = () => {
    if (d.goals.includeExercise) { d.saveGoals({ ...d.goals, includeExercise: false }); return; }
    if (!connected) { Alert.alert('Connect a source first', 'Exercise adjustment needs real active-energy data from Apple Health.'); return; }
    Alert.alert(
      'Avoid counting exercise twice',
      'Your calorie goal may already include activity. Which is true for your goal?',
      [
        { text: 'It assumes I’m active', onPress: () => d.saveGoals({ ...d.goals, includeExercise: true, goalIncludesActivity: true }) },
        { text: 'It’s for a rest day', onPress: () => d.saveGoals({ ...d.goals, includeExercise: true, goalIncludesActivity: false, baselineActiveKcal: 0 }) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={h.refreshing} onRefresh={h.refresh} tintColor={colors.accent} />}>
      <T variant="largeTitle">Activity</T>

      {/* Connection */}
      {!connected && (
        <Card style={{ gap: spacing.md }}>
          <T variant="headline">Choose a step source</T>
          <T variant="body" secondary>
            Macro only shows real data. Pick where your steps, distance and active calories come from.
          </T>
          {HEALTHKIT_BUILD ? (
            <Source icon="heart.fill" title="Apple Health" body="Steps, distance, active energy, workouts and weight, with full history." onPress={() => h.connectSource('healthkit')} busy={h.status === 'connecting'} />
          ) : (
            <T variant="caption" secondary>
              Apple Health is not included in this build (it needs the HealthKit entitlement, which free Apple ID sideloading usually cannot provide).
            </T>
          )}
          <Source icon="iphone" title="Phone motion" body="Steps and walking distance from this iPhone’s motion coprocessor. About the last 7 days; older days are kept once Macro has seen them. No workouts or active calories." onPress={() => h.connectSource('motion')} busy={h.status === 'connecting'} />
        </Card>
      )}

      {problem && (
        <Card style={{ gap: spacing.sm, borderColor: h.status === 'no-data' ? colors.border : colors.danger }}>
          <T variant="headline">
            {h.status === 'crash-recovered' ? 'Apple Health was switched off'
              : h.status === 'denied' ? 'Access denied'
              : h.status === 'unavailable' ? 'Not available'
              : h.status === 'no-data' ? 'No data yet' : 'Something went wrong'}
          </T>
          {h.message ? <T variant="body" secondary>{h.message}</T> : null}
          {(h.status === 'denied' || h.status === 'no-data') && (
            <Press onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start' }}>
              <T variant="body" accent style={{ fontWeight: '600' }}>Open Settings</T>
            </Press>
          )}
        </Card>
      )}

      {connected && (
        <>
          {/* Today */}
          <Card style={{ alignItems: 'center', gap: spacing.md }}>
            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
              <T variant="headline">Today</T>
              <T variant="caption" secondary>{h.source === 'healthkit' ? 'Apple Health' : 'Phone motion'}{h.lastSync ? ` · ${new Date(h.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</T>
            </View>
            <Ring progress={progress(t?.steps ?? 0, d.goals.steps)} size={170} stroke={14} color={colors.accent}>
              <T variant="title">{fmt(t?.steps ?? 0)}</T>
              <T variant="caption" secondary>of {fmt(d.goals.steps)} steps</T>
            </Ring>
            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-around' }}>
              <Mini label="Distance" value={t?.distanceM != null ? u.distanceLabel(t.distanceM) : '—'} />
              <Mini label="Active kcal" value={t?.activeKcal != null ? fmt(t.activeKcal) : '—'} />
            </View>
            {h.source === 'motion' && <T variant="caption" secondary style={{ textAlign: 'center' }}>Phone motion does not provide active calories or workouts.</T>}
          </Card>

          {/* Charts */}
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['day', 'week', 'month'] as Range[]).map((r) => (
                <Pill key={r} label={r === 'day' ? 'Day' : r === 'week' ? 'Week' : 'Month'} active={range === r} onPress={() => { haptic.select(); setRange(r); }} />
              ))}
            </View>
            {!showStepsOnly && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(metricMeta) as Metric[])
                  .filter((m) => (m === 'activeKcal' ? h.backend?.capabilities.activeEnergy : m === 'distanceM' ? h.backend?.capabilities.distance : true))
                  .map((m) => <Pill key={m} label={metricMeta[m].label} active={metric === m} onPress={() => { haptic.select(); setMetric(m); setSel(undefined); }} />)}
              </View>
            )}
            {loadErr ? <T variant="body" secondary>Couldn’t load: {loadErr}</T> : (
              <>
                <BarChart
                  values={chart.values} labels={chart.labels} goal={chart.goal}
                  selected={sel} onSelect={range === 'day' ? undefined : (i) => { haptic.select(); setSel(i); }}
                  formatValue={(v) => (showStepsOnly ? fmt(v) : meta.fmt(v))}
                  summary={`${showStepsOnly ? 'Steps by hour' : meta.label} chart`}
                />
                {selDay && (
                  <T variant="body">
                    <T variant="body" style={{ fontWeight: '700' }}>{fromDateKey(selDay.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</T>
                    {': '}{selDay[metric] === null ? 'no data' : `${meta.fmt(conv(selDay[metric] as number))} ${meta.unit}`}
                  </T>
                )}
                {range === 'day' && hourly.every((x) => x === 0) && <T variant="caption" secondary>No hourly steps recorded yet today.</T>}
                {range !== 'day' && <Summary days={days} metric={metric} goal={d.goals.steps} fmtV={(v) => meta.fmt(conv(v))} unit={meta.unit} />}
              </>
            )}
          </Card>

          {/* Exercise adjustment */}
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <T variant="headline">Add exercise to calorie budget</T>
                <T variant="caption" secondary>Credits only active energy, never resting energy.</T>
              </View>
              <Pill label={d.goals.includeExercise ? 'On' : 'Off'} active={d.goals.includeExercise} onPress={toggleExercise} />
            </View>
            {d.goals.includeExercise && (
              <>
                <T variant="caption" secondary>Credit back</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[50, 75, 100].map((p) => <Pill key={p} label={`${p}%`} active={d.goals.exerciseCreditPct === p} onPress={() => d.saveGoals({ ...d.goals, exerciseCreditPct: p })} />)}
                </View>
                {d.goals.goalIncludesActivity && (
                  <>
                    <T variant="caption" secondary>Usual daily active kcal already in your goal (not credited)</T>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[0, 100, 200, 300, 400, 500].map((b) => <Pill key={b} label={String(b)} active={d.goals.baselineActiveKcal === b} onPress={() => d.saveGoals({ ...d.goals, baselineActiveKcal: b })} />)}
                    </View>
                  </>
                )}
                <T variant="body">
                  Today: {t?.activeKcal != null ? `${fmt(t.activeKcal)} active kcal` : 'no active-energy data'} → <T variant="body" accent style={{ fontWeight: '700' }}>+{fmt(credit.eligible)} kcal</T> added
                </T>
                {h.source === 'motion' && <T variant="caption" secondary>Phone motion has no active energy, so nothing is added with this source.</T>}
              </>
            )}
          </Card>

          {/* Workouts */}
          {h.backend?.capabilities.workouts && (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title="Workouts · last 30 days" />
              {h.workouts.length === 0 ? (
                <Card><T variant="body" secondary>No workouts recorded in Apple Health for the last 30 days.</T></Card>
              ) : h.workouts.slice(0, 15).map((w) => (
                <Card key={w.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T variant="headline">{w.type}</T>
                    <T variant="caption" secondary>{new Date(w.startMs).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</T>
                  </View>
                  <T variant="body" secondary>
                    {formatDuration(w.durationMin)}
                    {w.kcal != null ? ` · ${fmt(w.kcal)} kcal` : ''}
                    {w.distanceM != null ? ` · ${u.distanceLabel(w.distanceM)}` : ''}
                  </T>
                </Card>
              ))}
            </View>
          )}

          <Press onPress={() => Alert.alert('Disconnect step source?', 'Stored history stays on this phone. You can reconnect any time.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: h.disconnect },
          ])} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <T variant="caption" secondary>Disconnect {h.source === 'healthkit' ? 'Apple Health' : 'phone motion'}</T>
          </Press>
        </>
      )}

      {/* Body & water: always available, stored on this phone */}
      <SectionHeader title="Body & water" />
      <NavRow icon="scalemass.fill" title="Weight" sub="Log, trend and goal progress" onPress={() => router.push('/weight')} />
      <NavRow icon="ruler.fill" title="Measurements" sub="Waist, chest, arms, hips and more" onPress={() => router.push('/measurements')} />
      <NavRow icon="drop.fill" title="Water history" sub="Daily totals and goal" onPress={() => router.push('/water-history')} />
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <T variant="headline">{value}</T>
      <T variant="caption" secondary>{label}</T>
    </View>
  );
}

function Summary({ days, metric, goal, fmtV, unit }: { days: DayActivity[]; metric: Metric; goal: number; fmtV: (v: number) => string; unit: string }) {
  const a = averageOf(days, metric);
  const best = bestDay(days, metric);
  const hit = metric === 'steps' ? goalHitRate(days, 'steps', goal) : null;
  if (a === null) return <T variant="caption" secondary>No data for this period yet.</T>;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Mini label="Daily average" value={`${fmtV(a)}`} />
      <Mini label="Total" value={fmtV(totalOf(days, metric))} />
      {best && <Mini label="Best day" value={fmtV((best[metric] as number) ?? 0)} />}
      {hit !== null && <Mini label="Goal days" value={`${Math.round(hit * 100)}%`} />}
    </View>
  );
}

function Source({ icon, title, body, onPress, busy }: { icon: any; title: string; body: string; onPress: () => void; busy: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={busy ? undefined : onPress} style={{ flexDirection: 'row', gap: 12, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.elevated, opacity: busy ? 0.6 : 1 }}>
      <Icon name={icon} size={22} color={colors.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="headline">{busy ? 'Connecting…' : title}</T>
        <T variant="caption" secondary>{body}</T>
      </View>
    </Press>
  );
}

function NavRow({ icon, title, sub, onPress }: { icon: any; title: string; sub: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name={icon} size={20} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <T variant="headline">{title}</T>
          <T variant="caption" secondary>{sub}</T>
        </View>
        <Icon name="chevron.right" size={14} color={colors.textSecondary} />
      </Card>
    </Press>
  );
}
