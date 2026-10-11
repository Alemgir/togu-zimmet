import type { NotificationType } from '@prisma/client';
import { prisma, type Tx } from '../db.js';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Aynı kullanıcıya aynı anahtarla ikinci bildirim üretilmez */
  dedupeKey?: string;
}

export async function notifyUsers(db: Tx, userIds: string[], n: NotifyInput) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification.createMany({
    data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null })),
    skipDuplicates: true,
  });
}

export const adminIds = async (db: Tx) => (await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })).map((u) => u.id);

export const managerIds = async (db: Tx, department?: string | null) =>
  department ? (await db.user.findMany({ where: { role: 'UNIT_MANAGER', isActive: true, department }, select: { id: true } })).map((u) => u.id) : [];

/** Yöneticilere ve (varsa) ilgili birimin sorumlusuna bildirim gönderir. */
export async function notifyOversight(db: Tx, department: string | null | undefined, n: NotifyInput, exclude: string[] = []) {
  const ids = [...(await adminIds(db)), ...(await managerIds(db, department))].filter((id) => !exclude.includes(id));
  await notifyUsers(db, ids, n);
}

const DAY = 864e5;
let lastRun = 0;

/**
 * Zamana bağlı uyarılar: garanti bitişi (30 gün), planlı iade yaklaşıyor (3 gün), iade gecikmiş.
 * Tekrarlı çağrılar güvenlidir (dedupeKey).
 */
export async function runScheduledChecks(now = new Date()) {
  lastRun = now.getTime();
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR');
  await prisma.$transaction(async (tx) => {
    const warranty = await tx.device.findMany({
      where: { status: { not: 'RETIRED' }, warrantyEnd: { gte: now, lte: new Date(now.getTime() + 30 * DAY) } },
      include: { assignments: { where: { returnedAt: null }, take: 1, include: { user: { select: { department: true } } } } },
    });
    for (const d of warranty) {
      await notifyOversight(tx, d.assignments[0]?.user.department, {
        type: 'WARRANTY_EXPIRING',
        title: 'Garanti bitiyor',
        body: `${d.brand} ${d.model} (${d.assetTag}) garantisi ${fmt(d.warrantyEnd!)} tarihinde bitiyor`,
        link: `/devices/${d.id}`,
        dedupeKey: `w30:${d.id}:${d.warrantyEnd!.toISOString().slice(0, 10)}`,
      });
    }

    const active = await tx.assignment.findMany({
      where: { returnedAt: null, dueAt: { not: null, lte: new Date(now.getTime() + 3 * DAY) } },
      include: { device: { select: { id: true, brand: true, model: true, assetTag: true } }, user: { select: { id: true, name: true, department: true } } },
    });
    for (const a of active) {
      const label = `${a.device.brand} ${a.device.model} (${a.device.assetTag})`;
      if (a.dueAt! < now) {
        const n: NotifyInput = {
          type: 'ASSIGNMENT_OVERDUE',
          title: 'İade gecikmesi',
          body: `${a.user.name} · ${label} için planlı iade tarihi (${fmt(a.dueAt!)}) geçti`,
          link: `/devices/${a.device.id}`,
          dedupeKey: `overdue:${a.id}:${a.dueAt!.toISOString().slice(0, 10)}`,
        };
        await notifyUsers(tx, [a.user.id], { ...n, body: `${label} için planlı iade tarihi (${fmt(a.dueAt!)}) geçti. Lütfen iade edin` });
        await notifyOversight(tx, a.user.department, n, [a.user.id]);
      } else {
        await notifyUsers(tx, [a.user.id], {
          type: 'ASSIGNMENT_DUE',
          title: 'İade tarihi yaklaşıyor',
          body: `${label} için planlı iade tarihi ${fmt(a.dueAt!)}`,
          link: `/devices/${a.device.id}`,
          dedupeKey: `due3:${a.id}:${a.dueAt!.toISOString().slice(0, 10)}`,
        });
      }
    }
  });
}

/** Uç nokta çağrılarında en fazla 5 dakikada bir tetiklenir (ayrıca saatlik zamanlayıcı da çalışır). */
export async function runChecksThrottled() {
  if (Date.now() - lastRun < 5 * 60_000) return;
  await runScheduledChecks();
}

export function startScheduler(log: { error: (e: unknown) => void }) {
  const tick = () => runScheduledChecks().catch(log.error);
  tick();
  const t = setInterval(tick, 60 * 60_000);
  t.unref();
  return t;
}
