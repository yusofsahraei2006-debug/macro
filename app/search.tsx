import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card, Pill, Press, SectionHeader, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FoodRow } from '@/components/FoodRow';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Food } from '@/types/food';
import { searchOff } from '@/services/openFoodFacts';
import { searchUsda } from '@/services/usda';
import { FetchError } from '@/services/http';
import { takePickHandler } from '@/services/picker';
import * as foodRepo from '@/db/foodRepo';
import { haptic } from '@/utils/haptics';

const DEBOUNCE_MS = 400;
const MIN_CHARS = 2;
const keyOf = (f: Food) => (f.extId ? `${f.source}:${f.extId}` : `id:${f.id}:${f.name}:${f.brand ?? ''}`);

type Extras = { recents: string[]; favourites: Food[]; logged: Food[]; frequent: Food[]; custom: Food[] };
const EMPTY: Extras = { recents: [], favourites: [], logged: [], frequent: [], custom: [] };

export default function Search() {
  const { colors } = useTheme();
  const router = useRouter();
  const { meal, pick } = useLocalSearchParams<{ meal?: string; pick?: string }>();
  const pickMode = pick === '1';

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<Food[]>([]);
  const [online, setOnline] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extras, setExtras] = useState<Extras>(EMPTY);
  const requestId = useRef(0);

  const loadExtras = useCallback(async () => {
    const [recents, favourites, logged, frequent, custom] = await Promise.all([
      foodRepo.recentSearches(), foodRepo.listFavourites(), foodRepo.recentlyLogged(8),
      foodRepo.frequentlyLogged(8), foodRepo.listCustomFoods(),
    ]);
    setExtras({ recents, favourites, logged, frequent, custom });
  }, []);

  useEffect(() => { loadExtras(); }, [loadExtras]);

  // Debounce typing -> query
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  // Run search whenever the debounced query changes
  useEffect(() => {
    const id = ++requestId.current;
    if (query.length < MIN_CHARS) {
      setLocal([]); setOnline([]); setError(null); setLoading(false); setHasMore(false); setPage(1);
      return;
    }
    (async () => {
      setLoading(true); setError(null); setPage(1);
      // Local results first: instant and available offline.
      const localFoods = await foodRepo.searchLocalFoods(query);
      if (id !== requestId.current) return;
      setLocal(localFoods);

      const [off, usda] = await Promise.allSettled([searchOff(query, 1), searchUsda(query, 1)]);
      if (id !== requestId.current) return; // a newer query superseded this one
      const found: Food[] = [
        ...(usda.status === 'fulfilled' ? usda.value.foods : []),
        ...(off.status === 'fulfilled' ? off.value.foods : []),
      ];
      setOnline(found);
      setHasMore((off.status === 'fulfilled' && off.value.hasMore) || (usda.status === 'fulfilled' && usda.value.hasMore));
      if (off.status === 'rejected' && usda.status === 'rejected') {
        const e = off.reason as unknown;
        setError(e instanceof FetchError && e.kind === 'offline'
          ? 'You’re offline. Showing foods saved on this device.'
          : e instanceof FetchError && e.kind === 'timeout'
            ? 'Online search timed out. Showing foods saved on this device.'
            : 'Online search is unavailable right now. Showing foods saved on this device.');
      } else if (off.status === 'rejected' || usda.status === 'rejected') {
        setError(`Some results are missing (${off.status === 'rejected' ? 'Open Food Facts' : 'USDA'} didn’t respond).`);
      }
      setLoading(false);
    })();
  }, [query]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    const next = page + 1;
    const [off, usda] = await Promise.allSettled([searchOff(query, next), searchUsda(query, next)]);
    if (id !== requestId.current) return;
    const more = [
      ...(usda.status === 'fulfilled' ? usda.value.foods : []),
      ...(off.status === 'fulfilled' ? off.value.foods : []),
    ];
    setOnline((cur) => {
      const seen = new Set(cur.map(keyOf));
      return [...cur, ...more.filter((f) => !seen.has(keyOf(f)))];
    });
    setPage(next);
    setHasMore((off.status === 'fulfilled' && off.value.hasMore) || (usda.status === 'fulfilled' && usda.value.hasMore));
    setLoadingMore(false);
  };

  const choose = async (food: Food) => {
    haptic.tap();
    if (query.length >= MIN_CHARS) foodRepo.addSearch(query);
    if (pickMode) {
      // Persist online foods first so saved meals reference a real row and work offline.
      const saved = food.id ? food : await foodRepo.upsertRemoteFood(food);
      takePickHandler()?.(saved);
      router.back();
      return;
    }
    router.push({ pathname: '/log', params: { food: JSON.stringify(food), ...(meal ? { meal } : {}) } });
  };

  const toggleFavourite = async (food: Food) => {
    haptic.select();
    const saved = food.id ? food : await foodRepo.upsertRemoteFood(food);
    const on = !saved.isFavourite;
    await foodRepo.setFavourite(saved.id as number, on);
    const updated = { ...saved, isFavourite: on };
    const swap = (list: Food[]) => list.map((f) => (keyOf(f) === keyOf(food) || (f.id && f.id === saved.id) ? updated : f));
    setLocal(swap); setOnline(swap);
    loadExtras();
  };

  const submit = () => {
    const q = text.trim();
    setQuery(q);
    if (q.length >= MIN_CHARS) foodRepo.addSearch(q).then(loadExtras);
  };

  // Hide online duplicates of foods we already show from the device
  const localKeys = new Set(local.map(keyOf));
  const onlineShown = online.filter((f) => !localKeys.has(keyOf(f)));
  const searching = query.length >= MIN_CHARS;
  const noResults = searching && !loading && local.length === 0 && onlineShown.length === 0;

  const row = (f: Food) => (
    <FoodRow key={keyOf(f)} food={f} onPress={() => choose(f)} onToggleFavourite={() => toggleFavourite(f)} />
  );

  return (
    <Screen>
      <Header title={pickMode ? 'Add ingredient' : 'Search food'} />

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevated, borderRadius: radius.lg, paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <Icon name="magnifyingglass" size={16} color={colors.textSecondary} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Banana, Tesco chicken breast, protein yoghurt…"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel="Search foods by name or brand"
          style={{ flex: 1, color: colors.text, paddingVertical: 14, fontSize: 17 }}
        />
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {error ? (
        <Card style={{ padding: spacing.md }}>
          <T variant="caption" secondary>{error}</T>
        </Card>
      ) : null}

      {searching ? (
        <>
          {local.length > 0 && (
            <Card>
              <SectionHeader title="On your device" />
              {local.map(row)}
            </Card>
          )}
          {onlineShown.length > 0 && (
            <Card>
              <SectionHeader title="Food databases" />
              {onlineShown.map(row)}
              {hasMore ? (
                <Press onPress={loadMore} style={{ alignItems: 'center', paddingTop: spacing.md }}>
                  {loadingMore ? <ActivityIndicator color={colors.accent} /> : <T variant="body" accent style={{ fontWeight: '600' }}>Load more</T>}
                </Press>
              ) : null}
            </Card>
          )}
          {loading && local.length === 0 && onlineShown.length === 0 ? (
            <T variant="body" secondary style={{ textAlign: 'center', marginTop: spacing.lg }}>Searching…</T>
          ) : null}
          {noResults ? (
            <Card style={{ gap: spacing.sm, alignItems: 'center' }}>
              <T variant="headline">No matches for “{query}”</T>
              <T variant="body" secondary style={{ textAlign: 'center' }}>Try a simpler name, or add it yourself.</T>
              <Press onPress={() => router.push({ pathname: '/custom-food', params: { name: query } })}
                style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.xl, marginTop: spacing.sm }}>
                <T variant="headline" style={{ color: colors.accentText }}>Create custom food</T>
              </Press>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          {extras.recents.length > 0 && (
            <View>
              <SectionHeader title="Recent searches" right={
                <Press onPress={async () => { await foodRepo.clearSearches(); loadExtras(); }} accessibilityLabel="Clear recent searches">
                  <T variant="caption" accent>Clear</T>
                </Press>} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {extras.recents.map((r) => <Pill key={r} label={r} onPress={() => { setText(r); setQuery(r); }} />)}
              </View>
            </View>
          )}
          <Section title="Favourites" foods={extras.favourites} render={row} />
          <Section title="Recently logged" foods={extras.logged} render={row} />
          <Section title="Frequently eaten" foods={extras.frequent} render={row} />
          <Section title="Your foods" foods={extras.custom} render={(f) => (
            <FoodRow key={keyOf(f)} food={f} onPress={() => choose(f)} onToggleFavourite={() => toggleFavourite(f)}
              trailing={
                <Press onPress={() => router.push({ pathname: '/custom-food', params: { id: String(f.id) } })} hitSlop={10} accessibilityLabel={`Edit ${f.name}`}>
                  <Icon name="pencil" size={16} color={colors.textSecondary} />
                </Press>} />
          )} />
          {extras.favourites.length + extras.logged.length + extras.custom.length + extras.recents.length === 0 ? (
            <T variant="body" secondary style={{ textAlign: 'center', marginTop: spacing.lg }}>
              Type at least 2 letters to search packaged products and generic foods. Foods you log or save will appear here.
            </T>
          ) : null}
        </>
      )}

      <Press onPress={() => router.push('/custom-food')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.md }}>
        <Icon name="plus.circle.fill" size={18} color={colors.accent} />
        <T variant="body" accent style={{ fontWeight: '600' }}>Create custom food</T>
      </Press>
    </Screen>
  );
}

function Section({ title, foods, render }: { title: string; foods: Food[]; render: (f: Food) => React.ReactNode }) {
  if (!foods.length) return null;
  return (
    <Card>
      <SectionHeader title={title} />
      {foods.map(render)}
    </Card>
  );
}
