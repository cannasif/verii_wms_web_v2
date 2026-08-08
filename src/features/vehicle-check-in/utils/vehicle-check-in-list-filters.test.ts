import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildVehicleCheckInStatusFilters,
  VEHICLE_CHECK_IN_STATUS_TAB_ALL,
  VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN,
  VEHICLE_CHECK_IN_UNKNOWN_STATUS,
} from './vehicle-check-in-list-filters';

test('buildVehicleCheckInStatusFilters returns no filter for all tab', () => {
  assert.deepEqual(buildVehicleCheckInStatusFilters(VEHICLE_CHECK_IN_STATUS_TAB_ALL), []);
});

test('buildVehicleCheckInStatusFilters filters unknown plates status', () => {
  assert.deepEqual(buildVehicleCheckInStatusFilters(VEHICLE_CHECK_IN_STATUS_TAB_UNKNOWN), [
    {column: 'status', operator: 'equals', value: VEHICLE_CHECK_IN_UNKNOWN_STATUS},
  ]);
});
