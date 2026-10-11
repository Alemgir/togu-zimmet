import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, STAFF, call, createDevice, login, makeApp, resetDb } from './helpers.js';

let app: FastifyInstance;
let admin: string;
let staff: string;
let staffId: string;

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

const assign = (deviceId: string, userId: string, extra = {}) => call(app, 'POST', '/api/assignments', admin, { deviceId, userId, ...extra });
const tickets = async (qs = '') => (await call(app, 'GET', `/api/faults${qs}`, admin)).json().data as any[];

describe('Arıza kayıtları', () => {
  it('personel arıza bildirince: zimmet düşer VE açık kayıt otomatik oluşur, yöneticiye bildirim gider', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    const res = await call(app, 'POST', `/api/devices/${d.id}/report-fault`, staff, { note: 'Ekran titriyor' });
    expect(res.json().autoReturned).toBe(true);
    const t = await tickets();
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ status: 'OPEN', description: 'Ekran titriyor', reportedBy: { id: staffId } });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    const notes = await prisma.notification.findMany({ where: { userId: adminUser.id, type: 'FAULT_REPORTED' } });
    expect(notes).toHaveLength(1);
  });

  it('yönetici durumu Arızalı yapınca da kayıt açılır; aynı cihaza ikinci açık kayıt açılmaz', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY', note: 'Disk' });
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' }); // zaten arızalı
    expect(await tickets()).toHaveLength(1);
  });

  it('arızalı iade (condition=FAULTY) de kayıt açar', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    await call(app, 'POST', `/api/devices/${d.id}/return`, admin, { condition: 'FAULTY', note: 'Kırık' });
    const t = await tickets();
    expect(t[0].description).toBe('Kırık');
  });

  it('kayıt Çözüldü olunca cihaz OTOMATİK Depoya döner ve bildiren kişiye bildirim gider', async () => {
    const d = await createDevice(app, admin);
    await assign(d.id, staffId);
    await call(app, 'POST', `/api/devices/${d.id}/report-fault`, staff, { note: 'Açılmıyor' });
    const [t] = await tickets();
    const p = await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'IN_PROGRESS' });
    expect(p.json().ticket).toMatchObject({ status: 'IN_PROGRESS', handledBy: { name: 'Test Admin' } });
    const r = await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'RESOLVED', resolution: 'Anakart değişti' });
    expect(r.json().ticket).toMatchObject({ status: 'RESOLVED', resolution: 'Anakart değişti' });
    expect(r.json().ticket.resolvedAt).toBeTruthy();
    expect((await call(app, 'GET', `/api/devices/${d.id}`, admin)).json().device.status).toBe('IN_STOCK');
    const n = await prisma.notification.findMany({ where: { userId: staffId, type: 'FAULT_UPDATED' } });
    expect(n.map((x) => x.title)).toContain('Arıza giderildi');
  });

  it('cihaz elle arızalıdan çıkarılırsa açık kayıt otomatik çözülür', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'IN_STOCK' });
    const [t] = await tickets();
    expect(t.status).toBe('RESOLVED');
  });

  it('çözülen kayıt yeniden açılınca cihaz tekrar Arızalı olur; zimmetliyse 409', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    const [t] = await tickets();
    await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'RESOLVED' });
    const reopen = await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'OPEN' });
    expect(reopen.statusCode).toBe(200);
    expect((await call(app, 'GET', `/api/devices/${d.id}`, admin)).json().device.status).toBe('FAULTY');
    // Çöz → cihazı zimmetle → yeniden açmayı dene
    await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'RESOLVED' });
    await assign(d.id, staffId);
    expect((await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'OPEN' })).statusCode).toBe(409);
  });

  it('VERİTABANI GÜVENCESİ: aynı cihaza ikinci çözülmemiş kayıt doğrudan eklenemez', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    await expect(prisma.faultTicket.create({ data: { deviceId: d.id, description: 'çift' } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('yalnızca yönetici kaydı günceller; personel yalnızca kendi bildirdiğini görür', async () => {
    const d = await createDevice(app, admin);
    const other = await createDevice(app, admin);
    await assign(d.id, staffId);
    await call(app, 'POST', `/api/devices/${d.id}/report-fault`, staff, { note: 'Benimki' });
    await call(app, 'PATCH', `/api/devices/${other.id}/status`, admin, { status: 'FAULTY', note: 'Başkası' });
    const [mine] = (await call(app, 'GET', '/api/faults', staff)).json().data;
    expect((await call(app, 'GET', '/api/faults', staff)).json().data).toHaveLength(1);
    expect(mine.description).toBe('Benimki');
    expect((await call(app, 'PATCH', `/api/faults/${mine.id}`, staff, { status: 'RESOLVED' })).statusCode).toBe(403);
    expect((await call(app, 'GET', '/api/faults/board', staff)).statusCode).toBe(403);
  });

  it('pano (kanban) üç sütunu döndürür; geçersiz geçiş reddedilir', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY' });
    const board = (await call(app, 'GET', '/api/faults/board', admin)).json();
    expect(board.OPEN).toHaveLength(1);
    expect(board.IN_PROGRESS).toHaveLength(0);
    const [t] = board.OPEN;
    await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'RESOLVED' });
    const same = await call(app, 'PATCH', `/api/faults/${t.id}`, admin, { status: 'RESOLVED' });
    expect(same.statusCode).toBe(200); // aynı duruma geçiş: değişiklik yok
    expect((await call(app, 'GET', '/api/faults/board', admin)).json().RESOLVED).toHaveLength(1);
  });

  it('CSV dışa aktarma: BOM, noktalı virgül ve formül enjeksiyonuna karşı koruma', async () => {
    const d = await createDevice(app, admin);
    await call(app, 'PATCH', `/api/devices/${d.id}/status`, admin, { status: 'FAULTY', note: '=HYPERLINK("x")' });
    const res = await call(app, 'GET', '/api/exports/faults', admin);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('ariza-kayitlari');
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body.split('\r\n')[0]).toBe('﻿Kayıt no;Demirbaş no;Cihaz;Durum;Açıklama;Bildiren;Birim;İlgilenen;Açılış;Çözüm;Çözüm notu');
    expect(res.body).toContain("'=HYPERLINK");
    expect((await call(app, 'GET', '/api/exports/faults', staff)).statusCode).toBe(403);
  });
});
