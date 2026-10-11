import { motion } from 'framer-motion';
import { Cpu, Laptop, Monitor, Network, Printer, Server, Smartphone, Tablet, Tv, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { typeColor, typeLabel } from '@/lib/labels';
import type { DeviceType } from '@/lib/types';

interface Props {
  data: { type: DeviceType; count: number }[];
  selected: DeviceType | null;
  onSelect: (t: DeviceType | null) => void;
  height?: number | string;
}

const ICON: Record<string, LucideIcon> = {
  LAPTOP: Laptop,
  DESKTOP: Tv,
  SERVER: Server,
  MONITOR: Monitor,
  PRINTER: Printer,
  PHONE: Smartphone,
  TABLET: Tablet,
  NETWORK: Network,
};

/**
 * Cihaz türü kartları (ikon + adet + paydaki oran). Bir karta tıklamak sayfadaki diğer tüm
 * grafikleri o türe göre süzer (çapraz filtre); aynı karta tekrar tıklamak süzgeci kaldırır.
 */
export function TypeTreemap({ data, selected, onSelect, height = 230 }: Props) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((a, b) => a + b.count, 0) || 1;
  const max = sorted[0]?.count || 1;

  return (
    <div
      className={cn('grid content-start gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]', selected && '[&_button:not([data-sel=true])]:opacity-40')}
      style={{ minHeight: height === '100%' ? 230 : height }}
      role="group"
      aria-label="Cihaz türüne göre süz"
    >
      {sorted.map((t) => {
        const active = selected === t.type;
        const Icon = ICON[t.type] ?? Cpu;
        const color = typeColor(t.type);
        return (
          <motion.button
            key={t.type}
            type="button"
            data-sel={active}
            aria-pressed={active}
            aria-label={`${typeLabel(t.type)}: ${t.count} cihaz`}
            onClick={() => onSelect(active ? null : t.type)}
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            style={{ '--c': color } as React.CSSProperties}
            className={cn(
              'relative min-w-0 overflow-hidden rounded-xl border border-border bg-bg p-3.5 text-left outline-offset-2 transition-[opacity,border-color,box-shadow] hover:border-(--c)',
              active && 'border-(--teal) shadow-[0_0_0_2px_var(--teal)]',
            )}
          >
            <span className="absolute right-3 top-3 text-[11.5px] text-fg-subtle tabular-nums">{Math.round((t.count / total) * 100)}%</span>
            <span className="mb-3 grid size-9 place-items-center rounded-[10px] text-white" style={{ background: color }}>
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="block text-[26px] font-semibold leading-none tabular-nums">{t.count}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">{typeLabel(t.type)}</span>
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(t.count / max) * 100}%`, background: color }} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
