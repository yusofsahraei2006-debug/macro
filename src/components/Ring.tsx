import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { GOLD, GOLD_LIGHT, goldAmount, mix } from '@/utils/color';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Animated circular progress. `progress` is 0..1.
 * With `gold`, the arc warms to gold as it nears the goal, and a glint travels along the filled arc.
 */
export function Ring({
  progress, size = 220, stroke = 16, color, gold = false, children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  gold?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const base = color ?? colors.accent;
  const g = gold ? goldAmount(clamped) : 0;
  const c1 = gold ? mix(base, GOLD, g) : base;
  const c2 = gold ? mix(colors.accentSecondary, GOLD_LIGHT, g) : colors.accentSecondary;
  const seg = Math.max(stroke * 1.4, c * 0.05);

  const p = useSharedValue(0);
  const glint = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(clamped, { damping: 20, stiffness: 90 });
  }, [clamped, p]);
  useEffect(() => {
    glint.value = withRepeat(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 2400 })),
      -1,
      false,
    );
  }, [glint]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  const glintProps = useAnimatedProps(() => {
    const len = p.value * c;
    const travel = Math.max(0, len - seg);
    return {
      strokeDashoffset: -glint.value * travel,
      strokeOpacity: len > seg ? (0.35 + 0.5 * p.value) * Math.sin(Math.PI * glint.value) : 0,
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} stopOpacity="1" />
            <Stop offset="1" stopColor={c2} stopOpacity="0.8" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.elevated} strokeWidth={stroke} fill="none" />
        {/* soft outer glow that grows as the goal gets close */}
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={c1} strokeOpacity={0.12 + 0.18 * g} strokeWidth={stroke + 10}
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={arc} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={arc} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeWidth={stroke * 0.55}
          strokeLinecap="round" strokeDasharray={`${seg} ${c}`} animatedProps={glintProps} fill="none" />
      </Svg>
      {children}
    </View>
  );
}
