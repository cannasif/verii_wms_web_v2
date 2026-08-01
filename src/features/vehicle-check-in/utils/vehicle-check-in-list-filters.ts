import type {GridFilter} from '@/components/shared/AdvancedDataGrid';

export const VEHICLE_CHECK_IN_STATUS_TAB_ALL = 'all';
export const VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN = 'unknown';
export const VEHICLE_CHECK_IN_UNKNOWN_STATUS = 'ContainsUnknownPlates';

export type VehicleCheckInStatusTab =
  | typeof VEHICLE_CHECK_IN_STATUS_TAB_ALL
  | typeof VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN;

export function buildVehicleCheckInStatusFilters(statusTab: VehicleCheckInStatusTab): GridFilter[] {
  if (statusTab === VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN) {
    return [{column: 'status', operator: 'equals', value: VEHICLE_CHECK_IN_UNKNOWN_STATUS}];
  }
  return [];
}
