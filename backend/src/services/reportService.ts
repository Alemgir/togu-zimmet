import { prisma } from '../db.js';
import type { AuthUser } from '../plugins/auth.js';
import { baseDeviceWhere, lastDays } from './dashboardService.js';

const DAY = 864e5;
const YEAR = 365 * DAY;

export async function buildReport(actor: AuthUser, opts: { type?: string } = {}) {
  const now = new Date();
  const base = baseDeviceWhere(actor, opts.type);
  const scopeOnly = baseDeviceWhere(actor);
  const since = new Date(now.getTime() - 31 * DAY);

  const [devices, byTypeAll, assignRows, returnRows, activeAssign] = await Promise.all([
    prisma.device.findMany({ where: base, select: { status: true, purchaseDate: true, warrantyEnd: true } }),
    prisma.device.groupBy({ by: ['type'], where: scopeOnly, _count: { _all: true } }),
    prisma.assignment.findMany({ where: { device: base, assignedAt: { gte: since } }, select: { assignedAt: true } }),
    prisma.assignment.findMany({ where: { device: base, returnedAt: { gte: since } }, select: { returnedAt: true } }),
    prisma.assignment.findMany({ where: { returnedAt: null, device: base }, select: { user: { select: { department: true } } } }),
  ]);

  const n = devices.length;
  const live = devices.filter((d) => d.status !== 'RETIRED');
  const rate = (c: number, of = n) => (of ? c / of : 0);
  const faultyR = rate(devices.filter((d) => d.status === 'FAULTY').length);
  const expiredR = rate(devices.filter((d) => d.warrantyEnd && d.warrantyEnd < now).length);
  const oldR = rate(devices.filter((d) => now.getTime() - d.purchaseDate.getTime() >= 3 * YEAR).length);
  const utilization = rate(devices.filter((d) => d.status === 'ASSIGNED').length, live.length);
  // Sağlık puanı: arıza (ağır), garanti bitişi ve cihaz yaşı oranları ile düşer
  const score = n ? Math.round(Math.max(0, Math.min(100, 100 - faultyR * 150 - expiredR * 40 - oldR * 30))) : 100;

  const ageBuckets = [0, 0, 0, 0, 0, 0];
  devices.forEach((d) => (ageBuckets[Math.min(5, Math.max(0, Math.floor((now.getTime() - d.purchaseDate.getTime()) / YEAR)))]! += 1));

  const warrantyMonths = Array<number>(12).fill(0);
  live.forEach((d) => {
    if (d.warrantyEnd && d.warrantyEnd > now) {
      const m = Math.floor((d.warrantyEnd.getTime() - now.getTime()) / (30.4 * DAY));
      if (m < 12) warrantyMonths[m]! += 1;
    }
  });

  // Yenileme planı: 4 yaş ve üzeri cihazların 5. yaşını dolduracağı takvim yılı
  const renewal = new Map<number, number>();
  live.forEach((d) => {
    if (now.getTime() - d.purchaseDate.getTime() >= 4 * YEAR || d.purchaseDate.getTime() + 5 * YEAR < now.getTime() + 3 * YEAR) {
      const y = Math.max(now.getFullYear(), d.purchaseDate.getFullYear() + 5);
      renewal.set(y, (renewal.get(y) ?? 0) + 1);
    }
  });

  const status = { IN_STOCK: 0, ASSIGNED: 0, FAULTY: 0, RETIRED: 0 } as Record<string, number>;
  devices.forEach((d) => (status[d.status] = (status[d.status] ?? 0) + 1));

  const dept = new Map<string, number>();
  activeAssign.forEach((a) => dept.set(a.user.department ?? 'Belirtilmemiş', (dept.get(a.user.department ?? 'Belirtilmemiş') ?? 0) + 1));

  const key = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: process.env.APP_TZ ?? 'Europe/Istanbul' });
  const days = lastDays(30, now).map((d) => ({ date: d.key, assigned: 0, returned: 0 }));
  const idx = new Map(days.map((d) => [d.date, d]));
  assignRows.forEach((a) => {
    const e = idx.get(key(a.assignedAt));
    if (e) e.assigned++;
  });
  returnRows.forEach((a) => {
    const e = idx.get(key(a.returnedAt!));
    if (e) e.returned++;
  });

  return {
    type: opts.type ?? null,
    total: n,
    health: {
      score,
      grade: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'warning' : 'critical',
      utilization: Math.round(utilization * 100),
      faultyRate: Math.round(faultyR * 100),
      expiredWarrantyRate: Math.round(expiredR * 100),
      oldRate: Math.round(oldR * 100),
    },
    byType: byTypeAll.map((t) => ({ type: t.type, count: t._count._all })).sort((a, b) => b.count - a.count),
    status,
    ageBuckets,
    warrantyMonths,
    renewal: [...renewal.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
    byDepartment: [...dept.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    activity: days,
  };
}
