export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEALS: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunrise.fill' },
  { key: 'lunch', label: 'Lunch', icon: 'sun.max.fill' },
  { key: 'dinner', label: 'Dinner', icon: 'moon.stars.fill' },
  { key: 'snacks', label: 'Snacks', icon: 'leaf.fill' },
];

export type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  waterMl: number;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  objective: 'lose' | 'maintain' | 'gain';
  includeExercise: boolean;
  /** % of active energy credited back when includeExercise is on (active-energy estimates run high). */
  exerciseCreditPct: number;
  /** null = never asked. true = the calorie goal already assumes regular activity. */
  goalIncludesActivity: boolean | null;
  /** Usual daily active kcal already built into the goal; only energy ABOVE this is credited. */
  baselineActiveKcal: number;
};

export type Units = { weight: 'kg' | 'lb'; length: 'cm' | 'in'; distance: 'km' | 'mi' };
export const DEFAULT_UNITS: Units = { weight: 'kg', length: 'cm', distance: 'km' };

export const DEFAULT_GOALS: Goals = {
  calories: 2800,
  protein: 160,
  carbs: 320,
  fat: 80,
  steps: 10000,
  waterMl: 3000,
  currentWeightKg: null,
  targetWeightKg: null,
  objective: 'maintain',
  includeExercise: false,
  exerciseCreditPct: 50,
  goalIncludesActivity: null,
  baselineActiveKcal: 0,
};

export type DashboardCardId = 'calories' | 'macros' | 'activity' | 'hydration';
export type DashboardPrefs = {
  order: DashboardCardId[];
  hidden: DashboardCardId[];
  compact: boolean;
};
export const DEFAULT_DASHBOARD: DashboardPrefs = {
  order: ['calories', 'macros', 'hydration', 'activity'],
  hidden: [],
  compact: false,
};

export type DiaryEntry = {
  id: number;
  date: string;
  meal: MealType;
  foodId: number | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  kcalPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
};

export type WaterEntry = { id: number; date: string; ml: number };
