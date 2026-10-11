import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, MANAGER, STAFF, call, createDevice, login, makeApp, makeUser, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
let staff: string;
let staffId: string;
let mgr: string;
let adminId: string;

beforeAll(async () => (app = await makeApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  const a = await login(app, ADMIN);
  admin = a.token;
  adminId = a.user.id;
  const s = await login(app, STAFF);
  staff = s.token;
  staffId = s.user.id;
  mgr = (await login(app, MANAGER)).token;
});
const assign = (deviceId: string, userId: string, extra = {}) => call(app, 'POST', '/api/assignments', admin, { deviceId, userId, ...extra });

describe('Birim sorumlusu rolü', () => {
  it('birim sorumlusu için birim zorunludur (oluşturma ve güncelleme)', async () => {
    const bad = await call(app, 'POST', '/api/users', admin, { name: 'Bir Kişi', email: 'b@t.com', password: 'Sifre1234', role: 'UNIT_MANAGER' });
    expect(bad.statusCode).toBe(400);
    const u = await makeUser(app, admin, 'c@t.com');
    expect((await call(app, 'PATCH', `/api/users/${u.id}`, admin, { role: 'UNIT_MANAGER' })).statusCode).toBe(400);
    expect((await call(app, 'PATCH', `/api/users/${u.id}`, admin, { role: 'UNIT_MANAGER', department: 'Muhasebe' })).statusCode).toBe(200);
  });

  it('yalnızca kendi biriminin kullanıcılarını listeler ve görüntüler', async () => {
    await makeUser(app, admin, 'ayni@t.com', { department: 'Muhasebe' });
    const other = await makeUser(app, admin, 'baska@t.com', { department: 'Kütüphane' });
    const list = (await call(app, 'GET', '/api/users', mgr)).json();
    expect(list.data.every((u: any) => u.department === 'Muhasebe')).toBe(true);
    expect(list.meta.total).toBe(3); // staff + manager + ayni
    expect((await call(app, 'GET', `/api/users/${other.id}`, mgr)).statusCode).toBe(404);
    expect((await call(app, 'POST', '/api/users', mgr, {})).statusCode).toBe(403);
    expect((await call(app, 'DELETE', `/api/users/${other.id}`, mgr)).statusCode).toBe(403);
  });

  it('envanter ve zimmetler kendi birimiyle sınırlıdır; yazma işlemleri yasaktır', async () => {
    const other = await makeUser(app, admin, 'baska@t.com', { department: 'Kütüphane' });
    const [mine, theirs, free] = [await createDevice(app, admin), await createDevice(app, admin), await createDevice(app, admin)];
    await assign(mine.id, staffId);
    await assign(theirs.id, other.id);
    const devices = (await call(app, 'GET', '/api/devices', mgr)).json();
    expect(devices.data.map((d: any) => d.id)).toEqual([mine.id]);
    const asg = (await call(app, 'GET', '/api/assignments', mgr)).json();
    expect(asg.meta.total).toBe(1);
    expect((await call(app, 'GET', `/api/devices/${mine.id}`, mgr)).json().history).toHaveLength(1); // kendi biriminde: geçmiş görünür
    expect((await call(app, 'GET', `/api/devices/${theirs.id}`, mgr)).json().history).toEqual([]); // başka birim: yalnızca temel bilgi
    expect((await call(app, 'POST', '/api/assignments', mgr, { deviceId: free.id, userId: staffId })).statusCode).toBe(403);
    expect((await call(app, 'POST', `/api/devices/${mine.id}/return`, mgr, {})).statusCode).toBe(403);
    expect((await call(app, 'POST', '/api/devices', mgr, {})).statusCode).toBe(403);
    expect((await call(app, 'GET', '/api/counts', mgr)).statusCode).toBe(403);
  });

  it('kendi biriminin cihazı için arıza bildirebilir, başka birimin için bildiremez', async () => {
    const other = await makeUser(app, admin, 'baska@t.com', { department: 'Kütüphane' });
    const [mine, theirs] = [await createDevice(app, admin), await createDevice(app, admin)];
    await assign(mine.id, staffId);
    await assign(theirs.id, other.id);
    expect((await call(app, 'POST', `/api/devices/${theirs.id}/report-fault`, mgr, {})).statusCode).toBe(403);
    const ok = await call(app, 'POST', `/api/devices/${mine.id}/report-fault`, mgr, { note: 'Sorumlu bildirdi' });
    expect(ok.statusCode).toBe(200);
    // Zimmetten düşse de biriminden bildirilen arıza kaydını görmeye devam eder
    const faults = (await call(app, 'GET', '/api/faults', mgr)).json().data;
    expect(faults).toHaveLength(1);
    expect((await call(app, 'GET', '/api/faults/board', mgr)).json().OPEN).toHaveLength(1);
    expect((await call(app, 'GET', `/api/devices/${mine.id}`, mgr)).statusCode).toBe(200);
  });

  it('dashboard ve raporlar yalnızca birimin verisini kapsar; dışa aktarma da öyle', async () => {
    const other = await makeUser(app, admin, 'baska@t.com', { department: 'Kütüphane' });
    const [mine, theirs] = [await createDevice(app, admin, { brand: 'Benim' }), await createDevice(app, admin, { brand: 'Onların' })];
    await assign(mine.id, staffId);
    await assign(theirs.id, other.id);
    const dash = (await call(app, 'GET', '/api/dashboard', mgr)).json();
    expect(dash.scope).toBe('department');
    expect(dash.totals.devices).toBe(1);
    expect(dash.byDepartment).toEqual([{ department: 'Muhasebe', count: 1 }]);
    expect((await call(app, 'GET', '/api/reports/summary', mgr)).json().total).toBe(1);
    const csv = (await call(app, 'GET', '/api/exports/devices', mgr)).body;
    expect(csv).toContain('Benim');
    expect(csv).not.toContain('Onların');
  });

  it('son aktif yönetici rolünü düşürmeye veya birim sorumlusuna çevirmeye çalışırken korunur', async () => {
    expect((await call(app, 'PATCH', `/api/users/${adminId}`, admin, { role: 'UNIT_MANAGER', department: 'Birim X' })).statusCode).toBe(409);
  });
});

