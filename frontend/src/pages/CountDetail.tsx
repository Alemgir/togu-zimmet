import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Camera, CameraOff, Check, CheckCircle2, Download, Flag, Search } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, useCloseCount, useCount, useScan } from '@/api/hooks';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import type { CountProgress } from '@/lib/types';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Pagination } from '@/components/ui/Pagination';
import { CameraScan } from '@/components/CameraScan';
import { DeviceIcon } from '@/components/devices/DeviceIcon';

type Feedback = { kind: 'ok' | 'duplicate' | 'unexpected' | 'error'; title: string; sub: string; at: number };
const STYLE: Record<Feedback['kind'], string> = {
  ok: 'bg-success/14 text-success border-success/30',
  duplicate: 'bg-warning/15 text-warning border-warning/30',
  unexpected: 'bg-accent-soft text-accent border-accent/30',
  error: 'bg-danger/12 text-danger border-danger/30',
};

function beep(kind: Feedback['kind']) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = kind === 'ok' ? 880 : kind === 'duplicate' ? 440 : kind === 'unexpected' ? 660 : 220;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 300);
  } catch {
    /* ses desteklenmiyor */
  }
}

function Ring({ p }: { p: CountProgress }) {
  const pct = p.expected ? p.scanned / p.expected : 0;
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <motion.circle cx="64" cy="64" r={r} fill="none" stroke="var(--success)" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 0.5 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="text-2xl font-semibold tabular-nums">%{Math.round(pct * 100)}</b><span className="text-[11px] text-fg-subtle">{p.scanned}/{p.expected}</span></div>
    </div>
  );
}

