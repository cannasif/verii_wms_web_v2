const CONTROL_QTY_EPS = 1e-6;

export function resolveDecisionControlQuantity(
  requested: number | null,
  remainingInspectable: number,
  requiredMinimum: number,
): { additional: number; missingRequired: boolean } {
  if (remainingInspectable <= CONTROL_QTY_EPS) {
    return { additional: 0, missingRequired: false };
  }
  if (requested == null || Number.isNaN(requested)) {
    return { additional: 0, missingRequired: requiredMinimum > CONTROL_QTY_EPS };
  }
  return { additional: requested, missingRequired: false };
}

export function sanitizeIntegerQuantityInput(value: string): string {
  let result = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      result += ch;
      continue;
    }
    if (ch === "." || ch === ",") break;
  }
  return result;
}

export function sanitizeDecimalQuantityInput(value: string): string {
  let separatorSeen = false;
  let result = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      result += ch;
      continue;
    }
    if ((ch === "." || ch === ",") && !separatorSeen) {
      separatorSeen = true;
      result += ch;
    }
  }
  return result;
}

function stringifyCappedQuantity(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
  return String(rounded);
}

export function capQuantityInput(value: string, maximum: number): string {
  const sanitized = sanitizeDecimalQuantityInput(value);
  if (!sanitized) return "";
  const normalized = sanitized.replace(",", ".");
  const incomplete = normalized === "." || normalized.endsWith(".");
  const parsed = incomplete
    ? Number(normalized === "." ? "0" : normalized.slice(0, -1))
    : Number(normalized);
  if (!Number.isFinite(parsed)) return sanitized;
  const limit = Math.max(0, maximum);
  if (parsed - limit > CONTROL_QTY_EPS) return stringifyCappedQuantity(limit);
  return sanitized;
}

export function remainingCapacityForDistributionRow(
  rows: Array<{ key: string; quantity: string }>,
  key: string,
  totalRemaining: number,
): number {
  const others = rows.reduce((sum, row) => {
    if (row.key === key) return sum;
    const qty = Number(String(row.quantity ?? "").trim().replace(",", "."));
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
  return Math.max(0, Math.round((totalRemaining - others) * 1_000_000) / 1_000_000);
}

export function collectQualityProgressControlQuantities(
  lines: Array<{ id: number }>,
  drafts: Record<number, { confirmedInspectedQuantity?: string; inspectedQuantity?: string }>,
  parseQuantity: (value: string) => number,
): Array<{ lineId: number; inspectedQuantity: number }> {
  const seen = new Set<number>();
  const result: Array<{ lineId: number; inspectedQuantity: number }> = [];
  for (const line of lines) {
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    const draft = drafts[line.id];
    const raw = draft?.confirmedInspectedQuantity?.trim()
      ? draft.confirmedInspectedQuantity
      : draft?.inspectedQuantity?.trim() ?? "";
    if (!raw) continue;
    const inspected = parseQuantity(raw);
    if (!Number.isFinite(inspected) || inspected <= 0) continue;
    result.push({ lineId: line.id, inspectedQuantity: inspected });
  }
  return result;
}

export function formatQualityWorkOperatorName(
  startedByName?: string | null,
  stoppedByName?: string | null,
): string | null {
  const started = startedByName?.trim() ?? "";
  const stopped = stoppedByName?.trim() ?? "";
  if (!started && !stopped) return null;
  if (started && stopped && started !== stopped) return `${started} → ${stopped}`;
  return started || stopped;
}
