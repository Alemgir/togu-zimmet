import { prisma } from '../db.js';
import { badRequest } from '../lib/errors.js';

/** Boşlukları sadeleştirir: baştaki/sondaki boşlukları atar, ardışık boşlukları teke indirir. */
export const normalize = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');

const FOLD: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

/**
 * Karşılaştırma anahtarı: büyük/küçük harf ve Türkçe karakter farkını yok sayar.
 * "DELL" = "dell", "BİLGİ İŞLEM" = "bilgi islem" = "Bilgi Işlem": Türkçe klavye kullanmadan yazılan
 * "Kutuphane" de mevcut "Kütüphane" kaydıyla birleşir.
 */
export const keyOf = (s: string) =>
  normalize(s)
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıışğüöçâîû]/g, (c) => FOLD[c] ?? c);

// Harf/rakam ile başlar; harf, rakam, boşluk ve yaygın noktalama içerebilir. <, >, {, }, kontrol karakterleri reddedilir.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .,\-–—_/&()+#'’:;·]*$/u;

/** Seçenek listesinde yer alan değerlerin (marka, birim, unvan, konum, tür) denetimi. */
export function validateLabel(raw: string, label: string, opts: { min?: number; max?: number } = {}): string {
  const v = normalize(raw);
  const { min = 2, max = 80 } = opts;
  if (v.length < min) throw badRequest(`${label} en az ${min} karakter olmalı`);
  if (v.length > max) throw badRequest(`${label} en fazla ${max} karakter olabilir`);
  if (!NAME_RE.test(v)) throw badRequest(`${label} yalnızca harf, rakam, boşluk ve . , ; : - – _ / & ( ) + # ' · karakterlerini içerebilir`);
  return v;
}

type Field = 'device.brand' | 'device.location' | 'device.type' | 'user.department' | 'user.title';

async function distinctWithCounts(field: Field): Promise<{ value: string; count: number }[]> {
  switch (field) {
    case 'device.brand': return (await prisma.device.groupBy({ by: ['brand'], _count: { _all: true } })).map((r) => ({ value: r.brand, count: r._count._all }));
    case 'device.location': return (await prisma.device.groupBy({ by: ['location'], where: { location: { not: null } }, _count: { _all: true } })).map((r) => ({ value: r.location!, count: r._count._all }));
    case 'device.type': return (await prisma.device.groupBy({ by: ['type'], _count: { _all: true } })).map((r) => ({ value: r.type, count: r._count._all }));
    case 'user.department': return (await prisma.user.groupBy({ by: ['department'], where: { department: { not: null } }, _count: { _all: true } })).map((r) => ({ value: r.department!, count: r._count._all }));
    case 'user.title': return (await prisma.user.groupBy({ by: ['title'], where: { title: { not: null } }, _count: { _all: true } })).map((r) => ({ value: r.title!, count: r._count._all }));
  }
}

/**
 * Yazım birleştirme: kayıtlı bir değerle (büyük/küçük harf ve boşluk farkı hariç) aynıysa
 * mevcut yazım kullanılır; böylece "dell" / "DELL" / "Dell" filtre ve grafiklerde ikiye bölünmez.
 * Birden çok yazım zaten varsa en çok kullanılanı seçilir.
 */
export async function canonicalValue(field: Field, raw: string, label: string, opts?: { min?: number; max?: number }): Promise<string> {
  const v = validateLabel(raw, label, opts);
  const k = keyOf(v);
  const matches = (await distinctWithCounts(field)).filter((r) => keyOf(r.value) === k).sort((a, b) => b.count - a.count);
  return matches[0]?.value ?? v;
}

export async function canonicalOptional(field: Field, raw: string | null | undefined, label: string, opts?: { min?: number; max?: number }): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || normalize(raw) === '') return null;
  return canonicalValue(field, raw, label, opts);
}

/* ───── Cihaz türü ───── */
export const BUILTIN_TYPES = ['LAPTOP', 'DESKTOP', 'SERVER', 'MONITOR', 'PRINTER', 'PHONE', 'TABLET', 'NETWORK', 'OTHER'] as const;

const ALIASES: Record<(typeof BUILTIN_TYPES)[number], string[]> = {
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

const ALIAS_INDEX = new Map<string, (typeof BUILTIN_TYPES)[number]>();
for (const code of BUILTIN_TYPES) {
  ALIAS_INDEX.set(keyOf(code), code);
  ALIASES[code].forEach((a) => ALIAS_INDEX.set(keyOf(a), code));
}

/**
 * Yazılan türü çözer: yerleşik tür adı/kodu/eş anlamlısı ise kod (LAPTOP…), değilse özel tür adı.
 * Özel adlar da mevcut yazımla birleştirilir ("projeksiyon" → "Projeksiyon").
 */
export async function resolveDeviceType(raw: string): Promise<string> {
  const v = validateLabel(raw, 'Cihaz türü', { min: 2, max: 40 });
  const builtin = ALIAS_INDEX.get(keyOf(v));
  if (builtin) return builtin;
  return canonicalValue('device.type', v, 'Cihaz türü', { min: 2, max: 40 });
}
