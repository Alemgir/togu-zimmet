import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, MANAGER, STAFF, bearer, call, createDevice, deviceBody, login, makeApp, makeUser, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
let staff: string;
let staffId: string;
let mgr: string;

beforeAll(async () => (app = await makeApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  admin = (await login(app, ADMIN)).token;
  const s = await login(app, STAFF);
  staff = s.token;
  staffId = s.user.id;
  mgr = (await login(app, MANAGER)).token;
});
const post = (over: Record<string, unknown> = {}) => call(app, 'POST', '/api/devices', admin, deviceBody(over));
const assign = (deviceId: string, userId: string, extra = {}) => call(app, 'POST', '/api/assignments', admin, { deviceId, userId, ...extra });
const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

describe('kimlik doğrulama: uç durumlar', () => {
  it('e-posta büyük/küçük harf ve baştaki/sondaki boşluğa duyarsızdır', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: '  ADMIN@Test.EDU.tr ', password: ADMIN.password } });
    expect(res.statusCode).toBe(200);
  });

  it('eksik/bozuk gövde 400 döner, sunucu hatası vermez', async () => {
    for (const payload of [{}, { email: 'a@b.com' }, { email: 'bozuk', password: 'x' }, { email: ['x'], password: 1 }]) {
      const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: payload as any });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'content-type': 'application/json' }, payload: '{bozuk json' })).statusCode).toBe(400);
  });

  it('silinmiş kullanıcının eski token’ı geçersizdir', async () => {
    const u = await makeUser(app, admin, 'gecici@t.com');
    const t = (await login(app, { email: 'gecici@t.com', password: 'Sifre1234' })).token;
    expect((await call(app, 'GET', '/api/auth/me', t)).statusCode).toBe(200);
    await call(app, 'DELETE', `/api/users/${u.id}`, admin);
    expect((await call(app, 'GET', '/api/auth/me', t)).statusCode).toBe(401);
  });

  it('yetkilendirme başlığı biçimleri: Bearer olmayan, boş, başka şema reddedilir', async () => {
    for (const h of ['', 'Bearer', 'Bearer ', 'Basic abc', 'token abc', `Bearer ${admin}x`]) {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: h ? { authorization: h } : {} });
      expect(res.statusCode, `başlık: "${h}"`).toBe(401);
    }
  });

  it('şifre değiştirme: zayıf yeni şifre, aynı şifre ve yanlış mevcut şifre', async () => {
    const t = staff;
    const bad = (body: object) => call(app, 'PATCH', '/api/auth/me/password', t, body);
    expect((await bad({ currentPassword: STAFF.password, newPassword: 'kisa1' })).statusCode).toBe(400);
    expect((await bad({ currentPassword: STAFF.password, newPassword: 'sadeceharfler' })).statusCode).toBe(400);
    expect((await bad({ currentPassword: STAFF.password, newPassword: '12345678' })).statusCode).toBe(400);
    expect((await bad({ currentPassword: 'yanlis', newPassword: 'Yeni12345' })).statusCode).toBe(400);
    expect((await bad({ currentPassword: STAFF.password })).statusCode).toBe(400);
  });
});

