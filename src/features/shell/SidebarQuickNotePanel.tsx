import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { getWorkKnowlageApi } from '../../shared/lib/workKnowlageApi';
import {
  buildCalendarWeeks,
  formatDateKey,
  formatMonthKey,
  getMonthLabel,
  parseDateKey,
  startOfMonth,
} from '../../shared/lib/quickNotes';
import type { QuickNoteMonthEntry, Space } from '../../shared/types/workspace';

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const compactCalendarTextStyle = {
  fontSize: '12px',
  lineHeight: '1.2',
};

interface SidebarQuickNotePanelProps {
  activeSpace: Space | null;
  refreshKey?: number;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
}

export function SidebarQuickNotePanel({
  activeSpace,
  refreshKey = 0,
  selectedDate,
  onSelectDate,
}: SidebarQuickNotePanelProps) {
  const initialToday = useMemo(() => new Date(), []);
  const todayDate = useMemo(() => formatDateKey(initialToday), [initialToday]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseDateKey(selectedDate)));
  const [monthEntries, setMonthEntries] = useState<QuickNoteMonthEntry[]>([]);

  const monthKey = useMemo(() => formatMonthKey(visibleMonth), [visibleMonth]);
  const noteDateSet = useMemo(
    () => new Set(monthEntries.map((entry) => entry.noteDate)),
    [monthEntries]
  );
  const calendarWeeks = useMemo(() => buildCalendarWeeks(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!activeSpace) {
      setMonthEntries([]);
      return;
    }

    const api = getWorkKnowlageApi();
    let cancelled = false;

    api.quickNotes.listMonth(monthKey)
      .then((entries) => {
        if (!cancelled) {
          setMonthEntries(entries);
        }
      })
      .catch((error) => {
        console.error('[SidebarQuickNotePanel] Failed to load month quick notes:', error);
        if (!cancelled) {
          setMonthEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSpace, monthKey, refreshKey]);

  const selectDate = useCallback((date: Date) => {
    const nextDateKey = formatDateKey(date);
    onSelectDate(nextDateKey);
    setVisibleMonth(startOfMonth(date));
  }, [onSelectDate]);

  const shiftMonth = useCallback((delta: number) => {
    setVisibleMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  }, []);

  const jumpToToday = useCallback(() => {
    onSelectDate(todayDate);
    setVisibleMonth(startOfMonth(initialToday));
  }, [initialToday, onSelectDate, todayDate]);

  return (
    <div
      data-testid="sidebar-quick-note-panel"
      className="mt-4 rounded-[20px] border border-white/60 bg-white/40 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.03)] backdrop-blur-xl"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span
          className="text-[14px] font-[600] tracking-wide text-slate-800"
          style={compactCalendarTextStyle}
        >
          {getMonthLabel(visibleMonth)}
        </span>
        <div className="flex items-center gap-1 text-slate-500">
          <button
            type="button"
            aria-label="回到今天"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-slate-100 hover:text-slate-800"
            onClick={jumpToToday}
          >
            <Calendar size={13} />
          </button>
          <button
            type="button"
            aria-label="上一个月"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-slate-100 hover:text-slate-800"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            aria-label="下一个月"
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-slate-100 hover:text-slate-800"
            onClick={() => shiftMonth(1)}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_repeat(7,minmax(0,1fr))] gap-y-1.5 text-center text-[13px] font-sans">
        <div className="mb-1.5 font-[500] text-slate-500" style={compactCalendarTextStyle}>周</div>
        {DAY_LABELS.map((label) => (
          <div key={label} className="mb-1.5 font-[500] text-slate-500" style={compactCalendarTextStyle}>{label}</div>
        ))}

        {calendarWeeks.map((week) => (
          <FragmentRow
            key={`${monthKey}-week-${week.weekNumber}-${week.days[0]?.dateKey}`}
            weekNumber={week.weekNumber}
            days={week.days}
            noteDateSet={noteDateSet}
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelectDate={selectDate}
          />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({
  weekNumber,
  days,
  noteDateSet,
  selectedDate,
  todayDate,
  onSelectDate,
}: {
  weekNumber: number;
  days: Array<{ date: Date; dateKey: string; inMonth: boolean }>;
  noteDateSet: Set<string>;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: Date) => void;
}) {
  return (
    <>
      <div
        className="flex h-7 items-center justify-center font-[500] text-indigo-500"
        style={compactCalendarTextStyle}
      >
        {weekNumber}
      </div>
      {days.map((day) => {
        const isSelected = day.dateKey === selectedDate;
        const isToday = day.dateKey === todayDate;
        const hasNote = noteDateSet.has(day.dateKey);

        return (
          <button
            key={day.dateKey}
            type="button"
            aria-label={`选择 ${day.dateKey}`}
            aria-pressed={isSelected}
            data-has-note={hasNote ? 'true' : 'false'}
            className={`relative flex h-7 flex-col items-center justify-center rounded-[8px] text-[13px] transition-colors ${
              isSelected
                ? 'bg-[#e6e2f5] text-indigo-600'
                : day.inMonth
                  ? 'text-slate-800 hover:bg-slate-100/80'
                  : 'text-slate-300 hover:bg-slate-50'
            }`}
            style={compactCalendarTextStyle}
            onClick={() => onSelectDate(day.date)}
          >
            <span className={`leading-none ${isToday && !isSelected ? 'text-indigo-500' : ''}`}>
              {day.date.getDate()}
            </span>
            {hasNote ? (
              <span className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full bg-indigo-500" />
            ) : null}
          </button>
        );
      })}
    </>
  );
}
