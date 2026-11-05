import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
  { key: 'voice', label: 'Describe or speak a meal', icon: 'mic.fill' },
  { key: 'water', label: 'Add water', icon: 'drop.fill' },
];

const ROUTES: Record<string, string> = { scan: '/scan', search: '/search', custom: '/custom-food', meal: '/meals', voice: '/describe-meal' };

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
              {WATER_AMOUNTS.map((ml, i) => (
                <Animated.View key={ml} entering={ZoomIn.delay(i * 45).springify().damping(14)} style={styles.cell}>
                  <Press onPress={() => pickWater(ml)} accessibilityLabel={`Add ${ml} millilitres`}
                    style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Icon name="drop.fill" size={24} color={colors.water} />
                    <T variant="headline" style={{ marginTop: spacing.sm }}>{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}</T>
                  </Press>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {ACTIONS.map((a, i) => {
                const available = !a.phase;
                return (
                  <Animated.View key={a.key} entering={ZoomIn.delay(i * 55).springify().damping(13).stiffness(170)} style={styles.cell}>
                    <Press
                      haptics={available}
                      onPress={() => {
                        if (a.key === 'water') setWaterMode(true);
                        else if (ROUTES[a.key]) router.replace(ROUTES[a.key] as any); // replaces the sheet, so Back returns to the tabs
                        else haptic.warning();
                      }}
                      accessibilityLabel={available ? a.label : `${a.label}, coming in ${a.phase}`}
                      style={[styles.tile, { backgroundColor: colors.card, borderColor: available ? colors.accent + '55' : colors.border, opacity: available ? 1 : 0.4 }]}
                    >
                      {available ? (
                        <LinearGradient colors={[colors.accent + '33', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
                      ) : null}
                      <View style={[styles.iconWrap, { backgroundColor: available ? colors.accent : colors.elevated, shadowColor: colors.accent, shadowOpacity: available ? 0.5 : 0 }]}>
                        <Icon name={a.icon as any} size={28} color={available ? colors.accentText : colors.textSecondary} />
                      </View>
                    </Press>
                  </Animated.View>
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
  cell: { width: '30.6%' },
  tile: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
  },
});
