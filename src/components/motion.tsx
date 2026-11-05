import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import type { type as TypeScale } from '@/theme/tokens';

/** Staggered entrance for a block: fades up with a spring, `i` is its position in the list. */
export function Reveal({ i = 0, children, style }: { i?: number; children: React.ReactNode; style?: StyleProp<any> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 8) * 70).springify().damping(17).stiffness(140)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Counts smoothly to its value (easeOutCubic). Re-animates from the previous value when it changes. */
export function AnimatedNumber({
  value, variant = 'body', style, format = (n: number) => Math.round(n).toLocaleString(), duration = 700, accent, secondary,
}: {
  value: number;
  variant?: keyof typeof TypeScale;
  style?: StyleProp<TextStyle>;
  format?: (n: number) => string;
  duration?: number;
  accent?: boolean;
  secondary?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const v = a + (b - a) * e;
      setShown(v);
      from.current = v;
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else { from.current = b; setShown(b); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current != null) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return <T variant={variant} accent={accent} secondary={secondary} style={style}>{format(shown)}</T>;
}

/** Slowly drifting glow behind a screen: subtle depth without costing much battery. */
export function AmbientGlow() {
  const { colors, isDark } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + t.value * 80 }, { translateY: t.value * 24 }, { scale: 1 + t.value * 0.12 }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: 30 - t.value * 60 }, { translateY: 20 - t.value * 30 }] }));
  const hi = isDark ? 0.16 : 0.12;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', top: -140, right: -120, width: 380, height: 380, borderRadius: 190, overflow: 'hidden' }, a]}>
        <LinearGradient colors={[colors.accent + Math.round(hi * 255).toString(16).padStart(2, '0'), 'transparent']} start={{ x: 0.3, y: 0.3 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 260, left: -160, width: 320, height: 320, borderRadius: 160, overflow: 'hidden' }, b]}>
        <LinearGradient colors={[colors.accent + '0D', 'transparent']} start={{ x: 0.2, y: 0.2 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
