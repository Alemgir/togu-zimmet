import { iconFor } from '@/components/devices/DeviceIcon';
import { resolveTypeInput, typeColor, typeLabel, typeOptions } from './deviceTypes';

describe('cihaz türü', () => {
  it('yerleşik türleri etiketler, özel türü olduğu gibi gösterir', () => {
    expect(typeLabel('LAPTOP')).toBe('Dizüstü');
    expect(typeLabel('NETWORK')).toBe('Ağ cihazı');
    expect(typeLabel('Projeksiyon')).toBe('Projeksiyon');
  });

  it('yazılan metni koda çözer (eş anlamlı, Türkçe karakter, büyük harf)', () => {
    expect(resolveTypeInput('dizüstü')).toEqual({ value: 'LAPTOP', label: 'Dizüstü', builtin: true });
    expect(resolveTypeInput('DİZÜSTÜ')).toMatchObject({ value: 'LAPTOP' });
    expect(resolveTypeInput('  laptop ')).toMatchObject({ value: 'LAPTOP' });
    expect(resolveTypeInput('masaustu')).toMatchObject({ value: 'DESKTOP' });
    expect(resolveTypeInput('ag cihazi')).toMatchObject({ value: 'NETWORK' });
    expect(resolveTypeInput('Diğer')).toMatchObject({ value: 'OTHER' });
  });

  it('listede olmayanı özel tür olarak bırakır', () => {
    expect(resolveTypeInput('  akıllı   tahta ')).toEqual({ value: 'akıllı tahta', label: 'akıllı tahta', builtin: false });
  });

  it('seçenek listesi: tüm yerleşik türler + kullanımdaki özel türler (tekrarsız, sıralı)', () => {
    const o = typeOptions(['LAPTOP', 'UPS', 'Projeksiyon', 'UPS']);
    expect(o).toHaveLength(9 + 2);
    expect(o.slice(9).map((x) => x.value)).toEqual(['Projeksiyon', 'UPS']);
    expect(typeOptions()).toHaveLength(9);
  });

  it('özel türe sabit renk üretir', () => {
    expect(typeColor('LAPTOP')).toBe('#462b55');
    expect(typeColor('UPS')).toBe(typeColor('UPS'));
    expect(typeColor('UPS')).toMatch(/^hsl\(/);
    expect(typeColor('UPS')).not.toBe(typeColor('Projeksiyon'));
  });

  it('özel türe anahtar kelimeden simge seçer, bilinmeyende genel simge', () => {
    expect(iconFor('LAPTOP')).toBe(iconFor('LAPTOP'));
    expect(iconFor('Projeksiyon')).not.toBe(iconFor('Bilinmeyen Şey'));
    expect(iconFor('UPS')).not.toBe(iconFor('Bilinmeyen Şey'));
    expect(iconFor('Bilinmeyen Şey')).toBe(iconFor('OTHER'));
  });
});
