import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { publicUser } from '../lib/serializers.js';
import { isTest } from '../config.js';

export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .regex(/[A-Za-z]/, 'Şifre en az bir harf içermeli')
  .regex(/\d/, 'Şifre en az bir rakam içermeli');

const authRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/auth/login',
    {
      schema: { tags: ['Auth'], body: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }) },
      config: { rateLimit: { max: isTest ? 1000 : 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const email = req.body.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      const ok = user ? await bcrypt.compare(req.body.password, user.passwordHash) : await bcrypt.compare(req.body.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
      if (!user || !ok) throw unauthorized('E-posta veya şifre hatalı');
      if (!user.isActive) throw unauthorized('Hesabınız pasif durumda. Yöneticinizle iletişime geçin');
      const token = app.jwt.sign({ sub: user.id, v: user.tokenVersion });
      return { token, user: publicUser(user) };
    },
  );

  r.post('/auth/logout', { onRequest: app.authenticate, schema: { tags: ['Auth'] } }, async () => ({ ok: true }));

  r.get('/auth/me', { onRequest: app.authenticate, schema: { tags: ['Auth'] } }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser.id } });
    return { user: publicUser(user) };
  });

  r.patch(
    '/auth/me/password',
    {
      onRequest: app.authenticate,
      schema: { tags: ['Auth'], body: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }) },
    },
    async (req) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser.id } });
      if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw badRequest('Mevcut şifre hatalı');
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(req.body.newPassword, 10), tokenVersion: { increment: 1 } },
      });
      // Eski oturumlar kapanır; yeni token ile devam edilir
      return { ok: true, token: app.jwt.sign({ sub: updated.id, v: updated.tokenVersion }) };
    },
  );
};

export default authRoutes;
