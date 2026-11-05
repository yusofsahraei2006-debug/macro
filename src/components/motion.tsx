import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
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

/** Slowly drifting, soft-edged glow behind a screen: depth without a visible shape. */
export function AmbientGlow() {
  const { colors, isDark } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -30 + t.value * 60 }, { translateY: t.value * 20 }, { scale: 1 + t.value * 0.1 }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: 24 - t.value * 48 }, { translateY: 16 - t.value * 24 }] }));
  const strong = isDark ? 0.14 : 0.1;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', top: -220, right: -200, width: 520, height: 520 }, a]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="glowA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={strong} />
              <Stop offset="0.55" stopColor={colors.accent} stopOpacity={strong * 0.35} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glowA)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 380, left: -260, width: 480, height: 480 }, b]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="glowB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={strong * 0.5} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glowB)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
