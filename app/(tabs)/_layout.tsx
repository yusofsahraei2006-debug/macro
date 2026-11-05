import React from 'react';
import { View, StyleSheet } from 'react-native';
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

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.bar, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(17,19,24,0.7)' : 'rgba(255,255,255,0.8)' }]}
      >
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === i;

          if (route.name === 'add') {
            return (
              <View key={route.key} style={styles.slot}>
                <Press
                  accessibilityLabel="Add food, water or more"
                  onPress={() => {
                    haptic.press();
                    router.push('/add');
                  }}
                  style={[styles.addBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                >
                  <Icon name="plus" size={26} color={colors.accentText} weight="bold" />
                </Press>
              </View>
            );
          }

          return (
            <Press
              key={route.key}
              haptics={false}
              accessibilityLabel={meta.label}
              onPress={() => {
                haptic.select();
                if (!focused) navigation.navigate(route.name);
              }}
              style={styles.slot}
            >
              <Icon name={meta.icon as any} size={22} color={focused ? colors.accent : colors.textSecondary} />
              <T
                variant="caption"
                style={{ marginTop: 3, fontSize: 10, color: focused ? colors.accent : colors.textSecondary }}
              >
                {meta.label}
              </T>
            </Press>
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
    paddingVertical: 8,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
