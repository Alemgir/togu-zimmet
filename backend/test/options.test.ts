import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { keyOf, normalize, resolveDeviceType, validateLabel } from '../src/services/canonical.js';
import { ADMIN, STAFF, call, createDevice, deviceBody, login, makeApp, makeUser, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  admin = (await login(app, ADMIN)).token;
});

const post = (over: Record<string, unknown>) => call(app, 'POST', '/api/devices', admin, deviceBody(over));

describe('metin normalleştirme ve denetim (birim)', () => {
  it('normalize: boşlukları sadeleştirir', () => {
    expect(normalize('  Bilgi   İşlem \n')).toBe('Bilgi İşlem');
  });

  it('keyOf: büyük/küçük harf ve Türkçe karakter farkını yok sayar', () => {
    expect(keyOf('BİLGİ İŞLEM')).toBe(keyOf('bilgi işlem'));
    expect(keyOf('BILGI ISLEM')).toBe(keyOf('Bilgi İşlem')); // Türkçe karakter yazmadan
    expect(keyOf('Kutuphane')).toBe(keyOf('KÜTÜPHANE'));
    expect(keyOf('ISPARTA')).toBe(keyOf('ısparta'));
    expect(keyOf('Çağrı Öğrenci Şirketi')).toBe(keyOf('cagri ogrenci sirketi'));
    expect(keyOf('DELL')).toBe(keyOf(' dell '));
    expect(keyOf('Dell')).not.toBe(keyOf('Dell Inc'));
    expect(keyOf('Sık')).toBe(keyOf('sik')); // bilinen ödünleşim: yalnızca aksan farkı olan sözcükler birleşir
  });

  it('validateLabel: uzunluk ve karakter kuralları', () => {
    expect(validateLabel('  Lenovo  ', 'Marka')).toBe('Lenovo');
    expect(() => validateLabel('a', 'Marka')).toThrow(/en az 2/);
    expect(() => validateLabel('x'.repeat(81), 'Marka')).toThrow(/en fazla 80/);
    expect(() => validateLabel('<script>alert(1)</script>', 'Marka')).toThrow(/yalnızca harf/);
    expect(() => validateLabel('Dell{}', 'Marka')).toThrow();
    expect(() => validateLabel('.nokta ile başlar', 'Marka')).toThrow();
    expect(() => validateLabel('   ', 'Marka')).toThrow(/en az/);
    expect(validateLabel('Ağ Cihazı (L3) – v2', 'Tür')).toBe('Ağ Cihazı (L3) – v2');
    expect(validateLabel('Merkez Kampüs · Oda 204', 'Konum', { max: 120 })).toBe('Merkez Kampüs · Oda 204'); // form örneğindeki yazım kabul edilir
    expect(() => validateLabel('Bina*', 'Konum')).toThrow();
    expect(() => validateLabel('a@b', 'Konum')).toThrow();
  });
});

