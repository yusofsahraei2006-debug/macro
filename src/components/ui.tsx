import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { haptic } from '@/utils/haptics';

/** Text that respects Dynamic Type (allowFontScaling is on by default; we cap extreme sizes). */
export function T({
  variant = 'body',
  secondary,
  accent,
  style,
  ...rest
}: TextProps & { variant?: keyof typeof type; secondary?: boolean; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[type[variant], { color: accent ? colors.accent : secondary ? colors.textSecondary : colors.text }, style]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          shadowOpacity: isDark ? 0.35 : 0.06,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a refined spring scale + haptic. The style (incl. flex/width) applies to the pressable itself. */
export function Press({
  children,
  onPress,
  style,
  haptics = true,
  ...rest
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  haptics?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  hitSlop?: number;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={() => (s.value = withSpring(0.94, { damping: 18, stiffness: 320 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 12, stiffness: 240 }))}
      onPress={() => {
        if (haptics) haptic.tap();
        onPress?.();
      }}
      style={[style, a]}
    >
      {children}
    </APressable>
  );
}

export function Pill({ label, onPress, active }: { label: string; onPress?: () => void; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? colors.accent : colors.elevated, borderColor: active ? colors.accent : colors.border },
      ]}
    >
      <T variant="caption" style={{ color: active ? colors.accentText : colors.text, fontWeight: '600' }}>
        {label}
      </T>
    </Press>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="headline">{title}</T>
      {right}
    </View>
  );
}

/** Shimmer-free skeleton block (static, calm; avoids battery use). */
export function Skeleton({ height = 120, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height, borderRadius: radius.lg, backgroundColor: colors.card, opacity: 0.6 }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
});
