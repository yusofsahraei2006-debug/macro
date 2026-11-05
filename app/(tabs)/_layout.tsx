import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { Tabs, useRouter } from 'expo-router';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/components/Icon';
import { Press, T } from '@/components/ui';
import { haptic } from '@/utils/haptics';

const TABS: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: 'house.fill' },
  diary: { label: 'Diary', icon: 'book.fill' },
  add: { label: 'Add', icon: 'plus' },
  activity: { label: 'Activity', icon: 'figure.run' },
  profile: { label: 'Profile', icon: 'person.fill' },
};

function TabItem({ focused, icon, label, onPress }: { focused: boolean; icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const f = useSharedValue(focused ? 1 : 0);
  React.useEffect(() => { f.value = withSpring(focused ? 1 : 0, { damping: 13, stiffness: 190 }); }, [focused, f]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * f.value }, { scale: 1 + 0.14 * f.value }] }));
  const dot = useAnimatedStyle(() => ({ opacity: f.value, transform: [{ scale: f.value }] }));
  return (
    <View style={styles.slotWrap}>
      <Press haptics={false} accessibilityLabel={label} onPress={onPress} style={styles.slot}>
        <Animated.View style={[{ alignItems: 'center' }, lift]}>
          <Icon name={icon as any} size={22} color={focused ? colors.accent : colors.textSecondary} />
          <T variant="caption" style={{ marginTop: 3, fontSize: 11, fontWeight: '600', color: focused ? colors.accent : colors.textSecondary }}>{label}</T>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }, dot]} />
      </Press>
    </View>
  );
}

function PlusButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.32 }] }));
  return (
    <View style={styles.slotWrap}>
      <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent }, halo]} />
        <Press accessibilityLabel="Add food, water or more" onPress={onPress}
          style={[styles.addBtn, { backgroundColor: colors.accent, shadowColor: colors.accent, marginTop: 0 }]}>
          <Icon name="plus" size={26} color={colors.accentText} weight="bold" />
        </Press>
      </View>
    </View>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.bar, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(17,19,24,0.92)' : 'rgba(255,255,255,0.8)' }]}
      >
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === i;

          if (route.name === 'add') {
            return <PlusButton key={route.key} onPress={() => { haptic.press(); router.push('/add-sheet'); }} />;
          }

          return (
            <TabItem
              key={route.key}
              focused={focused}
              icon={meta.icon}
              label={meta.label}
              onPress={() => { haptic.select(); if (!focused) navigation.navigate(route.name); }}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="diary" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  slotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 64 },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
