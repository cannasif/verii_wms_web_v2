import { describe, expect, it } from 'vitest';
import {
  GRID_REFRESH_COOLDOWN_MS,
  isRefreshOnCooldown,
  nextRefreshAvailableAt,
  remainingRefreshCooldownSeconds,
} from './grid-refresh-cooldown';

describe('grid refresh cooldown', () => {
  it('keeps the button available before the first click', () => {
    expect(remainingRefreshCooldownSeconds(null, 1_000)).toBe(0);
    expect(isRefreshOnCooldown(null, 1_000)).toBe(false);
  });

  it('starts a 30 second lock after the first click', () => {
    const now = 10_000;
    const availableAt = nextRefreshAvailableAt(now);

    expect(availableAt - now).toBe(30_000);
    expect(GRID_REFRESH_COOLDOWN_MS).toBe(30_000);
    expect(remainingRefreshCooldownSeconds(availableAt, now)).toBe(30);
    expect(isRefreshOnCooldown(availableAt, now)).toBe(true);
  });

  it('counts remaining whole seconds up to the unlock instant', () => {
    const availableAt = 40_000;

    expect(remainingRefreshCooldownSeconds(availableAt, 10_000)).toBe(30);
    expect(remainingRefreshCooldownSeconds(availableAt, 10_001)).toBe(30);
    expect(remainingRefreshCooldownSeconds(availableAt, 39_001)).toBe(1);
    expect(remainingRefreshCooldownSeconds(availableAt, 40_000)).toBe(0);
    expect(isRefreshOnCooldown(availableAt, 40_000)).toBe(false);
  });

  it('does not stay locked after the countdown ends', () => {
    expect(remainingRefreshCooldownSeconds(40_000, 40_500)).toBe(0);
    expect(isRefreshOnCooldown(40_000, 41_000)).toBe(false);
  });
});
