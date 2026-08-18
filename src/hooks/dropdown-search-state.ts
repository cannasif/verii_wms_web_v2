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
    // Eşik kararı kırpılmış uzunlukla verilir; API'ye ise kullanıcının ham
    // metni gönderilir. Karakter/boşluk normalizasyonu sunucunun sorumluluğudur.
    activeTerm: isSearchMode ? searchTerm : '',
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
