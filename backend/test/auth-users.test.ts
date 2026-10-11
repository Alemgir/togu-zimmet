import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db.js';
import { ADMIN, STAFF, bearer, login, makeApp, resetDb } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(resetDb);

describe('Auth', () => {
  it('doğru bilgilerle giriş yapar ve şifre hash’ini sızdırmaz', async () => {
    const { res, token } = await login(app, ADMIN);
    expect(res.statusCode).toBe(200);
    expect(token).toBeTruthy();
    expect(res.json().user.passwordHash).toBeUndefined();
    expect(res.json().user.role).toBe('ADMIN');
  });

  it('yanlış şifre ve bilinmeyen e-posta aynı hatayı verir', async () => {
    const a = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ADMIN.email, password: 'yanlis' } });
    const b = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'yok@x.com', password: 'yanlis' } });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json().error.message).toBe(b.json().error.message);
  });

  it('token olmadan veya bozuk token ile 401 döner', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer('bozuk') })).statusCode).toBe(401);
  });

  it('/me ve logout çalışır', async () => {
    const { token } = await login(app, STAFF);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
    expect(me.json().user.email).toBe(STAFF.email);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(token) })).statusCode).toBe(200);
  });

  it('şifre değişince eski token geçersiz, yeni token geçerli olur', async () => {
    const { token } = await login(app, STAFF);
    const ch = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me/password',
      headers: bearer(token),
      payload: { currentPassword: STAFF.password, newPassword: 'Yeni12345' },
    });
    expect(ch.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(ch.json().token) })).statusCode).toBe(200);
    expect((await login(app, { email: STAFF.email, password: 'Yeni12345' })).res.statusCode).toBe(200);
  });

  it('mevcut şifre yanlışsa değiştirmez', async () => {
    const { token } = await login(app, STAFF);
    const ch = await app.inject({
      method: 'PATCH', url: '/api/auth/me/password', headers: bearer(token),
      payload: { currentPassword: 'yanlis', newPassword: 'Yeni12345' },
    });
    expect(ch.statusCode).toBe(400);
  });

  it('pasif kullanıcı giriş yapamaz ve mevcut token’ı çalışmaz', async () => {
    const { token: adminT } = await login(app, ADMIN);
    const { token: staffT, user } = await login(app, STAFF);
    await app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers: bearer(adminT), payload: { isActive: false } });
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(staffT) })).statusCode).toBe(401);
    expect((await login(app, STAFF)).res.statusCode).toBe(401);
  });
});

describe('Kullanıcı yönetimi', () => {
  it('personel kullanıcı yönetimine erişemez (403)', async () => {
    const { token } = await login(app, STAFF);
    expect((await app.inject({ method: 'GET', url: '/api/users', headers: bearer(token) })).statusCode).toBe(403);
    expect(
      (await app.inject({ method: 'POST', url: '/api/users', headers: bearer(token), payload: {} })).statusCode,
    ).toBe(403);
  });

  it('kullanıcı oluşturur, e-postayı normalize eder, tekrarını reddeder', async () => {
    const { token } = await login(app, ADMIN);
    const body = { name: 'Ali Veli', email: ' ALI@Test.EDU.tr ', password: 'Sifre1234', role: 'STAFF', department: 'IT' };
    const ok = await app.inject({ method: 'POST', url: '/api/users', headers: bearer(token), payload: body });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().user.email).toBe('ali@test.edu.tr');
    expect(ok.json().user.passwordHash).toBeUndefined();
    const dup = await app.inject({ method: 'POST', url: '/api/users', headers: bearer(token), payload: body });
    expect(dup.statusCode).toBe(409);
  });

  it('zayıf şifre ve geçersiz e-postayı doğrular (400)', async () => {
    const { token } = await login(app, ADMIN);
    const weak = await app.inject({
      method: 'POST', url: '/api/users', headers: bearer(token),
      payload: { name: 'Ali', email: 'a@b.com', password: 'abc', role: 'STAFF' },
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error.code).toBe('VALIDATION_ERROR');
    const bad = await app.inject({
      method: 'POST', url: '/api/users', headers: bearer(token),
      payload: { name: 'Ali', email: 'bozuk', password: 'Sifre1234', role: 'STAFF' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('sayfalama, arama ve filtreleme çalışır', async () => {
    const { token } = await login(app, ADMIN);
    for (let i = 0; i < 12; i++)
      await app.inject({
        method: 'POST', url: '/api/users', headers: bearer(token),
        payload: { name: `Kullanıcı ${i}`, email: `k${i}@t.com`, password: 'Sifre1234', role: 'STAFF', department: i % 2 ? 'Birim A' : 'Birim B' },
      });
    const p1 = (await app.inject({ method: 'GET', url: '/api/users?pageSize=5&page=1', headers: bearer(token) })).json();
    expect(p1.data).toHaveLength(5);
    expect(p1.meta).toMatchObject({ total: 15, totalPages: 3, page: 1 });
    const p3 = (await app.inject({ method: 'GET', url: '/api/users?pageSize=5&page=3', headers: bearer(token) })).json();
    expect(p3.data).toHaveLength(5);
    const s = (await app.inject({ method: 'GET', url: '/api/users?search=kullanıcı 7', headers: bearer(token) })).json();
    expect(s.data.map((u: any) => u.email)).toEqual(['k7@t.com']);
    const d = (await app.inject({ method: 'GET', url: '/api/users?department=Birim A', headers: bearer(token) })).json();
    expect(d.meta.total).toBe(6);
  });

  it('günceller ve admin şifre sıfırlayınca kullanıcının eski oturumu kapanır', async () => {
    const { token } = await login(app, ADMIN);
    const { token: st, user } = await login(app, STAFF);
    const up = await app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers: bearer(token), payload: { department: 'Yeni Birim', title: '' } });
    expect(up.json().user.department).toBe('Yeni Birim');
    expect(up.json().user.title).toBeNull();
    await app.inject({ method: 'PATCH', url: `/api/users/${user.id}/password`, headers: bearer(token), payload: { newPassword: 'Reset12345' } });
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(st) })).statusCode).toBe(401);
    expect((await login(app, { email: STAFF.email, password: 'Reset12345' })).res.statusCode).toBe(200);
  });

  it('kendini silemez / son yöneticiyi koruyamaz', async () => {
    const { token, user } = await login(app, ADMIN);
    expect((await app.inject({ method: 'DELETE', url: `/api/users/${user.id}`, headers: bearer(token) })).statusCode).toBe(409);
    expect(
      (await app.inject({ method: 'PATCH', url: `/api/users/${user.id}`, headers: bearer(token), payload: { role: 'STAFF' } })).statusCode,
    ).toBe(409);
  });

  it('geçmişi olmayan kullanıcı tamamen silinir', async () => {
    const { token } = await login(app, ADMIN);
    const { user } = await login(app, STAFF);
    const del = await app.inject({ method: 'DELETE', url: `/api/users/${user.id}`, headers: bearer(token) });
    expect(del.json()).toMatchObject({ mode: 'deleted', releasedDevices: 0 });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});
