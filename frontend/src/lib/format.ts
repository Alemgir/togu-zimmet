const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

export const fmtDate = (d?: string | null) => (d ? dateFmt.format(new Date(d)) : '—');
export const fmtDateTime = (d?: string | null) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const toInputDate = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function fromNow(d: string | Date, now = Date.now()) {
  const diff = (new Date(d).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'az önce';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(typeof d === 'string' ? d : d.toISOString());
}

export type WarrantyState = { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' };
export function warrantyState(end: string | null, now = Date.now()): WarrantyState {
  if (!end) return { label: 'Belirtilmemiş', tone: 'neutral' };
  const days = Math.ceil((new Date(end).getTime() - now) / 864e5);
  if (days < 0) return { label: 'Garanti bitti', tone: 'danger' };
  if (days <= 90) return { label: `${days} gün kaldı`, tone: 'warning' };
  return { label: 'Garantili', tone: 'success' };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('');
