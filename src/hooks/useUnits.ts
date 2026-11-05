import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getUnits } from '@/db/repositories';
import { DEFAULT_UNITS, Units } from '@/types';
import { cmToIn, kgToLb, mToKm, mToMiles } from '@/services/health/aggregate';

/** Reloads on focus so a change made in Profile shows up everywhere without restarting. */
export function useUnits() {
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS);
  const reload = useCallback(() => { getUnits().then(setUnits); }, []);
  useFocusEffect(reload);
  return {
    units, reload,
    weight: (kg: number) => (units.weight === 'kg' ? kg : kgToLb(kg)),
    weightLabel: (kg: number) => `${(units.weight === 'kg' ? kg : kgToLb(kg)).toFixed(1)} ${units.weight}`,
    length: (cm: number) => (units.length === 'cm' ? cm : cmToIn(cm)),
    lengthLabel: (cm: number) => `${(units.length === 'cm' ? cm : cmToIn(cm)).toFixed(1)} ${units.length}`,
    distanceLabel: (m: number) => `${(units.distance === 'km' ? mToKm(m) : mToMiles(m)).toFixed(2)} ${units.distance}`,
  };
}
