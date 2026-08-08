import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isDefinitiveSessionRefreshStatus } from './session-refresh-policy';

test('yalnızca kesin kimlik doğrulama hataları oturumu kapatır', () => {
  assert.equal(isDefinitiveSessionRefreshStatus(400), true);
  assert.equal(isDefinitiveSessionRefreshStatus(401), true);
  assert.equal(isDefinitiveSessionRefreshStatus(403), true);

  assert.equal(isDefinitiveSessionRefreshStatus(429), false);
  assert.equal(isDefinitiveSessionRefreshStatus(500), false);
  assert.equal(isDefinitiveSessionRefreshStatus(502), false);
  assert.equal(isDefinitiveSessionRefreshStatus(503), false);
});
