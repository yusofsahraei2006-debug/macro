import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Icon } from '@/components/Icon';
import { Press, T } from '@/components/ui';
import { useDiary } from '@/hooks/useDiary';
import { haptic } from '@/utils/haptics';

type Action = { key: string; label: string; icon: string; phase?: string };

const ACTIONS: Action[] = [
  { key: 'scan', label: 'Scan barcode', icon: 'barcode.viewfinder' },
  { key: 'search', label: 'Search food', icon: 'magnifyingglass' },
  { key: 'custom', label: 'Custom food', icon: 'square.and.pencil' },
  { key: 'meal', label: 'Saved meal', icon: 'fork.knife' },
  { key: 'voice', label: 'Voice entry', icon: 'mic.fill', phase: 'Phase 4' },
  { key: 'water', label: 'Add water', icon: 'drop.fill' },
];

const ROUTES: Record<string, string> = { scan: '/scan', search: '/search', custom: '/custom-food', meal: '/meals' };

const WATER_AMOUNTS = [150, 250, 500, 1000];

export default function AddSheet() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addWater } = useDiary();
  const [waterMode, setWaterMode] = useState(false);

  const y = useSharedValue(500);
  useEffect(() => {
    y.value = withSpring(0, { damping: 22, stiffness: 220 });
  }, [y]);

  const close = () => {
    y.value = withTiming(600, { duration: 180 }, (done) => {
      if (done) runOnJS(router.back)();
    });
  };

  const drag = Gesture.Pan()
    .onChange((e) => {
      y.value = Math.max(0, y.value + e.changeY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(close)();
      else y.value = withSpring(0, { damping: 22, stiffness: 220 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const pickWater = async (ml: number) => {
    await addWater(ml);
    haptic.success();
    close();
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>

      <GestureDetector gesture={drag}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.bgSecondary, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg },
            sheetStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <T variant="title" style={{ marginBottom: spacing.lg }}>
            {waterMode ? 'Add water' : 'Add'}
          </T>

          {waterMode ? (
            <View style={styles.grid}>
              {WATER_AMOUNTS.map((ml) => (
                <Press key={ml} onPress={() => pickWater(ml)} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="drop.fill" size={22} color={colors.water} />
                  <T variant="headline" style={{ marginTop: spacing.sm }}>
                    {ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
                  </T>
                </Press>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {ACTIONS.map((a) => {
                const available = !a.phase;
                return (
                  <Press
                    key={a.key}
                    haptics={available}
                    onPress={() => {
                      if (a.key === 'water') setWaterMode(true);
                      else if (ROUTES[a.key]) router.replace(ROUTES[a.key] as any); // replaces the sheet, so Back returns to the tabs
                      else haptic.warning();
                    }}
                    accessibilityLabel={available ? a.label : `${a.label}, coming in ${a.phase}`}
                    style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border, opacity: available ? 1 : 0.5 }]}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: available ? colors.accent : colors.elevated }]}>
                      <Icon name={a.icon as any} size={20} color={available ? colors.accentText : colors.textSecondary} />
                    </View>
                    <T variant="body" style={{ marginTop: spacing.sm, fontWeight: '600' }}>{a.label}</T>
                    {a.phase ? <T variant="caption" secondary>{a.phase}</T> : null}
                  </Press>
                );
              })}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    minHeight: 104,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    justifyContent: 'center',
  },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
