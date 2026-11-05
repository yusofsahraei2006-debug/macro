import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { AnimatedNumber } from '@/components/motion';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { MEALS, MealType } from '@/types';
import { Food, foodMacros } from '@/types/food';
import { round0, round1, scale, sum } from '@/utils/nutrition';
import { defaultMeal, parseDecimal } from '@/utils/meal';
import { haptic } from '@/utils/haptics';
import { ParsedItem, baseQuantityFor, parseMealText } from '@/services/mealParser';
import { findCandidates } from '@/services/mealResolve';
import { setPickHandler } from '@/services/picker';
import * as foodRepo from '@/db/foodRepo';
import * as repo from '@/db/repositories';

type Row = {
  key: string;
  item: ParsedItem;
  candidates: Food[];
  idx: number;
  qty: string;
  estimated: boolean;
  note: string;
  error: string | null;
  showOptions: boolean;
};

const servKey = (id?: number) => `servingSize:${id}`;

async function quantityRow(item: ParsedItem, food: Food) {
  const remembered = food.id ? parseDecimal((await repo.getRaw(servKey(food.id))) ?? '') : null;
  return baseQuantityFor(item, food, remembered && remembered > 0 ? remembered : null);
}

/** Describe a meal in words (typed or dictated with the keyboard mic); each part is matched to a real food. */
export default function DescribeMeal() {
  const { colors } = useTheme();
  const router = useRouter();
  const d = useDiary();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'input' | 'working' | 'review'>('input');
  const [rows, setRows] = useState<Row[]>([]);
  const [meal, setMeal] = useState<MealType>((params.meal as MealType) || defaultMeal());
  const [saving, setSaving] = useState(false);

  const calculate = async () => {
    const items = parseMealText(text);
    if (!items.length) { Alert.alert('Nothing to calculate', 'Describe what you ate, e.g. “3 eggs, 2 slices of toast and a latte”.'); return; }
    haptic.press();
    setPhase('working');
    const built = await Promise.all(items.map(async (item, i): Promise<Row> => {
      const r = await findCandidates(item.name);
      const food = r.foods[0];
      const q = food ? await quantityRow(item, food) : { qty: 0, estimated: false, note: '' };
      return {
        key: `${i}-${item.name}`, item, candidates: r.foods, idx: 0, qty: food ? String(round1(q.qty)) : '',
        estimated: q.estimated, note: q.note, error: food ? null : r.error ?? `No match found for “${item.name}”.`, showOptions: false,
      };
    }));
    setRows(built);
    setPhase('review');
    haptic.success();
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const choose = async (row: Row, idx: number) => {
    const food = row.candidates[idx];
    const q = await quantityRow(row.item, food);
    haptic.select();
    update(row.key, { idx, qty: String(round1(q.qty)), estimated: q.estimated, note: q.note, showOptions: false, error: null });
  };

  const searchFor = (row: Row) => {
    setPickHandler(async (f: Food) => {
      const q = await quantityRow(row.item, f);
      setRows((rs) => rs.map((r) => (r.key === row.key
        ? { ...r, candidates: [f, ...r.candidates.filter((c) => c !== f)], idx: 0, qty: String(round1(q.qty)), estimated: q.estimated, note: q.note, error: null, showOptions: false }
        : r)));
    });
    router.push({ pathname: '/search', params: { pick: '1' } });
  };

  const active = rows.filter((r) => r.candidates[r.idx] && (parseDecimal(r.qty) ?? 0) > 0);
  const rowMacros = (r: Row) => scale(foodMacros(r.candidates[r.idx]), parseDecimal(r.qty) ?? 0);
  const totals = sum(active.map(rowMacros));

  const addAll = async () => {
    if (!active.length || saving) return;
    setSaving(true);
    try {
      for (const r of active) {
        const saved = r.candidates[r.idx].id ? r.candidates[r.idx] : await foodRepo.upsertRemoteFood(r.candidates[r.idx]);
        const q = parseDecimal(r.qty) as number;
        await d.addEntry({
          date: d.date, meal, foodId: saved.id ?? null, name: saved.name, brand: saved.brand ?? null,
          quantity: q, unit: saved.unit,
          kcalPerUnit: saved.kcalPerUnit, proteinPerUnit: saved.proteinPerUnit, carbsPerUnit: saved.carbsPerUnit, fatPerUnit: saved.fatPerUnit,
        });
        // "3 eggs" logged as 150 g -> remember 50 g per egg for next time
        const weighed = saved.unit === 'g' || saved.unit === 'ml';
        if (weighed && saved.id && r.item.count && !r.item.countUnit && !r.item.amount) {
          await repo.setRaw(servKey(saved.id), String(round1(q / r.item.count)));
        }
      }
      haptic.success();
      router.dismissAll?.();
      router.navigate('/diary');
    } catch {
      Alert.alert('Could not save', 'Something went wrong writing to the diary. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputBox = (
    <Card style={{ gap: spacing.md }}>
      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus={phase === 'input'}
        multiline
        placeholder="e.g. 3 eggs, 2 slices of toast with butter and a latte"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Describe what you ate"
        style={{ minHeight: 96, color: colors.text, fontSize: 18, lineHeight: 25, textAlignVertical: 'top' }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="mic.fill" size={14} color={colors.accent} />
        <T variant="caption" secondary style={{ flex: 1 }}>To speak instead, tap the microphone on your keyboard.</T>
      </View>
    </Card>
  );

  return (
    <Screen>
      <Header title="Describe a meal" />

      {phase !== 'review' ? (
        <>
          {inputBox}
          <Press onPress={phase === 'working' ? undefined : calculate}
            style={{ backgroundColor: text.trim() ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <Icon name={phase === 'working' ? 'hourglass' : 'sparkles'} size={18} color={text.trim() ? colors.accentText : colors.textSecondary} />
            <T variant="headline" style={{ color: text.trim() ? colors.accentText : colors.textSecondary }}>
              {phase === 'working' ? 'Matching foods…' : 'Calculate'}
            </T>
          </Press>
          <T variant="caption" secondary>
            Each part is matched to a real food from your saved foods, USDA and Open Food Facts. Amounts like “3 eggs” use typical
            portion sizes; you can check and change everything before it is logged.
          </T>
        </>
      ) : (
        <>
          <Animated.View entering={FadeInDown.springify().damping(16)}>
            <Card style={{ alignItems: 'center', gap: spacing.sm }}>
              <T variant="caption" secondary style={{ letterSpacing: 1.5 }}>MEAL TOTAL</T>
              <AnimatedNumber variant="metric" accent value={totals.kcal} />
              <T variant="caption" secondary>kcal</T>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: spacing.sm }}>
                {([['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([l, v]) => (
                  <View key={l} style={{ alignItems: 'center' }}>
                    <AnimatedNumber variant="metricSmall" value={v} format={(x) => `${round1(x)} g`} />
                    <T variant="caption" secondary>{l}</T>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>

          {rows.map((r, i) => {
            const food = r.candidates[r.idx];
            const m = food ? rowMacros(r) : null;
            return (
              <Animated.View key={r.key} entering={FadeInDown.delay(80 + i * 70).springify().damping(16)} exiting={FadeOut} layout={LinearTransition.springify()}>
                <Card style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <T variant="caption" secondary>“{r.item.raw}”</T>
                      <T variant="headline" numberOfLines={2}>{food ? food.name : 'No match'}</T>
                      {food?.brand ? <T variant="caption" secondary numberOfLines={1}>{food.brand}</T> : null}
                    </View>
                    <Press onPress={() => { haptic.tap(); setRows((rs) => rs.filter((x) => x.key !== r.key)); }} accessibilityLabel="Remove item" hitSlop={10}>
                      <Icon name="xmark.circle.fill" size={22} color={colors.textSecondary} />
                    </Press>
                  </View>

                  {food ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <TextInput
                          value={r.qty} onChangeText={(v) => update(r.key, { qty: v, estimated: false })}
                          keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel={`Amount in ${food.unit}`}
                          style={{ width: 100, color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 17, fontWeight: '700' }}
                        />
                        <T variant="body" secondary>{food.unit}</T>
                        {r.estimated ? (
                          <View style={{ marginLeft: 'auto', backgroundColor: colors.accent + '22', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <T variant="caption" accent style={{ fontWeight: '700' }}>Estimate</T>
                          </View>
                        ) : null}
                      </View>
                      <T variant="caption" secondary>{r.note}</T>
                      {m ? <T variant="body">{round0(m.kcal)} kcal · {round1(m.protein)} P · {round1(m.carbs)} C · {round1(m.fat)} F</T> : null}
                      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                        {r.candidates.length > 1 ? <Pill label={r.showOptions ? 'Hide matches' : `Other matches (${r.candidates.length - 1})`} onPress={() => update(r.key, { showOptions: !r.showOptions })} /> : null}
                        <Pill label="Search" onPress={() => searchFor(r)} />
                      </View>
                      {r.showOptions ? (
                        <View style={{ gap: 4 }}>
                          {r.candidates.map((c, ci) => ci === r.idx ? null : (
                            <Press key={ci} onPress={() => choose(r, ci)} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                              <T variant="body" numberOfLines={1}>{c.name}</T>
                              <T variant="caption" secondary numberOfLines={1}>{c.brand ? `${c.brand} · ` : ''}{round0(c.kcalPerUnit * (c.unit === 'g' || c.unit === 'ml' ? 100 : 1))} kcal per {c.unit === 'g' || c.unit === 'ml' ? `100 ${c.unit}` : `1 ${c.unit}`} · {c.source === 'usda' ? 'USDA' : c.source === 'openfoodfacts' ? 'Open Food Facts' : 'Saved'}</T>
                            </Press>
                          ))}
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <T variant="body" secondary>{r.error}</T>
                      <Pill label="Search for it" onPress={() => searchFor(r)} />
                    </>
                  )}
                </Card>
              </Animated.View>
            );
          })}

          <Card style={{ gap: spacing.md }}>
            <T variant="headline">Meal</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {MEALS.map((x) => <Pill key={x.key} label={x.label} active={meal === x.key} onPress={() => { haptic.select(); setMeal(x.key); }} />)}
            </View>
          </Card>

          <Press onPress={addAll} style={{ backgroundColor: active.length ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
            <T variant="headline" style={{ color: active.length ? colors.accentText : colors.textSecondary }}>
              {saving ? 'Saving…' : active.length ? `Add ${active.length} item${active.length === 1 ? '' : 's'} to ${MEALS.find((x) => x.key === meal)?.label}` : 'Nothing to add'}
            </T>
          </Press>
          <Press onPress={() => { setPhase('input'); setRows([]); }} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <T variant="body" accent style={{ fontWeight: '600' }}>Edit description</T>
          </Press>
        </>
      )}
    </Screen>
  );
}
