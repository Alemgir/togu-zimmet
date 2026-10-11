import type { Assignment, Device, DeviceStatus, ReturnReason } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { lockDevice } from '../lib/locks.js';
import type { AuthUser } from '../plugins/auth.js';
import { logEvent } from './eventLog.js';
import { openFault, resolveOpenFaults } from './faultService.js';
import { notifyUsers } from './notificationService.js';

export { logEvent };

const WHY: Record<ReturnReason, string> = {
  MANUAL: 'zimmetten düşüldü',
  FAULT_REPORTED: 'arıza nedeniyle otomatik zimmetten düşüldü',
  USER_DEACTIVATED: 'kullanıcı pasife alındığı için otomatik zimmetten düşüldü',
  RETIRED: 'hizmet dışı bırakıldığı için otomatik zimmetten düşüldü',
  REASSIGNED: 'başka personele devredildi',
};

const label = (d: { brand: string; model: string; assetTag: string }) => `${d.brand} ${d.model} (${d.assetTag})`;

/** Cihazın aktif zimmetini kapatır (varsa). Cihaz durumunu çağıran taraf belirler. */
async function closeActive(tx: Tx, deviceId: string, opts: { reason: ReturnReason; actorId: string | null; note?: string | null }) {
  const active = await tx.assignment.findFirst({
    where: { deviceId, returnedAt: null },
    include: { user: { select: { id: true, name: true, department: true } }, device: { select: { brand: true, model: true, assetTag: true } } },
  });
  if (!active) return null;
  await tx.assignment.update({
    where: { id: active.id },
    data: { returnedAt: new Date(), returnedById: opts.actorId, returnReason: opts.reason, returnNote: opts.note ?? null },
  });
  await logEvent(tx, deviceId, 'RETURNED', `${active.user.name} üzerinden ${WHY[opts.reason]}`, opts.actorId, {
    assignmentId: active.id,
    userId: active.user.id,
    reason: opts.reason,
  });
  if (opts.reason !== 'USER_DEACTIVATED' && active.user.id !== opts.actorId) {
    await notifyUsers(tx, [active.user.id], {
      type: 'RETURNED',
      title: 'Zimmet düşüldü',
      body: `${label(active.device)} ${WHY[opts.reason]}`,
      link: `/devices/${deviceId}`,
    });
  }
  return active;
}