describe('cihaz türü: yazılarak yeni tür eklenebilir', () => {
  it('yerleşik tür adı/eş anlamlısı koda çözülür (Türkçe karakter ve büyük harf farkı fark etmez)', async () => {
    for (const [input, code] of [['dizüstü', 'LAPTOP'], ['DİZÜSTÜ', 'LAPTOP'], ['Laptop', 'LAPTOP'], ['  masaustu ', 'DESKTOP'], ['Monitör', 'MONITOR'], ['ağ cihazı', 'NETWORK'], ['DİĞER', 'OTHER'], ['PRINTER', 'PRINTER']] as const) {
      expect(await resolveDeviceType(input)).toBe(code);
    }
  });

  it('listede olmayan tür özel tür olarak kaydedilir; aynı türün farklı yazımı mevcut yazıma birleşir', async () => {
    const a = await post({ type: 'Projeksiyon' });
    expect(a.statusCode).toBe(201);
    expect(a.json().device.type).toBe('Projeksiyon');
    const b = await post({ type: ' projeksiyon  ' });
    expect(b.json().device.type).toBe('Projeksiyon'); // yeni bir tür doğmaz
    const c = await post({ type: 'PROJEKSİYON' });
    expect(c.json().device.type).toBe('Projeksiyon');
    const meta = (await call(app, 'GET', '/api/devices/meta', admin)).json();
    expect(meta.types).toEqual(['Projeksiyon']);
  });

  it('özel tür filtrelenebilir; panel ve raporlar da özel türü tanır', async () => {
    await post({ type: 'UPS' });
    await post({ type: 'UPS' });
    await post({ type: 'LAPTOP' });
    expect((await call(app, 'GET', '/api/devices?type=UPS', admin)).json().meta.total).toBe(2);
    const dash = (await call(app, 'GET', '/api/dashboard?type=UPS', admin)).json();
    expect(dash.totals.devices).toBe(2);
    expect(dash.byType).toEqual(expect.arrayContaining([{ type: 'UPS', count: 2 }, { type: 'LAPTOP', count: 1 }]));
    expect((await call(app, 'GET', '/api/reports/summary?type=UPS', admin)).json().total).toBe(2);
    const csv = (await call(app, 'GET', '/api/exports/devices?type=UPS', admin)).body;
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3); // başlık + 2 cihaz
    expect(csv).toContain(';UPS;');
  });

  it('geçersiz tür adları reddedilir (400)', async () => {
    for (const bad of ['', ' ', 'a', '<b>x</b>', 'x'.repeat(41), '!!!']) {
      const res = await post({ type: bad });
      expect(res.statusCode, `tür: "${bad}"`).toBe(400);
    }
  });

  it('güncellemede de çözümlenir', async () => {
    const d = await createDevice(app, admin, { type: 'LAPTOP' });
    const up = await call(app, 'PATCH', `/api/devices/${d.id}`, admin, { type: 'akıllı tahta' });
    expect(up.json().device.type).toBe('akıllı tahta');
    const up2 = await call(app, 'PATCH', `/api/devices/${d.id}`, admin, { type: 'Monitör' });
    expect(up2.json().device.type).toBe('MONITOR');
  });
});

