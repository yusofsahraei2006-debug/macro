import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
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
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
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

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c], { borderColor: colors.accent }]} />
          ))}
        </View>
        <T variant="body" style={{ color: '#fff', marginTop: spacing.lg, fontWeight: '600' }}>Point at a food barcode</T>
      </View>

      {state.kind !== 'scanning' && (
        <View style={[styles.sheet, { backgroundColor: colors.bgSecondary, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]}>
          {state.kind === 'loading' ? (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.accent} />
              <T variant="headline">Looking up {state.code}</T>
            </View>
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

const C = 28;
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