describe('güvenlik: tüm uç noktalar kimlik ister, roller ayrılır', () => {
  const ROUTES: [string, string][] = [
    ['GET', '/api/auth/me'], ['GET', '/api/users'], ['GET', '/api/users/x'], ['GET', '/api/devices'], ['GET', '/api/devices/mine'], ['GET', '/api/devices/meta'],
    ['GET', '/api/devices/x'], ['GET', '/api/devices/x/qr'], ['GET', '/api/devices/by-qr/x'], ['GET', '/api/assignments'], ['GET', '/api/assignments/x'],
    ['GET', '/api/dashboard'], ['GET', '/api/reports/summary'], ['GET', '/api/faults'], ['GET', '/api/faults/board'], ['GET', '/api/faults/x'],
    ['GET', '/api/notifications'], ['GET', '/api/counts'], ['GET', '/api/counts/x'], ['GET', '/api/exports/devices'], ['GET', '/api/exports/assignments'],
    ['GET', '/api/exports/faults'], ['GET', '/api/meta/departments'], ['GET', '/api/meta/titles'],
    ['POST', '/api/users'], ['POST', '/api/devices'], ['POST', '/api/assignments'], ['POST', '/api/assignments/bulk'], ['POST', '/api/devices/bulk-status'],
    ['POST', '/api/devices/qr-batch'], ['POST', '/api/counts'], ['POST', '/api/notifications/read-all'], ['POST', '/api/auth/logout'],
    ['PATCH', '/api/users/x'], ['PATCH', '/api/devices/x'], ['PATCH', '/api/faults/x'], ['DELETE', '/api/users/x'], ['DELETE', '/api/devices/x'],
  ];
  it.each(ROUTES)('%s %s kimliksiz 401 döner', async (method, url) => {
    const res = await app.inject({ method: method as any, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {} });
    expect(res.statusCode).toBe(401);
  });

  it('personel yönetici uç noktalarında 403 alır', async () => {
    const d = await createDevice(app, admin);
    const adminOnly: [string, string, unknown?][] = [
      ['POST', '/api/users', {}], ['PATCH', `/api/users/${staffId}`, {}], ['DELETE', `/api/users/${staffId}`], ['POST', '/api/devices', {}], ['PATCH', `/api/devices/${d.id}`, {}],
      ['DELETE', `/api/devices/${d.id}`], ['PATCH', `/api/devices/${d.id}/status`, { status: 'FAULTY' }], ['POST', `/api/devices/${d.id}/return`, {}], ['POST', '/api/assignments', {}],
      ['POST', '/api/assignments/bulk', {}], ['POST', '/api/devices/bulk-status', {}], ['POST', '/api/counts', {}], ['GET', '/api/counts'], ['GET', '/api/users'], ['GET', '/api/assignments'],
      ['GET', '/api/dashboard'], ['GET', '/api/reports/summary'], ['GET', '/api/exports/devices'], ['GET', '/api/faults/board'], ['POST', '/api/devices/qr-batch', { ids: [d.id] }],
    ];
    for (const [m, u, body] of adminOnly) {
      const res = await call(app, m as any, u, staff, body);
      expect(res.statusCode, `${m} ${u}`).toBe(403);
    }
  });

  it('birim sorumlusu yazma uç noktalarında 403 alır', async () => {
    const d = await createDevice(app, admin);
    for (const [m, u, body] of [['POST', '/api/devices', {}], ['PATCH', `/api/devices/${d.id}`, {}], ['DELETE', `/api/devices/${d.id}`], ['POST', '/api/assignments', {}], ['PATCH', `/api/devices/${d.id}/status`, { status: 'FAULTY' }], ['POST', '/api/counts', {}], ['PATCH', '/api/faults/x', {}], ['POST', '/api/devices/bulk-status', {}]] as [string, string, unknown?][]) {
      expect((await call(app, m as any, u, mgr, body)).statusCode, `${m} ${u}`).toBe(403);
    }
  });

  it('bilinmeyen adres tutarlı JSON 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/yok-boyle-bir-adres' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('güvenlik başlıkları ayarlıdır (helmet)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('SQL enjeksiyonu benzeri arama dizeleri zararsızdır', async () => {
    await createDevice(app, admin);
    for (const q of ["'; DROP TABLE \"Device\"; --", "' OR '1'='1", '%', '_', '\\', '"', '𝕏😀']) {
      const res = await call(app, 'GET', `/api/devices?search=${encodeURIComponent(q)}`, admin);
      expect(res.statusCode, q).toBe(200);
    }
    expect(await prisma.device.count()).toBe(1);
    expect((await call(app, 'GET', `/api/devices?search=${'x'.repeat(101)}`, admin)).statusCode).toBe(400);
  });

  it('garip kimlik (ID) değerleri 500 değil 404 döner', async () => {
    for (const id of ['yok', '0', '-1', "'--", 'a'.repeat(200), '%00', '../etc']) {
      const r = await call(app, 'GET', `/api/devices/${encodeURIComponent(id)}`, admin);
      expect([404, 414], `${id.slice(0, 20)}: ${r.statusCode}`).toContain(r.statusCode); // çok uzun kimlik: 414 (500 değil)
    }
  });
});

