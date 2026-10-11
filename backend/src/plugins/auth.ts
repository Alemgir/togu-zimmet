import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { forbidden, unauthorized } from '../lib/errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; v: number };
    user: { sub: string; v: number };
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Yönetici veya birim sorumlusu */
    requireManager: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(fjwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES_IN } });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized();
    }
    const { sub, v } = req.user;
    const u = await prisma.user.findUnique({ where: { id: sub } });
    // Pasif kullanıcı veya şifresi değişmiş/oturumu sonlandırılmış token geçersiz sayılır
    if (!u || !u.isActive || u.tokenVersion !== v) throw unauthorized();
    req.authUser = { id: u.id, name: u.name, email: u.email, role: u.role, department: u.department };
  });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (req.authUser.role !== 'ADMIN') throw forbidden('Bu işlem yalnızca yöneticiler içindir');
  });

  app.decorate('requireManager', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (req.authUser.role === 'STAFF') throw forbidden('Bu işlem yöneticiler ve birim sorumluları içindir');
  });
});
