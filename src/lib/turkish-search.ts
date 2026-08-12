/**
 * Türkçe arama katlama: İ/I/ı/i ve ş/ğ/ü/ö/ç farklarını ASCII'ye indirger.
 * "DİGİ" ve "DIGI" aynı anahtara düşer → "digi".
 * Yerel (client) eşleştirmede her iki taraf da katlanır.
 */
export function foldTurkishSearch(value: string): string {
  return value
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * API araması:
 * - İ/ı/I/i → Latin I (ADMİN ≈ ADMIN ≈ Administrator)
 * - ğüşöç korunur (Erdoğan ≈ ERDOĞAN)
 * - tr-TR upper kullanılmaz; yoksa "admin" → "ADMİN" olur ve English isimlerde kırılır
 */
export function toTurkishApiSearch(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const iNormalized = trimmed
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i');

  const lower = iNormalized.toLocaleLowerCase('tr-TR');

  let out = '';
  for (const ch of lower) {
    if (ch === 'i') {
      out += 'I';
      continue;
    }
    out += ch.toLocaleUpperCase('tr-TR');
  }
  return out;
}

/** Enter ile rozet ekler; Türkçe katlamaya göre yinelenenleri atlar. */
export function appendFoldedSearchToken(tokens: string[], raw: string): string[] {
  const normalized = foldTurkishSearch(raw);
  if (!normalized) return tokens;
  if (tokens.some((token) => foldTurkishSearch(token) === normalized)) {
    return tokens;
  }
  return [...tokens, raw.trim()];
}
