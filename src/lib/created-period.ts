export const CREATED_PERIODS = ['day', 'week', 'month', 'year'] as const;

export type CreatedPeriod = (typeof CREATED_PERIODS)[number];

export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function buildCreatedPeriodRange(
  period: CreatedPeriod,
  now = new Date(),
): { start: Date; end: Date } {
  const start = startOfLocalDay(now);
  if (period === 'day') {
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (period === 'week') {
    const mondayOffset = (start.getDay() + 6) % 7;
    const weekStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - mondayOffset);
    return { start: weekStart, end: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7) };
  }
  if (period === 'month') {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { start: monthStart, end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1) };
  }
  const yearStart = new Date(start.getFullYear(), 0, 1);
  return { start: yearStart, end: new Date(yearStart.getFullYear() + 1, 0, 1) };
}

export function shiftCreatedPeriodAnchor(
  period: CreatedPeriod,
  anchor: Date,
  step: -1 | 1,
): Date {
  const start = startOfLocalDay(anchor);
  if (period === 'day') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + step);
  }
  if (period === 'week') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + step * 7);
  }
  if (period === 'month') {
    return new Date(start.getFullYear(), start.getMonth() + step, 1);
  }
  return new Date(start.getFullYear() + step, 0, 1);
}

export function isCurrentCreatedPeriod(
  period: CreatedPeriod,
  anchor: Date,
  now = new Date(),
): boolean {
  const current = buildCreatedPeriodRange(period, now);
  const selected = buildCreatedPeriodRange(period, anchor);
  return selected.start.getTime() === current.start.getTime();
}

export function canAdvanceCreatedPeriod(
  period: CreatedPeriod,
  anchor: Date,
  now = new Date(),
): boolean {
  const current = buildCreatedPeriodRange(period, now);
  const next = buildCreatedPeriodRange(
    period,
    shiftCreatedPeriodAnchor(period, anchor, 1),
  );
  return next.start.getTime() <= current.start.getTime();
}

export function toDateOnlyIso(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isInstantInCreatedPeriod(
  value: string | Date | null | undefined,
  period: CreatedPeriod | null,
  anchor: Date,
): boolean {
  if (!period) return true;
  if (value == null || value === '') return false;
  const parsed = typeof value === 'string' ? parseFlexibleDate(value) : value;
  if (Number.isNaN(parsed.getTime())) return false;
  const { start, end } = buildCreatedPeriodRange(period, anchor);
  return parsed.getTime() >= start.getTime() && parsed.getTime() < end.getTime();
}

function parseFlexibleDate(value: string): Date {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(trimmed);
}
