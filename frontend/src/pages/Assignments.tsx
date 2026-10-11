import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ClipboardList, Download, FileText, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, useAssignments } from '@/api/hooks';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListParams } from '@/lib/useListParams';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { RETURN_REASON_LABEL } from '@/lib/labels';
import type { AssignmentRecord } from '@/lib/types';
import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { DueBadge } from '@/components/devices/DueBadge';
import { AssignDialog, ReturnDialog, type ReturnTarget } from '@/components/devices/DeviceDialogs';

const TABS = [
  { v: 'active', l: 'Aktif zimmetler' },
  { v: 'overdue', l: 'Gecikmiş' },
  { v: 'returned', l: 'Geçmiş' },
  { v: 'all', l: 'Tümü' },
];

export default function Assignments() {
  const { isAdmin } = useAuth();
  const p = useListParams({ state: 'active' });
  const [search, setSearch] = useState(p.get('search'));
  const dSearch = useDebounced(search, 300);
  const [assignOpen, setAssignOpen] = useState(false);
  const [ret, setRet] = useState<ReturnTarget | null>(null);
  useEffect(() => {
    if (dSearch !== p.get('search')) p.set({ search: dSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch]);

  const state = p.get('state');
  const { data, isLoading, isFetching } = useAssignments({ page: p.page, pageSize: 12, state: state === 'overdue' ? 'active' : state, overdue: state === 'overdue' ? 'true' : undefined, search: p.get('search') });

  const returnTarget = (a: AssignmentRecord): ReturnTarget => ({ id: a.device!.id, brand: a.device!.brand, model: a.device!.model, holder: { name: a.user.name } });

  return (
    <div>
      <PageHeader title="Zimmetler" description="Tüm zimmet hareketleri ve iade geçmişi" actions={<><Button onClick={() => downloadFile('/exports/assignments', { state: state === 'overdue' ? 'active' : state }).then((n) => toast.success('Dışa aktarıldı', { description: n })).catch((e) => toast.error(errorMessage(e)))}><Download className="size-4" />CSV</Button>{isAdmin && <Button variant="primary" onClick={() => setAssignOpen(true)}><Plus className="size-4" />Yeni zimmet</Button>}</>} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist">
          {TABS.map(({ v, l }) => (
            <button key={v} role="tab" aria-selected={state === v} onClick={() => p.set({ state: v })} className={cn('relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors', state === v ? 'text-accent' : 'text-fg-muted hover:bg-surface-hover')}>
              {state === v && <motion.span layoutId="asg-tab" className="absolute inset-0 rounded-xl bg-accent-soft" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kişi veya cihaz ara…" aria-label="Zimmet ara" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<ClipboardList className="size-6" />} title="Kayıt bulunamadı" description={state === 'active' ? 'Şu an aktif zimmet yok.' : 'Bu görünümde hareket yok.'} />
        ) : (
          <>
            <ul className={cn('divide-y divide-border transition-opacity', isFetching && 'opacity-60')}>
              {data.data.map((a, i) => (
                <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 transition hover:bg-surface-hover/60">
                  <Link to={`/devices/${a.device!.id}`} className="flex min-w-[220px] flex-1 items-center gap-3">
                    <DeviceIcon type={a.device!.type} />
                    <span className="min-w-0 leading-tight"><span className="block truncate font-medium hover:text-accent">{a.device!.brand} {a.device!.model}</span><span className="font-mono text-[11px] text-fg-subtle">{a.device!.assetTag}</span></span>
                  </Link>
                  <ArrowRight className="hidden size-4 text-fg-subtle lg:block" />
                  <div className="flex min-w-[200px] flex-1 items-center gap-3">
                    <Avatar name={a.user.name} size={34} />
                    <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-medium">{a.user.name}</span><span className="block truncate text-xs text-fg-subtle">{a.user.department ?? '—'}</span></span>
                  </div>
                  <div className="min-w-[170px] text-xs text-fg-muted">
                    <p>Verildi: <b className="font-medium text-fg">{fmtDateTime(a.assignedAt)}</b></p>
                    <p>{a.returnedAt ? <>İade: <b className="font-medium text-fg">{fmtDateTime(a.returnedAt)}</b></> : <span className="text-fg-subtle">Veren: {a.assignedBy.name}</span>}</p>
                    {!a.returnedAt && <DueBadge dueAt={a.dueAt} className="mt-1" />}
                  </div>
                  <div className="flex min-w-[170px] items-center justify-end gap-2">
                    {a.returnedAt ? <Badge tone="neutral">{a.returnReason ? RETURN_REASON_LABEL[a.returnReason] : 'İade'}</Badge> : (
                      <>
                        <Badge tone="success" dot>Aktif</Badge>
                        {isAdmin && <Button size="sm" onClick={() => setRet(returnTarget(a))}><RotateCcw className="size-3.5" />İade al</Button>}
                      </>
                    )}
                    <Link to={`/tutanak/${a.id}`} aria-label="Tutanak" title="Tutanak" className="flex size-8 items-center justify-center rounded-lg text-fg-subtle transition hover:bg-surface-hover hover:text-accent"><FileText className="size-4" /></Link>
                  </div>
                </motion.li>
              ))}
            </ul>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPage={(n) => p.set({ page: n })} />
          </>
        )}
      </Card>

      {isAdmin && <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} />}
      {isAdmin && <ReturnDialog open={!!ret} onOpenChange={(o) => !o && setRet(null)} device={ret} />}
    </div>
  );
}
