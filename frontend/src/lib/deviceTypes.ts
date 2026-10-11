import { keyOf, normalize } from './text';

export const BUILTIN_TYPES = ['LAPTOP', 'DESKTOP', 'SERVER', 'MONITOR', 'PRINTER', 'PHONE', 'TABLET', 'NETWORK', 'OTHER'] as const;

export const TYPE_LABEL: Record<string, string> = {
  LAPTOP: 'Dizüstü',
  DESKTOP: 'Masaüstü',
  SERVER: 'Sunucu',
  MONITOR: 'Monitör',
  PRINTER: 'Yazıcı',
  PHONE: 'Telefon',
  TABLET: 'Tablet',
  NETWORK: 'Ağ cihazı',
  OTHER: 'Diğer',
};

/** Cihaz türü: yerleşik kodlar etiketlenir, özel (kullanıcının yazdığı) türler olduğu gibi gösterilir. */
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;

const BUILTIN_COLOR: Record<string, string> = {
  LAPTOP: '#462b55',
  MONITOR: '#00809b',
  SERVER: '#3564af',
  DESKTOP: '#7a3fa8',
  NETWORK: '#16244d',
  PRINTER: '#00677c',
  PHONE: '#910c32',
  TABLET: '#8d5fb0',
  OTHER: '#6b6275',
};

/** Özel türler için addan türetilen sabit, sakin bir renk (beyaz yazıyla okunur). */
export function typeColor(t: string): string {
  if (BUILTIN_COLOR[t]) return BUILTIN_COLOR[t];
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 42% 36%)`;
}

const ALIASES: Record<string, string[]> = {
  LAPTOP: ['dizüstü', 'dizustu', 'dizüstü bilgisayar', 'laptop', 'notebook'],
  DESKTOP: ['masaüstü', 'masaustu', 'masaüstü bilgisayar', 'desktop', 'pc'],
  SERVER: ['sunucu', 'server'],
  MONITOR: ['monitör', 'monitor'],
  PRINTER: ['yazıcı', 'yazici', 'printer'],
  PHONE: ['telefon', 'cep telefonu', 'phone'],
  TABLET: ['tablet'],
  NETWORK: ['ağ cihazı', 'ag cihazi', 'network'],
  OTHER: ['diğer', 'diger', 'other'],
};
const INDEX = new Map<string, string>();
for (const code of BUILTIN_TYPES) {
  INDEX.set(keyOf(code), code);
  (ALIASES[code] ?? []).forEach((a) => INDEX.set(keyOf(a), code));
}

/** Yazılan metni tür koduna çözer (yerleşikse kod, değilse özel ad). Sunucu aynısını yapar ve mevcut yazımla birleştirir. */
export function resolveTypeInput(text: string): { value: string; label: string; builtin: boolean } {
  const v = normalize(text);
  const code = INDEX.get(keyOf(v));
  return code ? { value: code, label: TYPE_LABEL[code]!, builtin: true } : { value: v, label: v, builtin: false };
}

/** Seçenek listesi: tüm yerleşik türler + envanterde kullanılan özel türler. */
export function typeOptions(inUse: string[] = []) {
  const custom = inUse.filter((t) => !TYPE_LABEL[t]);
  return [...BUILTIN_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t]! })), ...[...new Set(custom)].sort((a, b) => a.localeCompare(b, 'tr')).map((t) => ({ value: t, label: t }))];
}
