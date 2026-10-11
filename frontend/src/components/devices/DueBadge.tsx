import { fmtDate } from '@/lib/format';
import { Badge } from '@/components/ui/Misc';

/** Planlı iade tarihi göstergesi: gecikmiş (kırmızı), 3 gün içinde (turuncu), diğer (nötr). */
export function DueBadge({ dueAt, className }: { dueAt: string | null; className?: string }) {
  if (!dueAt) return null;
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 864e5);
  if (days < 0) return <Badge tone="danger" className={className}>{-days} gün gecikti</Badge>;
  return <Badge tone={days <= 3 ? 'warning' : 'neutral'} className={className}>İade: {fmtDate(dueAt)}</Badge>;
}
