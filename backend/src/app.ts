import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { config, isTest } from './config.js';
import { AppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import devicesRoutes from './routes/devices.js';
import assignmentsRoutes from './routes/assignments.js';
import dashboardRoutes from './routes/dashboard.js';
import faultsRoutes from './routes/faults.js';
import notificationsRoutes from './routes/notifications.js';
import countsRoutes from './routes/counts.js';
import exportsRoutes from './routes/exports.js';

export async function buildApp() {
  const app = Fastify({ logger: isTest ? false : { level: 'info' } });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.CORS_ORIGIN.split(','), methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(rateLimit, { global: false });
  await app.register(swagger, {
    openapi: {
      info: { title: 'IT Demirbaş ve Zimmet Yönetim Sistemi API', version: '1.0.0' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(authPlugin);

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.validation || err.code === 'FST_ERR_VALIDATION') {
      const issues = (err.validation ?? []).map((v: any) => ({
        path: (v.instancePath || v.params?.issue?.path?.join('.') || '').toString().replace(/^\//, ''),
        message: v.message ?? v.params?.issue?.message,
      }));
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: issues[0]?.message ?? 'Geçersiz veri', details: issues } });
    }
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: 'RATE_LIMIT', message: 'Çok fazla deneme. Lütfen biraz bekleyin' } });
    if (err.code === 'P2002') return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Bu kayıt zaten mevcut' } });
    req.log.error(err);
    return reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({
      error: { code: 'INTERNAL', message: err.statusCode && err.statusCode < 500 ? err.message : 'Beklenmeyen bir hata oluştu' },
    });
  });

  // Bilinmeyen adresler de tutarlı JSON hata biçimiyle döner
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Adres bulunamadı: ${req.method} ${req.url.split('?')[0]}` } }));

  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(usersRoutes);
      await api.register(devicesRoutes);
      await api.register(assignmentsRoutes);
      await api.register(dashboardRoutes);
      await api.register(faultsRoutes);
      await api.register(notificationsRoutes);
      await api.register(countsRoutes);
      await api.register(exportsRoutes);
    },
    { prefix: '/api' },
  );
  return app;
}
