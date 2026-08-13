export interface DropdownSearchInputState {
  normalizedTerm: string;
  activeTerm: string;
  isBrowseMode: boolean;
  isSearchMode: boolean;
  isThresholdMode: boolean;
}

export function resolveDropdownSearchInputState(
  searchTerm: string,
  minChars: number,
): DropdownSearchInputState {
  const normalizedTerm = searchTerm.trim();
  const threshold = Math.max(0, minChars);
  const isBrowseMode = normalizedTerm.length === 0;
  const isSearchMode = normalizedTerm.length >= threshold;
  const isThresholdMode = !isBrowseMode && !isSearchMode;

  return {
    normalizedTerm,
    activeTerm: isSearchMode ? normalizedTerm : '',
    isBrowseMode,
    isSearchMode,
    isThresholdMode,
  };
}

export function isDropdownSearchSettling(
  inputState: DropdownSearchInputState,
  queryState: DropdownSearchInputState,
): boolean {
  return !inputState.isThresholdMode && inputState.activeTerm !== queryState.activeTerm;
}