describe('Envanter sayımı', () => {
  it('oturum açılınca beklenen cihazlar listelenir; okutma ok / tekrar / beklenmeyen sonucu verir', async () => {
    const [a, b, c] = [await createDevice(app, admin, { location: 'Depo' }), await createDevice(app, admin, { location: 'Depo' }), await createDevice(app, admin, { location: 'Sunucu Odası' })];
    const created = await call(app, 'POST', '/api/counts', admin, { name: 'Depo sayımı', location: 'Depo' });
    expect(created.statusCode).toBe(201);
    const id = created.json().session.id;
    expect(created.json().progress).toEqual({ expected: 2, scanned: 0, missing: 2, unexpected: 0 });

    const s1 = await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: `http://localhost:5173/scan/${a.qrToken}` }); // QR bağlantısı
    expect(s1.json()).toMatchObject({ result: 'ok', device: { id: a.id }, progress: { scanned: 1, missing: 1 } });
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: a.assetTag.toLowerCase() })).json().result).toBe('duplicate'); // demirbaş no
    const s3 = await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: c.qrToken });
    expect(s3.json()).toMatchObject({ result: 'unexpected', progress: { unexpected: 1 } });
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: 'yok-boyle-bir-kod' })).statusCode).toBe(404);
    void b;

    const missing = (await call(app, 'GET', `/api/counts/${id}?state=missing`, admin)).json();
    expect(missing.data.map((i: any) => i.device.id)).toEqual([b.id]);
    expect((await call(app, 'GET', `/api/counts/${id}?state=unexpected`, admin)).json().data[0].device.id).toBe(c.id);
  });

  it('kapatılan sayıma okutma yapılamaz; CSV raporu sonuçları içerir', async () => {
    const [a, b] = [await createDevice(app, admin), await createDevice(app, admin)];
    const id = (await call(app, 'POST', '/api/counts', admin, { name: 'Genel sayım' })).json().session.id;
    await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: a.assetTag });
    const closed = await call(app, 'POST', `/api/counts/${id}/close`, admin);
    expect(closed.json().progress).toMatchObject({ scanned: 1, missing: 1 });
    expect((await call(app, 'POST', `/api/counts/${id}/close`, admin)).statusCode).toBe(409);
    expect((await call(app, 'POST', `/api/counts/${id}/scan`, admin, { code: b.assetTag })).statusCode).toBe(409);
    const csv = (await call(app, 'GET', `/api/counts/${id}/export`, admin)).body;
    expect(csv).toContain(`${a.assetTag};`);
    expect(csv).toMatch(/Sayıldı/);
    expect(csv).toMatch(/Eksik/);
  });

  it('sayılacak cihaz yoksa oturum açılmaz; personel erişemez', async () => {
    expect((await call(app, 'POST', '/api/counts', admin, { name: 'Boş sayım' })).statusCode).toBe(400);
    expect((await call(app, 'GET', '/api/counts', staff)).statusCode).toBe(403);
  });
});

