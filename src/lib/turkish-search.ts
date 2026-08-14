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
 * API aramasında kullanıcının yazdığı metni korur.
 *
 * Türkçe i/İ ile ı/I aynı harf değildir. Metni istemcide tek bir büyük harf
 * biçimine zorlamak "sabit" aramasını "SABIT" yaparak "SABİT" kaydını
 * kaçırıyordu. Kültür ve collation kuralları API/veritabanı sorumluluğudur;
 * istemci yalnızca dış boşlukları temizler.
 */
export function toTurkishApiSearch(value: string): string {
  return value.trim();
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
