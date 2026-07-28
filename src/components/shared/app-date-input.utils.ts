import { format, isValid, parse } from 'date-fns';
import type { AppDatePickerMode } from '@/components/shared/AppDatePickerPanel';

const DATE_PATTERNS = ['yyyy-MM-dd', 'dd.MM.yyyy', 'dd/MM/yyyy', 'd.M.yyyy', 'd/M/yyyy'];
const DATETIME_PATTERNS = [
  "yyyy-MM-dd'T'HH:mm",
  'yyyy-MM-dd HH:mm',
  'dd.MM.yyyy HH:mm',
  'dd.MM.yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm',
];
const TIME_PATTERNS = ['HH:mm', 'H:mm'];

function tryParse(raw: string, patterns: string[]): Date | null {
  const value = raw.trim();
  if (!value) return null;
  for (const pattern of patterns) {
    const parsed = parse(value, pattern, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
}

export function formatManualDateValue(date: Date, mode: AppDatePickerMode): string {
  if (mode === 'date') return format(date, 'yyyy-MM-dd');
  if (mode === 'time') return format(date, 'HH:mm');
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function normalizeManualDateInput(raw: string, mode: AppDatePickerMode): string | null {
  const value = raw.trim();
  if (!value) return '';

  const patterns = mode === 'date'
    ? DATE_PATTERNS
    : mode === 'time'
      ? TIME_PATTERNS
      : [...DATETIME_PATTERNS, ...DATE_PATTERNS];

  const parsed = tryParse(value, patterns);
  if (!parsed) return null;

  if (mode === 'datetime-local' && !value.includes(':')) {
    const dateOnly = format(parsed, 'yyyy-MM-dd');
    return `${dateOnly}T00:00`;
  }

  return formatManualDateValue(parsed, mode);
}
