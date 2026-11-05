import { useEffect, useState } from 'react';
import { useHealth } from '@/hooks/useHealth';
import { Goals } from '@/types';
import { eligibleExerciseKcal } from '@/services/health/aggregate';
import { todayKey } from '@/utils/date';

/**
 * Calories credited back for `date`, from real active energy only.
 * 0 when the setting is off, no source is connected, or the source has no value for that day.
 */
export function useExerciseCredit(date: string, goals: Goals) {
  const h = useHealth();
  const [kcal, setKcal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    if (h.source === 'none') { setKcal(null); return; }
    if (date === todayKey()) { setKcal(h.today?.activeKcal ?? null); return; }
    h.getDaily(date, date).then((r) => alive && setKcal(r[0]?.activeKcal ?? null)).catch(() => alive && setKcal(null));
    return () => { alive = false; };
  }, [date, h.source, h.today, h.getDaily]);

  const eligible = goals.includeExercise
    ? eligibleExerciseKcal(kcal, goals.exerciseCreditPct, goals.goalIncludesActivity ? goals.baselineActiveKcal : 0)
    : 0;
  return { activeKcal: kcal, eligible, enabled: goals.includeExercise };
}
