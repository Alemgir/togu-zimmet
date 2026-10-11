import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import { pageArgs, pageQuery, pageResult } from '../lib/pagination.js';
import { faultScope } from '../lib/scope.js';
import { updateFault } from '../services/faultService.js';

const include = {
  device: { select: { id: true, assetTag: true, brand: true, model: true, type: true, status: true, location: true } },
  reportedBy: { select: { id: true, name: true, department: true } },
  handledBy: { select: { id: true, name: true } },
} satisfies Prisma.FaultTicketInclude;

const STATUS = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']);

const faultsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = { onRequest: app.authenticate };

  r.get(
    '/faults',
    {
      ...auth,
      schema: {
        tags: ['Arızalar'],
        querystring: pageQuery.extend({ status: STATUS.optional(), active: z.enum(['true']).optional(), search: z.string().trim().optional(), deviceId: z.string().optional() }),
      },
    },
    async (req) => {
      const q = req.query;
      const where: Prisma.FaultTicketWhereInput = {
        AND: [
          faultScope(req.authUser),
          {
            ...(q.status && { status: q.status }),
            ...(q.active && { status: { not: 'RESOLVED' } }),
            ...(q.deviceId && { deviceId: q.deviceId }),
            ...(q.search && {
              OR: [
                { description: { contains: q.search, mode: 'insensitive' } },
                { device: { assetTag: { contains: q.search, mode: 'insensitive' } } },
                { device: { brand: { contains: q.search, mode: 'insensitive' } } },
                { device: { model: { contains: q.search, mode: 'insensitive' } } },
              ],
            }),
          },
        ],
      };
      const [rows, total] = await Promise.all([
        prisma.faultTicket.findMany({ where, orderBy: { createdAt: 'desc' }, include, ...pageArgs(q) }),
        prisma.faultTicket.count({ where }),
      ]);
      return pageResult(rows, total, q);
    },
  );

  // Kanban panosu: açık/inceleniyor kayıtların tamamı + son 14 günde çözülenler
  r.get('/faults/board', { onRequest: app.requireManager, schema: { tags: ['Arızalar'] } }, async (req) => {
    const scope = faultScope(req.authUser);
    const since = new Date(Date.now() - 14 * 864e5);
    const [open, progress, resolved] = await Promise.all([
      prisma.faultTicket.findMany({ where: { AND: [scope, { status: 'OPEN' }] }, orderBy: { createdAt: 'desc' }, take: 100, include }),
      prisma.faultTicket.findMany({ where: { AND: [scope, { status: 'IN_PROGRESS' }] }, orderBy: { createdAt: 'desc' }, take: 100, include }),
      prisma.faultTicket.findMany({ where: { AND: [scope, { status: 'RESOLVED', resolvedAt: { gte: since } }] }, orderBy: { resolvedAt: 'desc' }, take: 100, include }),
    ]);
    return { OPEN: open, IN_PROGRESS: progress, RESOLVED: resolved };
  });

  r.get('/faults/:id', { ...auth, schema: { tags: ['Arızalar'], params: z.object({ id: z.string() }) } }, async (req) => {
    const t = await prisma.faultTicket.findFirst({ where: { AND: [{ id: req.params.id }, faultScope(req.authUser)] }, include });
    if (!t) throw notFound('Arıza kaydı bulunamadı');
    const events = await prisma.deviceEvent.findMany({
      // Tetikleyen olay kaydı, kayıttan birkaç ms önce yazılır: küçük bir pay bırakılır
      where: { deviceId: t.deviceId, createdAt: { gte: new Date(t.createdAt.getTime() - 3000) } },
      orderBy: { createdAt: 'asc' },
      take: 30,
      include: { actor: { select: { name: true } } },
    });
    return { ticket: t, events };
  });

  r.patch(
    '/faults/:id',
    {
      onRequest: app.requireAdmin,
      schema: {
        tags: ['Arızalar'],
        params: z.object({ id: z.string() }),
        body: z.object({ status: STATUS.optional(), resolution: z.string().trim().max(1000).nullable().optional(), handledById: z.string().nullable().optional() }),
      },
    },
    async (req) => {
      const t = await updateFault(req.params.id, req.body, req.authUser);
      return { ticket: await prisma.faultTicket.findUniqueOrThrow({ where: { id: t.id }, include }) };
    },
  );
};

export default faultsRoutes;
