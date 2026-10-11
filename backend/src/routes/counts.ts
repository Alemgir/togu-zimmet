import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { conflict, notFound } from '../lib/errors.js';
import { toCsv } from '../lib/csv.js';
import { pageArgs, pageQuery, pageResult } from '../lib/pagination.js';
import { createSession, progress, scan } from '../services/countService.js';

const counts: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const admin = { onRequest: app.requireAdmin };
  const idp = z.object({ id: z.string() });

  r.post('/counts', { ...admin, schema: { tags: ['Sayım'], body: z.object({ name: z.string().trim().min(2).max(120), location: z.string().trim().max(120).nullable().optional() }) } }, async (req, reply) => {
    const s = await createSession(req.authUser, { name: req.body.name, location: req.body.location || null });
    reply.code(201);
    return { session: s, progress: await progress(s.id) };
  });

  r.get('/counts', { ...admin, schema: { tags: ['Sayım'] } }, async () => {
    const sessions = await prisma.countSession.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { createdBy: { select: { name: true } } } });
    return { data: await Promise.all(sessions.map(async (s) => ({ ...s, progress: await progress(s.id) }))) };
  });

  r.get(
    '/counts/:id',
    { ...admin, schema: { tags: ['Sayım'], params: idp, querystring: pageQuery.extend({ state: z.enum(['all', 'scanned', 'missing', 'unexpected']).default('all'), search: z.string().trim().optional() }) } },
    async (req) => {
      const s = await prisma.countSession.findUnique({ where: { id: req.params.id }, include: { createdBy: { select: { name: true } } } });
      if (!s) throw notFound('Sayım bulunamadı');
      const q = req.query;
      const where: Prisma.CountItemWhereInput = {
        sessionId: s.id,
        ...(q.state === 'scanned' && { expected: true, scannedAt: { not: null } }),
        ...(q.state === 'missing' && { expected: true, scannedAt: null }),
        ...(q.state === 'unexpected' && { expected: false }),
        ...(q.search && { device: { OR: [{ assetTag: { contains: q.search, mode: 'insensitive' } }, { brand: { contains: q.search, mode: 'insensitive' } }, { model: { contains: q.search, mode: 'insensitive' } }] } }),
      };
      const [items, total] = await Promise.all([
        prisma.countItem.findMany({
          where,
          orderBy: [{ scannedAt: { sort: 'desc', nulls: 'last' } }, { device: { assetTag: 'asc' } }],
          include: { device: { select: { id: true, assetTag: true, brand: true, model: true, type: true, location: true, status: true } }, scannedBy: { select: { name: true } } },
          ...pageArgs(q),
        }),
        prisma.countItem.count({ where }),
      ]);
      return { session: s, progress: await progress(s.id), ...pageResult(items, total, q) };
    },
  );

  r.post('/counts/:id/scan', { ...admin, schema: { tags: ['Sayım'], params: idp, body: z.object({ code: z.string().trim().min(1).max(300) }) } }, async (req) => scan(req.params.id, req.body.code, req.authUser));

  r.post('/counts/:id/close', { ...admin, schema: { tags: ['Sayım'], params: idp } }, async (req) => {
    const s = await prisma.countSession.findUnique({ where: { id: req.params.id } });
    if (!s) throw notFound('Sayım bulunamadı');
    if (s.status === 'CLOSED') throw conflict('Sayım zaten kapatılmış');
    const closed = await prisma.countSession.update({ where: { id: s.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    return { session: closed, progress: await progress(s.id) };
  });

  r.get('/counts/:id/export', { ...admin, schema: { tags: ['Sayım'], params: idp } }, async (req, reply) => {
    const s = await prisma.countSession.findUnique({ where: { id: req.params.id } });
    if (!s) throw notFound('Sayım bulunamadı');
    const items = await prisma.countItem.findMany({
      where: { sessionId: s.id },
      orderBy: { device: { assetTag: 'asc' } },
      include: { device: true, scannedBy: { select: { name: true } } },
    });
    const state = (i: (typeof items)[number]) => (!i.expected ? 'Beklenmeyen' : i.scannedAt ? 'Sayıldı' : 'Eksik');
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="sayim-${s.id.slice(-6)}.csv"`);
    return toCsv(items, [
      { header: 'Demirbaş no', value: (i) => i.device.assetTag },
      { header: 'Marka', value: (i) => i.device.brand },
      { header: 'Model', value: (i) => i.device.model },
      { header: 'Seri no', value: (i) => i.device.serialNumber },
      { header: 'Konum', value: (i) => i.device.location },
      { header: 'Sonuç', value: state },
      { header: 'Okutulma zamanı', value: (i) => i.scannedAt?.toLocaleString('tr-TR') },
      { header: 'Okutan', value: (i) => i.scannedBy?.name },
    ]);
  });
};

export default counts;
