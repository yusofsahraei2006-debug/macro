import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { GOLD, GOLD_LIGHT, goldAmount, mix } from '@/utils/color';

/**
 * Progress bar. With `gold`, the fill warms towards rich gold as it nears the goal.
 * A light glint sweeps across the filled part every few seconds, brighter the closer to the goal.
 */
export function Bar({ progress, color, height = 8, gold = false }: { progress: number; color?: string; height?: number; gold?: boolean }) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const base = color ?? colors.accent;
  const g = gold ? goldAmount(clamped) : 0;
  const fill = gold ? mix(base, GOLD, g) : base;
  const fillLight = gold ? mix(base, GOLD_LIGHT, g) : base;

  const p = useSharedValue(0);
  const shine = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(clamped, { damping: 20, stiffness: 100 });
  }, [clamped, p]);
  useEffect(() => {
    shine.value = withRepeat(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1900 })),
      -1,
      false,
    );
  }, [shine]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  const shineStyle = useAnimatedStyle(() => ({ left: `${-40 + shine.value * 140}%` }));
  const shineOpacity = 0.25 + 0.55 * (gold ? g : clamped);

  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.elevated, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, overflow: 'hidden' }, fillStyle]}>
        <LinearGradient colors={[fill, fillLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, { bottom: height / 2 }]} />
        {clamped > 0.02 ? (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: '40%', opacity: shineOpacity }, shineStyle]}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}
