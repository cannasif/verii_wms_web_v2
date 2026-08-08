import assert from 'node:assert/strict';
import { test } from 'vitest';
import {canEnableUnknownPlateResolve} from './unknown-plate-resolve';

test('unknown plate resolve uses server capability while idle',()=>{
  assert.equal(canEnableUnknownPlateResolve(true,false),true);
  assert.equal(canEnableUnknownPlateResolve(false,false),false);
  assert.equal(canEnableUnknownPlateResolve(true,true),false);
});
