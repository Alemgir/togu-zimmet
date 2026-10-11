import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Boxes, CheckCircle2, Clock, PackageOpen, Plus, QrCode, ShieldAlert, UserCheck, UserPlus, Wrench, X, BarChart3, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useDashboard, useRemind } from '@/api/hooks';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fromNow } from '@/lib/format';
import { faultNo, typeLabel } from '@/lib/labels';
import type { DeviceType } from '@/lib/types';
import { Badge, Card, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { CountUp } from '@/components/ui/CountUp';
import { Sparkline } from '@/components/charts/Sparkline';
import { TypeTreemap } from '@/components/charts/TypeTreemap';
import { EventTimeline } from '@/components/EventTimeline';
import { AssignDialog, DeviceFormDrawer, DueDialog } from '@/components/devices/DeviceDialogs';

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12, color: 'var(--fg)' };

type Kind = 'all' | 'fault' | 'warranty' | 'overdue' | 'stale';

interface AttentionItem {
  key: string;
  kind: Exclude<Kind, 'all'>;
  icon: LucideIcon;
  tone: string;
  title: string;
  meta: string;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
}

function Delta({ v, goodWhenUp = true }: { v: number; goodWhenUp?: boolean }) {
  if (v === 0) return <span className="rounded-full bg-fg/6 px-2 py-0.5 text-[11.5px] font-semibold text-fg-muted">0</span>;
  const good = (v > 0) === goodWhenUp;
  return <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums', good ? 'bg-success/14 text-success' : 'bg-danger/12 text-danger')}>{v > 0 ? `+${v}` : `−${Math.abs(v)}`}</span>;
}

