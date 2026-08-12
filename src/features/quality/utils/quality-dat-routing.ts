export interface QualityDatRouteTarget {
  decision: string;
  targetWarehouseId?: number | null;
}

export function requiresQualityDat(
  sourceWarehouseId: number,
  targets: readonly QualityDatRouteTarget[],
): boolean {
  if (sourceWarehouseId <= 0) return false;
  return targets.some((target) =>
    target.decision !== 'Returned'
    && Boolean(target.targetWarehouseId)
    && target.targetWarehouseId !== sourceWarehouseId,
  );
}
