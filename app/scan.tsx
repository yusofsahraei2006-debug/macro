import React, { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { normaliseScan } from '@/services/barcode';
import { lookupBarcode } from '@/services/openFoodFacts';
import { FetchError } from '@/services/http';
import * as foodRepo from '@/db/foodRepo';
import { haptic } from '@/utils/haptics';

type State =
  | { kind: 'scanning' }
  | { kind: 'loading'; code: string }
  | { kind: 'error'; title: string; detail: string; code?: string; canCreate?: boolean };

const DUPLICATE_WINDOW_MS = 3000;

export default function Scan() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number } | null>(null);

  const fail = (title: string, detail: string, extra: Partial<Extract<State, { kind: 'error' }>> = {}) => {
    haptic.warning();
    setState({ kind: 'error', title, detail, ...extra });
  };

  const onScan = useCallback(async ({ data }: { data: string }) => {
    if (busy.current) return;
    const now = Date.now();
    // Ignore the camera re-reporting the same code (duplicate scans)
    if (last.current && last.current.code === data && now - last.current.at < DUPLICATE_WINDOW_MS) return;
    last.current = { code: data, at: now };

    const parsed = normaliseScan(data);
    if (!parsed.ok) {
      busy.current = true;
      return fail('Not a valid barcode', parsed.reason);
    }

    busy.current = true;
    haptic.press();
    setState({ kind: 'loading', code: parsed.code });

    try {
      // 1) Cached/saved on this device (works offline)
      let food = await foodRepo.findFoodByBarcode(parsed.lookupCodes);
      // 2) Open Food Facts
      if (!food) {
        const remote = await lookupBarcode(parsed.lookupCodes);
        if (!remote) {
          return fail('Product not found', 'Open Food Facts has no entry for this barcode. You can search by name or create the food yourself.', { code: parsed.code, canCreate: true });
        }
        food = await foodRepo.upsertRemoteFood({ ...remote, barcode: parsed.code, extId: parsed.code });
      }
      haptic.success();
      router.replace({ pathname: '/log', params: { food: JSON.stringify(food), ...(meal ? { meal } : {}) } });
    } catch (e) {
      if (e instanceof FetchError) {
        if (e.kind === 'offline') return fail('No internet connection', 'This product isn’t saved on your device yet. Connect to the internet to look it up, or search your saved foods.');
        if (e.kind === 'timeout') return fail('Lookup timed out', 'Open Food Facts took too long to respond. Check your connection and try again.');
        return fail('Lookup failed', 'The food database returned an error. Please try again in a moment.');
      }
      if ((e as any)?.kind === 'missing-nutrition') {
        return fail('Nutrition values missing', 'This product exists but has no calorie information, so it can’t be logged accurately. Create it manually instead.', { code: parsed.code, canCreate: true });
      }
      fail('Something went wrong', 'The scan could not be processed. Please try again.');
    }
  }, [router, meal]);

  const reset = () => {
    last.current = null;
    busy.current = false;
    setState({ kind: 'scanning' });
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, padding: spacing.xl, paddingTop: insets.top + spacing.xl }]}>
        <Icon name="camera.fill" size={40} color={colors.accent} />
        <T variant="title" style={{ marginTop: spacing.lg, textAlign: 'center' }}>Camera access needed</T>
        <T variant="body" secondary style={{ textAlign: 'center', marginVertical: spacing.md }}>
          Macro uses the camera only to read food barcodes. Nothing is recorded or uploaded.
        </T>
        {permission.canAskAgain ? (
          <Action label="Allow camera" onPress={requestPermission} primary />
        ) : (
          <Action label="Open Settings" onPress={() => Linking.openSettings()} primary />
        )}
        <Action label="Search food instead" onPress={() => router.replace({ pathname: '/search', params: meal ? { meal } : {} })} />
        <Action label="Close" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        active={state.kind === 'scanning'}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={state.kind === 'scanning' ? onScan : undefined}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Press onPress={() => router.back()} accessibilityLabel="Close scanner" style={styles.roundBtn}>
          <Icon name="xmark" size={18} color="#fff" />
        </Press>
        <Press onPress={() => setTorch((t) => !t)} accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'} style={styles.roundBtn}>
          <Icon name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? colors.accent : '#fff'} />
        </Press>
      </View>

      <Viewfinder locked={state.kind !== 'scanning'} failed={state.kind === 'error'} />

      {state.kind !== 'scanning' && (
        <View style={[styles.sheet, { backgroundColor: colors.bgSecondary, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]}>
          {state.kind === 'loading' ? (
            <Animated.View entering={FadeInUp.springify().damping(16)} style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
              <T variant="caption" secondary style={{ letterSpacing: 2 }}>BARCODE DETECTED</T>
              <T variant="title" style={{ letterSpacing: 3, fontVariant: ['tabular-nums'] }}>{state.code}</T>
              <SweepBar />
              <T variant="body" secondary>Finding nutrition data…</T>
            </Animated.View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <T variant="title">{state.title}</T>
              <T variant="body" secondary>{state.detail}</T>
              <Action label="Search food by name" primary onPress={() => router.replace({ pathname: '/search', params: meal ? { meal } : {} })} />
              {state.canCreate ? (
                <Action label="Create custom food" onPress={() => router.replace({ pathname: '/custom-food', params: state.code ? { barcode: state.code } : {} })} />
              ) : null}
              <Action label="Scan again" onPress={reset} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const DIM = 'rgba(0,0,0,0.62)';

function Viewfinder({ locked, failed }: { locked: boolean; failed: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const fw = Math.min(width * 0.82, 360);
  const fh = fw * 0.62;
  const laser = useSharedValue(0);
  const breath = useSharedValue(0);
  const lock = useSharedValue(0);

  React.useEffect(() => {
    laser.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
    breath.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [laser, breath]);
  React.useEffect(() => {
    lock.value = locked
      ? withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 220 }))
      : withTiming(0, { duration: 200 });
  }, [locked, lock]);

  const laserStyle = useAnimatedStyle(() => ({
    opacity: locked ? 0 : 1,
    transform: [{ translateY: -70 + laser.value * (fh + 68) }],
  }));
  const cornerStyle = useAnimatedStyle(() => ({
    opacity: locked ? 1 : 0.65 + breath.value * 0.35,
    transform: [{ scale: locked ? Math.max(1, lock.value) : 1 + breath.value * 0.025 }],
  }));
  const tint = failed ? colors.danger : locked ? '#32D74B' : colors.accent;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: DIM, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing.lg }}>
        <Animated.View entering={FadeIn.delay(250)}>
          <T variant="headline" style={{ color: '#fff' }}>{failed ? 'Couldn’t read that' : locked ? 'Got it' : 'Point at a food barcode'}</T>
          {!locked ? <T variant="caption" style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 2 }}>It scans automatically</T> : null}
        </Animated.View>
      </View>
      <View style={{ height: fh, flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: DIM }} />
        <View style={{ width: fw, height: fh, overflow: 'hidden', borderRadius: 18 }}>
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 70 }, laserStyle]}>
            <LinearGradient colors={['transparent', tint + '55']} style={{ flex: 1 }} />
            <LinearGradient colors={['transparent', tint, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3 }} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, cornerStyle]}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c], { borderColor: tint }]} />
            ))}
          </Animated.View>
        </View>
        <View style={{ flex: 1, backgroundColor: DIM }} />
      </View>
      <View style={{ flex: 1, backgroundColor: DIM }} />
    </View>
  );
}

function SweepBar() {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  React.useEffect(() => { x.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false); }, [x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: -120 + x.value * 300 }] }));
  return (
    <View style={{ width: 180, height: 6, borderRadius: 3, backgroundColor: colors.elevated, overflow: 'hidden' }}>
      <Animated.View style={[{ width: 120, height: 6 }, a]}>
        <LinearGradient colors={['transparent', colors.accent, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} style={{
      backgroundColor: primary ? colors.accent : colors.elevated, borderRadius: radius.pill,
      paddingVertical: 14, paddingHorizontal: spacing.xl, alignItems: 'center', alignSelf: 'stretch', marginTop: primary ? 0 : spacing.sm,
    }}>
      <T variant="headline" style={{ color: primary ? colors.accentText : colors.text }}>{label}</T>
    </Press>
  );
}

const C = 30;
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '78%', aspectRatio: 1.6 },
  corner: { position: 'absolute', width: C, height: C },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth,
  },
});
