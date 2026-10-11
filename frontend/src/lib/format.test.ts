import { fromNow, initials, toInputDate, warrantyState } from './format';

const NOW = new Date('2026-10-10T12:00:00Z').getTime();

describe('warrantyState', () => {
  it('garanti tarihi yoksa belirtilmemiş döner', () => {
    expect(warrantyState(null, NOW)).toEqual({ label: 'Belirtilmemiş', tone: 'neutral' });
  });
  it('geçmişse "Garanti bitti" ve danger', () => {
    expect(warrantyState('2026-09-01', NOW)).toMatchObject({ label: 'Garanti bitti', tone: 'danger' });
  });
  it('90 gün içindeyse kalan günü ve warning gösterir', () => {
    expect(warrantyState('2026-10-20T12:00:00Z', NOW)).toEqual({ label: '10 gün kaldı', tone: 'warning' });
  });
  it('uzaksa garantili ve success', () => {
    expect(warrantyState('2028-01-01', NOW)).toEqual({ label: 'Garantili', tone: 'success' });
  });
});

describe('fromNow', () => {
  it('bir dakikadan azı "az önce"', () => {
    expect(fromNow(new Date(NOW - 20_000), NOW)).toBe('az önce');
  });
  it('dakika / saat / gün formatlar', () => {
    expect(fromNow(new Date(NOW - 5 * 60_000), NOW)).toMatch(/5 dakika önce/);
    expect(fromNow(new Date(NOW - 3 * 3600_000), NOW)).toMatch(/3 saat önce/);
    expect(fromNow(new Date(NOW - 2 * 86400_000), NOW)).toBe('evvelsi gün');
    expect(fromNow(new Date(NOW - 5 * 86400_000), NOW)).toMatch(/5 gün önce/);
  });
});

describe('yardımcılar', () => {
  it('initials Türkçe büyük harf kullanır', () => {
    expect(initials('ilker şahin')).toBe('İŞ');
    expect(initials('Ayşe')).toBe('A');
  });
  it('toInputDate boş değerde boş string döner', () => {
    expect(toInputDate(null)).toBe('');
    expect(toInputDate('2025-03-15T00:00:00.000Z')).toBe('2025-03-15');
  });
});
