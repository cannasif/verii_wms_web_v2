import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildKnownPlateExcelCandidateFilters,
  canEnableUnknownPlateResolve,
  collectKnownPlateExcelReferences,
  matchesKnownPlateExcel,
} from './unknown-plate-resolve';

test('unknown plate resolve uses server capability while idle',()=>{
  assert.equal(canEnableUnknownPlateResolve(true,false),true);
  assert.equal(canEnableUnknownPlateResolve(false,false),false);
  assert.equal(canEnableUnknownPlateResolve(true,true),false);
});

test('unknown plate resolve filters to known plate excel when one exists',()=>{
  const refs=collectKnownPlateExcelReferences([
    {identityStatus:'Known',importReferenceNo:'EXCEL-A'},
    {identityStatus:'Unknown',importReferenceNo:null},
    {identityStatus:'Known',importReferenceNo:' EXCEL-A '},
  ]);
  assert.deepEqual(refs,['EXCEL-A']);
  assert.deepEqual(buildKnownPlateExcelCandidateFilters(refs),[
    {column:'importReferenceNo',operator:'equals',value:'EXCEL-A'},
  ]);
  assert.equal(matchesKnownPlateExcel('EXCEL-A',refs),true);
  assert.equal(matchesKnownPlateExcel('EXCEL-B',refs),false);
});

test('unknown plate resolve shows all candidates when every plate is unknown',()=>{
  const refs=collectKnownPlateExcelReferences([
    {identityStatus:'Unknown',importReferenceNo:null},
    {identityStatus:'Unknown'},
  ]);
  assert.deepEqual(refs,[]);
  assert.deepEqual(buildKnownPlateExcelCandidateFilters(refs),[]);
  assert.equal(matchesKnownPlateExcel('EXCEL-B',refs),true);
});
