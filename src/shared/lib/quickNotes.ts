const pad = (value: number) => String(value).padStart(2, '0');
const CALENDAR_WEEK_COUNT = 6;
const CALENDAR_DAY_COUNT = CALENDAR_WEEK_COUNT * 7;

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((segment) => Number(segment));
  return new Date(year, (month || 1) - 1, day || 1);
};

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getMondayIndex = (jsDay: number) => (jsDay + 6) % 7;

const getIsoWeekNumber = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getMonthLabel = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月`;

export const getQuickNoteTitle = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}月${date.getDate()}日快记`;
};

export const buildCalendarWeeks = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const firstCell = addDays(monthStart, -getMondayIndex(monthStart.getDay()));
  // Keep the sidebar card height stable by always rendering a 6-week month grid.
  const lastCell = addDays(firstCell, CALENDAR_DAY_COUNT - 1);

  const weeks: Array<{
    weekNumber: number;
    days: Array<{ date: Date; dateKey: string; inMonth: boolean }>;
  }> = [];

  let cursor = firstCell;
  while (cursor <= lastCell) {
    const weekStart = cursor;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        date,
        dateKey: formatDateKey(date),
        inMonth: date.getMonth() === monthDate.getMonth(),
      };
    });

    weeks.push({
      weekNumber: getIsoWeekNumber(weekStart),
      days,
    });

    cursor = addDays(weekStart, 7);
  }

  return weeks;
};
