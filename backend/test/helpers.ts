import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';

export const ADMIN = { email: 'admin@test.edu.tr', password: 'Admin123!' };
export const STAFF = { email: 'staff@test.edu.tr', password: 'Staff1234' };
export const MANAGER = { email: 'manager@test.edu.tr', password: 'Manager123' };

/**
 * GÜVENLİK KİLİDİ: testler tabloları boşaltır. Yalnızca adı _test veya _e2e ile biten veritabanında çalışır.
 * (Yapılandırma olmadan çalıştırılırsa Prisma geliştirme veritabanına bağlanabilir; bu kilit onu engeller.)
 */
export function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  const db = (url.split('?')[0] ?? '').split('/').pop() ?? '';
  if (!/_(test|e2e)$/.test(db)) {
    throw new Error(`GÜVENLİK: testler yalnızca *_test / *_e2e veritabanında çalışır (şu an: "${db || 'tanımsız'}"). Testleri backend/ klasöründen "npm test" ile çalıştırın.`);
  }
}

export async function resetDb() {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Notification","CountItem","CountSession","FaultTicket","DeviceEvent","Assignment","Device","User","Counter" RESTART IDENTITY CASCADE',
  );
  await prisma.user.create({
    data: { name: 'Test Admin', email: ADMIN.email, passwordHash: await bcrypt.hash(ADMIN.password, 4), role: 'ADMIN', department: 'BİDB' },
  });
  await prisma.user.create({
    data: { name: 'Test Personel', email: STAFF.email, passwordHash: await bcrypt.hash(STAFF.password, 4), role: 'STAFF', department: 'Muhasebe' },
  });
  await prisma.user.create({
    data: { name: 'Test Birim Sorumlusu', email: MANAGER.email, passwordHash: await bcrypt.hash(MANAGER.password, 4), role: 'UNIT_MANAGER', department: 'Muhasebe' },
  });
}

export async function makeApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function login(app: FastifyInstance, creds: { email: string; password: string }) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: creds });
  return { token: res.json().token as string, user: res.json().user, res };
}

export const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

let serial = 0;
export const deviceBody = (over: Record<string, unknown> = {}) => ({
  type: 'LAPTOP',
  brand: 'Lenovo',
  model: 'ThinkPad T14',
  serialNumber: `SN-${Date.now()}-${++serial}`,
  purchaseDate: '2024-03-15',
  warrantyEnd: '2027-03-15',
  ...over,
});

export async function createDevice(app: FastifyInstance, token: string, over: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/api/devices', headers: bearer(token), payload: deviceBody(over) });
  return res.json().device as { id: string; assetTag: string; status: string; qrToken: string };
}

export const call = (app: FastifyInstance, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token: string, payload?: unknown) =>
  app.inject({ method, url, headers: bearer(token), payload: payload as any });

export async function makeUser(app: FastifyInstance, adminToken: string, email: string, extra: Record<string, unknown> = {}) {
  const res = await call(app, 'POST', '/api/users', adminToken, { name: `Kullanıcı ${email.split('@')[0]}`, email, password: 'Sifre1234', role: 'STAFF', ...extra });
  return res.json().user as { id: string; name: string; department: string | null };
}
