import { format, isValid, parse } from 'date-fns';
import type { AppDatePickerMode } from '@/components/shared/AppDatePickerPanel';

const DATE_PATTERNS = [
  'yyyy.MM.dd',
  'yyyy-MM-dd',
  'dd.MM.yyyy',
  'dd-MM-yyyy',
  'dd/MM/yyyy',
  'd.M.yyyy',
  'd/M/yyyy',
];
const DATETIME_PATTERNS = [
  "yyyy-MM-dd'T'HH:mm",
  'yyyy-MM-dd HH:mm',
  'yyyy.MM.dd HH:mm',
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampMonth(raw: string): string {
  if (!raw) return '';
  if (raw.length === 1) {
    return Number(raw) > 1 ? `0${raw}` : raw;
  }
  let month = Number(raw.slice(0, 2));
  if (!Number.isFinite(month) || month < 1) month = 1;
  if (month > 12) month = 12;
  return String(month).padStart(2, '0');
}

function clampDay(raw: string, year: number, month: number): string {
  if (!raw) return '';
  const maxDay =
    Number.isFinite(year) && month >= 1 && month <= 12 ? daysInMonth(year, month) : 31;
  if (raw.length === 1) {
    const first = Number(raw);
    if (first > 3 || (maxDay < 30 && first > Math.floor(maxDay / 10))) {
      return String(clamp(first, 1, maxDay)).padStart(2, '0');
    }
    return raw;
  }
  let day = Number(raw.slice(0, 2));
  if (!Number.isFinite(day) || day < 1) day = 1;
  day = clamp(day, 1, maxDay);
  return String(day).padStart(2, '0');
}

/**
 * Yıl önde mi, gün önde mi?
 * - 19xx / 20xx ile başlıyorsa → YYYY.MM.DD
 * - Aksi halde (TR) → DD.MM.YYYY  (örn. 12102026 → 12.10.2026)
 */
export function isYearFirstDateDigits(digits: string): boolean {
  if (digits.startsWith('19') || digits.startsWith('20')) return true;
  if (digits.length < 4) return false;
  const year = Number(digits.slice(0, 4));
  return year >= 1900 && year <= 2100;
}

function maskYearFirst(digits: string): string {
  const year = digits.slice(0, Math.min(4, digits.length));
  if (digits.length <= 4) return year;

  const month = clampMonth(digits.slice(4, Math.min(6, digits.length)));
  if (digits.length <= 6) return `${year}.${month}`;

  const yearNum = Number(year);
  const monthNum = Number(month.padStart(2, '0'));
  const day = clampDay(digits.slice(6, 8), yearNum, monthNum);
  return `${year}.${month.padStart(2, '0')}.${day}`;
}

function maskDayFirst(digits: string): string {
  let day = digits.slice(0, Math.min(2, digits.length));
  if (digits.length <= 2) {
    if (day.length === 1 && Number(day) > 3) {
      return String(clamp(Number(day), 1, 31)).padStart(2, '0');
    }
    return day;
  }

  day = clampDay(day.padStart(2, '0').slice(0, 2), 2000, 1);
  // provisional clamp with max 31 until we know month
  {
    let d = Number(day);
    if (!Number.isFinite(d) || d < 1) d = 1;
    d = clamp(d, 1, 31);
    day = String(d).padStart(2, '0');
  }

  if (digits.length <= 2) return day;

  const month = clampMonth(digits.slice(2, Math.min(4, digits.length)));
  if (digits.length <= 4) return `${day}.${month}`;

  const year = digits.slice(4, Math.min(8, digits.length));
  if (year.length < 4) return `${day}.${month.padStart(2, '0')}.${year}`;

  const yearNum = Number(year.slice(0, 4));
  const monthNum = Number(month.padStart(2, '0'));
  const maxDay = daysInMonth(yearNum, monthNum);
  let d = Number(day);
  d = clamp(d, 1, maxDay);
  day = String(d).padStart(2, '0');

  return `${day}.${month.padStart(2, '0')}.${year.slice(0, 4)}`;
}

/** ISO `yyyy-MM-dd` → display `yyyy.MM.dd`. */
export function toDisplayDateValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return `${iso[1]}.${iso[2]}.${iso[3]}`;
  return trimmed;
}

/** Digits → dotted date; year-first vs day-first otomatik. */
export function maskManualDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  return isYearFirstDateDigits(digits) ? maskYearFirst(digits) : maskDayFirst(digits);
}

export function formatManualDateValue(date: Date, mode: AppDatePickerMode): string {
  if (mode === 'date') return format(date, 'yyyy-MM-dd');
  if (mode === 'time') return format(date, 'HH:mm');
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeManualDateInput(raw: string, mode: AppDatePickerMode): string | null {
  const value = raw.trim();
  if (!value) return '';

  if (mode === 'date') {
    const masked = maskManualDateTyping(value);

    const ymd = masked.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
    if (ymd) {
      return isoFromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    }

    const dmy = masked.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy) {
      return isoFromParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    }

    // Explicit slash/dash forms already complete
    const parsed = tryParse(value, DATE_PATTERNS);
    if (parsed) return format(parsed, 'yyyy-MM-dd');

    return null;
  }

  const patterns = mode === 'time'
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
