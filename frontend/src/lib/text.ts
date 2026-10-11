/** Sunucudaki canonical.ts ile aynı kurallar: ön yüz yazılanı daha yazarken denetler, asıl yetki sunucudadır. */
export const normalize = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

const FOLD: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

/** Karşılaştırma anahtarı (sunucuyla aynı): büyük/küçük harf ve Türkçe karakter farkını yok sayar ("Kutuphane" = "Kütüphane"). */
export const keyOf = (s: string) =>
  normalize(s)
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıışğüöçâîû]/g, (c) => FOLD[c] ?? c);

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .,\-–—_/&()+#'’:;·]*$/u;

/** Hata mesajı döndürür; geçerliyse undefined. */
export function validateLabel(raw: string, opts: { min?: number; max?: number; label?: string } = {}): string | undefined {
  const { min = 2, max = 80, label = 'Değer' } = opts;
  const v = normalize(raw);
  if (v.length < min) return `${label} en az ${min} karakter olmalı`;
  if (v.length > max) return `${label} en fazla ${max} karakter olabilir`;
  if (!NAME_RE.test(v)) return `${label} yalnızca harf, rakam, boşluk ve . , ; : - – _ / & ( ) + # ' · içerebilir`;
  return undefined;
}

/** Levenshtein uzaklığı (yazım hatası tespiti için). */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** "Şunu mu demek istediniz?" adayları: yazım hatası düzeyinde benzer (tam eşleşme hariç). */
export function similarTo<T>(typed: string, items: T[], keyFn: (t: T) => string, max = 3): T[] {
  const k = keyOf(typed);
  if (k.length < 4) return [];
  const limit = k.length <= 6 ? 1 : 2;
  return items
    .map((it) => ({ it, d: distance(k, keyOf(keyFn(it))) }))
    .filter((x) => x.d > 0 && x.d <= limit)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.it);
}
