import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, useReport } from '@/api/hooks';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { typeLabel } from '@/lib/labels';
import type { DeviceType, ReportData } from '@/lib/types';
import { Card, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { CountUp } from '@/components/ui/CountUp';
import { TypeTreemap } from '@/components/charts/TypeTreemap';

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', fontSize: 12, color: 'var(--fg)' };
const GRADE: Record<ReportData['health']['grade'], { label: string; color: string }> = {
  excellent: { label: 'Çok iyi', color: 'var(--success)' },
  good: { label: 'İyi', color: 'var(--info)' },
  warning: { label: 'Dikkat', color: 'var(--warning)' },
  critical: { label: 'Kritik', color: 'var(--danger)' },
};
const AGE_LABELS = ['<1 yıl', '1–2', '2–3', '3–4', '4–5', '5+'];

function HealthRing({ score, color }: { score: number; color: string }) {
  const r = 76, c = 2 * Math.PI * r;
  return (
    <div className="relative size-44 shrink-0">
      <svg viewBox="0 0 176 176" className="size-full -rotate-90" aria-hidden>
        <circle cx="88" cy="88" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        <motion.circle cx="88" cy="88" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] font-semibold leading-none tracking-tight"><CountUp value={score} /></span>
        <span className="mt-1 text-xs text-fg-subtle">/ 100</span>
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="w-28 shrink-0 text-fg-muted">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><motion.i className="block h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} /></span>
      <b className="w-10 text-right tabular-nums">%{value}</b>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const type = (sp.get('type') as DeviceType | null) || null;
  const setType = (t: DeviceType | null) => setSp((p) => { const n = new URLSearchParams(p); t ? n.set('type', t) : n.delete('type'); return n; }, { replace: true });
  const { data, isLoading, isError } = useReport(type);

  const exp = (url: string, params = {}) => () =>
    downloadFile(url, params).then((n) => toast.success('Dışa aktarıldı', { description: `${n} — Excel ile açılır` })).catch((e) => toast.error(errorMessage(e)));

  if (isError) return <Card className="p-10 text-center text-sm text-fg-muted">Rapor verileri yüklenemedi.</Card>;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><div className="grid gap-4 lg:grid-cols-12"><Skeleton className="h-72 rounded-2xl lg:col-span-5" /><Skeleton className="h-72 rounded-2xl lg:col-span-7" /></div></div>;

  const g = GRADE[data.health.grade];
  const ageMax = Math.max(1, ...data.ageBuckets);
  const monthName = (i: number) => new Date(Date.now() + i * 30.4 * 864e5).toLocaleDateString('tr-TR', { month: 'short' });
  const deptMax = data.byDepartment[0]?.count ?? 1;
  const st = [['Zimmetli', data.status.ASSIGNED, 'var(--success)'], ['Depoda', data.status.IN_STOCK, 'var(--info)'], ['Arızalı', data.status.FAULTY, 'var(--danger)'], ['Hizmet dışı', data.status.RETIRED, 'var(--fg-subtle)']] as const;
  const activity = data.activity.map((a) => ({ ...a, label: new Date(a.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) }));
  const typeParam = type ? { type } : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        description={`${user?.role === 'UNIT_MANAGER' ? `${user.department} birimi` : 'Tüm envanter'} · sağlık, yaş, garanti ve yenileme analizleri`}
        actions={
          <>
            <Button onClick={exp('/exports/devices', typeParam)}><FileSpreadsheet className="size-4" />Envanter</Button>
            <Button onClick={exp('/exports/assignments')}><Download className="size-4" />Zimmetler</Button>
            <Button onClick={exp('/exports/faults')}><Download className="size-4" />Arızalar</Button>
          </>
        }
      />

      {type && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-3.5 pr-1.5 text-[13px] font-semibold text-accent">
            Filtre: {typeLabel(type)}
            <button onClick={() => setType(null)} aria-label="Filtreyi kaldır" className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"><X className="size-3" strokeWidth={3} /></button>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="min-w-0 p-5 lg:col-span-5">
          <div className="mb-4 flex items-start justify-between">
            <div><h2 className="text-sm font-semibold">Envanter sağlık puanı</h2><p className="text-xs text-fg-subtle">{type ? typeLabel(type) : 'Tüm cihazlar'} · arıza, garanti ve yaş oranlarından</p></div>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${g.color} 15%, transparent)`, color: g.color }}>{g.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <HealthRing score={data.health.score} color={g.color} />
            <div className="min-w-[200px] flex-1 space-y-3">
              <MiniBar label="Kullanım" value={data.health.utilization} color="var(--success)" />
              <MiniBar label="Arıza oranı" value={data.health.faultyRate} color="var(--danger)" />
              <MiniBar label="Garantisi bitmiş" value={data.health.expiredWarrantyRate} color="var(--warning)" />
              <MiniBar label="3+ yaşında" value={data.health.oldRate} color="var(--info)" />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-7">
          <div className="mb-4"><h2 className="text-sm font-semibold">Cihaz türleri</h2><p className="text-xs text-fg-subtle">Kutulara tıklayarak diğer grafikleri süz</p></div>
          <TypeTreemap data={data.byType} selected={type} onSelect={setType} />
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-5">
          <div className="mb-3"><h2 className="text-sm font-semibold">Cihaz yaşı</h2><p className="text-xs text-fg-subtle">Alım tarihine göre (yıl)</p></div>
          <div className="flex h-40 items-end gap-2.5 pt-5">
            {data.ageBuckets.map((v, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <motion.div className="relative w-full rounded-t-lg rounded-b-sm" style={{ background: i >= 3 ? 'var(--warning)' : 'var(--accent)', minHeight: 3 }} initial={{ height: 0 }} animate={{ height: `${Math.max(2, (v / ageMax) * 100)}%` }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
                  {v > 0 && <em className="absolute -top-5 inset-x-0 text-center text-xs font-bold not-italic">{v}</em>}
                </motion.div>
                <span className="text-[11px] text-fg-subtle">{AGE_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-fg-subtle">Turuncu: 3+ yaş. Yenileme planlamasında öncelikli adaylar.</p>
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-7">
          <div className="mb-3"><h2 className="text-sm font-semibold">Garanti takvimi</h2><p className="text-xs text-fg-subtle">Önümüzdeki 12 ayda biten garantiler</p></div>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {data.warrantyMonths.map((v, i) => (
              <div key={i} title={`${v} cihaz`} className={cn('rounded-xl bg-surface-2 py-2 text-center text-[11px] text-fg-muted transition hover:-translate-y-0.5', (v >= 2 || (i < 3 && v > 0)) && 'bg-warning/18 text-fg')}>
                {monthName(i)}<b className={cn('mt-0.5 block text-lg', v >= 2 || (i < 3 && v > 0) ? 'text-warning' : 'text-fg')}>{v}</b>
              </div>
            ))}
          </div>
          {data.renewal.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-[13px] font-semibold">Yenileme planı</h3>
              <div className="flex flex-wrap gap-2">
                {data.renewal.map((r) => <span key={r.year} className="rounded-xl border border-border bg-surface-2/60 px-3 py-1.5 text-sm"><b className="font-semibold tabular-nums">{r.year}</b> <span className="text-fg-muted">· {r.count} cihaz 5 yaşına ulaşıyor</span></span>)}
              </div>
            </div>
          )}
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-6">
          <h2 className="mb-3 text-sm font-semibold">Durum karması</h2>
          <div className="mb-3 flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            {st.map(([l, v, c]) => <i key={l} title={`${l}: ${v}`} className="block h-full" style={{ flex: v || 0.0001, background: c }} />)}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-fg-muted">
            {st.map(([l, v, c]) => <li key={l} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: c }} />{l} <b className="tabular-nums text-fg">{v}</b></li>)}
          </ul>
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-6">
          <h2 className="mb-3 text-sm font-semibold">Birimlere göre zimmet</h2>
          {data.byDepartment.length === 0 ? <p className="py-6 text-center text-sm text-fg-subtle">Zimmetli cihaz yok</p> : (
            <ul className="space-y-2.5">
              {data.byDepartment.slice(0, 6).map((d) => (
                <li key={d.department} className="grid grid-cols-[140px_1fr_28px] items-center gap-2.5 text-xs">
                  <span className="truncate text-fg-muted" title={d.department}>{d.department}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-2"><motion.i className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(d.count / deptMax) * 100}%` }} transition={{ duration: 0.7 }} /></span>
                  <b className="text-right tabular-nums">{d.count}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0 p-5 lg:col-span-12">
          <div className="mb-4 flex items-start justify-between">
            <div><h2 className="text-sm font-semibold">Hareket</h2><p className="text-xs text-fg-subtle">Son 30 gün · günlük zimmet ve iade</p></div>
            <div className="flex gap-4 text-xs text-fg-muted"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--accent)]" />Zimmet</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--teal)]" />İade</span></div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity} margin={{ left: -24, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="rA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="rR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--teal)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--teal)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={4} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border-strong)' }} />
                <Area type="monotone" name="Zimmet" dataKey="assigned" stroke="var(--accent)" strokeWidth={2} fill="url(#rA)" />
                <Area type="monotone" name="İade" dataKey="returned" stroke="var(--teal)" strokeWidth={2} fill="url(#rR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
