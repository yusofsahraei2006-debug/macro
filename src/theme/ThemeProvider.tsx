import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, Palette } from './tokens';

type Theme = { colors: Palette; isDark: boolean };

const ThemeContext = createContext<Theme>({ colors: darkPalette, isDark: true });

// useColorScheme re-renders immediately when the system appearance changes.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Theme>(() => {
    const isDark = scheme !== 'light';
    return { colors: isDark ? darkPalette : lightPalette, isDark };
  }, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
