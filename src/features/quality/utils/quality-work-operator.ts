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
