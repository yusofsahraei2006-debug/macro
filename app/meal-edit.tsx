import React, { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Food, SavedMealItem, foodMacros } from '@/types/food';
import { setPickHandler } from '@/services/picker';
import { parseDecimal } from '@/utils/meal';
import { round0, round1, scale, sum } from '@/utils/nutrition';
import { haptic } from '@/utils/haptics';
import * as foodRepo from '@/db/foodRepo';

type Line = { key: string; food: Food; qty: string };
let seq = 0;
const newKey = () => `l${++seq}`;

/** Create / edit a saved meal: name + ingredients with quantities and live totals. */
export default function MealEdit() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const mealId = id ? Number(id) : undefined;

  const [name, setName] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [tried, setTried] = useState(false);
  const [loaded, setLoaded] = useState(!mealId);

  useEffect(() => {
    if (!mealId) return;
    foodRepo.getSavedMeal(mealId).then((m) => {
      if (!m) return router.back();
      setName(m.name);
      setLines(m.items.map((i) => ({ key: newKey(), food: i.food, qty: String(i.quantity) })));
      setLoaded(true);
    });
  }, [mealId, router]);

  useEffect(() => () => setPickHandler(null), []);

  const addIngredient = () => {
    setPickHandler((food) => {
      const defaultQty = food.unit === 'g' || food.unit === 'ml' ? food.servingQty : 1;
      setLines((cur) => [...cur, { key: newKey(), food, qty: String(defaultQty) }]);
    });
    router.push({ pathname: '/search', params: { pick: '1' } });
  };

  const parsed = lines.map((l) => ({ ...l, q: parseDecimal(l.qty) }));
  const badQty = parsed.some((l) => l.q === null || l.q <= 0);
  const totals = sum(parsed.map((l) => scale(foodMacros(l.food), l.q && l.q > 0 ? l.q : 0)));

  const errors: string[] = [];
  if (!name.trim()) errors.push('Give the meal a name.');
  if (lines.length === 0) errors.push('Add at least one ingredient.');
  if (badQty) errors.push('Every ingredient needs an amount above 0.');

  const save = async () => {
    setTried(true);
    if (errors.length) { haptic.warning(); return; }
    const items: SavedMealItem[] = parsed.map((l) => ({ food: l.food, quantity: l.q as number }));
    try {
      await foodRepo.saveMeal(name.trim(), items, mealId);
      haptic.success();
      router.back();
    } catch {
      Alert.alert('Could not save', 'Something went wrong saving this meal.');
    }
  };

  if (!loaded) return <Screen><Header title="Edit meal" /></Screen>;

  return (
    <Screen>
      <Header title={mealId ? 'Edit meal' : 'New meal'} />
      <Card>
        <T variant="caption" secondary style={{ marginBottom: 6 }}>Meal name</T>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Chicken and rice" placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Meal name"
          style={{ color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17 }} />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Ingredients</T>
        {lines.map((l, idx) => {
          const q = parseDecimal(l.qty);
          const m = scale(foodMacros(l.food), q && q > 0 ? q : 0);
          return (
            <View key={l.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <T variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{l.food.name}</T>
                  <T variant="caption" secondary>{round0(m.kcal)} kcal · {round1(m.protein)} g protein</T>
                </View>
                <TextInput
                  value={l.qty}
                  onChangeText={(v) => setLines((cur) => cur.map((x) => (x.key === l.key ? { ...x, qty: v } : x)))}
                  keyboardType="decimal-pad" selectTextOnFocus
                  accessibilityLabel={`Amount of ${l.food.name} in ${l.food.unit}`}
                  style={{ width: 76, textAlign: 'right', color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: 17, fontWeight: '600' }} />
                <T variant="caption" secondary style={{ width: 40 }} numberOfLines={1}>{l.food.unit}</T>
                <Press onPress={() => setLines((cur) => cur.filter((x) => x.key !== l.key))} hitSlop={10} accessibilityLabel={`Remove ${l.food.name}`}>
                  <Icon name="minus.circle.fill" size={20} color={colors.danger} />
                </Press>
              </View>
              {idx < lines.length - 1 ? <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} /> : null}
            </View>
          );
        })}
        <Press onPress={addIngredient} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="plus.circle.fill" size={18} color={colors.accent} />
          <T variant="body" accent style={{ fontWeight: '600' }}>Add ingredient</T>
        </Press>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <T variant="headline">Total</T>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[['kcal', totals.kcal, ''], ['Protein', totals.protein, ' g'], ['Carbs', totals.carbs, ' g'], ['Fat', totals.fat, ' g']].map(([k, v, u]) => (
            <View key={k as string} style={{ alignItems: 'center' }}>
              <T variant="metricSmall" accent={k === 'kcal'}>{k === 'kcal' ? round0(v as number) : round1(v as number)}{u as string}</T>
              <T variant="caption" secondary>{k as string}</T>
            </View>
          ))}
        </View>
      </Card>

      {tried && errors.length ? (
        <Card style={{ padding: spacing.md, gap: 4 }}>
          {errors.map((e) => <T key={e} variant="caption" style={{ color: colors.danger }}>{e}</T>)}
        </Card>
      ) : null}

      <Press onPress={save} style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
        <T variant="headline" style={{ color: colors.accentText }}>Save meal</T>
      </Press>
    </Screen>
  );
}
