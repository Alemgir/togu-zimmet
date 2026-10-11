import type { Device } from '@prisma/client';
import type { Tx } from '../db.js';
import { notFound } from './errors.js';

/** Cihaz satırını kilitler: aynı cihaz üzerinde eşzamanlı işlemler sıraya girer. */
export async function lockDevice(tx: Tx, deviceId: string): Promise<Device> {
  await tx.$queryRaw`SELECT id FROM "Device" WHERE id = ${deviceId} FOR UPDATE`;
  const device = await tx.device.findUnique({ where: { id: deviceId } });
  if (!device) throw notFound('Cihaz bulunamadı');
  return device;
}
