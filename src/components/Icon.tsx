import React from 'react';
import { SymbolView, SymbolViewProps } from 'expo-symbols';

/** SF Symbols (iOS-only app, so native symbols are always available). */
export function Icon({
  name,
  size = 22,
  color,
  weight = 'semibold',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  weight?: SymbolViewProps['weight'];
}) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} resizeMode="scaleAspectFit" />;
}
