import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isPromiseLike } from './async-action-guard';

describe('async action guard', () => {
  it('detects native and custom promise-like results', () => {
    assert.equal(isPromiseLike(Promise.resolve()), true);
    assert.equal(isPromiseLike({ then: () => undefined }), true);
    assert.equal(isPromiseLike(undefined), false);
  });
});
