import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { toCsv } from '../lib/csv.js';
import { assignmentScope, faultScope } from '../lib/scope.js';
import { deviceFilters, deviceWhere } from '../services/deviceQuery.js';
import { holderInclude } from './devices.js';

const STATUS_TR = { IN_STOCK: 'Depoda', ASSIGNED: 'Zimmetli', FAULTY: 'Arızalı', RETIRED: 'Hizmet dışı' } as const;
const TYPE_TR: Record<string, string> = { LAPTOP: 'Dizüstü', DESKTOP: 'Masaüstü', SERVER: 'Sunucu', MONITOR: 'Monitör', PRINTER: 'Yazıcı', PHONE: 'Telefon', TABLET: 'Tablet', NETWORK: 'Ağ cihazı', OTHER: 'Diğer' };
const REASON_TR = { MANUAL: 'İade alındı', FAULT_REPORTED: 'Arıza nedeniyle düşüldü', USER_DEACTIVATED: 'Personel pasife alındı', RETIRED: 'Hizmet dışı', REASSIGNED: 'Devredildi' } as const;
const FAULT_TR = { OPEN: 'Açık', IN_PROGRESS: 'İnceleniyor', RESOLVED: 'Çözüldü' } as const;
const dt = (d?: Date | null) => (d ? d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '');

const exportsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const manager = { onRequest: app.requireManager };
  const send = (reply: any, name: string, body: string) =>
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`).send(body);

  r.get('/exports/devices', { ...manager, schema: { tags: ['Raporlar'], querystring: z.object(deviceFilters) } }, async (req, reply) => {
    const rows = await prisma.device.findMany({ where: deviceWhere(req.authUser, req.query), include: holderInclude, orderBy: { assetTag: 'asc' }, take: 20000 });
    const now = Date.now();
    return send(
      reply,
      'envanter',
      toCsv(rows, [
        { header: 'Demirbaş no', value: (d) => d.assetTag },
        { header: 'Tür', value: (d) => TYPE_TR[d.type] ?? d.type },
        { header: 'Marka', value: (d) => d.brand },
        { header: 'Model', value: (d) => d.model },
        { header: 'Seri no', value: (d) => d.serialNumber },
        { header: 'Durum', value: (d) => STATUS_TR[d.status] },
        { header: 'Zimmetli kişi', value: (d) => d.assignments[0]?.user.name },
        { header: 'Birim', value: (d) => d.assignments[0]?.user.department },
        { header: 'Zimmet tarihi', value: (d) => d.assignments[0]?.assignedAt },
        { header: 'Planlı iade', value: (d) => d.assignments[0]?.dueAt },
        { header: 'Alım tarihi', value: (d) => d.purchaseDate },
        { header: 'Garanti bitişi', value: (d) => d.warrantyEnd },
        { header: 'Garanti', value: (d) => (d.warrantyEnd ? (d.warrantyEnd.getTime() < now ? 'Bitti' : 'Devam ediyor') : '') },
        { header: 'Konum', value: (d) => d.location },
      ]),
    );
  });

  r.get('/exports/assignments', { ...manager, schema: { tags: ['Raporlar'], querystring: z.object({ state: z.enum(['active', 'returned', 'all']).default('all') }) } }, async (req, reply) => {
    const where: Prisma.AssignmentWhereInput = { AND: [assignmentScope(req.authUser)], ...(req.query.state === 'active' && { returnedAt: null }), ...(req.query.state === 'returned' && { returnedAt: { not: null } }) };
    const rows = await prisma.assignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      take: 50000,
      include: { device: true, user: true, assignedBy: { select: { name: true } }, returnedBy: { select: { name: true } } },
    });
    return send(
      reply,
      'zimmetler',
      toCsv(rows, [
        { header: 'Tutanak no', value: (a) => `ZT-${a.assignedAt.getFullYear()}-${String(a.receiptNo).padStart(6, '0')}` },
        { header: 'Demirbaş no', value: (a) => a.device.assetTag },
        { header: 'Cihaz', value: (a) => `${a.device.brand} ${a.device.model}` },
        { header: 'Personel', value: (a) => a.user.name },
        { header: 'Birim', value: (a) => a.user.department },
        { header: 'Zimmet tarihi', value: (a) => dt(a.assignedAt) },
        { header: 'Planlı iade', value: (a) => a.dueAt },
        { header: 'İade tarihi', value: (a) => dt(a.returnedAt) },
        { header: 'İade nedeni', value: (a) => (a.returnReason ? REASON_TR[a.returnReason] : '') },
        { header: 'Zimmetleyen', value: (a) => a.assignedBy.name },
        { header: 'İade alan', value: (a) => a.returnedBy?.name },
        { header: 'Not', value: (a) => a.note },
      ]),
    );
  });

  r.get('/exports/faults', { ...manager, schema: { tags: ['Raporlar'] } }, async (req, reply) => {
    const rows = await prisma.faultTicket.findMany({
      where: faultScope(req.authUser),
      orderBy: { createdAt: 'desc' },
      take: 50000,
      include: { device: true, reportedBy: { select: { name: true, department: true } }, handledBy: { select: { name: true } } },
    });
    return send(
      reply,
      'ariza-kayitlari',
      toCsv(rows, [
        { header: 'Kayıt no', value: (f) => `AR-${String(f.ticketNo).padStart(5, '0')}` },
        { header: 'Demirbaş no', value: (f) => f.device.assetTag },
        { header: 'Cihaz', value: (f) => `${f.device.brand} ${f.device.model}` },
        { header: 'Durum', value: (f) => FAULT_TR[f.status] },
        { header: 'Açıklama', value: (f) => f.description },
        { header: 'Bildiren', value: (f) => f.reportedBy?.name },
        { header: 'Birim', value: (f) => f.reportedBy?.department },
        { header: 'İlgilenen', value: (f) => f.handledBy?.name },
        { header: 'Açılış', value: (f) => dt(f.createdAt) },
        { header: 'Çözüm', value: (f) => dt(f.resolvedAt) },
        { header: 'Çözüm notu', value: (f) => f.resolution },
      ]),
    );
  });
};

export default exportsRoutes;
