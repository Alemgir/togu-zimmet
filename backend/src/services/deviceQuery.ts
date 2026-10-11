import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { deviceScope, deviceViewScope } from '../lib/scope.js';
import type { AuthUser } from '../plugins/auth.js';

export const typeParam = z.string().trim().min(1).max(60);
export const STATUSES = ['IN_STOCK', 'ASSIGNED', 'FAULTY', 'RETIRED'] as const;

/** Envanter listesi ve dışa aktarma için ortak süzgeç alanları */
export const deviceFilters = {
  search: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  type: z.string().trim().min(1).max(60).optional(), // yerleşik kod ya da özel tür adı
  brand: z.string().optional(),
  department: z.string().optional(),
  userId: z.string().optional(),
  warrantyExpiring: z.enum(['true']).optional(),
  stale: z.enum(['true']).optional(), // 60+ gündür depoda hareketsiz
  overdue: z.enum(['true']).optional(), // planlı iadesi geçmiş zimmetli
};
export type DeviceFilters = Partial<{ [K in keyof typeof deviceFilters]: z.infer<(typeof deviceFilters)[K]> }>;

const DAY = 864e5;

export function deviceWhere(actor: AuthUser, q: DeviceFilters): Prisma.DeviceWhereInput {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * DAY);
  const holder: Prisma.UserWhereInput = { ...(q.userId && { id: q.userId }), ...(q.department && { department: q.department }) };
  const and: Prisma.DeviceWhereInput[] = [actor.role === 'STAFF' ? deviceScope(actor) : deviceViewScope(actor)];
  if (actor.role !== 'STAFF' && Object.keys(holder).length) and.push({ assignments: { some: { returnedAt: null, user: holder } } });
  if (q.overdue) and.push({ assignments: { some: { returnedAt: null, dueAt: { lt: now } } } });
  if (q.stale) and.push({ status: 'IN_STOCK', createdAt: { lt: cutoff }, assignments: { none: { returnedAt: { gt: cutoff } } } });
  if (q.search) {
    and.push({
      OR: [
        { assetTag: { contains: q.search, mode: 'insensitive' } },
        { brand: { contains: q.search, mode: 'insensitive' } },
        { model: { contains: q.search, mode: 'insensitive' } },
        { serialNumber: { contains: q.search, mode: 'insensitive' } },
        { assignments: { some: { returnedAt: null, user: { name: { contains: q.search, mode: 'insensitive' } } } } },
      ],
    });
  }
  return {
    AND: and,
    ...(q.status && { status: q.status }),
    ...(q.type && { type: q.type }),
    ...(q.brand && { brand: q.brand }),
    ...(q.warrantyExpiring && { warrantyEnd: { gte: now, lte: new Date(now.getTime() + 90 * DAY) } }),
  };
}
