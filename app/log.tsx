import React, { useEffect, useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useDiary } from '@/hooks/useDiary';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { MEALS, MealType } from '@/types';
import { Food, foodMacros, isMassOrVolume } from '@/types/food';
import { round0, round1, scale } from '@/utils/nutrition';
import { defaultMeal, parseDecimal } from '@/utils/meal';
import { haptic } from '@/utils/haptics';
import * as foodRepo from '@/db/foodRepo';
import * as repo from '@/db/repositories';

const MAX_QTY = 10000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Log a food (or edit an already-logged entry): choose quantity + meal, see live macros, add to diary. */
export default function LogFood() {
  const { colors } = useTheme();
  const router = useRouter();
  const d = useDiary();
  const params = useLocalSearchParams<{ food?: string; meal?: string; entryId?: string }>();

  const editing = params.entryId ? d.entries.find((e) => e.id === Number(params.entryId)) : undefined;

  const initialFood = useMemo<Food | null>(() => {
    if (editing) return foodRepo.entryToFood(editing);
    try { return params.food ? (JSON.parse(params.food) as Food) : null; } catch { return null; }
  }, [params.food, editing]);

  const [food, setFood] = useState<Food | null>(initialFood);
  const [meal, setMeal] = useState<MealType>((editing?.meal ?? (params.meal as MealType)) || defaultMeal());
  const [qty, setQty] = useState(() => {
    if (editing) return String(editing.quantity);
    return String(initialFood?.servingQty ?? 100);
  });
  const [busy, setBusy] = useState(false);
  // Servings mode: the user says "5 servings" and we store grams. 1 serving = servSize (g or ml), remembered per food.
  const [mode, setMode] = useState<'unit' | 'serv'>('unit');
  const [servSize, setServSize] = useState(String(initialFood?.servingQty ?? 100));
  const servKey = (id?: number) => `servingSize:${id}`;

  useEffect(() => {
    (async () => {
      const f = initialFood;
      if (!f || !isMassOrVolume(f.unit)) return;
      const remembered = f.id ? parseDecimal((await repo.getRaw(servKey(f.id))) ?? '') : null;
      const size = remembered ?? (f.servingQty !== 100 ? f.servingQty : null);
      if (!size || size <= 0) return;
      setServSize(String(size));
      setMode('serv');
      setQty(editing ? String(round2(editing.quantity / size)) : '1');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!food) {
    return (
      <Screen>
        <Header title="Food not found" />
        <T variant="body" secondary>That food could not be loaded. Go back and choose it again.</T>
      </Screen>
    );
  }

  const massLike = isMassOrVolume(food.unit);
  const inServings = massLike && mode === 'serv';
  const size = parseDecimal(servSize);
  const sizeOk = size !== null && size > 0 && size <= MAX_QTY;
  const q = parseDecimal(qty);
  const qOk = q !== null && q > 0 && q <= (inServings ? 1000 : MAX_QTY);
  const valid = qOk && (!inServings || sizeOk);
  // Amount in the food's base unit (g / ml / piece...), which is what the diary stores.
  const baseQty = valid ? (inServings ? (q as number) * (size as number) : (q as number)) : 0;
  const macros = scale(foodMacros(food), baseQty);
  const quick = inServings
    ? [0.5, 1, 2, 3, 4, 5]
    : massLike
      ? [...(food.servingQty !== 100 ? [food.servingQty] : []), 50, 100, 150, 200]
      : [0.5, 1, 2, 3, 4, 5];
  const switchMode = (m: 'unit' | 'serv') => {
    if (m === mode) return;
    haptic.select();
    if (m === 'serv' && !sizeOk) { /* keep qty; the size field is shown right below */ }
    else if (valid) setQty(String(m === 'serv' ? round2(baseQty / (size as number)) : round2(baseQty)));
    setMode(m);
  };

  const toggleFav = async () => {
    haptic.select();
    const saved = food.id ? food : await foodRepo.upsertRemoteFood(food);
    const next = !saved.isFavourite;
    await foodRepo.setFavourite(saved.id as number, next);
    setFood({ ...saved, isFavourite: next });
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await d.updateQuantity(editing.id, baseQty);
        if (inServings && editing.foodId) await repo.setRaw(servKey(editing.foodId), String(size));
        if (meal !== editing.meal) { await repo.moveEntry(editing.id, meal); await d.refresh(); }
      } else {
        // Save online foods locally first: de-duplicates, enables offline use and favourites.
        const saved = food.id ? food : await foodRepo.upsertRemoteFood(food);
        await d.addEntry({
          date: d.date, meal, foodId: saved.id ?? null, name: saved.name, brand: saved.brand ?? null,
          quantity: baseQty, unit: saved.unit,
          kcalPerUnit: saved.kcalPerUnit, proteinPerUnit: saved.proteinPerUnit,
          carbsPerUnit: saved.carbsPerUnit, fatPerUnit: saved.fatPerUnit,
        });
        if (inServings && saved.id) await repo.setRaw(servKey(saved.id), String(size));
      }
      haptic.success();
      router.dismissAll?.();
      router.navigate('/diary');
    } catch (e) {
      Alert.alert('Could not save', 'Something went wrong writing to the diary. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const fmtOpt = (v: number | null | undefined, per: number) => (v == null ? 'n/a' : `${round1(v * per)} g`);

  return (
    <Screen>
      <Header
        title={food.name}
        right={!editing ? (
          <Press onPress={toggleFav} accessibilityLabel={food.isFavourite ? 'Remove from favourites' : 'Add to favourites'} hitSlop={10}>
            <Icon name={food.isFavourite ? 'star.fill' : 'star'} size={22} color={food.isFavourite ? colors.accent : colors.textSecondary} />
          </Press>
        ) : undefined}
      />
      {food.brand ? <T variant="body" secondary style={{ marginTop: -spacing.sm }}>{food.brand}</T> : null}

      <Card style={{ gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T variant="metric" accent>{round0(macros.kcal)}</T>
          <T variant="caption" secondary>kcal</T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[
            ['Protein', macros.protein], ['Carbs', macros.carbs], ['Fat', macros.fat],
          ].map(([label, v]) => (
            <View key={label as string} style={{ alignItems: 'center' }}>
              <T variant="metricSmall">{round1(v as number)} g</T>
              <T variant="caption" secondary>{label as string}</T>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Amount</T>
        {massLike ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pill label="Servings" active={mode === 'serv'} onPress={() => switchMode('serv')} />
            <Pill label={food.unit === 'ml' ? 'Millilitres' : 'Grams'} active={mode === 'unit'} onPress={() => switchMode('unit')} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            selectTextOnFocus
            accessibilityLabel={inServings ? 'Number of servings' : `Quantity in ${food.unit}`}
            style={{
              flex: 1, color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md,
              paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 22, fontWeight: '700',
              borderWidth: qOk ? 0 : 1, borderColor: colors.danger,
            }}
          />
          <T variant="headline" secondary>{inServings ? (q === 1 ? 'serving' : 'servings') : food.unit}</T>
        </View>
        {!qOk && qty.length > 0 ? <T variant="caption" style={{ color: colors.danger }}>Enter an amount above 0.</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {quick.map((v) => (
            <Pill key={v} label={inServings ? `${v}` : `${v} ${food.unit}`} active={q === v} onPress={() => setQty(String(v))} />
          ))}
        </View>
        {inServings ? (
          <View style={{ gap: 6 }}>
            <T variant="caption" secondary>1 serving = how many {food.unit}? (remembered for this food)</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <TextInput
                value={servSize} onChangeText={setServSize} keyboardType="decimal-pad" selectTextOnFocus
                accessibilityLabel={`Size of one serving in ${food.unit}`}
                style={{ flex: 1, color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 17, fontWeight: '600', borderWidth: sizeOk ? 0 : 1, borderColor: colors.danger }}
              />
              <T variant="body" secondary>{food.unit}</T>
            </View>
            {valid ? <T variant="caption" secondary>= {round1(baseQty)} {food.unit} in total</T> : null}
          </View>
        ) : massLike && valid ? (
          <T variant="caption" secondary>
            Tip: switch to Servings to log e.g. “5 eggs” instead of grams.
          </T>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Meal</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MEALS.map((m) => <Pill key={m.key} label={m.label} active={meal === m.key} onPress={() => { haptic.select(); setMeal(m.key); }} />)}
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <T variant="headline">Nutrition per {massLike ? `100 ${food.unit}` : `1 ${food.unit}`}</T>
        {[
          ['Energy', `${round0(food.kcalPerUnit * (massLike ? 100 : 1))} kcal`],
          ['Protein', fmtOpt(food.proteinPerUnit, massLike ? 100 : 1)],
          ['Carbohydrates', fmtOpt(food.carbsPerUnit, massLike ? 100 : 1)],
          ['Fat', fmtOpt(food.fatPerUnit, massLike ? 100 : 1)],
          ['Sugar', fmtOpt(food.sugarPerUnit, massLike ? 100 : 1)],
          ['Fibre', fmtOpt(food.fibrePerUnit, massLike ? 100 : 1)],
        ].map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="body" secondary>{k}</T>
            <T variant="body" style={{ fontWeight: '600' }}>{v}</T>
          </View>
        ))}
        <T variant="caption" secondary>
          {food.source === 'openfoodfacts' ? 'Source: Open Food Facts (community data, check the label).'
            : food.source === 'usda' ? 'Source: USDA FoodData Central.' : 'Your own saved food.'}
        </T>
      </Card>

      <Press onPress={submit} style={{ backgroundColor: valid ? colors.accent : colors.elevated, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
        <T variant="headline" style={{ color: valid ? colors.accentText : colors.textSecondary }}>
          {editing ? 'Save changes' : `Add to ${MEALS.find((m) => m.key === meal)?.label}`}
        </T>
      </Press>
    </Screen>
  );
}