describe('cihaz doğrulaması', () => {
  it('seri numarası büyük/küçük harf farkıyla da tekrar edilemez', async () => {
    expect((await post({ serialNumber: 'abc-123' })).statusCode).toBe(201);
    expect((await post({ serialNumber: 'ABC-123' })).statusCode).toBe(409);
    expect((await post({ serialNumber: ' abc-123 ' })).statusCode).toBe(409);
    const other = await createDevice(app, admin);
    expect((await call(app, 'PATCH', `/api/devices/${other.id}`, admin, { serialNumber: 'Abc-123' })).statusCode).toBe(409);
    expect((await call(app, 'PATCH', `/api/devices/${other.id}`, admin, { serialNumber: 'yeni-seri' })).statusCode).toBe(200);
  });

  it('kendi seri numarasını (aynı değerle) güncelleyebilir', async () => {
    const d = await post({ serialNumber: 'SN-OWN' });
    const id = d.json().device.id;
    expect((await call(app, 'PATCH', `/api/devices/${id}`, admin, { serialNumber: 'SN-OWN', model: 'Yeni' })).statusCode).toBe(200);
  });

  it('alım tarihi gelecekte olamaz; garanti alımdan önce olamaz', async () => {
    expect((await post({ purchaseDate: iso(30) })).statusCode).toBe(400);
    expect((await post({ purchaseDate: '2024-06-01', warrantyEnd: '2024-01-01' })).statusCode).toBe(400);
    expect((await post({ purchaseDate: '2024-06-01', warrantyEnd: '2024-06-01' })).statusCode).toBe(201); // aynı gün kabul
    expect((await post({ purchaseDate: iso(0), warrantyEnd: iso(365) })).statusCode).toBe(201); // bugün alınan
  });

  it('güncellemede tarih tutarlılığı mevcut değerlerle birlikte denetlenir', async () => {
    const id = (await post({ purchaseDate: '2024-06-01', warrantyEnd: '2027-06-01' })).json().device.id;
    expect((await call(app, 'PATCH', `/api/devices/${id}`, admin, { warrantyEnd: '2023-01-01' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', `/api/devices/${id}`, admin, { purchaseDate: '2028-01-01' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', `/api/devices/${id}`, admin, { warrantyEnd: null })).statusCode).toBe(200);
  });

  it('geçersiz tarih biçimleri 400 döner', async () => {
    for (const bad of ['dün', '2024-13-45', '', 'null', '31/12/2024x']) expect((await post({ purchaseDate: bad })).statusCode, bad).toBe(400);
  });

  it('model boşlukları sadeleşir; çok uzun alanlar reddedilir; notlar sınırlıdır', async () => {
    expect((await post({ model: '  ThinkPad    T14  ' })).json().device.model).toBe('ThinkPad T14');
    expect((await post({ model: 'm'.repeat(121) })).statusCode).toBe(400);
    expect((await post({ serialNumber: 's'.repeat(121) })).statusCode).toBe(400);
    expect((await post({ notes: 'n'.repeat(1001) })).statusCode).toBe(400);
    expect((await post({ notes: 'n'.repeat(1000) })).statusCode).toBe(201);
  });

  it('emoji ve Unicode içeren model/not adları sorunsuz saklanır', async () => {
    const r = await post({ model: 'Model Ü-İ-Ş-Ğ-Ç-Ö 日本語', notes: 'Not 😀 – çok özel "tırnak" ve <b>etiket</b>' });
    expect(r.statusCode).toBe(201);
    expect(r.json().device.notes).toContain('<b>etiket</b>'); // metin olarak saklanır; arayüz kaçışlar
  });

  it('sıralama alanlarının tümü çalışır, geçersiz sıralama 400 döner', async () => {
    await createDevice(app, admin, { brand: 'Zeta' });
    await createDevice(app, admin, { brand: 'Alfa' });
    for (const sortBy of ['assetTag', 'brand', 'model', 'purchaseDate', 'status', 'createdAt']) {
      for (const dir of ['asc', 'desc']) expect((await call(app, 'GET', `/api/devices?sortBy=${sortBy}&sortDir=${dir}`, admin)).statusCode, `${sortBy} ${dir}`).toBe(200);
    }
    const asc = (await call(app, 'GET', '/api/devices?sortBy=brand&sortDir=asc', admin)).json().data.map((d: any) => d.brand);
    expect(asc).toEqual(['Alfa', 'Zeta']);
    expect((await call(app, 'GET', '/api/devices?sortBy=passwordHash', admin)).statusCode).toBe(400);
    expect((await call(app, 'GET', '/api/devices?sortDir=sideways', admin)).statusCode).toBe(400);
  });

  it('sayfalama sınırları: page=0, pageSize=0/101/abc reddedilir; çok büyük sayfa boş döner', async () => {
    for (const q of ['page=0', 'pageSize=0', 'pageSize=101', 'pageSize=abc', 'page=-1', 'page=1.5']) expect((await call(app, 'GET', `/api/devices?${q}`, admin)).statusCode, q).toBe(400);
    await createDevice(app, admin);
    const far = (await call(app, 'GET', '/api/devices?page=999', admin)).json();
    expect(far.data).toEqual([]);
    expect(far.meta.total).toBe(1);
  });

  it('durum geçiş matrisi: tüm geçişler tutarlı sonuç verir', async () => {
    const d = await createDevice(app, admin);
    const st = async (status: string) => (await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status })).json();
    expect((await st('FAULTY')).device.status).toBe('FAULTY');
    expect((await st('RETIRED')).device.status).toBe('RETIRED');
    expect((await st('IN_STOCK')).device.status).toBe('IN_STOCK');
    await assign(d.id, staffId);
    const toStock = await st('IN_STOCK'); // zimmetliyken depoya: iade gibi
    expect(toStock).toMatchObject({ autoReturned: true, device: { status: 'IN_STOCK', holder: null } });
    expect((await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'GEÇERSİZ' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', '/api/devices/yok/status', admin, { status: 'FAULTY' })).statusCode).toBe(404);
  });

  it('olmayan kayıtlar için PATCH/DELETE/QR 404 döner', async () => {
    expect((await call(app, 'PATCH', '/api/devices/yok', admin, { model: 'x' })).statusCode).toBe(404);
    expect((await call(app, 'DELETE', '/api/devices/yok', admin)).statusCode).toBe(404);
    expect((await call(app, 'GET', '/api/devices/yok/qr', admin)).statusCode).toBe(404);
    expect((await call(app, 'POST', '/api/devices/yok/return', admin, {})).statusCode).toBe(404);
    expect((await call(app, 'POST', '/api/devices/yok/report-fault', staff, {})).statusCode).toBe(404);
  });

  it('toplu işlem sınırları: boş liste, aşırı uzun liste, geçersiz kimlikler', async () => {
    expect((await call(app, 'POST', '/api/devices/bulk-status', admin, { ids: [], status: 'RETIRED' })).statusCode).toBe(400);
    expect((await call(app, 'POST', '/api/devices/bulk-status', admin, { ids: Array(201).fill('x'), status: 'RETIRED' })).statusCode).toBe(400);
    const res = (await call(app, 'POST', '/api/devices/bulk-status', admin, { ids: ['yok1', 'yok2'], status: 'RETIRED' })).json();
    expect(res).toMatchObject({ ok: 0, failed: 2 });
    expect((await call(app, 'POST', '/api/devices/qr-batch', admin, { ids: Array(201).fill('x') })).statusCode).toBe(400);
    expect((await call(app, 'POST', '/api/devices/qr-batch', admin, { ids: ['yok'] })).json().data).toEqual([]);
  });

  it('aynı cihaz toplu listede tekrar ederse bir kez işlenir', async () => {
    const d = await createDevice(app, admin);
    const res = (await call(app, 'POST', '/api/assignments/bulk', admin, { deviceIds: [d.id, d.id, d.id], userId: staffId })).json();
    expect(res).toMatchObject({ ok: 1, failed: 0 });
  });
});

describe('kullanıcı doğrulaması', () => {
  it('ad boşlukları sadeleşir; e-posta küçük harfe çevrilir; ad çok kısa/uzun reddedilir', async () => {
    const u = (await call(app, 'POST', '/api/users', admin, { name: '  Ayşe    Nur   Yılmaz ', email: 'AYSE@T.com', password: 'Sifre1234', role: 'STAFF' })).json().user;
    expect(u.name).toBe('Ayşe Nur Yılmaz');
    expect(u.email).toBe('ayse@t.com');
    expect((await call(app, 'POST', '/api/users', admin, { name: 'A', email: 'a1@t.com', password: 'Sifre1234', role: 'STAFF' })).statusCode).toBe(400);
    expect((await call(app, 'POST', '/api/users', admin, { name: 'A'.repeat(101), email: 'a2@t.com', password: 'Sifre1234', role: 'STAFF' })).statusCode).toBe(400);
    expect((await call(app, 'POST', '/api/users', admin, { name: 'Geçerli Ad', email: 'a3@t.com', password: 'Sifre1234', role: 'SUPERUSER' })).statusCode).toBe(400);
  });

  it('e-posta güncellemede başka kullanıcıyla çakışırsa 409, kendi e-postası serbest', async () => {
    const a = await makeUser(app, admin, 'a@t.com');
    await makeUser(app, admin, 'b@t.com');
    expect((await call(app, 'PATCH', `/api/users/${a.id}`, admin, { email: 'B@T.com' })).statusCode).toBe(409);
    expect((await call(app, 'PATCH', `/api/users/${a.id}`, admin, { email: 'a@t.com', name: 'Yeni Ad' })).statusCode).toBe(200);
  });

  it('kullanıcı detayı aktif zimmetleri tutanak numarasıyla döner', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId, { dueAt: iso(10) });
    const det = (await call(app, 'GET', `/api/users/${staffId}`, admin)).json();
    expect(det.activeAssignments).toHaveLength(1);
    expect(det.activeAssignments[0]).toMatchObject({ receiptNo: expect.any(Number), device: { id: d.id } });
    expect(det.activeAssignments[0].dueAt).toBeTruthy();
    expect(det.user.activeDeviceCount).toBe(1);
  });

  it('arama, rol ve aktiflik süzgeçleri birlikte çalışır', async () => {
    await makeUser(app, admin, 'x1@t.com', { department: 'Kütüphane' });
    const p = await makeUser(app, admin, 'x2@t.com', { department: 'Kütüphane' });
    await call(app, 'PATCH', `/api/users/${p.id}`, admin, { isActive: false });
    const get = async (q: string) => (await call(app, 'GET', `/api/users?${q}`, admin)).json().meta.total;
    expect(await get('department=Kütüphane')).toBe(2);
    expect(await get('department=Kütüphane&isActive=true')).toBe(1);
    expect(await get('department=Kütüphane&isActive=false')).toBe(1);
    expect(await get('role=ADMIN')).toBe(1);
    expect(await get('role=UNIT_MANAGER')).toBe(1);
    expect(await get('search=KÜTÜPHANE')).toBe(2); // büyük/küçük harf duyarsız
    expect((await call(app, 'GET', '/api/users?isActive=yok', admin)).statusCode).toBe(400);
  });

  it('pasif kullanıcı giriş yapamaz; yeniden aktifleşince yapabilir', async () => {
    const u = await makeUser(app, admin, 'pasif@t.com');
    await call(app, 'PATCH', `/api/users/${u.id}`, admin, { isActive: false });
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'pasif@t.com', password: 'Sifre1234' } })).statusCode).toBe(401);
    await call(app, 'PATCH', `/api/users/${u.id}`, admin, { isActive: true });
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'pasif@t.com', password: 'Sifre1234' } })).statusCode).toBe(200);
  });
});

