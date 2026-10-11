import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { runScheduledChecks } from '../src/services/notificationService.js';
import { ADMIN, STAFF, call, createDevice, login, makeApp, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
let staff: string;
let staffId: string;
const DAY = 864e5;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

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
});

const list = async (token: string) => (await call(app, 'GET', '/api/notifications', token)).json() as { data: any[]; unread: number };

describe('Bildirimler', () => {
  it('zimmet verilince personele bildirim gider; okundu işaretlenebilir', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId });
    const n = await list(staff);
    expect(n.unread).toBe(1);
    expect(n.data[0]).toMatchObject({ type: 'ASSIGNED', title: 'Size zimmet verildi', link: `/devices/${d.id}` });
    await call(app, 'POST', `/api/notifications/${n.data[0].id}/read`, staff);
    expect((await list(staff)).unread).toBe(0);
  });

  it('zimmetten düşülünce (manuel/otomatik) personele bildirim gider', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId });
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'RETIRED' });
    const titles = (await list(staff)).data.map((x) => x.title);
    expect(titles).toContain('Zimmet düşüldü');
  });

  it('tümünü okundu yap yalnızca kendi bildirimlerini etkiler', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    await prisma.notification.create({ data: { userId: adminUser.id, type: 'ASSIGNED', title: 'x', body: 'y' } });
    await call(app, 'POST', '/api/notifications/read-all', staff);
    expect((await list(staff)).unread).toBe(0);
    expect((await list(admin)).unread).toBe(1);
  });

  it('bir kullanıcının bildirimini başkası okundu yapamaz', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId });
    const n = (await list(staff)).data[0];
    await call(app, 'POST', `/api/notifications/${n.id}/read`, admin);
    expect((await list(staff)).unread).toBe(1);
  });

  it('planlı iade: geçmiş tarih reddedilir; uzatma ve hatırlatma çalışır', async () => {
    const d = await createDevice(app, admin);
    expect((await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId, dueAt: iso(-5) })).statusCode).toBe(400);
    const a = (await call(app, 'POST', '/api/assignments', admin, { deviceId: d.id, userId: staffId, dueAt: iso(10) })).json().assignment;
    expect(a.dueAt).toBeTruthy();
    const ext = await call(app, 'PATCH', `/api/assignments/${a.id}`, admin, { dueAt: iso(30) });
    expect(ext.statusCode).toBe(200);
    expect((await call(app, 'POST', `/api/assignments/${a.id}/remind`, admin)).statusCode).toBe(200);
    expect((await list(staff)).data.map((x) => x.title)).toContain('İade hatırlatması');
    await call(app, 'POST', `/api/devices/${d.id}/return`, admin, {});
    expect((await call(app, 'PATCH', `/api/assignments/${a.id}`, admin, { dueAt: iso(40) })).statusCode).toBe(409);
  });

  it('zamanlı kontrol: gecikme ve yaklaşan iade uyarıları üretilir, tekrar çalışınca ÇOĞALMAZ', async () => {
    const [late, soon] = [await createDevice(app, admin), await createDevice(app, admin)];
    const a1 = (await call(app, 'POST', '/api/assignments', admin, { deviceId: late.id, userId: staffId, dueAt: iso(5) })).json().assignment;
    await call(app, 'POST', '/api/assignments', admin, { deviceId: soon.id, userId: staffId, dueAt: iso(2) });
    // 1. zimmetin tarihini geçmişe çek (iş kuralı geçmişi reddettiği için doğrudan veritabanı)
    await prisma.assignment.update({ where: { id: a1.id }, data: { dueAt: new Date(Date.now() - 3 * DAY) } });
    await runScheduledChecks();
    await runScheduledChecks();
    const mine = (await list(staff)).data;
    expect(mine.filter((n) => n.type === 'ASSIGNMENT_OVERDUE')).toHaveLength(1);
    expect(mine.filter((n) => n.type === 'ASSIGNMENT_DUE')).toHaveLength(1);
    const adm = (await list(admin)).data;
    expect(adm.filter((n) => n.type === 'ASSIGNMENT_OVERDUE')).toHaveLength(1); // yönetici de gecikmeden haberdar olur
  });

  it('zamanlı kontrol: garantisi 30 gün içinde bitenler yöneticilere bildirilir (tekrarsız)', async () => {
    await createDevice(app, admin, { warrantyEnd: iso(12) });
    await createDevice(app, admin, { warrantyEnd: iso(200) });
    await runScheduledChecks();
    await runScheduledChecks();
    const adm = (await list(admin)).data.filter((n) => n.type === 'WARRANTY_EXPIRING');
    expect(adm).toHaveLength(1);
    expect(adm[0].body).toContain('garantisi');
  });

  it('dashboard dikkat listesi gecikmiş zimmeti ve garantiyi gösterir; tür filtresi her şeyi süzer', async () => {
    const lap = await createDevice(app, admin, { type: 'LAPTOP', warrantyEnd: iso(20) });
    const mon = await createDevice(app, admin, { type: 'MONITOR' });
    const a = (await call(app, 'POST', '/api/assignments', admin, { deviceId: lap.id, userId: staffId, dueAt: iso(3) })).json().assignment;
    await call(app, 'POST', '/api/assignments', admin, { deviceId: mon.id, userId: staffId });
    await prisma.assignment.update({ where: { id: a.id }, data: { dueAt: new Date(Date.now() - 2 * DAY) } });
    const all = (await call(app, 'GET', '/api/dashboard', admin)).json();
    expect(all.attention.overdue).toHaveLength(1);
    expect(all.attention.overdue[0]).toMatchObject({ days: 2, user: { name: 'Test Personel' } });
    expect(all.attention.warranty).toHaveLength(1);
    expect(all.totals.devices).toBe(2);
    expect(all.byType).toHaveLength(2);

    const onlyMon = (await call(app, 'GET', '/api/dashboard?type=MONITOR', admin)).json();
    expect(onlyMon.totals.devices).toBe(1);
    expect(onlyMon.attention.overdue).toHaveLength(0);
    expect(onlyMon.attention.warranty).toHaveLength(0);
    expect(onlyMon.byType).toHaveLength(2); // kutular her zaman tüm türleri gösterir
    expect(onlyMon.type).toBe('MONITOR');
  });

  it('hareketsiz depo: 60+ gündür kullanılmayan cihaz sayılır', async () => {
    const old = await createDevice(app, admin);
    await createDevice(app, admin);
    await prisma.device.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 90 * DAY) } });
    const dash = (await call(app, 'GET', '/api/dashboard', admin)).json();
    expect(dash.attention.stale.count).toBe(1);
    expect(dash.attention.stale.items[0].days).toBeGreaterThanOrEqual(89);
    const list = (await call(app, 'GET', '/api/devices?stale=true', admin)).json();
    expect(list.meta.total).toBe(1);
  });
});
