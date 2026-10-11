import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { typeParam } from '../services/deviceQuery.js';
import { buildDashboard } from '../services/dashboardService.js';
import { buildReport } from '../services/reportService.js';

const typeQuery = z.object({ type: typeParam.optional() });

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  // Komuta merkezi: ?type= ile tüm göstergeler cihaz türüne göre süzülür (çapraz filtre)
  r.get('/dashboard', { onRequest: app.requireManager, schema: { tags: ['Dashboard'], querystring: typeQuery } }, async (req) => buildDashboard(req.authUser, { type: req.query.type }));
  // İçgörü / Raporlar: sağlık puanı, yaş, garanti takvimi, yenileme planı…
  r.get('/reports/summary', { onRequest: app.requireManager, schema: { tags: ['Raporlar'], querystring: typeQuery } }, async (req) => buildReport(req.authUser, { type: req.query.type }));
};

export default dashboardRoutes;