describe('zimmet: uç durumlar', () => {
  it('geçersiz planlı iade biçimi 400; boş dize iade tarihini kaldırır; gelecekteki tarih kabul', async () => {
    const d = await createDevice(app, admin);
    expect((await assign(d.id, staffId, { dueAt: 'yarın' })).statusCode).toBe(400);
    const a = (await assign(d.id, staffId, { dueAt: '' })).json().assignment;
    expect(a.dueAt).toBeNull();
    const up = await call(app, 'PATCH', `/api/assignments/${a.id}`, admin, { dueAt: iso(5) });
    expect(up.json().assignment.dueAt).toBeTruthy();
    const clear = await call(app, 'PATCH', `/api/assignments/${a.id}`, admin, { dueAt: null });
    expect(clear.json().assignment.dueAt).toBeNull();
    expect((await call(app, 'PATCH', `/api/assignments/${a.id}`, admin, { dueAt: 'bozuk' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', '/api/assignments/yok', admin, { dueAt: iso(2) })).statusCode).toBe(404);
    expect((await call(app, 'POST', '/api/assignments/yok/remind', admin)).statusCode).toBe(404);
  });

  it('iade edilmiş zimmete hatırlatma gönderilemez', async () => {
    const d = await createDevice(app, admin);
    const a = (await assign(d.id, staffId)).json().assignment;
    await call(app, 'POST', `/api/devices/${d.id}/return`, admin, {});
    expect((await call(app, 'POST', `/api/assignments/${a.id}/remind`, admin)).statusCode).toBe(409);
  });

  it('zimmet listesi süzgeçleri: gecikmiş, kişi, cihaz, arama', async () => {
    const [a, b] = [await createDevice(app, admin, { brand: 'Aaa' }), await createDevice(app, admin, { brand: 'Bbb' })];
    const asg = (await assign(a.id, staffId, { dueAt: iso(2) })).json().assignment;
    await assign(b.id, staffId);
    await prisma.assignment.update({ where: { id: asg.id }, data: { dueAt: new Date(Date.now() - 864e5) } });
    const get = async (q: string) => (await call(app, 'GET', `/api/assignments?${q}`, admin)).json().meta.total;
    expect(await get('overdue=true')).toBe(1);
    expect(await get(`userId=${staffId}`)).toBe(2);
    expect(await get(`deviceId=${a.id}`)).toBe(1);
    expect(await get('search=bbb')).toBe(1);
    expect(await get('state=returned')).toBe(0);
    expect((await call(app, 'GET', '/api/assignments?state=bozuk', admin)).statusCode).toBe(400);
  });

  it('devir sonrası eski kişiye bildirim gider, tutanak numaraları benzersizdir', async () => {
    const d = await createDevice(app, admin);
    const other = await makeUser(app, admin, 'diger@t.com');
    const a1 = (await assign(d.id, staffId)).json().assignment;
    const a2 = (await assign(d.id, other.id, { transfer: true })).json().assignment;
    expect(a1.receiptNo).not.toBe(a2.receiptNo);
    const titles = (await call(app, 'GET', '/api/notifications', staff)).json().data.map((n: any) => n.title);
    expect(titles).toContain('Zimmet düşüldü');
  });

  it('kendi kendine zimmetleyen yöneticiye gereksiz bildirim gönderilmez', async () => {
    const d = await createDevice(app, admin);
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    await assign(d.id, adminUser.id);
    expect((await call(app, 'GET', '/api/notifications', admin)).json().data.filter((n: any) => n.type === 'ASSIGNED')).toHaveLength(0);
  });
});

describe('raporlar ve panel: boş veri', () => {
  it('hiç cihaz yokken sıfıra bölme olmaz, değerler tutarlıdır', async () => {
    const dash = (await call(app, 'GET', '/api/dashboard', admin)).json();
    expect(dash.totals).toMatchObject({ devices: 0, assigned: 0, inStock: 0, faulty: 0, retired: 0 });
    expect(dash.attention).toMatchObject({ faults: [], warranty: [], overdue: [], stale: { count: 0, items: [] } });
    expect(dash.trend.devices).toEqual(Array(30).fill(0));
    const rep = (await call(app, 'GET', '/api/reports/summary', admin)).json();
    expect(rep.total).toBe(0);
    expect(rep.health.score).toBe(100);
    expect(rep.ageBuckets).toEqual([0, 0, 0, 0, 0, 0]);
    expect(rep.warrantyMonths).toEqual(Array(12).fill(0));
  });

  it('olmayan tür filtresi boş sonuç verir (hata değil)', async () => {
    await createDevice(app, admin);
    const dash = (await call(app, 'GET', '/api/dashboard?type=YokBoyleTur', admin)).json();
    expect(dash.totals.devices).toBe(0);
    expect(dash.byType.length).toBe(1);
  });

  it('CSV dışa aktarma boş veride yalnızca başlık satırı döner', async () => {
    const csv = (await call(app, 'GET', '/api/exports/devices', admin)).body;
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1);
  });
});

describe('eşzamanlılık', () => {
  it('aynı cihaz için paralel durum değişiklikleri tutarlı sonuç verir', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const results = await Promise.all([
      call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' }),
      call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'RETIRED' }),
      call(app, 'POST', `/api/devices/${d.id}/return`, admin, {}),
    ]);
    results.forEach((r) => expect(r.statusCode).toBeLessThan(500));
    const active = await prisma.assignment.count({ where: { deviceId: d.id, returnedAt: null } });
    expect(active).toBe(0);
    const openTickets = await prisma.faultTicket.count({ where: { deviceId: d.id, status: { not: 'RESOLVED' } } });
    expect(openTickets).toBeLessThanOrEqual(1);
  });

  it('paralel toplu zimmetler aynı cihazı iki kişiye vermez', async () => {
    const devices = await Promise.all(Array.from({ length: 5 }, () => createDevice(app, admin)));
    const u2 = await makeUser(app, admin, 'u2@t.com');
    const ids = devices.map((d) => d.id);
    await Promise.all([
      call(app, 'POST', '/api/assignments/bulk', admin, { deviceIds: ids, userId: staffId }),
      call(app, 'POST', '/api/assignments/bulk', admin, { deviceIds: ids, userId: u2.id }),
    ]);
    for (const id of ids) expect(await prisma.assignment.count({ where: { deviceId: id, returnedAt: null } })).toBe(1);
  });

  it('paralel sayım okutmaları aynı cihazı iki kez saymaz', async () => {
    const d = await createDevice(app, admin);
    const id = (await call(app, 'POST', '/api/counts', admin, { name: 'Paralel sayım' })).json().session.id;
    const res = await Promise.all(Array.from({ length: 6 }, () => call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: d.assetTag })));
    res.forEach((r) => expect(r.statusCode).toBe(200));
    expect(res.filter((r) => r.json().result === 'ok').length).toBeGreaterThanOrEqual(1);
    expect(await prisma.countItem.count({ where: { sessionId: id, scannedAt: { not: null } } })).toBe(1);
  });
});

