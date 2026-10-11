import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { pageArgs, pageQuery, pageResult } from '../lib/pagination.js';
import { assignmentScope } from '../lib/scope.js';
import { assignDevice, bulkAssign } from '../services/assignmentService.js';
import { notifyUsers } from '../services/notificationService.js';

const dueAt = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullable().optional());

const assignmentsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const admin = { onRequest: app.requireAdmin };
  const idp = z.object({ id: z.string() });

  r.post(
    '/assignments',
    {
      ...admin,
      schema: {
        tags: ['Zimmet'],
        body: z.object({
          deviceId: z.string(),
          userId: z.string(),
          note: z.string().trim().max(500).optional(),
          // Cihaz başkasındaysa: true ise önceki zimmet otomatik düşülüp devredilir
          transfer: z.boolean().default(false),
          // Planlı iade tarihi (isteğe bağlı)
          dueAt,
        }),
      },
    },
    async (req, reply) => {
      const a = await assignDevice({ ...req.body, actor: req.authUser });
      reply.code(201);
      return { assignment: a };
    },
  );

  // Toplu zimmet: aynı personele birden çok cihaz
  r.post(
    '/assignments/bulk',
    { ...admin, schema: { tags: ['Zimmet'], body: z.object({ deviceIds: z.array(z.string()).min(1).max(100), userId: z.string(), note: z.string().trim().max(500).optional(), transfer: z.boolean().default(false), dueAt }) } },
    async (req) => {
      const results = await bulkAssign({ ...req.body, actor: req.authUser });
      return { results, ok: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length };
    },
  );

  r.get(
    '/assignments',
    {
      onRequest: app.requireManager,
      schema: {
        tags: ['Zimmet'],
        querystring: pageQuery.extend({
          state: z.enum(['active', 'returned', 'all']).default('all'),
          overdue: z.enum(['true']).optional(),
          userId: z.string().optional(),
          deviceId: z.string().optional(),
          search: z.string().trim().optional(),
        }),
      },
    },
    async (req) => {
      const q = req.query;
      const where: Prisma.AssignmentWhereInput = {
        AND: [assignmentScope(req.authUser)],
        ...(q.state === 'active' && { returnedAt: null }),
        ...(q.state === 'returned' && { returnedAt: { not: null } }),
        ...(q.overdue && { returnedAt: null, dueAt: { lt: new Date() } }),
        ...(q.userId && { userId: q.userId }),
        ...(q.deviceId && { deviceId: q.deviceId }),
        ...(q.search && {
          OR: [
            { user: { name: { contains: q.search, mode: 'insensitive' } } },
            { device: { assetTag: { contains: q.search, mode: 'insensitive' } } },
            { device: { brand: { contains: q.search, mode: 'insensitive' } } },
            { device: { model: { contains: q.search, mode: 'insensitive' } } },
          ],
        }),
      };
      const [rows, total] = await Promise.all([
        prisma.assignment.findMany({
          where,
          orderBy: { assignedAt: 'desc' },
          include: {
            device: { select: { id: true, assetTag: true, brand: true, model: true, type: true } },
            user: { select: { id: true, name: true, department: true } },
            assignedBy: { select: { id: true, name: true } },
            returnedBy: { select: { id: true, name: true } },
          },
          ...pageArgs(q),
        }),
        prisma.assignment.count({ where }),
      ]);
      return pageResult(rows, total, q);
    },
  );

  // Tutanak verisi: yönetici, kendi biriminin sorumlusu veya zimmetin sahibi görebilir
  r.get('/assignments/:id', { onRequest: app.authenticate, schema: { tags: ['Zimmet'], params: idp } }, async (req) => {
    const a = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        device: true,
        user: { select: { id: true, name: true, email: true, department: true, title: true } },
        assignedBy: { select: { id: true, name: true, title: true } },
        returnedBy: { select: { id: true, name: true, title: true } },
      },
    });
    if (!a) throw notFound('Zimmet kaydı bulunamadı');
    const u = req.authUser;
    const allowed = u.role === 'ADMIN' || a.userId === u.id || (u.role === 'UNIT_MANAGER' && !!u.department && a.user.department === u.department);
    if (!allowed) throw forbidden();
    return { assignment: a };
  });

  r.patch('/assignments/:id', { ...admin, schema: { tags: ['Zimmet'], params: idp, body: z.object({ dueAt: z.coerce.date().nullable() }) } }, async (req) => {
    const a = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!a) throw notFound('Zimmet kaydı bulunamadı');
    if (a.returnedAt) throw conflict('İade edilmiş zimmetin tarihi değiştirilemez');
    if (req.body.dueAt && req.body.dueAt.getTime() < Date.now() - 864e5) throw badRequest('Planlı iade tarihi geçmişte olamaz');
    return { assignment: await prisma.assignment.update({ where: { id: a.id }, data: { dueAt: req.body.dueAt } }) };
  });

  // Elle hatırlatma: personele bildirim gönderir
  r.post('/assignments/:id/remind', { ...admin, schema: { tags: ['Zimmet'], params: idp } }, async (req) => {
    const a = await prisma.assignment.findUnique({ where: { id: req.params.id }, include: { device: { select: { id: true, brand: true, model: true, assetTag: true } } } });
    if (!a) throw notFound('Zimmet kaydı bulunamadı');
    if (a.returnedAt) throw conflict('Bu zimmet zaten iade edilmiş');
    await prisma.$transaction((tx) =>
      notifyUsers(tx, [a.userId], {
        type: 'ASSIGNMENT_DUE',
        title: 'İade hatırlatması',
        body: `${a.device.brand} ${a.device.model} (${a.device.assetTag}) için iade hatırlatması${a.dueAt ? ` · planlı tarih ${a.dueAt.toLocaleDateString('tr-TR')}` : ''}`,
        link: `/devices/${a.device.id}`,
      }),
    );
    return { ok: true };
  });
};

export default assignmentsRoutes;
