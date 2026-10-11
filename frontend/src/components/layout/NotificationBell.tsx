import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, BellOff, CalendarClock, CheckCheck, RotateCcw, ShieldAlert, UserCheck, Wrench, type LucideIcon } from 'lucide-react';
import { useNotificationActions, useNotifications } from '@/api/hooks';
import { cn } from '@/lib/cn';
import { fromNow } from '@/lib/format';
import type { NotificationType } from '@/lib/types';
import { Button } from '@/components/ui/Button';

const META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  FAULT_REPORTED: { icon: AlertTriangle, tone: 'bg-danger/12 text-danger' },
  FAULT_UPDATED: { icon: Wrench, tone: 'bg-info/12 text-info' },
  ASSIGNED: { icon: UserCheck, tone: 'bg-success/12 text-success' },
  RETURNED: { icon: RotateCcw, tone: 'bg-accent-soft text-accent' },
  WARRANTY_EXPIRING: { icon: ShieldAlert, tone: 'bg-warning/15 text-warning' },
  ASSIGNMENT_DUE: { icon: CalendarClock, tone: 'bg-warning/15 text-warning' },
  ASSIGNMENT_OVERDUE: { icon: CalendarClock, tone: 'bg-danger/12 text-danger' },
};

export function NotificationBell() {
  const { data } = useNotifications();
  const { markRead, readAll } = useNotificationActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = data?.unread ?? 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}>
          <motion.span key={unread} animate={unread ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.6 }}>
            <Bell className="size-[18px]" />
          </motion.span>
          <AnimatePresence>
            {unread > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-1 top-1 flex min-w-[17px] items-center justify-center rounded-full border-2 border-bg bg-danger px-1 text-[10px] font-bold leading-[13px] text-white dark:text-[#2a0a14]">
                {unread > 99 ? '99+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Bildirimler</h2>
            <button disabled={!unread} onClick={() => readAll.mutate()} className="flex items-center gap-1.5 text-xs font-medium text-accent transition disabled:opacity-40">
              <CheckCheck className="size-3.5" /> Tümünü okundu yap
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {!data?.data.length ? (
              <div className="flex flex-col items-center px-6 py-12 text-center text-sm text-fg-muted">
                <BellOff className="mb-2 size-6 text-fg-subtle" />
                Henüz bildirim yok
              </div>
            ) : (
              data.data.map((n) => {
                const { icon: Icon, tone } = META[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className="relative flex w-full gap-3 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-surface-hover"
                  >
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px]', n.readAt ? 'font-medium text-fg-muted' : 'font-semibold')}>{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-fg-subtle">{fromNow(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" aria-label="Okunmadı" />}
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
