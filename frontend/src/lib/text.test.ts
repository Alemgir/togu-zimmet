import { distance, keyOf, normalize, similarTo, validateLabel } from './text';

describe('normalize / keyOf', () => {
  it('boşlukları sadeleştirir', () => {
    expect(normalize('  Bilgi   İşlem \n')).toBe('Bilgi İşlem');
    expect(normalize('')).toBe('');
  });
  it('büyük/küçük harf ve Türkçe karakter farkını yok sayan anahtar üretir', () => {
    expect(keyOf('BİLGİ İŞLEM')).toBe(keyOf('bilgi işlem'));
    expect(keyOf('BILGI ISLEM')).toBe(keyOf('Bilgi İşlem'));
    expect(keyOf('ISPARTA')).toBe('isparta');
    expect(keyOf('İSTANBUL')).toBe('istanbul');
    expect(keyOf('Kutuphane')).toBe(keyOf('KÜTÜPHANE'));
    expect(keyOf('Çağrı Öğrenci Şirketi')).toBe('cagri ogrenci sirketi');
    expect(keyOf(' DELL ')).toBe('dell');
  });
});

describe('validateLabel (sunucuyla aynı kurallar)', () => {
  it('geçerli değerleri kabul eder', () => {
    for (const ok of ['Lenovo', 'Ağ Cihazı (L3)', 'Merkez Kampüs · Oda 204', 'Dr. Öğr. Üyesi', 'AT&T', "O'Neil", 'Bina A-2/3', 'Akıllı Tahta – 75"'.replace('"', '')]) {
      expect(validateLabel(ok), ok).toBeUndefined();
    }
  });
  it('kısa, uzun ve tehlikeli karakterli değerleri reddeder', () => {
    expect(validateLabel('a')).toMatch(/en az 2/);
    expect(validateLabel('a', { min: 1 })).toBeUndefined();
    expect(validateLabel('x'.repeat(81))).toMatch(/en fazla 80/);
    expect(validateLabel('x'.repeat(41), { max: 40, label: 'Tür' })).toMatch(/Tür en fazla 40/);
    for (const bad of ['<b>x</b>', 'a@b.com', 'Dell{}', '.baslar', '   ', 'Bina*', 'x\u0000y']) {
      expect(validateLabel(bad), bad).toBeTruthy();
    }
  });
});

describe('distance / similarTo (yazım hatası önerisi)', () => {
  it('Levenshtein uzaklığını hesaplar', () => {
    expect(distance('dell', 'dell')).toBe(0);
    expect(distance('lenovo', 'lenavo')).toBe(1);
    expect(distance('kitten', 'sitting')).toBe(3);
    expect(distance('', 'abc')).toBe(3);
  });
  it('yakın yazımları önerir, tam eşleşmeyi ve çok farklıları önermez', () => {
    const list = ['Lenovo', 'Dell', 'HP', 'Samsung', 'Cisco'];
    expect(similarTo('Lenavo', list, (x) => x)).toEqual(['Lenovo']);
    expect(similarTo('lenovo', list, (x) => x)).toEqual([]); // tam eşleşme (harf farkı yok sayılır) zaten bulunur
    expect(similarTo('Samsunğ', list, (x) => x)).toEqual([]); // Türkçe karakter farkı eşleşmedir, yazım hatası değil
    expect(similarTo('Samsunk', list, (x) => x)).toEqual(['Samsung']);
    expect(similarTo('Xiaomi', list, (x) => x)).toEqual([]);
    expect(similarTo('Del', list, (x) => x)).toEqual([]); // 3 harften kısa/çok kısa girişlerde öneri yok
  });
});
