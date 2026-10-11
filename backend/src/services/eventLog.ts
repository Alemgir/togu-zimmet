import type { EventType, Prisma } from '@prisma/client';
import type { Tx } from '../db.js';

export async function logEvent(tx: Tx, deviceId: string, type: EventType, message: string, actorId: string | null, meta?: Prisma.InputJsonValue) {
  await tx.deviceEvent.create({ data: { deviceId, type, message, actorId, meta } });
}
