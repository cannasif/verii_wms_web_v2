import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  isPromiseLike,
  remainingActionBusyTime,
} from './async-action-guard';

describe('async action guard', () => {
  it('keeps fast actions visibly busy for the configured minimum', () => {
    assert.equal(remainingActionBusyTime(1_000, 350, 1_100), 250);
  });

  it('does not add delay after the minimum elapsed', () => {
    assert.equal(remainingActionBusyTime(1_000, 350, 1_500), 0);
  });

  it('detects native and custom promise-like results', () => {
    assert.equal(isPromiseLike(Promise.resolve()), true);
    assert.equal(isPromiseLike({ then: () => undefined }), true);
    assert.equal(isPromiseLike(undefined), false);
  });
});
