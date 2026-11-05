import { addDays, fromDateKey, toDateKey } from '@/utils/date';

describe('date keys', () => {
  it('round-trips', () => {
    expect(toDateKey(fromDateKey('2026-11-05'))).toBe('2026-11-05');
  });
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('is stable across the UK clock change', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});