export default function CountDetail() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'missing' | 'scanned' | 'unexpected' | 'all'>('missing');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const dSearch = useDebounced(search, 300);
  const { data, isLoading } = useCount(id, { state: tab, page, pageSize: 12, search: dSearch });
  const scan = useScan(id);
  const close = useCloseCount();
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(false);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const closed = data?.session.status === 'CLOSED';
  useEffect(() => setPage(1), [tab, dSearch]);
  useEffect(() => { if (!closed) input.current?.focus(); }, [closed, data?.session.id]);

  const submitCode = async (raw: string) => {
    const c = raw.trim();
    if (!c || closed) return;
    try {
      const r = await scan.mutateAsync(c);
      const name = `${r.device.brand} ${r.device.model}`;
      const f: Feedback =
        r.result === 'ok' ? { kind: 'ok', title: 'Sayıldı', sub: `${name} · ${r.device.assetTag}`, at: Date.now() }
        : r.result === 'duplicate' ? { kind: 'duplicate', title: 'Zaten sayılmıştı', sub: `${name} · ${r.device.assetTag}`, at: Date.now() }
        : { kind: 'unexpected', title: 'Listede yok (beklenmeyen)', sub: `${name} · ${r.device.assetTag}${r.device.location ? ` · kayıtlı konum: ${r.device.location}` : ''}`, at: Date.now() };
      setFb(f);
      beep(f.kind);
    } catch (e) {
      setFb({ kind: 'error', title: 'Okutulamadı', sub: errorMessage(e), at: Date.now() });
      beep('error');
    }
    setCode('');
    input.current?.focus();
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); submitCode(code); };

  if (isLoading && !data) return <div className="space-y-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-96 rounded-2xl" /></div>;
  if (!data) return <EmptyState icon={<AlertTriangle className="size-6" />} title="Sayım bulunamadı" action={<Link to="/counts"><Button>Geri dön</Button></Link>} />;
  const { session, progress } = data;
  const tabs = [['missing', 'Eksik', progress.missing], ['scanned', 'Sayılan', progress.scanned], ['unexpected', 'Beklenmeyen', progress.unexpected], ['all', 'Tümü', progress.expected + progress.unexpected]] as const;

  return (
    <div className="space-y-5">
      <Link to="/counts" className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition hover:text-fg"><ArrowLeft className="size-4" />Sayımlar</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">{session.name}</h1><Badge tone={closed ? 'success' : 'warning'} dot>{closed ? 'Tamamlandı' : 'Devam ediyor'}</Badge></div>
          <p className="mt-1 text-sm text-fg-muted">{session.location ?? 'Tüm konumlar'} · {session.createdBy.name} · {fmtDateTime(session.createdAt)}{session.closedAt && ` → ${fmtDateTime(session.closedAt)}`}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => downloadFile(`/counts/${id}/export`).then((n) => toast.success('Rapor indirildi', { description: n })).catch((e) => toast.error(errorMessage(e)))}><Download className="size-4" />CSV raporu</Button>
          {!closed && <Button variant="primary" onClick={() => setConfirm(true)}><Flag className="size-4" />Sayımı bitir</Button>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-5">
            <Ring p={progress} />
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><i className="size-2 rounded-full bg-success" /><dt className="text-fg-muted">Sayılan</dt><dd className="ml-auto font-semibold tabular-nums">{progress.scanned}</dd></div>
              <div className="flex items-center gap-2"><i className="size-2 rounded-full bg-danger" /><dt className="text-fg-muted">Eksik</dt><dd className="ml-auto font-semibold tabular-nums">{progress.missing}</dd></div>
              <div className="flex items-center gap-2"><i className="size-2 rounded-full bg-accent" /><dt className="text-fg-muted">Beklenmeyen</dt><dd className="ml-auto font-semibold tabular-nums">{progress.unexpected}</dd></div>
            </dl>
          </div>

          {closed ? (
            <div className="rounded-xl bg-success/10 p-4 text-sm text-success"><CheckCircle2 className="mb-1.5 size-5" />Sayım tamamlandı. {progress.missing > 0 ? `${progress.missing} cihaz bulunamadı; CSV raporundan inceleyebilirsiniz.` : 'Tüm cihazlar bulundu.'}</div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="space-y-2">
                <label htmlFor="scan-code" className="block text-[13px] font-medium text-fg-muted">Kodu okutun veya yazın</label>
                <div className="flex gap-2">
                  <input ref={input} id="scan-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="TOGU-000012 · QR bağlantısı · seri no" className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 font-mono text-sm shadow-sm transition placeholder:font-sans placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40" />
                  <Button type="submit" variant="primary" className="h-11" loading={scan.isPending} disabled={!code.trim()}><Check className="size-4" /></Button>
                </div>
                <p className="text-xs text-fg-subtle">Barkod/QR okuyucu klavye gibi çalışır: okutunca otomatik gönderilir.</p>
              </form>
              <Button className="w-full justify-center" onClick={() => setCamera((c) => !c)}>{camera ? <><CameraOff className="size-4" />Kamerayı kapat</> : <><Camera className="size-4" />Kamerayı aç</>}</Button>
              {camera && <CameraScan onCode={submitCode} />}
            </>
          )}

          <AnimatePresence mode="wait">
            {fb && (
              <motion.div key={fb.at} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} role="status" className={cn('rounded-xl border p-3.5', STYLE[fb.kind])}>
                <p className="text-sm font-semibold">{fb.title}</p>
                <p className="mt-0.5 text-xs opacity-90">{fb.sub}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {tabs.map(([v, l, n]) => (
                <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition', tab === v ? 'border-transparent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>{l} <b className="tabular-nums">{n}</b></button>
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cihaz ara…" aria-label="Cihaz ara" className="h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-[var(--ring)]/40" />
            </div>
          </div>
          {data.data.length === 0 ? <EmptyState icon={<CheckCircle2 className="size-6" />} title={tab === 'missing' ? 'Eksik cihaz yok' : 'Kayıt yok'} description={tab === 'missing' ? 'Beklenen tüm cihazlar okutuldu.' : undefined} /> : (
            <>
              <ul className="divide-y divide-border">
                {data.data.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <DeviceIcon type={it.device.type} size="sm" />
                    <span className="min-w-0 flex-1 leading-tight"><Link to={`/devices/${it.device.id}`} className="block truncate text-sm font-medium hover:text-accent">{it.device.brand} {it.device.model}</Link><span className="font-mono text-[11px] text-fg-subtle">{it.device.assetTag}{it.device.location ? ` · ${it.device.location}` : ''}</span></span>
                    {!it.expected ? <Badge tone="accent">Beklenmeyen</Badge> : it.scannedAt ? <span className="text-right text-xs text-fg-subtle"><Badge tone="success" dot>Sayıldı</Badge><span className="mt-1 block">{fmtDateTime(it.scannedAt)}</span></span> : <Badge tone="danger" dot>Eksik</Badge>}
                  </li>
                ))}
              </ul>
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPage={setPage} />
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} loading={close.isPending} title="Sayımı bitir" confirmLabel="Sayımı bitir" description="Sayım kapatılınca yeni okutma yapılamaz."
        onConfirm={() => close.mutate(id, { onSuccess: () => { toast.success('Sayım tamamlandı'); setConfirm(false); }, onError: () => setConfirm(false) })}>
        {progress.missing > 0 ? <p className="rounded-lg bg-warning/12 p-3 text-warning"><b>{progress.missing} cihaz</b> henüz okutulmadı ve raporda “Eksik” görünecek.</p> : <p className="rounded-lg bg-success/10 p-3 text-success">Tüm beklenen cihazlar okutuldu.</p>}
      </ConfirmDialog>
    </div>
  );
}
