import type { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { logEvent } from './eventLog.js';
import type { AuthUser } from '../plugins/auth.js';

export const qrPayload = (token: string) => `${config.APP_URL.replace(/\/$/, '')}/scan/${token}`;

export async function createDevice(data: Omit<Prisma.DeviceUncheckedCreateInput, 'assetTag' | 'qrToken'>, actor: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { key: 'device' },
      update: { value: { increment: 1 } },
      create: { key: 'device', value: 1 },
    });
    const assetTag = `TOGU-${String(counter.value).padStart(6, '0')}`;
    const device = await tx.device.create({ data: { ...data, status: 'IN_STOCK', assetTag } });
    await logEvent(tx, device.id, 'CREATED', `Cihaz envantere eklendi (${assetTag})`, actor.id);
    return device;
  });
}

export async function qrFor(token: string) {
  const payload = qrPayload(token);
  const [dataUrl, svg] = await Promise.all([
    QRCode.toDataURL(payload, { margin: 1, width: 512, errorCorrectionLevel: 'M' }),
    QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
  ]);
  return { payload, dataUrl, svg };
}
