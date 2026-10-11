import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { pageArgs, pageQuery, pageResult } from '../lib/pagination.js';
import { deviceViewScope } from '../lib/scope.js';
import { bulkStatus, changeStatus, logEvent, reportFault, returnDevice } from '../services/assignmentService.js';
import { createDevice, qrFor } from '../services/deviceService.js';
import { STATUSES, deviceFilters, deviceWhere } from '../services/deviceQuery.js';
import { canonicalOptional, canonicalValue, normalize, resolveDeviceType } from '../services/canonical.js';
import { badRequest } from '../lib/errors.js';

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const deviceFields = {
  type: z.string().trim().min(1, 'Cihaz türü zorunlu').max(60),
  brand: z.string().trim().min(1, 'Marka zorunlu').max(80),
  model: z.string().trim().min(1, 'Model zorunlu').max(120),
  serialNumber: z.string().trim().min(1, 'Seri no zorunlu').max(120),
  purchaseDate: z.coerce.date(),
  warrantyEnd: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  location: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
};

const DAY = 864e5;

/** Tarih tutarlılığı: alım tarihi gelecekte olamaz; garanti bitişi alım tarihinden önce olamaz. */
function checkDates(purchase?: Date | null, warranty?: Date | null) {
  if (purchase && purchase.getTime() > Date.now() + DAY) throw badRequest('Alım tarihi gelecekte olamaz');
  if (purchase && warranty && warranty.getTime() < purchase.getTime()) throw badRequest('Garanti bitiş tarihi alım tarihinden önce olamaz');
}

/** Seri numarası büyük/küçük harf farkı gözetmeksizin benzersiz olmalı ("abc" ile "ABC" aynı cihazdır). */
async function serialTaken(serial: string, exceptId?: string) {
  return !!(await prisma.device.findFirst({ where: { serialNumber: { equals: serial, mode: 'insensitive' }, ...(exceptId && { NOT: { id: exceptId } }) }, select: { id: true } }));
}

/** Seçenek alanlarını denetler ve mevcut yazımla birleştirir (tür çözümleme, marka, konum). */
async function prepare<T extends { type?: string; brand?: string; location?: string | null }>(body: T): Promise<T> {
  const out = { ...body } as T & { model?: string };
  if (out.model !== undefined) out.model = normalize(out.model);
  if (out.type !== undefined) out.type = await resolveDeviceType(out.type);
  if (out.brand !== undefined) out.brand = await canonicalValue('device.brand', out.brand, 'Marka', { min: 1, max: 80 });
  if (out.location !== undefined) out.location = (await canonicalOptional('device.location', out.location, 'Konum', { max: 120 })) as string | null;
  return out;
}

export const holderInclude = {
  assignments: {
    where: { returnedAt: null },
    take: 1,
    include: { user: { select: { id: true, name: true, email: true, department: true, title: true } } },
  },
} satisfies Prisma.DeviceInclude;

type WithHolder = Prisma.DeviceGetPayload<{ include: typeof holderInclude }>;
export const shapeDevice = ({ assignments, ...d }: WithHolder) => ({
  ...d,
  holder: assignments[0]?.user ?? null,
  assignedAt: assignments[0]?.assignedAt ?? null,
  dueAt: assignments[0]?.dueAt ?? null,
  assignmentId: assignments[0]?.id ?? null,
});

const devicesRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = { onRequest: app.authenticate };
  const admin = { onRequest: app.requireAdmin };
  const manager = { onRequest: app.requireManager };
  const idParam = z.object({ id: z.string() });

  r.get(
    '/devices',
    {
      ...auth,
      schema: {
        tags: ['Envanter'],
        querystring: pageQuery.extend({
          ...deviceFilters,
          sortBy: z.enum(['assetTag', 'brand', 'model', 'purchaseDate', 'status', 'createdAt']).default('createdAt'),
          sortDir: z.enum(['asc', 'desc']).default('desc'),
        }),
      },
    },
    async (req) => {
      const q = req.query;
      const where = deviceWhere(req.authUser, q);
      const [rows, total] = await Promise.all([
        prisma.device.findMany({ where, orderBy: { [q.sortBy]: q.sortDir }, include: holderInclude, ...pageArgs(q) }),
        prisma.device.count({ where }),
      ]);
      return pageResult(rows.map(shapeDevice), total, q);
    },
  );

  r.get('/devices/mine', { ...auth, schema: { tags: ['Envanter'] } }, async (req) => {
    const rows = await prisma.assignment.findMany({
      where: { userId: req.authUser.id, returnedAt: null },
      include: { device: true },
      orderBy: { assignedAt: 'desc' },
    });
    return {
      data: rows.map((a) => ({ ...a.device, assignedAt: a.assignedAt, dueAt: a.dueAt, receiptNo: a.receiptNo, assignmentId: a.id, assignmentNote: a.note })),
    };
  });

  r.get('/devices/by-qr/:token', { ...auth, schema: { tags: ['Envanter'], params: z.object({ token: z.string() }) } }, async (req) => {
    const d = await prisma.device.findUnique({ where: { qrToken: req.params.token }, include: holderInclude });
    if (!d) throw notFound('Bu QR koduna ait cihaz bulunamadı');
    return { device: shapeDevice(d) };
  });

  r.get('/devices/meta', { ...auth, schema: { tags: ['Meta'] } }, async () => {
    const [brands, locations, types] = await Promise.all([
      prisma.device.findMany({ select: { brand: true }, distinct: ['brand'], orderBy: { brand: 'asc' } }),
      prisma.device.findMany({ where: { location: { not: null } }, select: { location: true }, distinct: ['location'], orderBy: { location: 'asc' } }),
      prisma.device.findMany({ select: { type: true }, distinct: ['type'], orderBy: { type: 'asc' } }),
    ]);
    return { brands: brands.map((b) => b.brand), locations: locations.map((l) => l.location!), types: types.map((t) => t.type) };
  });

  // Toplu QR etiketi: seçilen cihazların QR görüntülerini tek istekte döndürür
  r.post('/devices/qr-batch', { ...manager, schema: { tags: ['Envanter'], body: z.object({ ids: z.array(z.string()).min(1).max(200) }) } }, async (req) => {
    const rows = await prisma.device.findMany({ where: { AND: [{ id: { in: req.body.ids } }, deviceViewScope(req.authUser)] }, orderBy: { assetTag: 'asc' } });
    const data = await Promise.all(rows.map(async (d) => ({ id: d.id, assetTag: d.assetTag, brand: d.brand, model: d.model, serialNumber: d.serialNumber, dataUrl: (await qrFor(d.qrToken)).dataUrl })));
    return { data };
  });

  r.post(
    '/devices/bulk-status',
    { ...admin, schema: { tags: ['Envanter'], body: z.object({ ids: z.array(z.string()).min(1).max(200), status: z.enum(STATUSES), note: z.string().trim().max(500).optional() }) } },
    async (req) => {
      const results = await bulkStatus({ deviceIds: req.body.ids, status: req.body.status, actor: req.authUser, note: req.body.note });
      return { results, ok: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length };
    },
  );

  r.get('/devices/:id', { ...auth, schema: { tags: ['Envanter'], params: idParam } }, async (req) => {
    const d = await prisma.device.findUnique({ where: { id: req.params.id }, include: holderInclude });
    if (!d) throw notFound('Cihaz bulunamadı');
    const u = req.authUser;
    // Geçmiş ve denetim kaydı: yönetici, ya da cihaz kendi biriminde olan birim sorumlusu
    const detailed = u.role === 'ADMIN' || (u.role === 'UNIT_MANAGER' && (await prisma.device.count({ where: { AND: [{ id: d.id }, deviceViewScope(u)] } })) > 0);
    const [history, events, faults] = await Promise.all([
      detailed
        ? prisma.assignment.findMany({
            where: { deviceId: d.id },
            orderBy: { assignedAt: 'desc' },
            include: {
              user: { select: { id: true, name: true, department: true } },
              assignedBy: { select: { id: true, name: true } },
              returnedBy: { select: { id: true, name: true } },
            },
          })
        : [],
      detailed ? prisma.deviceEvent.findMany({ where: { deviceId: d.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { id: true, name: true } } } }) : [],
      detailed ? prisma.faultTicket.findMany({ where: { deviceId: d.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { reportedBy: { select: { name: true } } } }) : [],
    ]);
    return { device: shapeDevice(d), history, events, faults };
  });

  r.get('/devices/:id/qr', { ...auth, schema: { tags: ['Envanter'], params: idParam } }, async (req) => {
    const d = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!d) throw notFound('Cihaz bulunamadı');
    return { assetTag: d.assetTag, ...(await qrFor(d.qrToken)) };
  });

  r.post('/devices', { ...admin, schema: { tags: ['Envanter'], body: z.object(deviceFields) } }, async (req, reply) => {
    checkDates(req.body.purchaseDate, req.body.warrantyEnd);
    if (await serialTaken(req.body.serialNumber)) throw conflict('Bu seri numarasıyla kayıtlı bir cihaz zaten var');
    const device = await createDevice(await prepare(req.body), req.authUser);
    reply.code(201);
    return { device: shapeDevice({ ...device, assignments: [] }) };
  });

  r.patch('/devices/:id', { ...admin, schema: { tags: ['Envanter'], params: idParam, body: z.object(deviceFields).partial() } }, async (req) => {
    const { id } = req.params;
    const current = await prisma.device.findUnique({ where: { id } });
    if (!current) throw notFound('Cihaz bulunamadı');
    if (req.body.serialNumber && req.body.serialNumber !== current.serialNumber && (await serialTaken(req.body.serialNumber, id))) throw conflict('Bu seri numarasıyla kayıtlı bir cihaz zaten var');
    checkDates(req.body.purchaseDate ?? current.purchaseDate, req.body.warrantyEnd === undefined ? current.warrantyEnd : req.body.warrantyEnd);
    const data = await prepare(req.body);
    const d = await prisma.$transaction(async (tx) => {
      const updated = await tx.device.update({ where: { id }, data, include: holderInclude });
      await logEvent(tx, id, 'UPDATED', 'Cihaz bilgileri güncellendi', req.authUser.id, { fields: Object.keys(req.body) });
      return updated;
    });
    return { device: shapeDevice(d) };
  });

  r.patch(
    '/devices/:id/status',
    { ...admin, schema: { tags: ['Envanter'], params: idParam, body: z.object({ status: z.enum(STATUSES), note: z.string().trim().max(500).optional() }) } },
    async (req) => {
      const { device, autoReturned } = await changeStatus({ deviceId: req.params.id, status: req.body.status, actor: req.authUser, note: req.body.note });
      const full = await prisma.device.findUniqueOrThrow({ where: { id: device.id }, include: holderInclude });
      return { device: shapeDevice(full), autoReturned };
    },
  );

  r.post(
    '/devices/:id/report-fault',
    { ...auth, schema: { tags: ['Envanter'], params: idParam, body: z.object({ note: z.string().trim().max(500).optional() }) } },
    async (req) => {
      if (!(await prisma.device.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw notFound('Cihaz bulunamadı');
      const { device, autoReturned } = await reportFault({ deviceId: req.params.id, actor: req.authUser, note: req.body.note });
      const full = await prisma.device.findUniqueOrThrow({ where: { id: device.id }, include: holderInclude });
      return { device: shapeDevice(full), autoReturned };
    },
  );

  r.post(
    '/devices/:id/return',
    { ...admin, schema: { tags: ['Zimmet'], params: idParam, body: z.object({ note: z.string().trim().max(500).optional(), condition: z.enum(['OK', 'FAULTY']).default('OK') }) } },
    async (req) => {
      const { device } = await returnDevice({ deviceId: req.params.id, actor: req.authUser, ...req.body });
      const full = await prisma.device.findUniqueOrThrow({ where: { id: device.id }, include: holderInclude });
      return { device: shapeDevice(full) };
    },
  );

  r.delete('/devices/:id', { ...admin, schema: { tags: ['Envanter'], params: idParam } }, async (req) => {
    const { id } = req.params;
    const d = await prisma.device.findUnique({ where: { id } });
    if (!d) throw notFound('Cihaz bulunamadı');
    if (await prisma.assignment.count({ where: { deviceId: id } })) throw conflict('Zimmet geçmişi olan cihaz silinemez. Bunun yerine "Hizmet dışı" durumuna alın');
    await prisma.device.delete({ where: { id } });
    return { ok: true };
  });
};

export default devicesRoutes;
