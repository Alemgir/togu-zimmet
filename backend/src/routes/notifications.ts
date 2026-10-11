import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../db.js';
import { runChecksThrottled } from '../services/notificationService.js';

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = { onRequest: app.authenticate };

  r.get('/notifications', { ...auth, schema: { tags: ['Bildirimler'], querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }) } }, async (req) => {
    await runChecksThrottled().catch((e) => req.log.error(e));
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: req.authUser.id }, orderBy: { createdAt: 'desc' }, take: req.query.limit }),
      prisma.notification.count({ where: { userId: req.authUser.id, readAt: null } }),
    ]);
    return { data: items, unread };
  });

  r.post('/notifications/read-all', { ...auth, schema: { tags: ['Bildirimler'] } }, async (req) => {
    const res = await prisma.notification.updateMany({ where: { userId: req.authUser.id, readAt: null }, data: { readAt: new Date() } });
    return { updated: res.count };
  });

  r.post('/notifications/:id/read', { ...auth, schema: { tags: ['Bildirimler'], params: z.object({ id: z.string() }) } }, async (req) => {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.authUser.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  });
};

export default notificationsRoutes;
