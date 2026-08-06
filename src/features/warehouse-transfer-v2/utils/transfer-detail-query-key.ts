import type { TransferApiVariant } from '../api/warehouse-transfer.api';

export function transferDetailQueryKey(variant: TransferApiVariant, id: number) {
  return variant === 'production'
    ? (['production-transfer', 'detail', id] as const)
    : (['warehouse-transfer', 'detail', variant, id] as const);
}
