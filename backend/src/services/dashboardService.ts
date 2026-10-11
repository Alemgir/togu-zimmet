import type { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { deviceViewScope, userScope } from '../lib/scope.js';
import type { AuthUser } from '../plugins/auth.js';

const DAY = 864e5;
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: config.APP_TZ });

/** Belirli bir andaki saat dilimi ofseti, örn. "+03:00" */
function tzOffset(date: Date) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: config.APP_TZ, timeZoneName: 'longOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = part.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1]! : '+00:00';
}

/** Son N günün gün sonu zaman damgaları (yapılandırılan saat dilimine göre gün sınırı). */
export function lastDays(n: number, now = new Date()) {
  const out: { key: string; end: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * DAY);
    const key = dayKey(t);
    out.push({ key, end: i === 0 ? now : new Date(`${key}T23:59:59.999${tzOffset(t)}`) });
  }
  return out;
}

export function baseDeviceWhere(actor: AuthUser, type?: string): Prisma.DeviceWhereInput {
  return { AND: [deviceViewScope(actor), type ? { type } : {}] };
}

export async function buildDashboard(actor: AuthUser, opts: { type?: string } = {}) {
  const now = new Date();
  const base = baseDeviceWhere(actor, opts.type);
  const scopeOnly = baseDeviceWhere(actor);
  const days = lastDays(30, now);
  const since = new Date(now.getTime() - 31 * DAY);

  const [byStatus, byTypeAll, deviceDates, assignmentsAll, faultsAll, openFaults, warranty, overdue, recentEvents, inStock, users, deptRows] = await Promise.all([
    prisma.device.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    prisma.device.groupBy({ by: ['type'], where: scopeOnly, _count: { _all: true } }),
    prisma.device.findMany({ where: base, select: { createdAt: true } }),
    prisma.assignment.findMany({
      where: { device: base, OR: [{ returnedAt: null }, { returnedAt: { gte: since } }] },
      select: { assignedAt: true, returnedAt: true },
    }),
    prisma.faultTicket.findMany({ where: { device: base, OR: [{ resolvedAt: null }, { resolvedAt: { gte: since } }] }, select: { createdAt: true, resolvedAt: true } }),
    prisma.faultTicket.findMany({
      where: { device: base, status: { not: 'RESOLVED' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { device: { select: { id: true, assetTag: true, brand: true, model: true, location: true } }, reportedBy: { select: { name: true } } },
    }),
    prisma.device.findMany({
      where: { AND: [base, { status: { not: 'RETIRED' }, warrantyEnd: { gte: now, lte: new Date(now.getTime() + 90 * DAY) } }] },
      orderBy: { warrantyEnd: 'asc' },
      take: 10,
      select: { id: true, assetTag: true, brand: true, model: true, warrantyEnd: true },
    }),
    prisma.assignment.findMany({
      where: { returnedAt: null, dueAt: { not: null, lt: now }, device: base },
      orderBy: { dueAt: 'asc' },
      take: 10,
      include: { user: { select: { id: true, name: true } }, device: { select: { id: true, assetTag: true, brand: true, model: true } } },
    }),
    prisma.deviceEvent.findMany({
      where: { device: base },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { device: { select: { id: true, assetTag: true, brand: true, model: true } }, actor: { select: { name: true } } },
    }),
    // Hareketsiz depo: 60+ gündür hiç zimmetlenmemiş / iade edilmemiş
    actor.role === 'ADMIN'
      ? prisma.device.findMany({
          where: { AND: [base, { status: 'IN_STOCK' }] },
          select: { id: true, assetTag: true, brand: true, model: true, createdAt: true, assignments: { orderBy: { returnedAt: 'desc' }, take: 1, select: { returnedAt: true } } },
        })
      : Promise.resolve([]),
    prisma.user.count({ where: { AND: [userScope(actor), { isActive: true }] } }),
    prisma.assignment.findMany({ where: { returnedAt: null, device: base }, select: { user: { select: { department: true } } } }),
  ]);

  const status = { IN_STOCK: 0, ASSIGNED: 0, FAULTY: 0, RETIRED: 0 } as Record<string, number>;
  byStatus.forEach((s) => (status[s.status] = s._count._all));
  const total = Object.values(status).reduce((a, b) => a + b, 0);

  // 30 günlük eğilim (KPI sparkline'ları): her gün sonu itibarıyla
  const retiredNow = status.RETIRED;
  const created = deviceDates.map((d) => d.createdAt.getTime());
  const trend = { devices: [] as number[], assigned: [] as number[], faulty: [] as number[], inStock: [] as number[] };
  for (const { end } of days) {
    const t = end.getTime();
    const devices = created.filter((c) => c <= t).length;
    const assigned = assignmentsAll.filter((a) => a.assignedAt.getTime() <= t && (!a.returnedAt || a.returnedAt.getTime() > t)).length;
    const faulty = faultsAll.filter((f) => f.createdAt.getTime() <= t && (!f.resolvedAt || f.resolvedAt.getTime() > t)).length;
    trend.devices.push(devices);
    trend.assigned.push(assigned);
    trend.faulty.push(faulty);
    trend.inStock.push(Math.max(0, devices - assigned - faulty - retiredNow));
  }
  const delta = (s: number[]) => (s.length ? s[s.length - 1]! - s[0]! : 0);

  const dept = new Map<string, number>();
  deptRows.forEach((a) => {
    const k = a.user.department ?? 'Belirtilmemiş';
    dept.set(k, (dept.get(k) ?? 0) + 1);
  });

  const stale = (inStock as { id: string; assetTag: string; brand: string; model: string; createdAt: Date; assignments: { returnedAt: Date | null }[] }[])
    .map((d) => ({ ...d, last: d.assignments[0]?.returnedAt ?? d.createdAt }))
    .filter((d) => now.getTime() - d.last.getTime() > 60 * DAY)
    .sort((a, b) => a.last.getTime() - b.last.getTime());

  return {
    scope: actor.role === 'ADMIN' ? 'all' : actor.role === 'UNIT_MANAGER' ? 'department' : 'self',
    type: opts.type ?? null,
    totals: { devices: total, users, inStock: status.IN_STOCK, assigned: status.ASSIGNED, faulty: status.FAULTY, retired: status.RETIRED },
    trend,
    deltas: { devices: delta(trend.devices), assigned: delta(trend.assigned), inStock: delta(trend.inStock), faulty: delta(trend.faulty) },
    // Tür kutuları her zaman tüm türleri gösterir (filtre seçimi için); diğer her şey seçili türe göre süzülür
    byType: byTypeAll.map((t) => ({ type: t.type, count: t._count._all })).sort((a, b) => b.count - a.count),
    byDepartment: [...dept.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    attention: {
      faults: openFaults.map((f) => ({ id: f.id, ticketNo: f.ticketNo, status: f.status, description: f.description, createdAt: f.createdAt, reportedBy: f.reportedBy?.name ?? null, device: f.device })),
      warranty: warranty.map((d) => ({ ...d, days: Math.ceil((d.warrantyEnd!.getTime() - now.getTime()) / DAY) })),
      overdue: overdue.map((a) => ({ id: a.id, dueAt: a.dueAt, days: Math.max(1, Math.floor((now.getTime() - a.dueAt!.getTime()) / DAY)), user: a.user, device: a.device })),
      stale: { count: stale.length, items: stale.slice(0, 5).map((d) => ({ id: d.id, assetTag: d.assetTag, brand: d.brand, model: d.model, days: Math.floor((now.getTime() - d.last.getTime()) / DAY) })) },
    },
    recentEvents,
  };
}