function Kpi({ label, value, icon: Icon, tone, color, to, hint, delta, series, goodWhenUp, delay }: { label: string; value: number; icon: LucideIcon; tone: string; color: string; to: string; hint: string; delta: number; series: number[]; goodWhenUp?: boolean; delay: number }) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -3 }}
      onClick={() => navigate(to)}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:p-5"
    >
      <span className={cn('mb-4 flex size-10 items-center justify-center rounded-xl', tone)}><Icon className="size-[18px]" /></span>
      <Sparkline values={series} color={color} className="absolute right-3 top-4 h-8 w-14 sm:right-4 sm:top-5 sm:h-9 sm:w-[84px]" />
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl"><CountUp value={value} /></p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle"><Delta v={delta} goodWhenUp={goodWhenUp} /> {hint}</p>
    </motion.button>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const type = (sp.get('type') as DeviceType | null) || null;
  const setType = (t: DeviceType | null) => setSp((p) => { const n = new URLSearchParams(p); t ? n.set('type', t) : n.delete('type'); return n; }, { replace: true });
  const { data, isLoading, isError, refetch, isFetching } = useDashboard(type);
  const remind = useRemind();
  const [kind, setKind] = useState<Kind>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [due, setDue] = useState<{ id: string; current: string; sub: string } | null>(null);
  const qs = type ? `&type=${type}` : '';

  const items = useMemo<AttentionItem[]>(() => {
    if (!data) return [];
    const a = data.attention;
    const out: AttentionItem[] = [];
    a.faults.forEach((f) =>
      out.push({
        key: `f${f.id}`, kind: 'fault', icon: Wrench, tone: 'bg-danger/12 text-danger',
        title: `${f.device.brand} ${f.device.model} arızalı`,
        meta: `${faultNo(f.ticketNo)} · ${f.device.assetTag} · ${f.status === 'IN_PROGRESS' ? 'İnceleniyor' : 'Açık'} · ${fromNow(f.createdAt)}`,
        actions: [{ label: 'Kaydı aç', primary: true, onClick: () => navigate(`/faults?ticket=${f.id}`) }, { label: 'Cihaz', onClick: () => navigate(`/devices/${f.device.id}`) }],
      }),
    );
    if (isAdmin) {
      a.overdue.forEach((o) =>
        out.push({
          key: `o${o.id}`, kind: 'overdue', icon: Clock, tone: 'bg-accent-soft text-accent',
          title: `${o.user.name} · iade tarihi ${o.days} gün geçti`,
          meta: `${o.device.brand} ${o.device.model} · ${o.device.assetTag} · planlı ${fmtDate(o.dueAt)}`,
          actions: [
            { label: 'Hatırlat', primary: true, onClick: () => remind.mutate(o.id, { onSuccess: () => toast.success(`${o.user.name} kişisine hatırlatma gönderildi`) }) },
            { label: 'Uzat', onClick: () => setDue({ id: o.id, current: o.dueAt, sub: `${o.user.name} · ${o.device.brand} ${o.device.model}` }) },
          ],
        }),
      );
    } else {
      a.overdue.forEach((o) =>
        out.push({ key: `o${o.id}`, kind: 'overdue', icon: Clock, tone: 'bg-accent-soft text-accent', title: `${o.user.name} · iade tarihi ${o.days} gün geçti`, meta: `${o.device.brand} ${o.device.model} · ${o.device.assetTag}`, actions: [{ label: 'Cihaz', onClick: () => navigate(`/devices/${o.device.id}`) }] }),
      );
    }
    a.warranty.forEach((w) =>
      out.push({
        key: `w${w.id}`, kind: 'warranty', icon: ShieldAlert, tone: 'bg-warning/15 text-warning',
        title: `${w.brand} ${w.model} · garanti ${w.days} gün sonra bitiyor`,
        meta: `${w.assetTag} · ${fmtDate(w.warrantyEnd)}`,
        actions: [{ label: 'Cihaza git', onClick: () => navigate(`/devices/${w.id}`) }],
      }),
    );
    if (isAdmin && a.stale.count > 0) {
      out.push({
        key: 'stale', kind: 'stale', icon: PackageOpen, tone: 'bg-info/12 text-info',
        title: `${a.stale.count} cihaz 60+ gündür depoda hareketsiz`,
        meta: a.stale.items.map((i) => `${i.brand} ${i.model}`).slice(0, 2).join(', ') + (a.stale.count > 2 ? '…' : ''),
        actions: [{ label: 'Listele', primary: true, onClick: () => navigate(`/devices?stale=true${qs}`) }],
      });
    }
    return out;
  }, [data, isAdmin, navigate, qs, remind]);

  if (isError) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-fg-muted">Panel verileri yüklenemedi.</p>
        <button onClick={() => refetch()} className="mt-3 text-sm font-medium text-accent">Tekrar dene</button>
      </Card>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
        <div className="grid gap-4 lg:grid-cols-12"><Skeleton className="h-96 rounded-2xl lg:col-span-7" /><Skeleton className="h-96 rounded-2xl lg:col-span-5" /></div>
      </div>
    );
  }

  const t = data.totals;
  const visible = items.filter((i) => kind === 'all' || i.kind === kind);
  const count = (k: Kind) => (k === 'all' ? items.length : items.filter((i) => i.kind === k).length);
  const donut = [
    { name: 'Zimmetli', value: t.assigned, color: 'var(--success)' },
    { name: 'Depoda', value: t.inStock, color: 'var(--info)' },
    { name: 'Arızalı', value: t.faulty, color: 'var(--danger)' },
    { name: 'Hizmet dışı', value: t.retired, color: 'var(--fg-subtle)' },
  ].filter((d) => d.value > 0);
  const utilization = t.devices ? Math.round((t.assigned / t.devices) * 100) : 0;
  const deptMax = data.byDepartment[0]?.count ?? 1;
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const scopeNote = data.scope === 'department' ? `${user?.department} birimi` : 'Tüm envanter';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0]}`}
        description={`${scopeNote} · ${items.length ? `bugün ilgilenmeniz gereken ${items.length} konu var` : 'bekleyen konu yok'}`}
        actions={
          <>
            <Button onClick={() => window.dispatchEvent(new Event('open-scanner'))}><QrCode className="size-4" />QR tara</Button>
            {isAdmin ? (
              <>
                <Button onClick={() => setAssignOpen(true)}><UserPlus className="size-4" />Zimmetle</Button>
                <Button variant="primary" onClick={() => setAddOpen(true)}><Plus className="size-4" />Cihaz ekle</Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => navigate('/reports')}><BarChart3 className="size-4" />Raporlar</Button>
            )}
          </>
        }
      />

      {type && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold text-accent">
            Filtre: {typeLabel(type)}
            <button onClick={() => setType(null)} aria-label="Filtreyi kaldır" className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"><X className="size-3" strokeWidth={3} /></button>
          </span>
          <span className="text-xs text-fg-subtle">Tüm göstergeler bu cihaz türüne göre süzüldü</span>
        </div>
      )}

      <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 transition-opacity', isFetching && 'opacity-80')}>
        <Kpi delay={0} label="Toplam cihaz" value={t.devices} icon={Boxes} tone="bg-accent-soft text-accent" color="var(--accent)" to={`/devices?${qs.slice(1)}`} hint="son 30 günde" delta={data.deltas.devices} series={data.trend.devices} />
        <Kpi delay={0.06} label="Zimmetli" value={t.assigned} icon={UserCheck} tone="bg-success/12 text-success" color="var(--success)" to={`/devices?status=ASSIGNED${qs}`} hint={`%${utilization} kullanımda`} delta={data.deltas.assigned} series={data.trend.assigned} />
        <Kpi delay={0.12} label="Boşta (Depoda)" value={t.inStock} icon={PackageOpen} tone="bg-info/12 text-info" color="var(--info)" to={`/devices?status=IN_STOCK${qs}`} hint="hemen zimmetlenebilir" delta={data.deltas.inStock} series={data.trend.inStock} />
        <Kpi delay={0.18} label="Arızalı" value={t.faulty} icon={ShieldAlert} tone="bg-danger/12 text-danger" color="var(--danger)" to="/faults" hint="bakım bekliyor" delta={data.deltas.faulty} series={data.trend.faulty} goodWhenUp={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="min-w-0 p-5 lg:col-span-7">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Dikkat gerektirenler</h2>
              <p className="text-xs text-fg-subtle">Arıza, gecikme, garanti ve hareketsizlik uyarıları</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Uyarı türü">
            {([['all', 'Hepsi'], ['fault', 'Arıza'], ['overdue', 'Gecikme'], ['warranty', 'Garanti'], ...(isAdmin ? [['stale', 'Hareketsiz']] : [])] as [Kind, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition', kind === k ? 'border-transparent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>
                {l} <b className="tabular-nums">{count(k)}</b>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-sm text-fg-muted">
              <CheckCircle2 className="mb-2 size-8 text-success" />
              <b className="text-fg">Her şey yolunda</b>
              Bekleyen konu yok.
            </div>
          ) : (
            <ul data-testid="attention-list" className="max-h-[430px] space-y-0.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {visible.map((it) => (
                  <motion.li key={it.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} className="flex flex-wrap items-center gap-3 rounded-xl p-2.5 transition hover:bg-surface-hover sm:flex-nowrap">
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', it.tone)}><it.icon className="size-4" /></span>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block truncate text-[13.5px] font-medium">{it.title}</span>
                      <span className="block truncate text-xs text-fg-subtle">{it.meta}</span>
                    </span>
                    <span className="flex gap-1.5">
                      {it.actions.map((a) => <Button key={a.label} size="sm" variant={a.primary ? 'primary' : 'secondary'} onClick={a.onClick}>{a.label}</Button>)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-5">
          <h2 className="text-sm font-semibold">Durum dağılımı</h2>
          <p className="text-xs text-fg-subtle">{type ? typeLabel(type) : data.scope === 'department' ? 'Biriminizdeki cihazlar' : 'Tüm cihazlar'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div className="relative mx-auto h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut.length ? donut : [{ name: 'Boş', value: 1, color: 'var(--surface-2)' }]} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={3} cornerRadius={6} stroke="none">
                    {(donut.length ? donut : [{ color: 'var(--surface-2)', name: '' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tabular-nums">{t.devices}</span><span className="text-xs text-fg-subtle">cihaz</span></div>
            </div>
            <ul className="min-w-[150px] flex-1 space-y-2 text-[13px] text-fg-muted">
              {[['Zimmetli', t.assigned, 'var(--success)'], ['Depoda', t.inStock, 'var(--info)'], ['Arızalı', t.faulty, 'var(--danger)'], ['Hizmet dışı', t.retired, 'var(--fg-subtle)']].map(([l, v, c]) => (
                <li key={l as string} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: c as string }} />{l}<b className="ml-auto font-medium tabular-nums text-fg">{v}</b></li>
              ))}
            </ul>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-[13px] font-semibold">Birime göre zimmet</h3>
            {data.byDepartment.length === 0 ? <p className="py-4 text-center text-sm text-fg-subtle">Zimmetli cihaz yok</p> : (
              <ul className="space-y-2.5">
                {data.byDepartment.slice(0, 5).map((d) => (
                  <li key={d.department} className="grid grid-cols-[130px_1fr_28px] items-center gap-2.5 text-xs">
                    <span className="truncate text-fg-muted" title={d.department}>{d.department}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-2"><motion.i className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(d.count / deptMax) * 100}%` }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} /></span>
                    <b className="text-right tabular-nums">{d.count}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="min-w-0 flex flex-col p-5 lg:col-span-8">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Cihaz türleri</h2>
              <p className="text-xs text-fg-subtle">Kutulara tıklayarak diğer grafikleri süz</p>
            </div>
            {type && <Button size="sm" variant="ghost" onClick={() => setType(null)}><X className="size-3.5" />Süzgeci kaldır</Button>}
          </div>
          <TypeTreemap data={data.byType} selected={type} onSelect={setType} height="100%" />
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Activity className="size-4 text-accent" /><h2 className="text-sm font-semibold">Canlı akış</h2></div>
            <Badge tone="success" dot>Canlı</Badge>
          </div>
          {data.recentEvents.length === 0 ? <p className="py-10 text-center text-sm text-fg-subtle">Henüz hareket yok</p> : (
            <EventTimeline items={data.recentEvents.slice(0, 6).map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actor: e.actor?.name, title: `${e.device.brand} ${e.device.model} · ${e.device.assetTag}` }))} />
          )}
          <Link to="/assignments" className="mt-4 block text-center text-xs font-medium text-accent hover:underline">Tüm zimmet hareketleri</Link>
        </Card>
      </div>

      {isAdmin && <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} />}
      {isAdmin && <DeviceFormDrawer open={addOpen} onOpenChange={setAddOpen} />}
      <DueDialog open={!!due} onOpenChange={(o) => !o && setDue(null)} assignmentId={due?.id ?? null} current={due?.current} subtitle={due?.sub} />
    </div>
  );
}
