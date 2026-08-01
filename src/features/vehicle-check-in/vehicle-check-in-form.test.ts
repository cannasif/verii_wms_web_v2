import assert from 'node:assert/strict';
import test from 'node:test';
import type {VehicleCheckInRow} from './types';
import {
  acceptanceTargetMatches,
  hydrateVehicleCheckInForm,
} from './vehicle-check-in-form';

test('vehicle hydration preserves supplier identity',()=>{
  const header={
    id:7,
    rowVersion:'row-version',
    branchCode:'0',
    plateNo:'34 TEST 34',
    steelSheetCount:2,
    customerId:42,
  } as VehicleCheckInRow;

  const form=hydrateVehicleCheckInForm(header);

  assert.equal(form.customerId,42);
  assert.equal(form.id,7);
  assert.equal(form.rowVersion,'row-version');
});

test('incremental acceptance counts saved and new slots together',()=>{
  assert.equal(acceptanceTargetMatches(2,1,3),true);
  assert.equal(acceptanceTargetMatches(2,1,2),false);
});
