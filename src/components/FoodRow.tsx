import React from 'react';
import { Image, View } from 'react-native';
import { Press, T } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Food, isMassOrVolume } from '@/types/food';
import { round0, round1 } from '@/utils/nutrition';

/** Reference quantity shown in lists: per 100 g/ml for weighed foods, otherwise per 1 unit. */
export const referenceQty = (f: Food) => (isMassOrVolume(f.unit) ? 100 : 1);

export function FoodRow({
  food, onPress, onToggleFavourite, trailing,
}: {
  food: Food;
  onPress: () => void;
  onToggleFavourite?: () => void;
  trailing?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const q = referenceQty(food);
  const label = `${q}${isMassOrVolume(food.unit) ? ' ' : ' '}${food.unit}`;
  return (
    <Press onPress={onPress} haptics={false}
      accessibilityLabel={`${food.name}${food.brand ? ', ' + food.brand : ''}, ${round0(food.kcalPerUnit * q)} calories per ${label}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      {food.imageUri ? (
        <Image source={{ uri: food.imageUri }} style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.elevated }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="fork.knife" size={16} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{food.name}</T>
        <T variant="caption" secondary numberOfLines={1}>
          {food.brand ? `${food.brand} · ` : ''}{round0(food.kcalPerUnit * q)} kcal · {round1(food.proteinPerUnit * q)} g protein · per {label}
        </T>
      </View>
      {trailing}
      {onToggleFavourite ? (
        <Press onPress={onToggleFavourite} hitSlop={10} accessibilityLabel={food.isFavourite ? 'Remove from favourites' : 'Add to favourites'}>
          <Icon name={food.isFavourite ? 'star.fill' : 'star'} size={18} color={food.isFavourite ? colors.accent : colors.textSecondary} />
        </Press>
      ) : null}
    </Press>
  );
}
