import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Boxes, Download, FilterX, Plus, QrCode, RotateCcw, Search, Tags, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, useDeviceMeta, useDepartments, useDevices, useDashboard } from '@/api/hooks';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useListParams } from '@/lib/useListParams';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import { fmtDate, warrantyState } from '@/lib/format';
import { STATUSES, STATUS_LABEL, typeLabel } from '@/lib/labels';
import type { Device, DeviceStatus } from '@/lib/types';
import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Combobox } from '@/components/ui/Combobox';
import { typeOptions } from '@/lib/deviceTypes';
import { Pagination } from '@/components/ui/Pagination';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { DueBadge } from '@/components/devices/DueBadge';
import { AssignDialog, BulkAssignDialog, BulkStatusDialog, DeviceFormDrawer, ReturnDialog } from '@/components/devices/DeviceDialogs';

const PAGE_SIZE = 10;
const SORTS = [
  { v: 'createdAt:desc', l: 'En yeni eklenen' },
  { v: 'assetTag:asc', l: 'Demirbaş no (A→Z)' },
  { v: 'brand:asc', l: 'Marka (A→Z)' },
  { v: 'purchaseDate:desc', l: 'Alım tarihi (yeni)' },
  { v: 'purchaseDate:asc', l: 'Alım tarihi (eski)' },
];

function Holder({ d }: { d: Device }) {
  if (!d.holder) return <span className="text-fg-subtle">—</span>;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={d.holder.name} size={28} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{d.holder.name}</p>
        <p className="truncate text-xs text-fg-subtle">{d.holder.department ?? '—'}</p>
        <DueBadge dueAt={d.dueAt} className="mt-1" />
      </div>
    </div>
  );
}

function Warranty({ d }: { d: Device }) {
  const w = warrantyState(d.warrantyEnd);
  return d.warrantyEnd ? <Badge tone={w.tone}>{w.label}</Badge> : <span className="text-fg-subtle">—</span>;
}

