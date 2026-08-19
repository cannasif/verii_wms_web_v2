import {
  DEFAULT_PROJECT_SETTINGS,
  useProjectSettingsStore,
} from "@/stores/project-settings-store";
import type { ProjectSettings } from "@/features/project-settings/project-settings.types";
const settings = (override?: Partial<ProjectSettings>) => ({
  ...DEFAULT_PROJECT_SETTINGS,
  ...(useProjectSettingsStore.getState().settings ?? DEFAULT_PROJECT_SETTINGS),
  ...override,
});
type DateInput = string | number | Date | null | undefined;
const parsed = (value: DateInput) => {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
export function formatProjectNumber(
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
  override?: Partial<ProjectSettings>,
) {
  const s = settings(override);
  const clampFractionDigits = (input: number): number =>
    Math.min(20, Math.max(0, Number.isFinite(input) ? Math.trunc(input) : 0));
  const maximumFractionDigits = clampFractionDigits(
    options?.maximumFractionDigits ?? s.decimalPlaces,
  );
  const requestedMinimum = clampFractionDigits(
    options?.minimumFractionDigits
      ?? (options?.maximumFractionDigits == null
        ? s.decimalPlaces
        : Math.min(s.decimalPlaces, maximumFractionDigits)),
  );
  const minimumFractionDigits = Math.min(
    requestedMinimum,
    maximumFractionDigits,
  );

  return new Intl.NumberFormat(s.numberLocale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/** Accepts TR/EN decimal entry (`1,5` / `1.5` / `1.000` / `1.234,56`) and returns a finite number or NaN. */
export function parseLocalizedNumber(
  value: string,
  override?: Partial<ProjectSettings>,
): number {
  const compact = value.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
  if (!compact) return Number.NaN;
  const s = settings(override);
  const parts = new Intl.NumberFormat(s.numberLocale).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ".";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ",";
  const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedDecimal = decimal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const thousandPattern = new RegExp(`^-?\\d{1,3}(?:${escapedGroup}\\d{3})+$`);
  let work = compact;
  if (group !== decimal && (work.includes(decimal) || thousandPattern.test(work))) {
    work = work.split(group).join("");
  }
  if (decimal !== "." && work.includes(decimal)) {
    const last = work.lastIndexOf(decimal);
    work = `${work.slice(0, last).replace(new RegExp(escapedDecimal, "g"), "")}.${work.slice(last + 1)}`;
  }
  const parsed = Number(work);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isPieceUnit(unitCode?: string | null): boolean {
  const normalized = (unitCode ?? "").trim().toLocaleUpperCase("tr-TR");
  return (
    normalized === "AD" ||
    normalized === "ADET" ||
    normalized === "ADETİ" ||
    normalized === "PCS" ||
    normalized === "PC" ||
    normalized === "EA"
  );
}

export function formatProjectQuantity(
  value: number,
  unitCode?: string | null,
  override?: Partial<ProjectSettings>,
): string {
  if (!Number.isFinite(value)) return "";
  if (isPieceUnit(unitCode)) {
    return formatProjectNumber(Math.round(value), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }, override);
  }
  const places = settings(override).decimalPlaces;
  return formatProjectNumber(value, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }, override);
}

function localeNumberSymbols(override?: Partial<ProjectSettings>) {
  const s = settings(override);
  const parts = new Intl.NumberFormat(s.numberLocale).formatToParts(12345.6);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ".",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ",",
    places: s.decimalPlaces,
  };
}

/** Live-mask a quantity field: digits only, locale grouping, optional decimals by unit. */
export function maskProjectQuantityInput(
  raw: string,
  unitCode?: string | null,
  override?: Partial<ProjectSettings>,
): string {
  const piece = isPieceUnit(unitCode || "ADET");
  const { decimal, places } = localeNumberSymbols(override);
  const altDecimal = decimal === "," ? "." : ",";
  const trailingDecimal = !piece && (raw.endsWith(decimal) || raw.endsWith(altDecimal));
  let intSource = raw;
  let fracSource = "";
  if (!piece) {
    const lastDec = Math.max(raw.lastIndexOf(decimal), raw.lastIndexOf(altDecimal));
    if (lastDec >= 0) {
      intSource = raw.slice(0, lastDec);
      fracSource = raw.slice(lastDec + 1);
    }
  }
  const intDigits = intSource.replace(/\D/g, "");
  if (piece) {
    if (!intDigits) return "";
    return formatProjectNumber(Number(intDigits), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }, override);
  }
  const fracDigits = fracSource.replace(/\D/g, "").slice(0, Math.max(0, places));
  if (!intDigits && !fracDigits && !trailingDecimal) return "";
  const intFormatted = formatProjectNumber(Number(intDigits || "0"), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }, override);
  if (!fracDigits && !trailingDecimal) return intFormatted;
  return `${intFormatted}${decimal}${fracDigits}`;
}

function caretFromDigitCount(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted.charAt(index))) {
      seen += 1;
      if (seen >= digitsBefore) return index + 1;
    }
  }
  return formatted.length;
}

export function nextQuantityCaret(
  previous: string,
  caret: number,
  next: string,
): number {
  const digitsBefore = previous.slice(0, Math.max(0, caret)).replace(/\D/g, "").length;
  const endsWithSep = /[.,]$/.test(previous) && /[.,]$/.test(next);
  if (endsWithSep) return next.length;
  return caretFromDigitCount(next, digitsBefore);
}
function dateParts(value: DateInput, override?: Partial<ProjectSettings>) {
  const date = parsed(value);
  if (!date) return null;
  const s = settings(override);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: s.timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((x) => x.type === type)?.value ?? "";
  const fullYear = get("year");
  return {
    day: get("day"),
    month: get("month"),
    year: s.yearFormat === "yy" ? fullYear.slice(-2) : fullYear,
  };
}
export function formatProjectDate(
  value: DateInput,
  override?: Partial<ProjectSettings>,
) {
  const p = dateParts(value, override);
  if (!p) return "-";
  const pattern = settings(override).dateFormat;
  return pattern === "MM/dd/yyyy"
    ? `${p.month}/${p.day}/${p.year}`
    : pattern === "yyyy-MM-dd"
      ? `${p.year}-${p.month}-${p.day}`
      : `${p.day}.${p.month}.${p.year}`;
}
export function formatProjectTime(
  value: DateInput,
  override?: Partial<ProjectSettings>,
) {
  const date = parsed(value);
  if (!date) return "-";
  const s = settings(override);
  const hour12 = s.timeFormat.startsWith("hh");
  const withSeconds = s.timeFormat.includes("ss");
  return new Intl.DateTimeFormat(s.numberLocale, {
    timeZone: s.timeZoneId,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12,
  }).format(date);
}
export function formatProjectDateTime(
  value: DateInput,
  override?: Partial<ProjectSettings>,
) {
  if (!parsed(value)) return "-";
  return `${formatProjectDate(value, override)} ${formatProjectTime(value, override)}`;
}
export function formatProjectYear(
  value: DateInput,
  override?: Partial<ProjectSettings>,
) {
  const p = dateParts(value, override);
  return p?.year ?? "-";
}
