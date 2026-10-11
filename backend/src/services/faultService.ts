import type { FaultStatus } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { lockDevice } from '../lib/locks.js';
import type { AuthUser } from '../plugins/auth.js';
import { notifyOversight, notifyUsers } from './notificationService.js';
import { logEvent } from './eventLog.js';

export const FAULT_LABEL: Record<FaultStatus, string> = { OPEN: 'Açık', IN_PROGRESS: 'İnceleniyor', RESOLVED: 'Çözüldü' };

/** Cihaz arızalandığında açık kayıt oluşturur (varsa mevcut açık kaydı döndürür). */
export async function openFault(
  tx: Tx,
  input: { deviceId: string; actorId: string | null; description: string; department?: string | null },
) {
  const existing = await tx.faultTicket.findFirst({ where: { deviceId: input.deviceId, status: { not: 'RESOLVED' } } });
  if (existing) return existing;
  const device = await tx.device.findUniqueOrThrow({ where: { id: input.deviceId } });
  const ticket = await tx.faultTicket.create({
    data: { deviceId: input.deviceId, reportedById: input.actorId, description: input.description.slice(0, 1000) },
  });
  await notifyOversight(
    tx,
    input.department,
    {
      type: 'FAULT_REPORTED',
      title: 'Yeni arıza kaydı',
      body: `${device.brand} ${device.model} (${device.assetTag}): ${input.description.slice(0, 120)}`,
      link: `/faults?ticket=${ticket.id}`,
      dedupeKey: `fault:${ticket.id}`,
    },
    input.actorId ? [input.actorId] : [],
  );
  return ticket;
}

/** Cihaz arızalı durumdan elle çıkarıldığında açık kayıtlar da otomatik kapanır. */
export async function resolveOpenFaults(tx: Tx, deviceId: string, opts: { actorId: string | null; resolution: string }) {
  const open = await tx.faultTicket.findMany({ where: { deviceId, status: { not: 'RESOLVED' } } });
  for (const t of open) {
    await tx.faultTicket.update({
      where: { id: t.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolution: t.resolution ?? opts.resolution, handledById: t.handledById ?? opts.actorId },
    });
  }
  return open.length;
}

const ALLOWED: Record<FaultStatus, FaultStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS'],
};

export async function updateFault(
  id: string,
  input: { status?: FaultStatus; resolution?: string | null; handledById?: string | null },
  actor: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.faultTicket.findUnique({ where: { id } });
    if (!found) throw notFound('Arıza kaydı bulunamadı');
    const device = await lockDevice(tx, found.deviceId);
    const ticket = await tx.faultTicket.findUniqueOrThrow({ where: { id } });
    const data: Record<string, unknown> = {};

    if (input.handledById !== undefined) {
      if (input.handledById) {
        const h = await tx.user.findUnique({ where: { id: input.handledById } });
        if (!h || h.role !== 'ADMIN') throw badRequest('İlgilenen kişi bir yönetici olmalı');
      }
      data.handledById = input.handledById;
    }
    if (input.resolution !== undefined) data.resolution = input.resolution?.trim() || null;

    if (input.status && input.status !== ticket.status) {
      if (!ALLOWED[ticket.status].includes(input.status)) throw conflict('Bu durum geçişi yapılamaz');
      const reopening = ticket.status === 'RESOLVED';
      if (reopening) {
        if (device.status === 'ASSIGNED') throw conflict('Cihaz şu an zimmetli; arıza kaydını yeniden açmadan önce iade alın');
        if (device.status === 'RETIRED') throw conflict('Hizmet dışı cihaz için arıza kaydı yeniden açılamaz');
        if (device.status === 'IN_STOCK') {
          await tx.device.update({ where: { id: device.id }, data: { status: 'FAULTY' } });
          await logEvent(tx, device.id, 'STATUS_CHANGED', 'Durum Depoda → Arızalı (arıza kaydı yeniden açıldı)', actor.id);
        }
        data.resolvedAt = null;
      }
      data.status = input.status;
      if (input.status === 'IN_PROGRESS' && !ticket.handledById && data.handledById === undefined) data.handledById = actor.id;
      if (input.status === 'RESOLVED') {
        data.resolvedAt = new Date();
        data.handledById = (data.handledById as string | null | undefined) ?? ticket.handledById ?? actor.id;
        if (device.status === 'FAULTY') {
          await tx.device.update({ where: { id: device.id }, data: { status: 'IN_STOCK' } });
          await logEvent(tx, device.id, 'STATUS_CHANGED', 'Arıza giderildi → cihaz Depoya döndü', actor.id, { ticket: ticket.ticketNo });
        }
      }
      await logEvent(
        tx,
        device.id,
        'STATUS_CHANGED',
        `Arıza kaydı #${ticket.ticketNo}: ${FAULT_LABEL[ticket.status]} → ${FAULT_LABEL[input.status]}`,
        actor.id,
        { ticket: ticket.ticketNo },
      );
      if (ticket.reportedById && ticket.reportedById !== actor.id) {
        await notifyUsers(tx, [ticket.reportedById], {
          type: 'FAULT_UPDATED',
          title: input.status === 'RESOLVED' ? 'Arıza giderildi' : 'Arıza kaydınız güncellendi',
          body: `${device.brand} ${device.model} (${device.assetTag}) arıza kaydı: ${FAULT_LABEL[input.status]}`,
          link: `/faults?ticket=${ticket.id}`,
        });
      }
    }
    return tx.faultTicket.update({ where: { id }, data });
  });
}
