import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { tr, enUS, de, fr, es, it, ar, type Locale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type AppDatePickerMode = 'date' | 'datetime-local' | 'time';

const LOCALES: Record<string, Locale> = {
  tr,
  en: enUS,
  de,
  fr,
  es,
  it,
  ar,
};

function resolveLocale(language: string): Locale {
  return LOCALES[language.split('-')[0] ?? 'en'] ?? enUS;
}

function parseValue(value: string, mode: AppDatePickerMode): Date | null {
  if (!value) return null;
  const pattern = mode === 'date'
    ? 'yyyy-MM-dd'
    : mode === 'time'
      ? 'HH:mm'
      : "yyyy-MM-dd'T'HH:mm";
  const parsed = parse(value, pattern, new Date());
  return isValid(parsed) ? parsed : null;
}

function formatValue(date: Date, mode: AppDatePickerMode): string {
  if (mode === 'date') return format(date, 'yyyy-MM-dd');
  if (mode === 'time') return format(date, 'HH:mm');
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface AppDatePickerPanelProps {
  mode: AppDatePickerMode;
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  min?: string;
  max?: string;
}

export function AppDatePickerPanel({
  mode,
  value,
  onChange,
  onClose,
  min,
  max,
}: AppDatePickerPanelProps): ReactElement {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const selected = parseValue(value, mode);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const [draft, setDraft] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    const parsed = parseValue(value, mode);
    if (!parsed) return;
    setDraft(parsed);
    setViewMonth(startOfMonth(parsed));
  }, [mode, value]);

  const minDate = min ? parseValue(min, mode === 'time' ? 'time' : mode === 'datetime-local' ? 'datetime-local' : 'date') : null;
  const maxDate = max ? parseValue(max, mode === 'time' ? 'time' : mode === 'datetime-local' ? 'datetime-local' : 'date') : null;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { locale });
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [locale, viewMonth]);

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { locale });
    return Array.from({ length: 7 }, (_, index) =>
      format(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index), 'EEEEE', { locale }),
    );
  }, [locale]);

  const apply = (next: Date, close = false): void => {
    setDraft(next);
    onChange(formatValue(next, mode));
    if (close) onClose?.();
  };

  const selectDay = (day: Date): void => {
    const next = new Date(day);
    if (mode !== 'date') {
      next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
    }
    setDraft(next);
    onChange(formatValue(next, mode));
    if (mode === 'date') onClose?.();
  };

  const setTimePart = (hours: number, minutes: number): void => {
    const next = new Date(draft);
    next.setHours(clamp(hours, 0, 23), clamp(minutes, 0, 59), 0, 0);
    apply(next);
  };

  const isDisabledDay = (day: Date): boolean => {
    if (mode === 'time') return false;
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    if (minDate) {
      const minStart = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (dayStart < minStart) return true;
    }
    if (maxDate) {
      const maxStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
      if (dayStart > maxStart) return true;
    }
    return false;
  };

  return (
    <div className="wms-date-picker-panel">
      {mode !== 'time' && (
        <>
          <div className="wms-date-picker-header flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={t('dateInput.prevMonth')}
              className="wms-date-picker-header__nav grid shrink-0 place-items-center rounded-lg"
              onClick={() => setViewMonth((current) => subMonths(current, 1))}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <div className="wms-date-picker-header__title min-w-0 flex-1 text-center font-bold capitalize">
              {format(viewMonth, 'LLLL yyyy', { locale })}
            </div>
            <button
              type="button"
              aria-label={t('dateInput.nextMonth')}
              className="wms-date-picker-header__nav grid shrink-0 place-items-center rounded-lg"
              onClick={() => setViewMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="mb-1 wms-date-picker-grid">
            {weekdayLabels.map((label, index) => (
              <div key={`${label}-${index}`} className="wms-date-picker-weekday">
                {label}
              </div>
            ))}
          </div>

          <div className="wms-date-picker-grid wms-date-picker-days">
            {days.map((day) => {
              const inactive = !isSameMonth(day, viewMonth);
              const selectedDay = selected ? isSameDay(day, selected) : false;
              const disabled = isDisabledDay(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'wms-date-picker-day grid place-items-center rounded-lg text-sm font-semibold transition',
                    inactive && 'wms-date-picker-day--inactive',
                    isToday(day) && !selectedDay && 'wms-date-picker-day--today',
                    selectedDay && 'wms-date-picker-day--selected',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode !== 'date' && (
        <div className={cn('grid grid-cols-2 gap-2', mode !== 'time' && 'mt-4 border-t border-[var(--wms-app-border)] pt-4')}>
          <label className="wms-date-picker-time-field space-y-1">
            {t('dateInput.hour')}
            <input
              type="number"
              min={0}
              max={23}
              value={draft.getHours()}
              onChange={(event) => setTimePart(Number(event.target.value), draft.getMinutes())}
              className="input h-10 px-3"
            />
          </label>
          <label className="wms-date-picker-time-field space-y-1">
            {t('dateInput.minute')}
            <input
              type="number"
              min={0}
              max={59}
              value={draft.getMinutes()}
              onChange={(event) => setTimePart(draft.getHours(), Number(event.target.value))}
              className="input h-10 px-3"
            />
          </label>
        </div>
      )}

      <div className="wms-date-picker-footer">
        <button
          type="button"
          className="wms-date-picker-footer__button wms-date-picker-footer__button--muted rounded-lg font-semibold"
          onClick={() => {
            onChange('');
            onClose?.();
          }}
        >
          {t('dateInput.clear')}
        </button>
        <div className="wms-date-picker-footer__actions">
          {mode !== 'time' && (
            <button
              type="button"
              className="wms-date-picker-footer__button wms-date-picker-footer__button--brand rounded-lg font-semibold"
              onClick={() => {
                const today = new Date();
                if (mode === 'datetime-local') {
                  today.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
                }
                setViewMonth(startOfMonth(today));
                apply(today, mode === 'date');
              }}
            >
              {t('dateInput.today')}
            </button>
          )}
          {mode !== 'date' && (
            <button
              type="button"
              className="wms-date-picker-footer__button wms-date-picker-footer__button--primary rounded-lg font-semibold"
              onClick={() => onClose?.()}
            >
              {t('dateInput.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
