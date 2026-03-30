import { describe, expect, test } from 'vitest';
import { buildCalendarWeeks, getMonthLabel } from './quickNotes';

describe('quickNotes', () => {
  test('formats month labels in Chinese', () => {
    expect(getMonthLabel(new Date(2026, 2, 1))).toBe('2026年3月');
  });

  test('builds six calendar weeks to keep sidebar height stable', () => {
    const weeks = buildCalendarWeeks(new Date(2026, 3, 1));

    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.days[0]?.dateKey).toBe('2026-03-30');
    expect(weeks[5]?.days[6]?.dateKey).toBe('2026-05-10');
  });
});
