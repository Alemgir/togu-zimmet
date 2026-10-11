import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, STAFF, bearer, createDevice, deviceBody, login, makeApp, resetDb } from './helpers.js';

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

describe('Envanter', () => {
  it('cihaz ekler: otomatik benzersiz demirbaş no, QR token ve Depoda durumu', async () => {
    const a = await createDevice(app, admin);
    const b = await createDevice(app, admin);
    expect(a.assetTag).toBe('TOGU-000001');
    expect(b.assetTag).toBe('TOGU-000002');
    expect(a.status).toBe('IN_STOCK');
    expect(a.qrToken).not.toBe(b.qrToken);
  });

  it('eşzamanlı eklemelerde demirbaş numaraları çakışmaz', async () => {
    await createDevice(app, admin); // sayaç satırını oluştur
    const results = await Promise.all(Array.from({ length: 10 }, () => createDevice(app, admin)));
    const tags = new Set(results.map((d) => d.assetTag));
    expect(tags.size).toBe(10);
  });

  it('aynı seri numarasını reddeder', async () => {
    await createDevice(app, admin, { serialNumber: 'ABC' });
    const dup = await app.inject({ method: 'POST', url: '/api/devices', headers: bearer(admin), payload: deviceBody({ serialNumber: 'ABC' }) });
    expect(dup.statusCode).toBe(409);
  });

  it('zorunlu alan ve tarih doğrulaması yapar', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/devices', headers: bearer(admin), payload: { brand: '' } });
    expect(res.statusCode).toBe(400);
    const badDate = await app.inject({ method: 'POST', url: '/api/devices', headers: bearer(admin), payload: deviceBody({ purchaseDate: 'dün' }) });
    expect(badDate.statusCode).toBe(400);
  });

  it('personel cihaz ekleyemez/silemez, ama QR ile cihaz detayını görebilir', async () => {
    const st = (await login(app, STAFF)).token;
    const d = await createDevice(app, admin);
    expect((await app.inject({ method: 'POST', url: '/api/devices', headers: bearer(st), payload: deviceBody() })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `/api/devices/${d.id}`, headers: bearer(st) })).statusCode).toBe(403);
    const byQr = await app.inject({ method: 'GET', url: `/api/devices/by-qr/${d.qrToken}`, headers: bearer(st) });
    expect(byQr.statusCode).toBe(200);
    expect(byQr.json().device.id).toBe(d.id);
    expect((await app.inject({ method: 'GET', url: '/api/devices/by-qr/yok', headers: bearer(st) })).statusCode).toBe(404);
  });

  it('QR kodu üretir (PNG data URL + SVG + okutulabilir link)', async () => {
    const d = await createDevice(app, admin);
    const qr = (await app.inject({ method: 'GET', url: `/api/devices/${d.id}/qr`, headers: bearer(admin) })).json();
    expect(qr.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(qr.svg).toContain('<svg');
    expect(qr.payload).toBe(`http://localhost:5173/scan/${d.qrToken}`);
  });

  it('günceller ve olay geçmişine yazar', async () => {
    const d = await createDevice(app, admin);
    const up = await app.inject({ method: 'PATCH', url: `/api/devices/${d.id}`, headers: bearer(admin), payload: { model: 'X1 Carbon', location: 'Depo' } });
    expect(up.json().device.model).toBe('X1 Carbon');
    const detail = (await app.inject({ method: 'GET', url: `/api/devices/${d.id}`, headers: bearer(admin) })).json();
    expect(detail.events.map((e: any) => e.type)).toEqual(['UPDATED', 'CREATED']);
  });

  it('arama, durum/tip/marka filtresi ve sayfalama', async () => {
    await createDevice(app, admin, { brand: 'Dell', model: 'Latitude', type: 'LAPTOP' });
    await createDevice(app, admin, { brand: 'Dell', model: 'U2723', type: 'MONITOR' });
    await createDevice(app, admin, { brand: 'HP', model: 'EliteBook', type: 'LAPTOP', serialNumber: 'HP-XYZ-1' });
    const get = async (qs: string) => (await app.inject({ method: 'GET', url: `/api/devices?${qs}`, headers: bearer(admin) })).json();
    expect((await get('search=dell')).meta.total).toBe(2);
    expect((await get('search=hp-xyz')).meta.total).toBe(1);
    expect((await get('type=LAPTOP')).meta.total).toBe(2);
    expect((await get('brand=HP&type=LAPTOP')).meta.total).toBe(1);
    expect((await get('status=FAULTY')).meta.total).toBe(0);
    const p = await get('pageSize=2&page=2&sortBy=assetTag&sortDir=asc');
    expect(p.data.map((d: any) => d.assetTag)).toEqual(['TOGU-000003']);
  });

  it('zimmet geçmişi olmayan cihaz silinir, geçmişi olan silinemez', async () => {
    const { user } = await login(app, STAFF);
    const free = await createDevice(app, admin);
    const used = await createDevice(app, admin);
    expect((await app.inject({ method: 'DELETE', url: `/api/devices/${free.id}`, headers: bearer(admin) })).statusCode).toBe(200);
    await app.inject({ method: 'POST', url: '/api/assignments', headers: bearer(admin), payload: { deviceId: used.id, userId: user.id } });
    await app.inject({ method: 'POST', url: `/api/devices/${used.id}/return`, headers: bearer(admin), payload: {} });
    expect((await app.inject({ method: 'DELETE', url: `/api/devices/${used.id}`, headers: bearer(admin) })).statusCode).toBe(409);
  });
});
