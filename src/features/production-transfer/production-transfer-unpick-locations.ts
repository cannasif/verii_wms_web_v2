const UNPICK_ALLOWED_LOCATION_TYPES = new Set([
  'Shelf',
  'Cell',
  'Rack',
  'Receiving',
]);

export type ProductionTransferUnpickLocationOption = {
  id: number;
  locationType?: string;
  isPickable?: boolean;
  isQuarantine?: boolean;
};

export function isProductionTransferUnpickTargetLocation(
  item: ProductionTransferUnpickLocationOption,
  options: {
    excludedIds: ReadonlySet<number>;
    allowedIds?: ReadonlySet<number>;
  },
): boolean {
  if (options.excludedIds.has(item.id)) return false;
  if (item.isQuarantine === true) return false;
  if (item.isPickable === false) return false;
  if (options.allowedIds?.has(item.id)) return true;
  return UNPICK_ALLOWED_LOCATION_TYPES.has(item.locationType ?? '');
}
