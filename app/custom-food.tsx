import React, { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, T } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Food, UNIT_CHOICES } from '@/types/food';
import { parseDecimal } from '@/utils/meal';
import { haptic } from '@/utils/haptics';
import * as foodRepo from '@/db/foodRepo';

const STANDARD = UNIT_CHOICES as readonly string[];

/**
 * Create / edit a custom food. Values are entered PER SERVING and stored per ONE unit
 * (perServing / servingQty), so scaling in the diary is exact.
 */
export default function CustomFood() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id, name: presetName, barcode } = useLocalSearchParams<{ id?: string; name?: string; barcode?: string }>();
  const editingId = id ? Number(id) : undefined;

  const [loaded, setLoaded] = useState(!editingId);
  const [name, setName] = useState(presetName ?? '');
  const [brand, setBrand] = useState('');
  const [servingQty, setServingQty] = useState('100');
  const [unit, setUnit] = useState<string>('g');
  const [customUnit, setCustomUnit] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [fibre, setFibre] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    foodRepo.getFood(editingId).then((f) => {
      if (!f) return router.back();
      const sq = f.servingQty;
      const fmt = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * sq * 100) / 100));
      setName(f.name); setBrand(f.brand ?? ''); setServingQty(String(sq));
      if (STANDARD.includes(f.unit)) setUnit(f.unit); else { setUnit('custom'); setCustomUnit(f.unit); }
      setKcal(fmt(f.kcalPerUnit)); setProtein(fmt(f.proteinPerUnit)); setCarbs(fmt(f.carbsPerUnit)); setFat(fmt(f.fatPerUnit));
      setSugar(fmt(f.sugarPerUnit)); setFibre(fmt(f.fibrePerUnit));
      setLoaded(true);
    });
  }, [editingId, router]);

  const finalUnit = (unit === 'custom' ? customUnit : unit).trim().toLowerCase();
  const sq = parseDecimal(servingQty);
  const nums = { kcal: parseDecimal(kcal), protein: parseDecimal(protein), carbs: parseDecimal(carbs), fat: parseDecimal(fat) };
  const sugarV = sugar.trim() === '' ? null : parseDecimal(sugar);
  const fibreV = fibre.trim() === '' ? null : parseDecimal(fibre);

  const errors: string[] = [];
  if (!name.trim()) errors.push('Enter a food name.');
  if (sq === null || sq <= 0) errors.push('Serving size must be above 0.');
  if (!finalUnit) errors.push('Choose or type a serving unit.');
  if (nums.kcal === null) errors.push('Enter calories (0 or more).');
  if (nums.protein === null || nums.carbs === null || nums.fat === null) errors.push('Enter protein, carbs and fat (0 if none).');
  if (sugar.trim() !== '' && sugarV === null) errors.push('Sugar must be a number.');
  if (fibre.trim() !== '' && fibreV === null) errors.push('Fibre must be a number.');
  const valid = errors.length === 0;

  const build = (): Food => {
    const per = (v: number) => v / (sq as number);
    return {
      id: editingId, source: 'custom', name: name.trim(), brand: brand.trim() || null, barcode: barcode ?? null,
      unit: finalUnit, servingQty: sq as number,
      kcalPerUnit: per(nums.kcal as number), proteinPerUnit: per(nums.protein as number),
      carbsPerUnit: per(nums.carbs as number), fatPerUnit: per(nums.fat as number),
      sugarPerUnit: sugarV === null ? null : per(sugarV), fibrePerUnit: fibreV === null ? null : per(fibreV),
    };
  };

  const persist = async (): Promise<Food | null> => {
    setTried(true);
    if (!valid) { haptic.warning(); return null; }
    const food = build();
    try {
      if (editingId) { await foodRepo.updateFood(food); return (await foodRepo.getFood(editingId)) as Food; }
      const newId = await foodRepo.insertFood(food);
      return (await foodRepo.getFood(newId)) as Food;
    } catch {
      Alert.alert('Could not save', barcode ? 'A food with this barcode is already saved.' : 'Something went wrong saving this food.');
      return null;
    }
  };

  const save = async () => { if (await persist()) { haptic.success(); router.back(); } };
  const saveAndLog = async () => {
    const f = await persist();
    if (f) { haptic.success(); router.replace({ pathname: '/log', params: { food: JSON.stringify(f) } }); }
  };

  const duplicate = async () => {
    if (!editingId || !valid) return;
    const copy = { ...build(), id: undefined, barcode: null, name: `${name.trim()} (copy)` };
    await foodRepo.insertFood(copy);
    haptic.success();
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete this food?', 'Meals you already logged keep their nutrition. It will no longer appear in search.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await foodRepo.deleteFood(editingId as number); haptic.warning(); router.back(); } },
    ]);

  const field = (label: string, value: string, set: (s: string) => void, opts: { numeric?: boolean; suffix?: string; placeholder?: string } = {}) => (
    <View style={{ gap: 6 }}>
      <T variant="caption" secondary>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
        <TextInput
          value={value}
          onChangeText={set}
          keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
          placeholder={opts.placeholder}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={label}
          style={{ flex: 1, color: colors.text, paddingVertical: 12, fontSize: 17 }}
        />
        {opts.suffix ? <T variant="caption" secondary>{opts.suffix}</T> : null}
      </View>
    </View>
  );

  if (!loaded) return <Screen><Header title="Edit food" /></Screen>;

  const per = `per ${servingQty || '…'} ${finalUnit || 'serving'}`;

  return (
    <Screen>
      <Header title={editingId ? 'Edit food' : 'Custom food'} />
      <Card style={{ gap: spacing.md }}>
        {field('Food name', name, setName, { placeholder: 'e.g. Protein flapjack' })}
        {field('Brand (optional)', brand, setBrand)}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Serving</T>
        {field('Serving size', servingQty, setServingQty, { numeric: true })}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {STANDARD.map((u) => <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />)}
          <Pill label="custom…" active={unit === 'custom'} onPress={() => setUnit('custom')} />
        </View>
        {unit === 'custom' ? field('Custom unit', customUnit, setCustomUnit, { placeholder: 'e.g. slice, scoop, cup' }) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <T variant="headline">Nutrition {per}</T>
        {field('Calories', kcal, setKcal, { numeric: true, suffix: 'kcal' })}
        {field('Protein', protein, setProtein, { numeric: true, suffix: 'g' })}
        {field('Carbohydrates', carbs, setCarbs, { numeric: true, suffix: 'g' })}
        {field('Fat', fat, setFat, { numeric: true, suffix: 'g' })}
        {field('Sugar (optional)', sugar, setSugar, { numeric: true, suffix: 'g' })}
        {field('Fibre (optional)', fibre, setFibre, { numeric: true, suffix: 'g' })}
      </Card>

      {tried && errors.length > 0 ? (
        <Card style={{ padding: spacing.md, gap: 4 }}>
          {errors.map((e) => <T key={e} variant="caption" style={{ color: colors.danger }}>{e}</T>)}
        </Card>
      ) : null}

      <Press onPress={save} style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
        <T variant="headline" style={{ color: colors.accentText }}>{editingId ? 'Save changes' : 'Save food'}</T>
      </Press>
      <Press onPress={saveAndLog} style={{ backgroundColor: colors.elevated, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center' }}>
        <T variant="headline">{editingId ? 'Save and add to diary' : 'Save and add to diary'}</T>
      </Press>
      {editingId ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
          <Press onPress={duplicate} style={{ padding: spacing.md }}><T variant="body" accent style={{ fontWeight: '600' }}>Duplicate</T></Press>
          <Press onPress={remove} style={{ padding: spacing.md }}><T variant="body" style={{ color: colors.danger, fontWeight: '600' }}>Delete</T></Press>
        </View>
      ) : null}
    </Screen>
  );
}