describe('sayım: uç durumlar', () => {
  it('konum süzgeci büyük/küçük harf duyarsızdır; hizmet dışı cihazlar sayılmaz', async () => {
    await createDevice(app, admin, { location: 'Depo' });
    const r = await createDevice(app, admin, { location: 'Depo' });
    await call(app, 'PATCH', `/api/devices/${r.id}/status`, admin, { status: 'RETIRED' });
    const s = (await call(app, 'POST', '/api/counts', admin, { name: 'Depo', location: 'DEPO' })).json();
    expect(s.progress.expected).toBe(1);
  });

  it('seri numarası ile de okutulabilir; hizmet dışı cihaz "beklenmeyen" sayılır', async () => {
    const [a, retired] = [await createDevice(app, admin, { serialNumber: 'SER-9' }), await createDevice(app, admin)];
    await call(app, 'PATCH', `/api/devices/${retired.id}/status`, admin, { status: 'RETIRED' });
    const id = (await call(app, 'POST', '/api/counts', admin, { name: 'Genel sayım' })).json().session.id;
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: 'ser-9' })).json().result).toBe('ok');
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: retired.assetTag })).json().result).toBe('unexpected');
    void a;
  });

  it('doğrulama: kısa ad, boş kod, çok uzun kod', async () => {
    await createDevice(app, admin);
    expect((await call(app, 'POST', '/api/counts', admin, { name: 'x' })).statusCode).toBe(400);
    const id = (await call(app, 'POST', '/api/counts', admin, { name: 'Geçerli ad' })).json().session.id;
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: '' })).statusCode).toBe(400);
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: 'k'.repeat(301) })).statusCode).toBe(400);
    expect((await call(app, 'POST', '/api/counts/yok/scan', admin, { code: 'abc' })).statusCode).toBe(404);
    expect((await call(app, 'GET', '/api/counts/yok', admin)).statusCode).toBe(404);
    expect((await call(app, 'POST', '/api/counts/yok/close', admin)).statusCode).toBe(404);
    expect((await call(app, 'GET', '/api/counts/yok/export', admin)).statusCode).toBe(404);
  });

  it('sayım listesi en yeni başta; ilerleme bilgisi içerir', async () => {
    await createDevice(app, admin);
    await call(app, 'POST', '/api/counts', admin, { name: 'Birinci' });
    await call(app, 'POST', '/api/counts', admin, { name: 'İkinci' });
    const list = (await call(app, 'GET', '/api/counts', admin)).json().data;
    expect(list.map((s: any) => s.name)).toEqual(['İkinci', 'Birinci']);
    expect(list[0].progress).toMatchObject({ expected: 1, scanned: 0 });
  });
});