export default function Devices() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const p = useListParams({ sort: 'createdAt:desc' });
  const [search, setSearch] = useState(p.get('search'));
  const dSearch = useDebounced(search, 300);
  const [formOpen, setFormOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Device | null>(null);
  const [returnFor, setReturnFor] = useState<Device | null>(null);
  const [sel, setSel] = useState<Map<string, Device>>(new Map());
  const [bulk, setBulk] = useState<null | 'assign' | 'status'>(null);

  useEffect(() => {
    if (dSearch !== p.get('search')) p.set({ search: dSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch]);

  const [sortBy, sortDir] = p.get('sort').split(':');
  const query = {
    page: p.page, pageSize: PAGE_SIZE, search: p.get('search'), status: p.get('status'), type: p.get('type'), brand: p.get('brand'),
    department: p.get('department'), warrantyExpiring: p.get('warrantyExpiring'), stale: p.get('stale'), overdue: p.get('overdue'), sortBy, sortDir,
  };
  const { data, isLoading, isFetching, isError } = useDevices(query);
  const totals = useDashboard().data?.totals;
  const meta = useDeviceMeta().data;
  const departments = useDepartments().data ?? [];
  const status = p.get('status') as DeviceStatus | '';
  const counts: Record<string, number | undefined> = totals ? { '': totals.devices, ASSIGNED: totals.assigned, IN_STOCK: totals.inStock, FAULTY: totals.faulty, RETIRED: totals.retired } : {};
  const special = [p.get('warrantyExpiring') && 'Garantisi 90 gün içinde bitenler', p.get('stale') && '60+ gündür depoda hareketsiz', p.get('overdue') && 'Planlı iadesi geçmiş'].filter(Boolean) as string[];
  const filtered = !!(p.get('search') || p.get('status') || p.get('type') || p.get('brand') || p.get('department') || special.length);

  const rows = data?.data ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (d: Device) => setSel((m) => { const n = new Map(m); n.has(d.id) ? n.delete(d.id) : n.set(d.id, d); return n; });
  const togglePage = () => setSel((m) => { const n = new Map(m); allOnPage ? rows.forEach((r) => n.delete(r.id)) : rows.forEach((r) => n.set(r.id, r)); return n; });
  const selected = useMemo(() => [...sel.values()], [sel]);
  const clearSel = () => setSel(new Map());

  const exportCsv = () => downloadFile('/exports/devices', { search: query.search, status: query.status, type: query.type, brand: query.brand, department: query.department, warrantyExpiring: query.warrantyExpiring, stale: query.stale, overdue: query.overdue })
    .then((n) => toast.success('Dışa aktarıldı', { description: `${n} — Excel ile açılır` })).catch((e) => toast.error(errorMessage(e)));

  const rowActions = (d: Device) => isAdmin && (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {d.status === 'IN_STOCK' && <Button size="sm" variant="soft" onClick={() => setAssignFor(d)}><UserPlus className="size-3.5" />Zimmetle</Button>}
      {d.status === 'ASSIGNED' && <Button size="sm" variant="secondary" onClick={() => setReturnFor(d)}><RotateCcw className="size-3.5" />İade al</Button>}
    </div>
  );

  const checkbox = (d: Device) => (
    <input type="checkbox" aria-label={`${d.assetTag} seç`} checked={sel.has(d.id)} onChange={() => toggle(d)} onClick={(e) => e.stopPropagation()} className="size-4 cursor-pointer rounded border-border-strong accent-[var(--accent)]" />
  );

  return (
    <div>
      <PageHeader
        title="Envanter"
        description={isAdmin ? 'Kurumdaki tüm cihazlar, durumları ve zimmetli oldukları kişiler' : 'Biriminizdeki zimmetli cihazlar'}
        actions={
          <>
            <Button onClick={exportCsv}><Download className="size-4" />CSV</Button>
            {isAdmin && <Button variant="primary" onClick={() => setFormOpen(true)}><Plus className="size-4" />Yeni cihaz</Button>}
          </>
        }
      />

      {isAdmin && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Duruma göre filtrele">
          {[{ v: '', l: 'Tümü' }, ...STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] }))].map(({ v, l }) => {
            const active = status === v;
            return (
              <button key={v} role="tab" aria-selected={active} onClick={() => p.set({ status: v })} className={cn('relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors', active ? 'text-accent' : 'text-fg-muted hover:bg-surface-hover')}>
                {active && <motion.span layoutId="status-tab" className="absolute inset-0 rounded-xl bg-accent-soft" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="relative">{l}</span>
                {counts[v] !== undefined && <span className={cn('relative rounded-md px-1.5 text-xs tabular-nums', active ? 'bg-accent/15' : 'bg-fg/6 text-fg-subtle')}>{counts[v]}</span>}
              </button>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="relative col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Marka, model, seri no, kişi…" aria-label="Cihaz ara" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40" />
          </div>
          <Combobox aria-label="Tür" value={p.get('type')} onChange={(v) => p.set({ type: v })} options={typeOptions(meta?.types)} allowCreate={false} clearLabel="Tüm türler" />
          <Combobox aria-label="Marka" value={p.get('brand')} onChange={(v) => p.set({ brand: v })} options={meta?.brands ?? []} allowCreate={false} clearLabel="Tüm markalar" />
          <Combobox aria-label="Birim" value={p.get('department')} onChange={(v) => p.set({ department: v })} options={departments} allowCreate={false} clearLabel="Tüm birimler" />
          <Select aria-label="Sırala" value={p.get('sort')} onChange={(e) => p.set({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </Select>
        </div>
        {filtered && (
          <div className="flex items-center justify-between gap-3 border-b border-border bg-accent-soft/50 px-4 py-2 text-xs">
            <span className="flex flex-wrap items-center gap-2 text-fg-muted">
              {special.map((s) => <Badge key={s} tone="warning">{s}</Badge>)}
              {data ? `${data.meta.total} sonuç` : ''}
            </span>
            <button onClick={() => { setSearch(''); p.clear(); }} className="flex shrink-0 items-center gap-1.5 font-medium text-accent hover:underline"><FilterX className="size-3.5" />Filtreleri temizle</button>
          </div>
        )}

        {isError ? (
          <EmptyState icon={<Boxes className="size-6" />} title="Liste yüklenemedi" description="Bağlantınızı kontrol edip tekrar deneyin." />
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Boxes className="size-6" />} title={filtered ? 'Eşleşen cihaz yok' : 'Henüz cihaz eklenmemiş'} description={filtered ? 'Arama veya filtreleri değiştirmeyi deneyin.' : 'İlk cihazı ekleyerek envanteri oluşturmaya başlayın.'}
            action={filtered ? <Button onClick={() => { setSearch(''); p.clear(); }}>Filtreleri temizle</Button> : isAdmin ? <Button variant="primary" onClick={() => setFormOpen(true)}><Plus className="size-4" />Cihaz ekle</Button> : undefined} />
        ) : (
          <>
            <div className={cn('hidden overflow-x-auto transition-opacity md:block', isFetching && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-fg-subtle">
                    <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Sayfadakilerin tümünü seç" checked={allOnPage} onChange={togglePage} className="size-4 cursor-pointer rounded accent-[var(--accent)]" /></th>
                    <th className="px-2 py-3">Cihaz</th><th className="px-4 py-3">Seri no</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Zimmetli</th><th className="px-4 py-3">Alım</th><th className="px-4 py-3">Garanti</th><th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((d, i) => (
                      <motion.tr key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} onClick={() => navigate(`/devices/${d.id}`)} className={cn('group cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-surface-hover', sel.has(d.id) && 'bg-accent-soft/60')}>
                        <td className="px-4 py-3">{checkbox(d)}</td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <DeviceIcon type={d.type} />
                            <div className="min-w-0 leading-tight">
                              <Link to={`/devices/${d.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:text-accent">{d.brand} {d.model}</Link>
                              <span className="font-mono text-[11px] text-fg-subtle">{d.assetTag} · {typeLabel(d.type)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-fg-muted">{d.serialNumber}</td>
                        <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                        <td className="px-4 py-3"><Holder d={d} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{fmtDate(d.purchaseDate)}</td>
                        <td className="px-4 py-3"><Warranty d={d} /></td>
                        <td className="px-4 py-3">{rowActions(d)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-border md:hidden', isFetching && 'opacity-60')}>
              {rows.map((d) => (
                <li key={d.id} onClick={() => navigate(`/devices/${d.id}`)} className={cn('space-y-3 p-4 active:bg-surface-hover', sel.has(d.id) && 'bg-accent-soft/60')}>
                  <div className="flex items-start gap-3">
                    {checkbox(d)}
                    <DeviceIcon type={d.type} />
                    <div className="min-w-0 flex-1 leading-tight"><p className="truncate font-medium">{d.brand} {d.model}</p><p className="font-mono text-[11px] text-fg-subtle">{d.assetTag}</p></div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3"><Holder d={d} />{rowActions(d)}</div>
                </li>
              ))}
            </ul>
            {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPage={(n) => p.set({ page: n })} />}
          </>
        )}
      </Card>

      {/* Toplu işlem çubuğu */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="fixed inset-x-3 bottom-[6.75rem] z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-border-strong bg-surface p-2.5 shadow-lg lg:bottom-6 lg:left-[calc(16rem+0.75rem)]" role="toolbar" aria-label="Toplu işlemler">
            <span className="flex items-center gap-2 px-2 text-sm font-semibold"><QrCode className="size-4 text-accent" />{selected.length} cihaz seçili</span>
            {isAdmin && <Button size="sm" variant="primary" onClick={() => setBulk('assign')}><UserPlus className="size-3.5" />Zimmetle</Button>}
            {isAdmin && <Button size="sm" onClick={() => setBulk('status')}>Durum</Button>}
            <Button size="sm" onClick={() => navigate(`/etiketler?ids=${selected.map((d) => d.id).join(',')}`)}><Tags className="size-3.5" />Etiket yazdır</Button>
            <Button size="sm" variant="ghost" onClick={clearSel} aria-label="Seçimi temizle"><X className="size-3.5" /></Button>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdmin && <DeviceFormDrawer open={formOpen} onOpenChange={setFormOpen} />}
      {isAdmin && <AssignDialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)} device={assignFor} />}
      {isAdmin && <ReturnDialog open={!!returnFor} onOpenChange={(o) => !o && setReturnFor(null)} device={returnFor} />}
      <BulkAssignDialog open={bulk === 'assign'} onOpenChange={(o) => !o && setBulk(null)} devices={selected} onDone={clearSel} />
      <BulkStatusDialog open={bulk === 'status'} onOpenChange={(o) => !o && setBulk(null)} devices={selected} onDone={clearSel} />
    </div>
  );
}
