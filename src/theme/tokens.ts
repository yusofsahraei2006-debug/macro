export type Palette = {
  bg: string;
  bgSecondary: string;
  card: string;
  elevated: string;
  accent: string;
  accentSecondary: string;
  accentText: string; // text placed on top of accent fills
  text: string;
  textSecondary: string;
  border: string;
  danger: string;
  success: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  shadow: string;
};

export const darkPalette: Palette = {
  bg: '#08090B',
  bgSecondary: '#111318',
  card: '#191B20',
  elevated: '#24262D',
  accent: '#FFD60A',
  accentSecondary: '#FACC15',
  accentText: '#08090B',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: '#303238',
  danger: '#FF453A',
  success: '#32D74B',
  protein: '#FFD60A',
  carbs: '#8E8E93',
  fat: '#C7C7CC',
  water: '#64D2FF',
  shadow: '#000000',
};

export const lightPalette: Palette = {
  bg: '#FFFFFF',
  bgSecondary: '#F5F6F8',
  card: '#FFFFFF',
  elevated: '#ECEEF2',
  accent: '#EAB308',
  accentSecondary: '#FACC15',
  accentText: '#101114',
  text: '#101114',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  danger: '#FF3B30',
  success: '#34C759',
  protein: '#EAB308',
  carbs: '#6B7280',
  fat: '#9CA3AF',
  water: '#0A84FF',
  shadow: '#101114',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, huge: 40 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0 },
  metric: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1 },
  metricSmall: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
};
