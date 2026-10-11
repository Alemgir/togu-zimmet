import type { User } from '@prisma/client';

export function publicUser(u: User) {
  const { passwordHash: _p, tokenVersion: _t, ...rest } = u;
  return rest;
}
