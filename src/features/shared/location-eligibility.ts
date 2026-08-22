export const PUTAWAY_EXCLUDED_LOCATION_TYPES = ['Zone', 'Quarantine', 'Virtual'] as const;

export type PutawayExcludedLocationType = (typeof PUTAWAY_EXCLUDED_LOCATION_TYPES)[number];

export type PutawayLocationCandidate = {
  id: number;
  warehouseId?: number | null;
  locationType?: string | null;
};

export type PutawayLocationEligibilityOptions = {
  warehouseId: number;
  excludedIds?: ReadonlySet<number>;
};

export function isExcludedPutawayLocationType(locationType?: string | null): boolean {
  const normalized = locationType?.trim().toLocaleLowerCase('en-US') ?? '';
  return PUTAWAY_EXCLUDED_LOCATION_TYPES.some(
    (type) => type.toLocaleLowerCase('en-US') === normalized,
  );
}

export function isEligiblePutawayTargetLocation(
  item: PutawayLocationCandidate,
  options: PutawayLocationEligibilityOptions,
): boolean {
  if (!(options.warehouseId > 0)) return false;
  if (Number(item.warehouseId) !== Number(options.warehouseId)) return false;
  if (options.excludedIds?.has(item.id)) return false;
  if (isExcludedPutawayLocationType(item.locationType)) return false;
  return true;
}

export function buildExcludedPutawayLocationTypeFilters(): Array<{
  column: string;
  operator: string;
  value: string;
}> {
  return PUTAWAY_EXCLUDED_LOCATION_TYPES.map((value) => ({
    column: 'locationType',
    operator: 'notEquals',
    value,
  }));
}
