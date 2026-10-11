import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { pageArgs, pageQuery, pageResult } from '../lib/pagination.js';
import { publicUser } from '../lib/serializers.js';
import { releaseAllForUser } from '../services/assignmentService.js';
import { passwordSchema } from './auth.js';
import { userScope } from '../lib/scope.js';
import { canonicalOptional } from '../services/canonical.js';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const baseFields = {
  name: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(100).transform((v) => v.replace(/\s+/g, ' ')),
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta girin'),
  role: z.enum(['ADMIN', 'UNIT_MANAGER', 'STAFF']),
  department: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  title: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
};

const withCount = {
  _count: { select: { assignments: { where: { returnedAt: null } } } },
} satisfies Prisma.UserInclude;

const shape = (u: Prisma.UserGetPayload<{ include: typeof withCount }>) => ({
  ...publicUser(u),
  activeDeviceCount: u._count.assignments,
});

async function activeAdminCount(excludeId?: string) {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

const usersRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const admin = { onRequest: app.requireAdmin };

  const manager = { onRequest: app.requireManager };

  r.get(
    '/users',
    {
      ...manager,
      schema: {
        tags: ['Kullanıcılar'],
        querystring: pageQuery.extend({
          search: z.string().trim().optional(),
          role: z.enum(['ADMIN', 'UNIT_MANAGER', 'STAFF']).optional(),
          department: z.string().optional(),
          isActive: bool.optional(),
          sortBy: z.enum(['name', 'email', 'department', 'createdAt']).default('name'),
          sortDir: z.enum(['asc', 'desc']).default('asc'),
        }),
      },
    },
    async (req) => {
      const q = req.query;
      const where: Prisma.UserWhereInput = {
        AND: [userScope(req.authUser)],
        ...(q.role && { role: q.role }),
        ...(q.department && { department: q.department }),
        ...(q.isActive !== undefined && { isActive: q.isActive }),
        ...(q.search && {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
            { department: { contains: q.search, mode: 'insensitive' } },
          ],
        }),
      };
      const [rows, total] = await Promise.all([
        prisma.user.findMany({ where, orderBy: { [q.sortBy]: q.sortDir }, include: withCount, ...pageArgs(q) }),
        prisma.user.count({ where }),
      ]);
      return pageResult(rows.map(shape), total, q);
    },
  );

  r.get('/users/:id', { ...manager, schema: { tags: ['Kullanıcılar'], params: z.object({ id: z.string() }) } }, async (req) => {
    const u = await prisma.user.findFirst({ where: { AND: [{ id: req.params.id }, userScope(req.authUser)] }, include: withCount });
    if (!u) throw notFound('Kullanıcı bulunamadı');
    const [devices, history] = await Promise.all([
      prisma.assignment.findMany({
        where: { userId: u.id, returnedAt: null },
        include: { device: true },
        orderBy: { assignedAt: 'desc' },
      }),
      prisma.assignment.findMany({
        where: { userId: u.id, returnedAt: { not: null } },
        include: { device: true },
        orderBy: { returnedAt: 'desc' },
        take: 50,
      }),
    ]);
    return { user: shape(u), activeAssignments: devices, history };
  });

  r.post(
    '/users',
    { ...admin, schema: { tags: ['Kullanıcılar'], body: z.object({ ...baseFields, password: passwordSchema }) } },
    async (req, reply) => {
      const { password, ...rest } = req.body;
      const data = {
        ...rest,
        department: (await canonicalOptional('user.department', rest.department, 'Birim', { max: 100 })) ?? null,
        title: (await canonicalOptional('user.title', rest.title, 'Unvan', { max: 100 })) ?? null,
      };
      if (data.role === 'UNIT_MANAGER' && !data.department) throw badRequest('Birim sorumlusu için birim/departman zorunludur');
      if (await prisma.user.findUnique({ where: { email: data.email } })) throw conflict('Bu e-posta ile kayıtlı bir kullanıcı var');
      const u = await prisma.user.create({
        data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
        include: withCount,
      });
      reply.code(201);
      return { user: shape(u) };
    },
  );

  r.patch(
    '/users/:id',
    {
      ...admin,
      schema: {
        tags: ['Kullanıcılar'],
        params: z.object({ id: z.string() }),
        body: z.object({ ...baseFields, isActive: z.boolean() }).partial(),
      },
    },
    async (req) => {
      const { id } = req.params;
      const body = {
        ...req.body,
        ...(req.body.department !== undefined && { department: await canonicalOptional('user.department', req.body.department, 'Birim', { max: 100 }) }),
        ...(req.body.title !== undefined && { title: await canonicalOptional('user.title', req.body.title, 'Unvan', { max: 100 }) }),
      };
      const current = await prisma.user.findUnique({ where: { id } });
      if (!current) throw notFound('Kullanıcı bulunamadı');
      if (body.email && body.email !== current.email && (await prisma.user.findUnique({ where: { email: body.email } })))
        throw conflict('Bu e-posta ile kayıtlı bir kullanıcı var');

      const nextRole = body.role ?? current.role;
      const nextDept = body.department === undefined ? current.department : body.department;
      if (nextRole === 'UNIT_MANAGER' && !nextDept) throw badRequest('Birim sorumlusu için birim/departman zorunludur');

      const losingAdmin = current.role === 'ADMIN' && current.isActive && ((!!body.role && body.role !== 'ADMIN') || body.isActive === false);
      if (losingAdmin && (await activeAdminCount(id)) === 0) throw conflict('Sistemde en az bir aktif yönetici kalmalı');
      if (id === req.authUser.id && (body.isActive === false || (!!body.role && body.role !== 'ADMIN')))
        throw conflict('Kendi hesabınızı pasife alamaz veya yetkinizi düşüremezsiniz');

      const u = await prisma.$transaction(async (tx) => {
        // Pasife alma → tüm zimmetler otomatik düşer
        if (body.isActive === false && current.isActive) await releaseAllForUser(tx, id, req.authUser.id);
        return tx.user.update({
          where: { id },
          data: { ...body, ...(body.isActive === false && { tokenVersion: { increment: 1 } }) },
          include: withCount,
        });
      });
      return { user: shape(u) };
    },
  );

  r.patch(
    '/users/:id/password',
    {
      ...admin,
      schema: { tags: ['Kullanıcılar'], params: z.object({ id: z.string() }), body: z.object({ newPassword: passwordSchema }) },
    },
    async (req) => {
      if (!(await prisma.user.findUnique({ where: { id: req.params.id } }))) throw notFound('Kullanıcı bulunamadı');
      await prisma.user.update({
        where: { id: req.params.id },
        data: { passwordHash: await bcrypt.hash(req.body.newPassword, 10), tokenVersion: { increment: 1 } },
      });
      return { ok: true };
    },
  );

  r.delete('/users/:id', { ...admin, schema: { tags: ['Kullanıcılar'], params: z.object({ id: z.string() }) } }, async (req) => {
    const { id } = req.params;
    if (id === req.authUser.id) throw conflict('Kendi hesabınızı silemezsiniz');
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) throw notFound('Kullanıcı bulunamadı');
    if (u.role === 'ADMIN' && u.isActive && (await activeAdminCount(id)) === 0)
      throw conflict('Sistemde en az bir aktif yönetici kalmalı');

    const history = await prisma.assignment.count({
      where: { OR: [{ userId: id }, { assignedById: id }, { returnedById: id }] },
    });
    return prisma.$transaction(async (tx) => {
      const released = await releaseAllForUser(tx, id, req.authUser.id);
      if (history === 0) {
        await tx.user.delete({ where: { id } });
        return { mode: 'deleted' as const, releasedDevices: released };
      }
      // Zimmet geçmişi denetim izi olarak korunur: kayıt silinmez, pasife alınır
      await tx.user.update({ where: { id }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      return { mode: 'deactivated' as const, releasedDevices: released };
    });
  });

  r.get('/meta/titles', { onRequest: app.authenticate, schema: { tags: ['Meta'] } }, async () => {
    const rows = await prisma.user.findMany({ where: { title: { not: null } }, select: { title: true }, distinct: ['title'], orderBy: { title: 'asc' } });
    return { titles: rows.map((x) => x.title!) };
  });

  r.get('/meta/departments', { onRequest: app.authenticate, schema: { tags: ['Meta'] } }, async () => {
    const rows = await prisma.user.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    return { departments: rows.map((x) => x.department!) };
  });
};

export default usersRoutes;
