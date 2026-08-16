const STORAGE_PREFIX = "wms.quality.control-qty.v1";
const CACHE_EPS = 1e-6;

export type QualityControlQuantityCacheLine = {
  inspectedQuantity: string;
  confirmedInspectedQuantity: string;
  baselineInspectedQuantity: number;
};

export type QualityControlQuantityCache = {
  v: 1;
  inspectionId: number;
  lines: Record<string, QualityControlQuantityCacheLine>;
};

type DraftControlFields = {
  inspectedQuantity: string;
  confirmedInspectedQuantity: string;
};

function canUseStorage(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null): storage is Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return storage != null;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function qualityControlQuantityCacheKey(userId: number, inspectionId: number): string {
  return `${STORAGE_PREFIX}:${userId}:${inspectionId}`;
}

export function readQualityControlQuantityCache(
  userId: number,
  inspectionId: number,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = defaultStorage(),
): Record<number, QualityControlQuantityCacheLine> {
  if (!canUseStorage(storage) || userId <= 0 || inspectionId <= 0) return {};
  try {
    const raw = storage.getItem(qualityControlQuantityCacheKey(userId, inspectionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QualityControlQuantityCache;
    if (parsed?.v !== 1 || parsed.inspectionId !== inspectionId || !parsed.lines) return {};
    const result: Record<number, QualityControlQuantityCacheLine> = {};
    for (const [lineIdRaw, line] of Object.entries(parsed.lines)) {
      const lineId = Number(lineIdRaw);
      if (!Number.isFinite(lineId) || lineId <= 0 || !line) continue;
      result[lineId] = {
        inspectedQuantity: String(line.inspectedQuantity ?? ""),
        confirmedInspectedQuantity: String(line.confirmedInspectedQuantity ?? ""),
        baselineInspectedQuantity: Number(line.baselineInspectedQuantity) || 0,
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function writeQualityControlQuantityCache(
  userId: number,
  inspectionId: number,
  lines: Record<number, QualityControlQuantityCacheLine>,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = defaultStorage(),
): void {
  if (!canUseStorage(storage) || userId <= 0 || inspectionId <= 0) return;
  const key = qualityControlQuantityCacheKey(userId, inspectionId);
  const payloadLines: Record<string, QualityControlQuantityCacheLine> = {};
  for (const [lineIdRaw, line] of Object.entries(lines)) {
    if (!line.inspectedQuantity.trim() && !line.confirmedInspectedQuantity.trim()) continue;
    payloadLines[lineIdRaw] = line;
  }
  try {
    if (Object.keys(payloadLines).length === 0) {
      storage.removeItem(key);
      return;
    }
    const payload: QualityControlQuantityCache = {
      v: 1,
      inspectionId,
      lines: payloadLines,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Private mode or quota — ignore; the live form still works.
  }
}

export function clearQualityControlQuantityCache(
  userId: number,
  inspectionId: number,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = defaultStorage(),
): void {
  if (!canUseStorage(storage) || userId <= 0 || inspectionId <= 0) return;
  try {
    storage.removeItem(qualityControlQuantityCacheKey(userId, inspectionId));
  } catch {
    // ignore
  }
}

export function extractQualityControlQuantityCache(
  drafts: Record<number, { inspectedQuantity?: string; confirmedInspectedQuantity?: string }>,
  lines: Array<{ id: number; inspectedQuantity: number }>,
): Record<number, QualityControlQuantityCacheLine> {
  const result: Record<number, QualityControlQuantityCacheLine> = {};
  for (const line of lines) {
    const draft = drafts[line.id];
    const inspectedQuantity = draft?.inspectedQuantity?.trim() ?? "";
    const confirmedInspectedQuantity = draft?.confirmedInspectedQuantity?.trim() ?? "";
    if (!inspectedQuantity && !confirmedInspectedQuantity) continue;
    result[line.id] = {
      inspectedQuantity,
      confirmedInspectedQuantity,
      baselineInspectedQuantity: line.inspectedQuantity,
    };
  }
  return result;
}

export function applyQualityControlQuantityCache<T extends DraftControlFields>(
  drafts: Record<number, T>,
  lines: Array<{ id: number; inspectedQuantity: number; remainingInspectable: number }>,
  cached: Record<number, QualityControlQuantityCacheLine>,
  parseQuantity: (value: string) => number,
): Record<number, T> {
  if (Object.keys(cached).length === 0) return drafts;
  let changed = false;
  const next = { ...drafts };
  for (const line of lines) {
    const cachedLine = cached[line.id];
    const draft = next[line.id];
    if (!cachedLine || !draft) continue;
    if (line.remainingInspectable <= CACHE_EPS) continue;
    if (line.inspectedQuantity - cachedLine.baselineInspectedQuantity > CACHE_EPS) continue;

    const inspectedRaw = cachedLine.inspectedQuantity.trim();
    const confirmedRaw = cachedLine.confirmedInspectedQuantity.trim();
    if (!inspectedRaw && !confirmedRaw) continue;

    const inspected = inspectedRaw ? parseQuantity(inspectedRaw) : NaN;
    if (inspectedRaw && (!Number.isFinite(inspected) || inspected <= 0 || inspected - line.remainingInspectable > CACHE_EPS)) {
      continue;
    }

    next[line.id] = {
      ...draft,
      inspectedQuantity: inspectedRaw || draft.inspectedQuantity,
      confirmedInspectedQuantity: confirmedRaw || draft.confirmedInspectedQuantity,
    };
    changed = true;
  }
  return changed ? next : drafts;
}