describe('marka, konum, birim, unvan: yazım birleştirme ve denetim', () => {
  it('marka: farklı yazımlar ilk kayıtlı yazıma birleşir', async () => {
    expect((await post({ brand: 'Dell' })).json().device.brand).toBe('Dell');
    expect((await post({ brand: 'dell' })).json().device.brand).toBe('Dell');
    expect((await post({ brand: ' DELL ' })).json().device.brand).toBe('Dell');
    expect((await post({ brand: 'Dell Technologies' })).json().device.brand).toBe('Dell Technologies');
    const meta = (await call(app, 'GET', '/api/devices/meta', admin)).json();
    expect(meta.brands).toEqual(['Dell', 'Dell Technologies']);
  });

  it('önceden birden çok yazım varsa en çok kullanılan seçilir', async () => {
    for (const b of ['hp', 'HP', 'HP']) await prisma.device.create({ data: { assetTag: `T-${Math.random()}`, type: 'LAPTOP', brand: b, model: 'x', serialNumber: `S-${Math.random()}`, purchaseDate: new Date() } });
    expect((await post({ brand: 'Hp' })).json().device.brand).toBe('HP');
  });

  it('marka: tehlikeli/geçersiz karakterler reddedilir; model ve seri no serbesttir', async () => {
    expect((await post({ brand: '<img src=x onerror=alert(1)>' })).statusCode).toBe(400);
    expect((await post({ brand: '' })).statusCode).toBe(400);
    expect((await post({ model: 'ThinkPad T14 (Gen 3) 14"', serialNumber: 'SN/2024-001#A' })).statusCode).toBe(201);
  });

  it('konum: yazılarak yeni konum eklenir, mevcutla birleşir, boş değer null olur', async () => {
    expect((await post({ location: 'Sunucu Odası' })).json().device.location).toBe('Sunucu Odası');
    expect((await post({ location: 'sunucu odası' })).json().device.location).toBe('Sunucu Odası');
    expect((await post({ location: 'SUNUCU ODASI' })).json().device.location).toBe('Sunucu Odası');
    expect((await post({ location: '   ' })).json().device.location).toBeNull();
    expect((await post({ location: 'Yeni Bina * 3. Kat' })).statusCode).toBe(400);
    expect((await post({ location: 'Yeni Bina 3. Kat' })).json().device.location).toBe('Yeni Bina 3. Kat');
    expect((await call(app, 'GET', '/api/devices/meta', admin)).json().locations).toEqual(['Sunucu Odası', 'Yeni Bina 3. Kat']);
  });

  it('Türkçe karakter yazmadan girilen birim/marka/konum mevcut kayıtla birleşir', async () => {
    await makeUser(app, admin, 'k1@t.com', { department: 'Kütüphane Daire Başkanlığı' });
    const u = await makeUser(app, admin, 'k2@t.com', { department: 'kutuphane daire baskanligi' });
    expect(u.department).toBe('Kütüphane Daire Başkanlığı');
    expect((await post({ location: 'Sunucu Odası' })).json().device.location).toBe('Sunucu Odası');
    expect((await post({ location: 'SUNUCU ODASI' })).json().device.location).toBe('Sunucu Odası');
    expect((await post({ brand: 'Çağdaş Teknoloji' })).json().device.brand).toBe('Çağdaş Teknoloji');
    expect((await post({ brand: 'cagdas teknoloji' })).json().device.brand).toBe('Çağdaş Teknoloji');
  });

  it('birim: kullanıcı oluştururken yeni birim yazılabilir ve mevcut birimle birleşir (İ/I duyarlı)', async () => {
    await makeUser(app, admin, 'a@t.com', { department: 'Bilgi İşlem' });
    const b = await makeUser(app, admin, 'b@t.com', { department: 'BİLGİ İŞLEM' });
    const c = await makeUser(app, admin, 'c@t.com', { department: 'bilgi işlem' });
    expect(b.department).toBe('Bilgi İşlem');
    expect(c.department).toBe('Bilgi İşlem');
    const depts = (await call(app, 'GET', '/api/meta/departments', admin)).json().departments;
    expect(depts.filter((d: string) => keyOf(d) === keyOf('Bilgi İşlem'))).toEqual(['Bilgi İşlem']);
    expect((await call(app, 'POST', '/api/users', admin, { name: 'Test Kişi', email: 'd@t.com', password: 'Sifre1234', role: 'STAFF', department: '<b>x</b>' })).statusCode).toBe(400);
  });

  it('birim ve unvan güncellemede de denetlenir; boş değer temizler', async () => {
    const u = await makeUser(app, admin, 'u@t.com', { department: 'Kütüphane', title: 'Uzman' });
    const up = await call(app, 'PATCH', `/api/users/${u.id}`, admin, { department: 'KÜTÜPHANE', title: 'uzman' });
    expect(up.json().user).toMatchObject({ department: 'Kütüphane', title: 'Uzman' });
    const clear = await call(app, 'PATCH', `/api/users/${u.id}`, admin, { department: '', title: '' });
    expect(clear.json().user).toMatchObject({ department: null, title: null });
    expect((await call(app, 'PATCH', `/api/users/${u.id}`, admin, { title: '{}' })).statusCode).toBe(400);
    const titles = (await call(app, 'GET', '/api/meta/titles', admin)).json().titles;
    expect(Array.isArray(titles)).toBe(true);
  });

  it('seçenek listeleri giriş yapmış herkese açık, yetkisiz erişim 401', async () => {
    expect((await call(app, 'GET', '/api/meta/titles', (await login(app, STAFF)).token)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/meta/titles' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/devices/meta' })).statusCode).toBe(401);
  });
});
