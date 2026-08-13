import { afterEach, describe, expect, it } from 'vitest';
import {
  beginInFlightRequest,
  buildApiRequestFingerprint,
  endInFlightRequest,
  resetInFlightRequestsForTests,
} from './in-flight-request-guard';

describe('in-flight API request guard', () => {
  afterEach(resetInFlightRequestsForTests);

  it('creates the same fingerprint for equivalent payloads', () => {
    const first = buildApiRequestFingerprint({ method: 'post', baseURL: '/api', url: '/save', data: { b: 2, a: 1 } });
    const second = buildApiRequestFingerprint({ method: 'post', baseURL: '/api', url: '/save', data: { a: 1, b: 2 } });
    expect(first).toBe(second);
  });

  it('distinguishes different request bodies', () => {
    const first = buildApiRequestFingerprint({ method: 'post', url: '/save', data: { quantity: 1 } });
    const second = buildApiRequestFingerprint({ method: 'post', url: '/save', data: { quantity: 2 } });
    expect(first).not.toBe(second);
  });

  it('blocks a duplicate until the original request is released', () => {
    const key = buildApiRequestFingerprint({ method: 'post', url: '/save', data: { id: 7 } });
    const token = beginInFlightRequest(key);

    expect(token).not.toBeNull();
    expect(beginInFlightRequest(key)).toBeNull();

    endInFlightRequest(key, token ?? undefined);
    expect(beginInFlightRequest(key)).not.toBeNull();
  });
});