export async function assignDevice(input: {
  deviceId: string;
  userId: string;
  actor: AuthUser;
  note?: string | null;
  transfer?: boolean;
  dueAt?: Date | null;
}): Promise<Assignment> {
  const { deviceId, userId, actor, note, transfer, dueAt } = input;
  if (dueAt && dueAt.getTime() < Date.now() - 864e5) throw badRequest('Planlı iade tarihi geçmişte olamaz');
  try {
    return await prisma.$transaction(async (tx) => {
      const device = await lockDevice(tx, deviceId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw notFound('Personel bulunamadı');
      if (!user.isActive) throw conflict('Pasif bir kullanıcıya zimmet verilemez');
      if (device.status === 'FAULTY') throw conflict('Arızalı cihaz zimmetlenemez. Önce durumunu güncelleyin');
      if (device.status === 'RETIRED') throw conflict('Hizmet dışı cihaz zimmetlenemez');

      const active = await tx.assignment.findFirst({
        where: { deviceId, returnedAt: null },
        include: { user: { select: { id: true, name: true } } },
      });
      if (active) {
        if (active.userId === userId) throw conflict(`Cihaz zaten ${user.name} üzerinde zimmetli`);
        if (!transfer) {
          throw conflict(`Cihaz şu an ${active.user.name} üzerinde zimmetli`, { code: 'ALREADY_ASSIGNED', currentHolder: active.user });
        }
        await closeActive(tx, deviceId, { reason: 'REASSIGNED', actorId: actor.id, note: `${user.name} kişisine devredildi` });
      }

      const created = await tx.assignment.create({ data: { deviceId, userId, assignedById: actor.id, note: note ?? null, dueAt: dueAt ?? null } });
      await tx.device.update({ where: { id: deviceId }, data: { status: 'ASSIGNED' } });
      await logEvent(tx, deviceId, 'ASSIGNED', `${user.name} kişisine zimmetlendi`, actor.id, { assignmentId: created.id, userId });
      if (userId !== actor.id) {
        await notifyUsers(tx, [userId], {
          type: 'ASSIGNED',
          title: 'Size zimmet verildi',
          body: `${label(device)} üzerinize zimmetlendi${dueAt ? ` (planlı iade: ${dueAt.toLocaleDateString('tr-TR')})` : ''}`,
          link: `/devices/${deviceId}`,
        });
      }
      return created;
    });
  } catch (e: any) {
    // Kısmi unique index: eşzamanlı iki zimmet isteğinden biri burada düşer
    if (e?.code === 'P2002') throw conflict('Cihaz başka bir işlemle eşzamanlı olarak zimmetlendi, tekrar deneyin');
    throw e;
  }
}

export async function returnDevice(input: { deviceId: string; actor: AuthUser; note?: string | null; condition?: 'OK' | 'FAULTY' }) {
  const { deviceId, actor, note, condition = 'OK' } = input;
  return prisma.$transaction(async (tx) => {
    await lockDevice(tx, deviceId);
    const faulty = condition === 'FAULTY';
    const closed = await closeActive(tx, deviceId, { reason: faulty ? 'FAULT_REPORTED' : 'MANUAL', actorId: actor.id, note });
    if (!closed) throw conflict('Cihaz şu an kimseye zimmetli değil');
    const status: DeviceStatus = faulty ? 'FAULTY' : 'IN_STOCK';
    const device = await tx.device.update({ where: { id: deviceId }, data: { status } });
    if (faulty) {
      await logEvent(tx, deviceId, 'FAULT_REPORTED', `Arızalı olarak iade alındı${note ? `: ${note}` : ''}`, actor.id);
      await openFault(tx, { deviceId, actorId: actor.id, description: note ?? 'Arızalı olarak iade alındı', department: closed.user.department });
    }
    return { device, assignmentId: closed.id };
  });
}

const STATUS_LABEL: Record<DeviceStatus, string> = { IN_STOCK: 'Depoda', ASSIGNED: 'Zimmetli', FAULTY: 'Arızalı', RETIRED: 'Hizmet dışı' };

/**
 * Durum değişikliği. Zimmetli cihaz Arızalı / Hizmet dışı / Depoda durumuna
 * alındığında zimmet OTOMATİK olarak düşülür; arıza kaydı da otomatik açılır/kapanır.
 */
export async function changeStatus(input: { deviceId: string; status: DeviceStatus; actor: AuthUser; note?: string | null }) {
  const { deviceId, status, actor, note } = input;
  if (status === 'ASSIGNED') throw badRequest('Cihazı zimmetli yapmak için zimmet işlemi kullanın');
  return prisma.$transaction(async (tx) => {
    const device = await lockDevice(tx, deviceId);
    if (device.status === status) return { device, autoReturned: false };

    let autoReturned = false;
    let department: string | null = null;
    if (device.status === 'ASSIGNED') {
      const reason: ReturnReason = status === 'FAULTY' ? 'FAULT_REPORTED' : status === 'RETIRED' ? 'RETIRED' : 'MANUAL';
      const closed = await closeActive(tx, deviceId, { reason, actorId: actor.id, note });
      autoReturned = !!closed;
      department = closed?.user.department ?? null;
    }
    const updated = await tx.device.update({ where: { id: deviceId }, data: { status } });
    await logEvent(
      tx,
      deviceId,
      status === 'FAULTY' ? 'FAULT_REPORTED' : 'STATUS_CHANGED',
      `Durum ${STATUS_LABEL[device.status]} → ${STATUS_LABEL[status]}${note ? ` (${note})` : ''}`,
      actor.id,
      { from: device.status, to: status },
    );
    if (status === 'FAULTY') {
      await openFault(tx, { deviceId, actorId: actor.id, description: note ?? 'Arıza bildirildi', department });
    } else if (device.status === 'FAULTY') {
      await resolveOpenFaults(tx, deviceId, { actorId: actor.id, resolution: `Durum ${STATUS_LABEL[status]} olarak güncellendi` });
    }
    return { device: updated, autoReturned };
  });
}

/** Zimmetli cihazı kullanan personel (veya biriminin sorumlusu / yönetici) arıza bildirir; zimmet otomatik düşer. */
export async function reportFault(input: { deviceId: string; actor: AuthUser; note?: string | null }) {
  const { deviceId, actor, note } = input;
  if (actor.role !== 'ADMIN') {
    const active = await prisma.assignment.findFirst({ where: { deviceId, returnedAt: null }, include: { user: { select: { id: true, department: true } } } });
    const own = active?.userId === actor.id;
    const managed = actor.role === 'UNIT_MANAGER' && !!actor.department && active?.user.department === actor.department;
    if (!own && !managed) throw forbidden('Yalnızca üzerinizde (veya biriminizde) zimmetli olan cihaz için arıza bildirebilirsiniz');
  }
  return changeStatus({ deviceId, status: 'FAULTY', actor, note: note ?? 'Arıza bildirildi' });
}

/** Kullanıcı pasife alınırken/silinirken tüm aktif zimmetleri otomatik düşer. */
export async function releaseAllForUser(tx: Tx, userId: string, actorId: string) {
  const active = await tx.assignment.findMany({ where: { userId, returnedAt: null }, select: { deviceId: true } });
  for (const { deviceId } of active) {
    await lockDevice(tx, deviceId);
    await closeActive(tx, deviceId, { reason: 'USER_DEACTIVATED', actorId });
    await tx.device.update({ where: { id: deviceId }, data: { status: 'IN_STOCK' } });
  }
  return active.length;
}

export interface BulkResult {
  deviceId: string;
  ok: boolean;
  error?: string;
}

export async function bulkAssign(input: { deviceIds: string[]; userId: string; actor: AuthUser; note?: string | null; dueAt?: Date | null; transfer?: boolean }) {
  const results: BulkResult[] = [];
  for (const deviceId of [...new Set(input.deviceIds)]) {
    try {
      await assignDevice({ deviceId, userId: input.userId, actor: input.actor, note: input.note, dueAt: input.dueAt, transfer: input.transfer });
      results.push({ deviceId, ok: true });
    } catch (e: any) {
      results.push({ deviceId, ok: false, error: e?.message ?? 'Hata' });
    }
  }
  return results;
}

export async function bulkStatus(input: { deviceIds: string[]; status: DeviceStatus; actor: AuthUser; note?: string | null }) {
  const results: BulkResult[] = [];
  for (const deviceId of [...new Set(input.deviceIds)]) {
    try {
      await changeStatus({ deviceId, status: input.status, actor: input.actor, note: input.note });
      results.push({ deviceId, ok: true });
    } catch (e: any) {
      results.push({ deviceId, ok: false, error: e?.message ?? 'Hata' });
    }
  }
  return results;
}

export type { Device };
