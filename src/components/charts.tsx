import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Line, Path, Rect, Circle } from 'react-native-svg';
import { T } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/** Round a maximum up to a tidy axis ceiling. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Bar chart. `null` values are "no data" (drawn as a faint stub), distinct from a real 0 (no bar).
 * Tap a bar to select it; the selected bar is yellow.
 */
export function BarChart({
  values, labels, goal, height = 150, selected, onSelect, formatValue, summary,
}: {
  values: (number | null)[];
  labels: string[]; // same length; only some are drawn
  goal?: number;
  height?: number;
  selected?: number;
  onSelect?: (i: number) => void;
  formatValue?: (v: number) => string;
  summary?: string;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const known = values.filter((v): v is number => v !== null);
  const max = niceMax(Math.max(goal ?? 0, ...known, 1));
  const n = values.length;
  const gap = n > 14 ? 2 : 6;
  const bw = w > 0 ? Math.max(2, (w - gap * (n - 1)) / n) : 0;
  const plotH = height - 4;
  const every = n > 20 ? 5 : n > 12 ? 3 : 1;

  return (
    <View accessible accessibilityLabel={summary ?? 'Bar chart'}>
      <View onLayout={onLayout} style={{ height }}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {goal ? (
              <Line x1={0} x2={w} y1={plotH - (goal / max) * plotH} y2={plotH - (goal / max) * plotH}
                stroke={colors.textSecondary} strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
            ) : null}
            {values.map((v, i) => {
              const x = i * (bw + gap);
              const isSel = selected === i;
              const fill = isSel ? colors.accent : colors.elevated;
              if (v === null) {
                return <Rect key={i} x={x} y={plotH - 3} width={bw} height={3} rx={1.5} fill={colors.border} opacity={0.6} />;
              }
              const h = Math.max(v > 0 ? 3 : 0, (v / max) * plotH);
              return (
                <Rect key={i} x={x} y={plotH - h} width={bw} height={h} rx={Math.min(5, bw / 2)}
                  fill={isSel ? colors.accent : goal && v >= goal ? colors.accent : colors.textSecondary} opacity={isSel ? 1 : goal && v >= goal ? 0.85 : 0.45}
                  onPress={() => onSelect?.(i)} />
              );
            })}
            {/* invisible, larger touch targets */}
            {onSelect && values.map((_, i) => (
              <Rect key={`t${i}`} x={i * (bw + gap) - gap / 2} y={0} width={bw + gap} height={height} fill="transparent" onPress={() => onSelect(i)} />
            ))}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6, height: 14 }}>
        {labels.map((l, i) => (
          <View key={i} style={{ width: n ? `${100 / n}%` : undefined, alignItems: 'center' }}>
            {i % every === 0 || i === n - 1 ? <T variant="caption" secondary style={{ fontSize: 10 }} numberOfLines={1}>{l}</T> : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <T variant="caption" secondary style={{ fontSize: 10 }}>0</T>
        <T variant="caption" secondary style={{ fontSize: 10 }}>{formatValue ? formatValue(max) : String(max)}{goal ? ' · dashed = goal' : ''}</T>
      </View>
    </View>
  );
}

/** Simple line chart over evenly spaced x positions, with optional dashed target line. */
export function LineChart({
  points, target, height = 140, formatValue, summary,
}: {
  points: { x: number; y: number }[];
  target?: number | null;
  height?: number;
  formatValue?: (v: number) => string;
  summary?: string;
}) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  if (points.length === 0) return null;
  const ys = points.map((p) => p.y).concat(target != null ? [target] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 0.5) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = (x: number) => (x1 === x0 ? w / 2 : 6 + ((x - x0) / (x1 - x0)) * (w - 12));
  const sy = (y: number) => 6 + (1 - (y - lo) / (hi - lo)) * (height - 12);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View accessible accessibilityLabel={summary ?? 'Line chart'}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height }}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {target != null ? <Line x1={0} x2={w} y1={sy(target)} y2={sy(target)} stroke={colors.textSecondary} strokeDasharray="4 4" opacity={0.6} /> : null}
            <Path d={d} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.length <= 40 ? points.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={colors.accent} />) : null}
            <Circle cx={sx(last.x)} cy={sy(last.y)} r={5} fill={colors.accent} />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <T variant="caption" secondary style={{ fontSize: 10 }}>{formatValue ? formatValue(lo + pad) : (lo + pad).toFixed(1)}</T>
        <T variant="caption" secondary style={{ fontSize: 10 }}>{target != null ? 'dashed = target · ' : ''}{formatValue ? formatValue(hi - pad) : (hi - pad).toFixed(1)}</T>
      </View>
    </View>
  );
}
