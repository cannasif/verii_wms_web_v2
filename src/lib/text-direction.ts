export type TextDirection = 'ltr' | 'rtl';

const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

export function normalizeLanguageCode(language?: string | null): string {
  if (!language) {
    return 'tr';
  }

  const normalized = language.toLowerCase();
  return normalized === 'sa' ? 'ar' : normalized.split('-')[0] || 'tr';
}

export function getTextDirection(language?: string | null): TextDirection {
  return RTL_LANGUAGES.has(normalizeLanguageCode(language)) ? 'rtl' : 'ltr';
}

export function applyDocumentTextDirection(language?: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }

  const lang = normalizeLanguageCode(language);
  const direction = getTextDirection(lang);
  const root = document.documentElement;

  root.lang = lang;
  root.dir = direction;
  root.dataset.language = lang;
  root.dataset.direction = direction;
}
