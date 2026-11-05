import React from 'react';
import { TextInput, View } from 'react-native';
import { T } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export const parseNum = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="caption" secondary>{label}</T>
      <TextInput
        value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={placeholder}
        placeholderTextColor={colors.textSecondary} accessibilityLabel={label}
        style={{ color: colors.text, backgroundColor: colors.elevated, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17 }}
      />
    </View>
  );
}
