import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import type { AuthUser } from '../plugins/auth.js';

/** QR bağlantısı, QR token'ı, demirbaş no veya seri no → cihaz */
export async function resolveDevice(codeRaw: string) {
  const code = codeRaw.trim();
  if (!code) return null;
  const m = code.match(/\/scan\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  const token = m ? m[1]! : code;
  return prisma.device.findFirst({
    where: { OR: [{ qrToken: token }, { assetTag: { equals: code, mode: 'insensitive' } }, { serialNumber: { equals: code, mode: 'insensitive' } }] },
  });
}

export async function createSession(actor: AuthUser, input: { name: string; location?: string | null }) {
  return prisma.$transaction(async (tx) => {
    const devices = await tx.device.findMany({
      where: { status: { not: 'RETIRED' }, ...(input.location ? { location: { equals: input.location, mode: 'insensitive' } } : {}) },
      select: { id: true },
    });
    if (!devices.length) throw badRequest('Bu kapsamda sayılacak cihaz bulunamadı');
    const session = await tx.countSession.create({ data: { name: input.name, location: input.location ?? null, createdById: actor.id } });
    await tx.countItem.createMany({ data: devices.map((d) => ({ sessionId: session.id, deviceId: d.id })) });
    return session;
  });
}

export async function progress(sessionId: string) {
  const [expected, scanned, unexpected] = await Promise.all([
    prisma.countItem.count({ where: { sessionId, expected: true } }),
    prisma.countItem.count({ where: { sessionId, expected: true, scannedAt: { not: null } } }),
    prisma.countItem.count({ where: { sessionId, expected: false } }),
  ]);
  return { expected, scanned, missing: expected - scanned, unexpected };
}

export async function scan(sessionId: string, code: string, actor: AuthUser) {
  const session = await prisma.countSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Sayım bulunamadı');
  if (session.status === 'CLOSED') throw conflict('Bu sayım kapatılmış');
  const device = await resolveDevice(code);
  if (!device) throw notFound('Bu koda ait cihaz bulunamadı');

  const item = await prisma.countItem.findUnique({ where: { sessionId_deviceId: { sessionId, deviceId: device.id } } });
  let result: 'ok' | 'duplicate' | 'unexpected';
  if (!item) {
    await prisma.countItem.create({ data: { sessionId, deviceId: device.id, expected: false, scannedAt: new Date(), scannedById: actor.id } });
    result = 'unexpected';
  } else if (item.scannedAt) {
    result = 'duplicate';
  } else {
    await prisma.countItem.update({ where: { id: item.id }, data: { scannedAt: new Date(), scannedById: actor.id } });
    result = 'ok';
  }
  return { result, device: { id: device.id, assetTag: device.assetTag, brand: device.brand, model: device.model, location: device.location }, progress: await progress(sessionId) };
}
