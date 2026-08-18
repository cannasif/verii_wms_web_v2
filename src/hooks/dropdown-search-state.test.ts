import { describe, expect, it } from 'vitest';
import {
  isDropdownSearchSettling,
  resolveDropdownSearchInputState,
} from './dropdown-search-state';

describe('dropdown search input state', () => {
  it('separates browse, threshold and search modes', () => {
    expect(resolveDropdownSearchInputState('', 2).isBrowseMode).toBe(true);
    expect(resolveDropdownSearchInputState('a', 2).isThresholdMode).toBe(true);
    expect(resolveDropdownSearchInputState('ab', 2).isSearchMode).toBe(true);
  });

  it('detects the debounce window so stale options can be hidden', () => {
    const input = resolveDropdownSearchInputState('new stock', 2);
    const query = resolveDropdownSearchInputState('old stock', 2);
    expect(isDropdownSearchSettling(input, query)).toBe(true);
    expect(isDropdownSearchSettling(input, input)).toBe(false);
  });

  it('uses trimming only for the threshold and preserves the raw API term', () => {
    const state = resolveDropdownSearchInputState('  İşlemci  ', 2);

    expect(state.normalizedTerm).toBe('İşlemci');
    expect(state.activeTerm).toBe('  İşlemci  ');
    expect(state.isSearchMode).toBe(true);
  });
});