describe('bildirim ve arıza: uç durumlar', () => {
  it('bildirim limiti sınırlandırılır; sıralama en yeni başta', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    await call(app, 'POST', `/api/devices/${d.id}/return`, admin, {});
    const res = (await call(app, 'GET', '/api/notifications?limit=1', staff)).json();
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe('Zimmet düşüldü');
    expect((await call(app, 'GET', '/api/notifications?limit=0', staff)).statusCode).toBe(400);
    expect((await call(app, 'GET', '/api/notifications?limit=101', staff)).statusCode).toBe(400);
  });

  it('arıza listesi arama, durum ve sayfalama; olmayan kayıt 404', async () => {
    for (const note of ['Ekran kırık', 'Disk bozuk', 'Klavye çalışmıyor']) {
      const d = await createDevice(app, admin);
      await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY', note });
    }
    const get = async (q: string) => (await call(app, 'GET', `/api/faults?${q}`, admin)).json();
    expect((await get('search=disk')).meta.total).toBe(1);
    expect((await get('status=OPEN')).meta.total).toBe(3);
    expect((await get('active=true&pageSize=2')).data).toHaveLength(2);
    expect((await get('page=2&pageSize=2')).data).toHaveLength(1);
    expect((await call(app, 'GET', '/api/faults/yok', admin)).statusCode).toBe(404);
    expect((await call(app, 'PATCH', '/api/faults/yok', admin, { status: 'RESOLVED' })).statusCode).toBe(404);
    const t = (await get('')).data[0];
    expect((await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'GEÇERSİZ' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { handledById: staffId })).statusCode).toBe(400); // yalnızca yönetici ilgilenebilir
    const detail = (await call(app, 'GET', `/api/faults/${t.id}`, admin)).json();
    expect(detail.events.length).toBeGreaterThan(0);
  });

  it('arıza kaydı çözüm notu güncellenebilir; boş not null olur', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    const [t] = (await call(app, 'GET', '/api/faults', admin)).json().data;
    expect((await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { resolution: '  Parça bekleniyor ' })).json().ticket.resolution).toBe('Parça bekleniyor');
    expect((await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { resolution: '   ' })).json().ticket.resolution).toBeNull();
  });
});
