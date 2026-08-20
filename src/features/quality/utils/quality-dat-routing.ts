export interface QualityDatRouteTarget {
  decision: string;
  targetWarehouseId?: number | null;
  /** When set, compared against the target instead of the default receiving warehouse. */
  sourceWarehouseId?: number | null;
}

export function requiresQualityDat(
  defaultSourceWarehouseId: number,
  targets: readonly QualityDatRouteTarget[],
): boolean {
  return targets.some((target) => {
    const sourceWarehouseId = target.sourceWarehouseId && target.sourceWarehouseId > 0
      ? target.sourceWarehouseId
      : defaultSourceWarehouseId;
    return sourceWarehouseId > 0
      && target.decision !== 'Returned'
      && Boolean(target.targetWarehouseId)
      && target.targetWarehouseId !== sourceWarehouseId;
  });
}

export function resolveQualityInventorySourceWarehouseId(args: {
  lineDecision: string;
  quarantineLocationId?: number | null;
  dispositions: ReadonlyArray<{
    lineId: number;
    decision: string;
    sequenceNo: number;
    targetWarehouseId: number;
  }>;
  lineId: number;
  quarantineDestinations: ReadonlyArray<{
    locationId: number;
    warehouseId: number;
  }>;
  fallbackWarehouseId: number;
}): number {
  if (args.lineDecision === 'Quarantined') {
    const quarantineMoves = args.dispositions
      .filter((disposition) =>
        disposition.lineId === args.lineId
        && disposition.decision === 'Quarantined'
        && disposition.targetWarehouseId > 0)
      .sort((left, right) => right.sequenceNo - left.sequenceNo);
    if (quarantineMoves[0]) return quarantineMoves[0].targetWarehouseId;

    if (args.quarantineLocationId) {
      const destination = args.quarantineDestinations.find(
        (item) => item.locationId === args.quarantineLocationId,
      );
      if (destination?.warehouseId) return destination.warehouseId;
    }
  }

  return args.fallbackWarehouseId;
}
