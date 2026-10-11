import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, STAFF, bearer, createDevice, login, makeApp, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
let staff: string;
let staffId: string;
let adminId: string;

const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as any });
const assign = (deviceId: string, userId: string, extra: object = {}) =>
  call('POST', '/api/assignments', admin, { deviceId, userId, ...extra });
const getDevice = async (id: string) => (await call('GET', `/api/devices/${id}`, admin)).json();
const makeUser = async (email: string) =>
  (await call('POST', '/api/users', admin, { name: `Kullanıcı ${email.split('@')[0]}`, email, password: 'Sifre1234', role: 'STAFF' })).json().user;

beforeAll(async () => (app = await makeApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  const a = await login(app, ADMIN);
  const s = await login(app, STAFF);
  admin = a.token;
  adminId = a.user.id;
  staff = s.token;
  staffId = s.user.id;
});

describe('Zimmet', () => {
  it('zimmetler: cihaz Zimmetli olur, holder görünür, olay yazılır', async () => {
    const d = await createDevice(app, admin);
    const res = await assign(d.id, staffId, { note: 'Yeni başlayan' });
    expect(res.statusCode).toBe(201);
    const { device, history, events } = await getDevice(d.id);
    expect(device.status).toBe('ASSIGNED');
    expect(device.holder.id).toBe(staffId);
    expect(history).toHaveLength(1);
    expect(history[0].returnedAt).toBeNull();
    expect(events[0].type).toBe('ASSIGNED');
  });

  it('zaten zimmetli cihaz 409 verir ve mevcut sahibi bildirir', async () => {
    const d = await createDevice(app, admin);
    const other = await makeUser('baska@t.com');
    await assign(d.id, staffId);
    const res = await assign(d.id, other.id);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.details).toMatchObject({ code: 'ALREADY_ASSIGNED', currentHolder: { id: staffId } });
    expect((await assign(d.id, staffId)).statusCode).toBe(409); // aynı kişiye tekrar
  });

  it('devir (transfer): eski zimmet OTOMATİK düşer, yeni zimmet açılır', async () => {
    const d = await createDevice(app, admin);
    const other = await makeUser('devir@t.com');
    await assign(d.id, staffId);
    const res = await assign(d.id, other.id, { transfer: true });
    expect(res.statusCode).toBe(201);
    const { device, history } = await getDevice(d.id);
    expect(device.holder.id).toBe(other.id);
    expect(history).toHaveLength(2);
    const old = history.find((h: any) => h.user.id === staffId);
    expect(old.returnedAt).not.toBeNull();
    expect(old.returnReason).toBe('REASSIGNED');
    expect(history.filter((h: any) => !h.returnedAt)).toHaveLength(1);
  });

  it('iade: zimmet kapanır, cihaz Depoda olur; ikinci iade 409', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const ret = await call('POST', `/api/devices/${d.id}/return`, admin, { note: 'Sağlam teslim' });
    expect(ret.statusCode).toBe(200);
    expect(ret.json().device.status).toBe('IN_STOCK');
    expect(ret.json().device.holder).toBeNull();
    const { history } = await getDevice(d.id);
    expect(history[0]).toMatchObject({ returnReason: 'MANUAL', returnNote: 'Sağlam teslim' });
    expect(history[0].returnedBy.id).toBe(adminId);
    expect((await call('POST', `/api/devices/${d.id}/return`, admin, {})).statusCode).toBe(409);
  });

  it('arızalı iade: zimmet düşer VE cihaz Arızalı olur', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const ret = await call('POST', `/api/devices/${d.id}/return`, admin, { condition: 'FAULTY', note: 'Ekran kırık' });
    expect(ret.json().device.status).toBe('FAULTY');
    const { history } = await getDevice(d.id);
    expect(history[0].returnReason).toBe('FAULT_REPORTED');
  });

  it('arızalı ve hizmet dışı cihaz zimmetlenemez; pasif kullanıcıya zimmet verilemez', async () => {
    const d = await createDevice(app, admin);
    await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    expect((await assign(d.id, staffId)).statusCode).toBe(409);
    await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'RETIRED' });
    expect((await assign(d.id, staffId)).statusCode).toBe(409);
    const ok = await createDevice(app, admin);
    const inactive = await makeUser('pasif@t.com');
    await call('PATCH', `/api/users/${inactive.id}`, admin, { isActive: false });
    expect((await assign(ok.id, inactive.id)).statusCode).toBe(409);
  });

  it('olmayan cihaz/kullanıcı 404 verir', async () => {
    const d = await createDevice(app, admin);
    expect((await assign('yok', staffId)).statusCode).toBe(404);
    expect((await assign(d.id, 'yok')).statusCode).toBe(404);
  });

  it('OTOMATİK DÜŞME: zimmetli cihaz Arızalı yapılınca zimmet kendiliğinden kapanır', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const res = await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY', note: 'Açılmıyor' });
    expect(res.json()).toMatchObject({ autoReturned: true, device: { status: 'FAULTY', holder: null } });
    const { history } = await getDevice(d.id);
    expect(history[0]).toMatchObject({ returnReason: 'FAULT_REPORTED' });
    expect(history[0].returnedAt).not.toBeNull();
  });

  it('OTOMATİK DÜŞME: zimmetli cihaz Hizmet dışı yapılınca zimmet düşer', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const res = await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'RETIRED' });
    expect(res.json().autoReturned).toBe(true);
    expect((await getDevice(d.id)).history[0].returnReason).toBe('RETIRED');
  });

  it('durum doğrudan Zimmetli yapılamaz', async () => {
    const d = await createDevice(app, admin);
    expect((await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'ASSIGNED' })).statusCode).toBe(400);
  });

  it('personel kendi cihazı için arıza bildirir: zimmet otomatik düşer', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const res = await call('POST', `/api/devices/${d.id}/report-fault`, staff, { note: 'Klavye çalışmıyor' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ autoReturned: true, device: { status: 'FAULTY' } });
    expect((await call('GET', '/api/devices/mine', staff)).json().data).toHaveLength(0);
  });

  it('personel başkasının cihazı için arıza bildiremez (403)', async () => {
    const d = await createDevice(app, admin);
    const other = await makeUser('x@t.com');
    await assign(d.id, other.id);
    expect((await call('POST', `/api/devices/${d.id}/report-fault`, staff, {})).statusCode).toBe(403);
    expect((await getDevice(d.id)).device.status).toBe('ASSIGNED');
  });

  it('personel yalnızca kendi cihazlarını listeler; zimmet işlemi yapamaz', async () => {
    const mine = await createDevice(app, admin);
    const other = await createDevice(app, admin);
    const u2 = await makeUser('y@t.com');
    await assign(mine.id, staffId);
    await assign(other.id, u2.id);
    const list = (await call('GET', '/api/devices', staff)).json();
    expect(list.data.map((d: any) => d.id)).toEqual([mine.id]);
    expect((await call('GET', '/api/devices/mine', staff)).json().data[0].id).toBe(mine.id);
    expect((await call('POST', '/api/assignments', staff, { deviceId: other.id, userId: staffId, transfer: true })).statusCode).toBe(403);
    expect((await call('POST', `/api/devices/${mine.id}/return`, staff, {})).statusCode).toBe(403);
  });

  it('personel detayda zimmet geçmişi/denetim kaydı görmez', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const detail = (await call('GET', `/api/devices/${d.id}`, staff)).json();
    expect(detail.history).toEqual([]);
    expect(detail.events).toEqual([]);
  });

  it('OTOMATİK DÜŞME: kullanıcı pasife alınınca tüm cihazları Depoya döner', async () => {
    const u = await makeUser('ayril@t.com');
    const [a, b] = [await createDevice(app, admin), await createDevice(app, admin)];
    await assign(a.id, u.id);
    await assign(b.id, u.id);
    const res = await call('PATCH', `/api/users/${u.id}`, admin, { isActive: false });
    expect(res.statusCode).toBe(200);
    for (const id of [a.id, b.id]) {
      const { device, history } = await getDevice(id);
      expect(device).toMatchObject({ status: 'IN_STOCK', holder: null });
      expect(history[0].returnReason).toBe('USER_DEACTIVATED');
    }
  });

  it('OTOMATİK DÜŞME: zimmet geçmişi olan kullanıcı silinince pasife alınır, geçmiş korunur', async () => {
    const u = await makeUser('sil@t.com');
    const d = await createDevice(app, admin);
    await assign(d.id, u.id);
    const del = await call('DELETE', `/api/users/${u.id}`, admin);
    expect(del.json()).toMatchObject({ mode: 'deactivated', releasedDevices: 1 });
    const { device, history } = await getDevice(d.id);
    expect(device.status).toBe('IN_STOCK');
    expect(history).toHaveLength(1);
    expect(history[0].user.id).toBe(u.id);
  });

  it('EŞZAMANLILIK: aynı cihaza paralel zimmet isteklerinden yalnızca biri başarılı olur', async () => {
    const d = await createDevice(app, admin);
    const users = await Promise.all(Array.from({ length: 6 }, (_, i) => makeUser(`par${i}@t.com`)));
    const results = await Promise.all(users.map((u) => assign(d.id, u.id)));
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(5);
    const active = await prisma.assignment.count({ where: { deviceId: d.id, returnedAt: null } });
    expect(active).toBe(1);
  });

  it('VERİTABANI GÜVENCESİ: aynı cihaza ikinci aktif zimmet doğrudan SQL ile bile eklenemez', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    await expect(
      prisma.assignment.create({ data: { deviceId: d.id, userId: adminId, assignedById: adminId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('zimmet listesi: durum/arama filtresi ve sayfalama', async () => {
    const [a, b] = [await createDevice(app, admin, { brand: 'Dell' }), await createDevice(app, admin, { brand: 'HP' })];
    await assign(a.id, staffId);
    await assign(b.id, staffId);
    await call('POST', `/api/devices/${b.id}/return`, admin, {});
    const get = async (qs: string) => (await call('GET', `/api/assignments?${qs}`, admin)).json();
    expect((await get('state=all')).meta.total).toBe(2);
    expect((await get('state=active')).meta.total).toBe(1);
    expect((await get('state=returned')).data[0].device.brand).toBe('HP');
    expect((await get('search=dell')).meta.total).toBe(1);
    expect((await get(`userId=${staffId}&pageSize=1`)).data).toHaveLength(1);
  });

  it('dashboard rakamları tutarlıdır', async () => {
    const [a, b, c, d] = [
      await createDevice(app, admin), await createDevice(app, admin), await createDevice(app, admin), await createDevice(app, admin),
    ];
    await assign(a.id, staffId);
    await call('PATCH', `/api/devices/${b.id}/status`, admin, { status: 'FAULTY' });
    await call('PATCH', `/api/devices/${d.id}/status`, admin, { status: 'RETIRED' });
    void c;
    const dash = (await call('GET', '/api/dashboard', admin)).json();
    expect(dash.totals).toMatchObject({ devices: 4, assigned: 1, faulty: 1, inStock: 1, retired: 1 });
    expect(dash.byDepartment).toEqual([{ department: 'Muhasebe', count: 1 }]);
    expect(dash.trend.devices).toHaveLength(30);
    expect(dash.trend.assigned.at(-1)).toBe(1);
    expect(dash.recentEvents.length).toBeGreaterThan(0);
    const rep = (await call('GET', '/api/reports/summary', admin)).json();
    expect(rep.activity).toHaveLength(30);
    expect(rep.activity.at(-1).assigned).toBe(1);
    expect((await call('GET', '/api/dashboard', staff)).statusCode).toBe(403);
  });
});
