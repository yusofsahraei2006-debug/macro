export type ActivitySource = 'healthkit' | 'motion' | 'none';

/** One local calendar day. null = the source cannot supply that metric (not "zero"). */
export type DayActivity = {
  date: string; // YYYY-MM-DD
  steps: number | null;
  distanceM: number | null; // walking + running, metres
  activeKcal: number | null; // ACTIVE energy only, never resting
};

export type HourBucket = { hour: number; steps: number };

export type Workout = {
  id: string;
  type: string; // human label, e.g. "Running"
  startMs: number;
  endMs: number;
  durationMin: number;
  kcal: number | null;
  distanceM: number | null;
};

export type WeightSample = { date: string; kg: number; atMs: number };

export type Capabilities = {
  steps: boolean;
  distance: boolean;
  activeEnergy: boolean;
  workouts: boolean;
  weight: boolean;
  hourly: boolean;
  /** How far back the source can be queried; Infinity for HealthKit. */
  historyDays: number;
};

/**
 * Everything the app needs from an activity source. Each real source (HealthKit, phone motion) implements
 * this; tests implement it with an in-memory fake. All dates are local-day keys.
 */
export interface HealthBackend {
  id: Exclude<ActivitySource, 'none'>;
  capabilities: Capabilities;
  isAvailable(): Promise<boolean>;
  /** Ask the user for access. Resolves when the prompt flow finished (even if the user denied reads). */
  requestPermission(): Promise<void>;
  getDailyActivity(fromKey: string, toKey: string): Promise<DayActivity[]>;
  getHourlySteps(dateKey: string): Promise<HourBucket[]>;
  getWorkouts(fromKey: string, toKey: string): Promise<Workout[]>;
  getWeights(fromKey: string, toKey: string): Promise<WeightSample[]>;
  /** Foreground change notifications (no polling). Returns an unsubscribe function. */
  subscribe?(onChange: () => void): () => void;
}
