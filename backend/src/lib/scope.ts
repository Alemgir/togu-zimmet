import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../plugins/auth.js';

/**
 * Rol bazlı veri kapsamı.
 *  - ADMIN: her şey
 *  - UNIT_MANAGER: yalnızca kendi birimindeki personelin zimmetli cihazları, bu personelin zimmet/arıza kayıtları
 *  - STAFF: yalnızca kendi kayıtları
 */
const NONE = '__none__';

export function deviceScope(u: AuthUser): Prisma.DeviceWhereInput {
  if (u.role === 'ADMIN') return {};
  if (u.role === 'UNIT_MANAGER') {
    if (!u.department) return { id: NONE };
    return { assignments: { some: { returnedAt: null, user: { department: u.department } } } };
  }
  return { assignments: { some: { returnedAt: null, userId: u.id } } };
}

/** Birim sorumlusu, biriminden bildirilen arızalı (artık zimmetli olmayan) cihazı da görebilir. */
export function deviceViewScope(u: AuthUser): Prisma.DeviceWhereInput {
  if (u.role !== 'UNIT_MANAGER' || !u.department) return deviceScope(u);
  return { OR: [deviceScope(u), { faults: { some: { reportedBy: { department: u.department } } } }] };
}

export function userScope(u: AuthUser): Prisma.UserWhereInput {
  if (u.role === 'ADMIN') return {};
  if (u.role === 'UNIT_MANAGER') return { department: u.department ?? NONE };
  return { id: u.id };
}

export function assignmentScope(u: AuthUser): Prisma.AssignmentWhereInput {
  if (u.role === 'ADMIN') return {};
  if (u.role === 'UNIT_MANAGER') return { user: { department: u.department ?? NONE } };
  return { userId: u.id };
}

export function faultScope(u: AuthUser): Prisma.FaultTicketWhereInput {
  if (u.role === 'ADMIN') return {};
  if (u.role === 'UNIT_MANAGER') {
    const d = u.department ?? NONE;
    return { OR: [{ reportedBy: { department: d } }, { device: { assignments: { some: { returnedAt: null, user: { department: d } } } } }] };
  }
  return { reportedById: u.id };
}
