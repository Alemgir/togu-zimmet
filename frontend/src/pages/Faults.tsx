import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Download, LayoutGrid, List, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, useFault, useFaultBoard, useFaults, useUpdateFault } from '@/api/hooks';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDateTime, fromNow } from '@/lib/format';
import { faultNo, FAULT_LABEL, FAULT_TONE } from '@/lib/labels';
import { useDebounced } from '@/lib/useDebounced';
import { useListParams } from '@/lib/useListParams';
import type { FaultStatus, FaultTicket } from '@/lib/types';
import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';
import { Drawer, Modal } from '@/components/ui/Overlay';
import { Pagination } from '@/components/ui/Pagination';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { EventTimeline } from '@/components/EventTimeline';

const COLUMNS: { status: FaultStatus; hint: string; dot: string }[] = [
  { status: 'OPEN', hint: 'Yeni bildirilen arızalar', dot: 'bg-danger' },
  { status: 'IN_PROGRESS', hint: 'Servis / inceleme sürüyor', dot: 'bg-warning' },
  { status: 'RESOLVED', hint: 'Son 14 günde çözülenler', dot: 'bg-success' },
];

function TicketCard({ t, draggable, onOpen }: { t: FaultTicket; draggable: boolean; onOpen: () => void }) {
  // Not: Framer Motion "onDragStart" prop'unu kendi sürükleme hareketi için ayırdığından,
  // yerel HTML5 sürükle-bırak için düz bir iç öğe kullanılır; animasyon dış sarmalayıcıdadır.
  return (
    <motion.div layout>
      <div
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        className={cn('rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition hover:border-border-strong hover:shadow-md', draggable && 'cursor-grab active:cursor-grabbing')}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-fg-subtle">{faultNo(t.ticketNo)}</span>
          <span className="text-[11px] text-fg-subtle">{fromNow(t.createdAt)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <DeviceIcon type={t.device.type} size="sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold">{t.device.brand} {t.device.model}</p>
            <p className="font-mono text-[10.5px] text-fg-subtle">{t.device.assetTag}</p>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-fg-muted">{t.description}</p>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5 truncate">{t.reportedBy && <Avatar name={t.reportedBy.name} size={18} />}{t.reportedBy?.name ?? 'Sistem'}</span>
          {t.handledBy && <span className="truncate">→ {t.handledBy.name.split(' ')[0]}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function ResolveDialog({ ticket, onClose, onConfirm, loading }: { ticket: FaultTicket | null; onClose: () => void; onConfirm: (note: string) => void; loading: boolean }) {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [ticket]);
  return (
    <Modal open={!!ticket} onOpenChange={(o) => !o && onClose()} title="Arızayı çözüldü olarak işaretle" description={ticket ? `${faultNo(ticket.ticketNo)} · ${ticket.device.brand} ${ticket.device.model}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>Vazgeç</Button><Button variant="primary" loading={loading} onClick={() => onConfirm(note)}><Check className="size-4" />Çözüldü</Button></>}>
      <div className="space-y-4">
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">Kayıt çözülünce cihaz <b className="font-medium">otomatik olarak Depoya döner</b> ve yeniden zimmetlenebilir.</p>
        <Textarea label="Çözüm notu (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Anakart değiştirildi, test edildi" autoFocus />
      </div>
    </Modal>
  );
}

function TicketDrawer({ id, onClose, canEdit }: { id: string | null; onClose: () => void; canEdit: boolean }) {
  const { data } = useFault(id);
  const update = useUpdateFault();
  const [resolution, setResolution] = useState('');
  const t = data?.ticket;
  useEffect(() => setResolution(t?.resolution ?? ''), [t?.id, t?.resolution]);

  const setStatus = (status: FaultStatus) =>
    update.mutate({ id: t!.id, status, resolution: status === 'RESOLVED' ? resolution || undefined : undefined }, {
      onSuccess: () => toast.success(`Durum: ${FAULT_LABEL[status]}`, { description: status === 'RESOLVED' ? 'Cihaz otomatik olarak Depoya döndü' : undefined }),
    });

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()} title={t ? faultNo(t.ticketNo) : 'Arıza kaydı'} description={t ? `${t.device.brand} ${t.device.model} · ${t.device.assetTag}` : undefined}>
      {!t ? <Skeleton className="h-40" /> : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={FAULT_TONE[t.status]} dot>{FAULT_LABEL[t.status]}</Badge>
            <Link to={`/devices/${t.device.id}`} className="text-sm font-medium text-accent hover:underline">Cihaz sayfası →</Link>
          </div>
          <section>
            <h3 className="mb-1.5 text-[13px] font-medium text-fg-muted">Arıza açıklaması</h3>
            <p className="rounded-xl bg-surface-2 p-3 text-sm">{t.description}</p>
            <p className="mt-2 text-xs text-fg-subtle">{t.reportedBy ? `${t.reportedBy.name}${t.reportedBy.department ? ` · ${t.reportedBy.department}` : ''}` : 'Sistem'} · {fmtDateTime(t.createdAt)}</p>
          </section>
          {canEdit ? (
            <section className="space-y-3">
              <h3 className="text-[13px] font-medium text-fg-muted">Durum</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['OPEN', 'IN_PROGRESS', 'RESOLVED'] as FaultStatus[]).map((s) => (
                  <button key={s} disabled={update.isPending} onClick={() => s !== t.status && setStatus(s)} className={cn('rounded-xl border p-2.5 text-center text-xs font-semibold transition', t.status === s ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>
                    {FAULT_LABEL[s]}
                  </button>
                ))}
              </div>
              <Textarea label="Çözüm notu" value={resolution} onChange={(e) => setResolution(e.target.value)} onBlur={() => resolution !== (t.resolution ?? '') && update.mutate({ id: t.id, resolution })} placeholder="Yapılan işlem, değişen parça…" />
              {t.handledBy && <p className="text-xs text-fg-subtle">İlgilenen: {t.handledBy.name}</p>}
            </section>
          ) : t.resolution ? (
            <section><h3 className="mb-1.5 text-[13px] font-medium text-fg-muted">Çözüm</h3><p className="rounded-xl bg-success/10 p-3 text-sm">{t.resolution}</p></section>
          ) : null}
          <section>
            <h3 className="mb-3 text-[13px] font-medium text-fg-muted">Süreç</h3>
            <EventTimeline items={(data?.events ?? []).map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actor: e.actor?.name }))} />
          </section>
        </div>
      )}
    </Drawer>
  );
}

export default function Faults() {
  const { isAdmin, isManager } = useAuth();
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const update = useUpdateFault();
  const [view, setView] = useState<'board' | 'list'>(isManager ? 'board' : 'list');
  const [over, setOver] = useState<FaultStatus | null>(null);
  const [pendingResolve, setPendingResolve] = useState<FaultTicket | null>(null);
  const ticketId = sp.get('ticket');
  const openTicket = (id: string | null) => setSp((p) => { const n = new URLSearchParams(p); id ? n.set('ticket', id) : n.delete('ticket'); return n; }, { replace: true });

  const board = useFaultBoard();
  const p = useListParams({ status: '' });
  const [search, setSearch] = useState(p.get('search'));
  const dSearch = useDebounced(search, 300);
  useEffect(() => {
    if (dSearch !== p.get('search')) p.set({ search: dSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch]);
  const list = useFaults({ page: p.page, pageSize: 12, status: p.get('status'), search: p.get('search') });

  const move = (id: string, status: FaultStatus) => {
    const all = Object.values(board.data ?? {}).flat();
    const t = all.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (status === 'RESOLVED') return setPendingResolve(t);
    // İyimser güncelleme: kart anında yeni sütuna geçer
    qc.setQueryData<Record<FaultStatus, FaultTicket[]>>(['fault-board'], (old) => {
      if (!old) return old;
      const next = { OPEN: [...old.OPEN], IN_PROGRESS: [...old.IN_PROGRESS], RESOLVED: [...old.RESOLVED] };
      next[t.status] = next[t.status].filter((x) => x.id !== id);
      next[status] = [{ ...t, status }, ...next[status]];
      return next;
    });
    update.mutate({ id, status }, { onSuccess: () => toast.success(`${faultNo(t.ticketNo)} → ${FAULT_LABEL[status]}`), onError: (e) => { toast.error(errorMessage(e)); qc.invalidateQueries({ queryKey: ['fault-board'] }); } });
  };

  const confirmResolve = (note: string) =>
    update.mutate({ id: pendingResolve!.id, status: 'RESOLVED', resolution: note.trim() || undefined }, {
      onSuccess: () => { toast.success(`${faultNo(pendingResolve!.ticketNo)} çözüldü`, { description: 'Cihaz otomatik olarak Depoya döndü' }); setPendingResolve(null); },
      onError: () => setPendingResolve(null),
    });

  return (
    <div>
      <PageHeader
        title="Arızalar"
        description={isManager ? 'Arıza ve bakım kayıtları: bildirimden çözüme kadar tüm süreç' : 'Bildirdiğiniz arıza kayıtları'}
        actions={
          <>
            {isManager && (
              <div className="inline-flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Görünüm">
                {([['board', 'Pano', LayoutGrid], ['list', 'Liste', List]] as const).map(([v, l, Icon]) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition', view === v ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')}><Icon className="size-3.5" />{l}</button>
                ))}
              </div>
            )}
            {isManager && <Button onClick={() => downloadFile('/exports/faults').then((n) => toast.success('Dışa aktarıldı', { description: n })).catch((e) => toast.error(errorMessage(e)))}><Download className="size-4" />CSV</Button>}
          </>
        }
      />

      {view === 'board' && isManager ? (
        board.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map(({ status, hint, dot }) => {
              const items = board.data?.[status] ?? [];
              return (
                <div
                  key={status}
                  onDragOver={(e) => { if (isAdmin) { e.preventDefault(); setOver(status); } }}
                  onDragLeave={() => setOver((o) => (o === status ? null : o))}
                  onDrop={(e) => { e.preventDefault(); setOver(null); if (isAdmin) move(e.dataTransfer.getData('text/plain'), status); }}
                  className={cn('flex min-h-[320px] flex-col rounded-2xl border border-border bg-surface-2/50 p-3 transition-colors', over === status && 'border-teal bg-accent-soft')}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-semibold"><i className={cn('size-2 rounded-full', dot)} />{FAULT_LABEL[status]}</h2>
                      <p className="text-[11px] text-fg-subtle">{hint}</p>
                    </div>
                    <span className="rounded-lg bg-fg/6 px-2 py-0.5 text-xs font-semibold tabular-nums">{items.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5">
                    {items.map((t) => <TicketCard key={t.id} t={t} draggable={isAdmin} onOpen={() => openTicket(t.id)} />)}
                    {items.length === 0 && <p className="m-auto py-10 text-center text-xs text-fg-subtle">{isAdmin ? 'Buraya kart sürükleyin' : 'Kayıt yok'}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex gap-1.5">
              {[['', 'Tümü'], ['OPEN', 'Açık'], ['IN_PROGRESS', 'İnceleniyor'], ['RESOLVED', 'Çözüldü']].map(([v, l]) => (
                <button key={v} onClick={() => p.set({ status: v })} className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition', p.get('status') === v ? 'border-transparent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>{l}</button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cihaz veya açıklama ara…" aria-label="Arıza ara" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40" />
            </div>
          </div>
          {list.isLoading ? <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> : !list.data?.data.length ? (
            <EmptyState icon={<Wrench className="size-6" />} title="Arıza kaydı yok" description="Bildirilen arızalar burada listelenir." />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {list.data.data.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => openTicket(t.id)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 p-4 text-left transition hover:bg-surface-hover/60">
                      <DeviceIcon type={t.device.type} />
                      <span className="min-w-[200px] flex-1 leading-tight"><span className="block truncate font-medium">{t.device.brand} {t.device.model}</span><span className="font-mono text-[11px] text-fg-subtle">{faultNo(t.ticketNo)} · {t.device.assetTag}</span></span>
                      <span className="line-clamp-1 min-w-[160px] flex-1 text-sm text-fg-muted">{t.description}</span>
                      <span className="text-xs text-fg-subtle">{fromNow(t.createdAt)}</span>
                      <Badge tone={FAULT_TONE[t.status]} dot>{FAULT_LABEL[t.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={list.data.meta.page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} pageSize={list.data.meta.pageSize} onPage={(n) => p.set({ page: n })} />
            </>
          )}
        </Card>
      )}

      <TicketDrawer id={ticketId} onClose={() => openTicket(null)} canEdit={isAdmin} />
      <ResolveDialog ticket={pendingResolve} onClose={() => setPendingResolve(null)} onConfirm={confirmResolve} loading={update.isPending} />
    </div>
  );
}
