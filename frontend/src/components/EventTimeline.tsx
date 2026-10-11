import { ArrowLeftRight, Box, Pencil, RotateCcw, TriangleAlert, UserCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fromNow } from '@/lib/format';
import type { EventType } from '@/lib/types';

export const EVENT_META: Record<EventType, { icon: LucideIcon; tone: string }> = {
  CREATED: { icon: Box, tone: 'bg-info/12 text-info' },
  UPDATED: { icon: Pencil, tone: 'bg-fg/8 text-fg-muted' },
  ASSIGNED: { icon: UserCheck, tone: 'bg-success/12 text-success' },
  RETURNED: { icon: RotateCcw, tone: 'bg-accent-soft text-accent' },
  STATUS_CHANGED: { icon: ArrowLeftRight, tone: 'bg-warning/15 text-warning' },
  FAULT_REPORTED: { icon: TriangleAlert, tone: 'bg-danger/12 text-danger' },
};

export function EventIcon({ type, className }: { type: EventType; className?: string }) {
  const { icon: Icon, tone } = EVENT_META[type];
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone, className)}>
      <Icon className="size-4" />
    </span>
  );
}

export interface TimelineItem {
  id: string;
  type: EventType;
  message: string;
  createdAt: string;
  actor?: string | null;
  title?: string;
}

export function EventTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-5">
      <span aria-hidden className="absolute bottom-2 left-4 top-2 w-px bg-border" />
      {items.map((e) => (
        <li key={e.id} className="relative flex gap-3">
          <EventIcon type={e.type} className="relative ring-4 ring-surface" />
          <div className="min-w-0 flex-1 pt-0.5">
            {e.title && <p className="truncate text-xs font-medium text-fg-subtle">{e.title}</p>}
            <p className="text-sm text-fg">{e.message}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {e.actor ? `${e.actor} · ` : ''}
              {fromNow(e.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