describe('Toplu işlemler, tutanak ve raporlar', () => {
  it('toplu zimmet: başarılı olanlar işlenir, hatalılar nedeniyle raporlanır', async () => {
    const [a, b, c] = [await createDevice(app, admin), await createDevice(app, admin), await createDevice(app, admin)];
    await call(app, 'PATCH', `/api/devices/${c.id}/status`, admin, { status: 'FAULTY' });
    const res = await call(app, 'POST', '/api/assignments/bulk', admin, { deviceIds: [a.id, b.id, c.id], userId: staffId });
    expect(res.json()).toMatchObject({ ok: 2, failed: 1 });
    expect(res.json().results.find((r: any) => r.deviceId === c.id).error).toMatch(/Arızalı/);
    expect((await call(app, 'GET', '/api/devices/mine', staff)).json().data).toHaveLength(2);
  });

  it('toplu durum değiştirme zimmetli cihazları otomatik düşürür', async () => {
    const [a, b] = [await createDevice(app, admin), await createDevice(app, admin)];
    await assign(a.id, staffId);
    const res = await call(app, 'POST', '/api/devices/bulk-status', admin, { ids: [a.id, b.id], status: 'RETIRED' });
    expect(res.json()).toMatchObject({ ok: 2, failed: 0 });
    expect((await call(app, 'GET', '/api/devices/mine', staff)).json().data).toHaveLength(0);
  });

  it('toplu QR etiketi: seçilen cihazların QR görüntülerini döndürür', async () => {
    const [a, b] = [await createDevice(app, admin), await createDevice(app, admin)];
    const res = (await call(app, 'POST', '/api/devices/qr-batch', admin, { ids: [a.id, b.id] })).json();
    expect(res.data).toHaveLength(2);
    expect(res.data[0].dataUrl).toMatch(/^data:image\/png;base64,/);
    expect((await call(app, 'POST', '/api/devices/qr-batch', staff, { ids: [a.id] })).statusCode).toBe(403);
  });

  it('tutanak verisi: zimmet sahibi, yönetici ve birim sorumlusu görür; başkası göremez', async () => {
    const d = await createDevice(app, admin);
    const other = await makeUser(app, admin, 'baska@t.com', { department: 'Kütüphane' });
    const a = (await assign(d.id, staffId)).json().assignment;
    const otherToken = (await login(app, { email: 'baska@t.com', password: 'Sifre1234' })).token;
    const mine = await call(app, 'GET', `/api/assignments/${a.id}`, staff);
    expect(mine.statusCode).toBe(200);
    expect(mine.json().assignment).toMatchObject({ receiptNo: expect.any(Number), device: { id: d.id }, user: { id: staffId }, assignedBy: { name: 'Test Admin' } });
    expect((await call(app, 'GET', `/api/assignments/${a.id}`, mgr)).statusCode).toBe(200); // aynı birim
    expect((await call(app, 'GET', `/api/assignments/${a.id}`, otherToken)).statusCode).toBe(403);
    void other;
  });

  it('zimmetler CSV: tutanak numarası ve durum bilgisi', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const csv = (await call(app, 'GET', '/api/exports/assignments?state=active', admin)).body;
    expect(csv).toMatch(/ZT-\d{4}-000001/);
    expect(csv).toContain('Test Personel');
  });

  it('raporlar: sağlık puanı, yaş dağılımı, garanti takvimi ve tür filtresi', async () => {
    const old = new Date(Date.now() - 4.5 * 365 * 864e5).toISOString().slice(0, 10);
    await createDevice(app, admin, { type: 'LAPTOP', purchaseDate: old, warrantyEnd: '2023-01-01' });
    const ok = await createDevice(app, admin, { type: 'MONITOR', warrantyEnd: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) });
    await call(app, 'PATCH', `/api/devices/${ok.id}/status`, admin, { status: 'FAULTY' });
    const rep = (await call(app, 'GET', '/api/reports/summary', admin)).json();
    expect(rep.total).toBe(2);
    expect(rep.ageBuckets[4]).toBe(1); // 4–5 yaş
    expect(rep.ageBuckets[2]).toBe(1); // 2–3 yaş (varsayılan alım tarihi 2024-03)
    expect(rep.health.faultyRate).toBe(50);
    expect(rep.health.expiredWarrantyRate).toBe(50);
    expect(rep.health.score).toBeLessThan(60);
    expect(rep.warrantyMonths[1]).toBe(1); // 40 gün sonra biten garanti → 2. ay kovası (arızalı cihaz hâlâ envanterde)
    const lap = (await call(app, 'GET', '/api/reports/summary?type=LAPTOP', admin)).json();
    expect(lap.total).toBe(1);
    expect(lap.byType).toHaveLength(2);
    expect((await call(app, 'GET', '/api/reports/summary', staff)).statusCode).toBe(403);
  });
});
