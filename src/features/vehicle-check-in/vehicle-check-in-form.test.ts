import assert from 'node:assert/strict';
import { test } from 'vitest';
import type {VehicleCheckInRow} from './types';
import {
  acceptanceTargetMatches,
  formatDriverName,
  hydrateVehicleCheckInForm,
  parseDriverName,
  parseSteelSheetCountInput,
  resolveVehicleCheckInSelectAll,
  sanitizeSteelSheetCountInput,
  vehicleCheckInExcelKey,
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

test('driver name input keeps spaces while typing first and last name',()=>{
  const roundTrip=(value:string)=>formatDriverName(
    parseDriverName(value).driverFirstName,
    parseDriverName(value).driverLastName,
  );

  assert.equal(roundTrip('Ali'),'Ali');
  assert.equal(roundTrip('Ali '),'Ali ');
  assert.equal(roundTrip('Ali Mehmet'),'Ali Mehmet');
  assert.equal(roundTrip('Ali Mehmet Yılmaz'),'Ali Mehmet Yılmaz');
  assert.deepEqual(parseDriverName('Ali Mehmet Yılmaz'),{
    driverFirstName:'Ali',
    driverLastName:'Mehmet Yılmaz',
  });
});

test('steel sheet count input allows empty and strips leading zeros',()=>{
  assert.equal(sanitizeSteelSheetCountInput(''),'');
  assert.equal(sanitizeSteelSheetCountInput('0'),'');
  assert.equal(sanitizeSteelSheetCountInput('012'),'12');
  assert.equal(sanitizeSteelSheetCountInput('12a'),'12');
  assert.equal(parseSteelSheetCountInput(''),null);
  assert.equal(parseSteelSheetCountInput('0'),null);
  assert.equal(parseSteelSheetCountInput('12'),12);
});

test('select all keeps sheets from the same excel import', () => {
  const rows = [
    {id: 1, importReferenceNo: 'EXCEL-A', sourceFileName: 'a.xlsx'},
    {id: 2, importReferenceNo: 'EXCEL-A', sourceFileName: 'a.xlsx'},
    {id: 3, importReferenceNo: 'EXCEL-B', sourceFileName: 'b.xlsx'},
    {id: 4, importReferenceNo: 'EXCEL-A', sourceFileName: 'a.xlsx'},
  ];

  assert.equal(vehicleCheckInExcelKey(rows[0]), 'EXCEL-A');
  assert.equal(vehicleCheckInExcelKey({importReferenceNo: '  ', sourceFileName: 'a.xlsx'}), 'a.xlsx');
  assert.deepEqual(
    resolveVehicleCheckInSelectAll(rows, [], new Set()).targets.map((row) => row.id),
    [1, 2, 4],
  );
  assert.equal(resolveVehicleCheckInSelectAll(rows, [], new Set()).mixedExcel, true);
  assert.deepEqual(
    resolveVehicleCheckInSelectAll(rows, [rows[2]], new Set()).targets.map((row) => row.id),
    [3],
  );
  assert.deepEqual(
    resolveVehicleCheckInSelectAll(rows, [], new Set([1])).targets.map((row) => row.id),
    [2, 4],
  );
});
