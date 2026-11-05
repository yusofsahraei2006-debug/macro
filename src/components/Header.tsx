import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Large-title header with a native-style back chevron for pushed screens. */
export function Header({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
        <Press onPress={onBack ?? (() => router.back())} accessibilityLabel="Back" hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
          <Icon name="chevron.left" size={18} color={colors.accent} />
          <T variant="body" accent style={{ fontWeight: '600' }}>Back</T>
        </Press>
        {right}
      </View>
      <T variant="largeTitle" numberOfLines={2}>{title}</T>
    </View>
  );
}
