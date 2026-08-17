import { describe, expect, it } from 'vitest';
import {
  pickInitialPopoverSide,
  resolveStickyPopoverSideOnMove,
} from './useStickyPopoverSide';

describe('pickInitialPopoverSide', () => {
  it('prefers bottom when both sides fit', () => {
    expect(pickInitialPopoverSide({ spaceTop: 400, spaceBottom: 400, required: 280 }, 'bottom')).toBe('bottom');
  });

  it('uses top when bottom does not fit on open', () => {
    expect(pickInitialPopoverSide({ spaceTop: 400, spaceBottom: 120, required: 280 }, 'bottom')).toBe('top');
  });

  it('prefers top when both sides fit and top is preferred', () => {
    expect(pickInitialPopoverSide({ spaceTop: 400, spaceBottom: 400, required: 280 }, 'top')).toBe('top');
  });

  it('uses bottom when top does not fit and top is preferred', () => {
    expect(pickInitialPopoverSide({ spaceTop: 120, spaceBottom: 400, required: 280 }, 'top')).toBe('bottom');
  });

  it('picks the side with more space when neither fully fits', () => {
    expect(pickInitialPopoverSide({ spaceTop: 180, spaceBottom: 120, required: 280 }, 'bottom')).toBe('top');
    expect(pickInitialPopoverSide({ spaceTop: 120, spaceBottom: 180, required: 280 }, 'bottom')).toBe('bottom');
  });
});

describe('resolveStickyPopoverSideOnMove', () => {
  it('keeps locked side while enough room remains', () => {
    expect(resolveStickyPopoverSideOnMove('bottom', { spaceTop: 500, spaceBottom: 320, required: 280 })).toBe('bottom');
  });

  it('does not flip just because opposite side has more room', () => {
    expect(resolveStickyPopoverSideOnMove('bottom', { spaceTop: 600, spaceBottom: 320, required: 280 })).toBe('bottom');
  });

  it('does not flip when viewport space is still enough for the locked height budget', () => {
    const lockedRequired = 280;
    expect(resolveStickyPopoverSideOnMove('bottom', { spaceTop: 600, spaceBottom: 320, required: lockedRequired })).toBe('bottom');
    expect(resolveStickyPopoverSideOnMove('bottom', { spaceTop: 600, spaceBottom: 320, required: 400 })).toBe('top');
  });
});
