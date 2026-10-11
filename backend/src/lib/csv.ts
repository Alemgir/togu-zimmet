/** Excel'in Türkçe sürümüyle uyumlu CSV: UTF-8 BOM + noktalı virgül ayırıcı. */
export function toCsv<T>(rows: T[], columns: { header: string; value: (r: T) => unknown }[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    // CSV enjeksiyonuna karşı: formül karakteriyle başlayan hücreleri etkisizleştir
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [columns.map((c) => esc(c.header)).join(';'), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(';'))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}
