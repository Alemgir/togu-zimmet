import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({ page, totalPages, total, pageSize, onPage }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-fg-muted">
      <span>
        <b className="font-medium text-fg">{from}–{to}</b> / {total} kayıt
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Önceki sayfa">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-20 text-center tabular-nums">{page} / {totalPages}</span>
        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Sonraki sayfa">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
