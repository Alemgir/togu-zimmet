import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BellRing, CalendarClock, CalendarDays, Download, FileText, History, Wrench, MapPin, Pencil, Printer, QrCode, RefreshCw, RotateCcw, ShieldCheck, StickyNote, Trash2, TriangleAlert, UserPlus, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useDevice, useDeleteDevice, useDeviceQr, useRemind } from '@/api/hooks';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fromNow, warrantyState } from '@/lib/format';
import { faultNo, FAULT_LABEL, FAULT_TONE, RETURN_REASON_LABEL, typeLabel } from '@/lib/labels';
import { Avatar, Badge, Card, EmptyState, Skeleton, StatusBadge } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { AssignDialog, DeviceFormDrawer, DueDialog, FaultDialog, ReturnDialog, StatusDialog } from '@/components/devices/DeviceDialogs';
import { EventTimeline } from '@/components/EventTimeline';
import { Logo } from '@/components/brand/Logo';

function Spec({ icon: Icon, label, children }: { icon?: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
      <dt className="w-32 shrink-0 text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

function duration(from: string, to: string | null) {
  const d = Math.max(0, Math.floor(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 864e5));
  return d === 0 ? 'Bir günden az' : `${d} gün`;
}

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const remind = useRemind();
  const { data, isLoading, isError } = useDevice(id);
  const qr = useDeviceQr(id);
  const del = useDeleteDevice();
  const [tab, setTab] = useState<'history' | 'events' | 'faults'>('history');
  const [dialog, setDialog] = useState<null | 'edit' | 'assign' | 'return' | 'status' | 'delete' | 'fault' | 'due'>(null);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;
  if (isError || !data) return <EmptyState icon={<TriangleAlert className="size-6" />} title="Cihaz bulunamadı" description="Silinmiş olabilir veya erişim yetkiniz yok." action={<Button onClick={() => navigate(isAdmin ? '/devices' : '/')}>Geri dön</Button>} />;

  const { device: d, history, events, faults } = data;
  const w = warrantyState(d.warrantyEnd);
  const isHolder = d.holder?.id === user?.id;
  const managesHolder = user?.role === 'UNIT_MANAGER' && !!user.department && d.holder?.department === user.department;
  const canReport = d.status === 'ASSIGNED' && !isAdmin && (isHolder || managesHolder);
  const canSeeDetail = isAdmin || history.length > 0 || events.length > 0;

  const download = () => {
    if (!qr.data) return;
    const a = document.createElement('a');
    a.href = qr.data.dataUrl;
    a.download = `${d.assetTag}-qr.png`;
    a.click();
  };

  const remove = async () => {
    try {
      await del.mutateAsync(d.id);
      toast.success('Cihaz silindi');
      navigate('/devices', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
      setDialog(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link to={isAdmin ? '/devices' : '/'} className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition hover:text-fg"><ArrowLeft className="size-4" />{isAdmin ? 'Envanter' : 'Zimmetlerim'}</Link>

      {/* Başlık */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <DeviceIcon type={d.type} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">{d.brand} {d.model}</h1>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-1 text-sm text-fg-muted"><span className="font-mono">{d.assetTag}</span> · {typeLabel(d.type)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && d.status === 'IN_STOCK' && <Button variant="primary" onClick={() => setDialog('assign')}><UserPlus className="size-4" />Zimmetle</Button>}
            {isAdmin && d.status === 'ASSIGNED' && (
              <>
                <Button variant="primary" onClick={() => setDialog('return')}><RotateCcw className="size-4" />İade al</Button>
                <Button onClick={() => setDialog('assign')}><RefreshCw className="size-4" />Devret</Button>
              </>
            )}
            {canReport && <Button variant="danger" onClick={() => setDialog('fault')}><TriangleAlert className="size-4" />Arıza bildir</Button>}
            {isAdmin && (
              <>
                <Button onClick={() => setDialog('status')}><Activity className="size-4" />Durum</Button>
                <Button onClick={() => setDialog('edit')}><Pencil className="size-4" />Düzenle</Button>
                <Button variant="ghost" size="icon" aria-label="Sil" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setDialog('delete')}><Trash2 className="size-4" /></Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Mevcut zimmet */}
          <Card className={cn('p-5', d.holder && 'border-success/30')}>
            <h2 className="mb-3 text-sm font-semibold">Şu an kimde?</h2>
            {d.holder ? (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
                <Avatar name={d.holder.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.holder.name}</p>
                  <p className="text-sm text-fg-muted">{[d.holder.title, d.holder.department].filter(Boolean).join(' · ') || d.holder.email}</p>
                </div>
                <div className="text-right text-xs text-fg-subtle"><p>Zimmet tarihi</p><p className="font-medium text-fg">{fmtDate(d.assignedAt)}</p></div>
              </motion.div>
            ) : null}
            {d.holder && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {d.dueAt ? (
                  <Badge tone={new Date(d.dueAt).getTime() < Date.now() ? 'danger' : 'warning'}><CalendarClock className="size-3" />Planlı iade: {fmtDate(d.dueAt)}</Badge>
                ) : (
                  <span className="text-xs text-fg-subtle">Planlı iade tarihi yok</span>
                )}
                <span className="ml-auto flex flex-wrap gap-2">
                  {isAdmin && d.assignmentId && <Button size="sm" onClick={() => setDialog('due')}><CalendarClock className="size-3.5" />{d.dueAt ? 'Uzat' : 'İade tarihi belirle'}</Button>}
                  {isAdmin && d.assignmentId && <Button size="sm" loading={remind.isPending} onClick={() => remind.mutate(d.assignmentId!, { onSuccess: () => toast.success('Hatırlatma gönderildi', { description: d.holder!.name }) })}><BellRing className="size-3.5" />Hatırlat</Button>}
                  {(isAdmin || isHolder || managesHolder) && d.assignmentId && <Link to={`/tutanak/${d.assignmentId}`}><Button size="sm"><FileText className="size-3.5" />Tutanak</Button></Link>}
                </span>
              </div>
            )}
            {!d.holder && (
              <p className="text-sm text-fg-muted">
                {d.status === 'IN_STOCK' ? 'Cihaz depoda, zimmetlenmeye hazır.' : d.status === 'FAULTY' ? 'Cihaz arızalı olduğu için kimseye zimmetli değil.' : 'Cihaz hizmet dışı.'}
              </p>
            )}
          </Card>

          <Card className="px-5">
            <h2 className="pt-5 text-sm font-semibold">Cihaz bilgileri</h2>
            <dl className="divide-y divide-border">
              <Spec label="Seri numarası"><span className="font-mono">{d.serialNumber}</span></Spec>
              <Spec icon={CalendarDays} label="Alım tarihi">{fmtDate(d.purchaseDate)}</Spec>
              <Spec icon={ShieldCheck} label="Garanti"><span className="flex flex-wrap items-center gap-2">{fmtDate(d.warrantyEnd)}{d.warrantyEnd && <Badge tone={w.tone}>{w.label}</Badge>}</span></Spec>
              <Spec icon={MapPin} label="Konum">{d.location ?? '—'}</Spec>
              {d.notes && <Spec icon={StickyNote} label="Notlar"><span className="whitespace-pre-wrap font-normal text-fg-muted">{d.notes}</span></Spec>}
            </dl>
          </Card>

          {canSeeDetail && (
            <Card className="overflow-hidden">
              <div className="flex gap-1 border-b border-border p-2" role="tablist">
                {([['history', 'Zimmet geçmişi', History, history.length], ['faults', 'Arıza kayıtları', Wrench, faults.length], ['events', 'Aktivite kaydı', Activity, events.length]] as const).map(([k, l, Icon, n]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors', tab === k ? 'text-accent' : 'text-fg-muted hover:bg-surface-hover')}>
                    {tab === k && <motion.span layoutId="detail-tab" className="absolute inset-0 rounded-xl bg-accent-soft" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <Icon className="relative size-4" /><span className="relative">{l}</span><span className="relative rounded-md bg-fg/6 px-1.5 text-xs tabular-nums text-fg-subtle">{n}</span>
                  </button>
                ))}
              </div>
              <div className="p-5">
                {tab === 'history' ? (
                  history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-fg-subtle">Bu cihaz henüz hiç zimmetlenmedi.</p>
                  ) : (
                    <ul className="space-y-3">
                      {history.map((h) => (
                        <li key={h.id} className={cn('rounded-xl border p-4', !h.returnedAt ? 'border-success/30 bg-success/5' : 'border-border')}>
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar name={h.user.name} size={36} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{h.user.name}</p>
                              <p className="text-xs text-fg-subtle">{h.user.department ?? '—'}</p>
                            </div>
                            {h.returnedAt ? <Badge tone="neutral">{h.returnReason ? RETURN_REASON_LABEL[h.returnReason] : 'İade edildi'}</Badge> : <Badge tone="success" dot>Aktif zimmet</Badge>}
                            <Link to={`/tutanak/${h.id}`} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"><FileText className="size-3.5" />Tutanak</Link>
                          </div>
                          <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-fg-muted sm:grid-cols-3">
                            <p>Verildi: <b className="font-medium text-fg">{fmtDateTime(h.assignedAt)}</b></p>
                            <p>İade: <b className="font-medium text-fg">{h.returnedAt ? fmtDateTime(h.returnedAt) : '—'}</b></p>
                            <p>Süre: <b className="font-medium text-fg">{duration(h.assignedAt, h.returnedAt)}</b></p>
                          </div>
                          {(h.note || h.returnNote) && <p className="mt-2 text-xs text-fg-subtle">{[h.note, h.returnNote].filter(Boolean).join(' → ')}</p>}
                        </li>
                      ))}
                    </ul>
                  )
                ) : tab === 'faults' ? (
                  faults.length === 0 ? (
                    <p className="py-8 text-center text-sm text-fg-subtle">Bu cihaz için arıza kaydı yok.</p>
                  ) : (
                    <ul className="space-y-3">
                      {faults.map((f) => (
                        <li key={f.id}>
                          <Link to={`/faults?ticket=${f.id}`} className="block rounded-xl border border-border p-4 transition hover:border-accent hover:bg-accent-soft">
                            <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-fg-subtle">{faultNo(f.ticketNo)}</span><Badge tone={FAULT_TONE[f.status]} dot>{FAULT_LABEL[f.status]}</Badge></div>
                            <p className="mt-1.5 text-sm">{f.description}</p>
                            <p className="mt-1 text-xs text-fg-subtle">{f.reportedBy?.name ?? 'Sistem'} · {fromNow(f.createdAt)}{f.resolution ? ` · Çözüm: ${f.resolution}` : ''}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <EventTimeline items={events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actor: e.actor?.name }))} />
                )}
              </div>
            </Card>
          )}
        </div>

        {/* QR */}
        <div>
          <Card className="p-5 lg:sticky lg:top-24">
            <div className="mb-3 flex items-center gap-2"><QrCode className="size-4 text-accent" /><h2 className="text-sm font-semibold">QR etiketi</h2></div>
            <div className="mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl border border-border bg-white p-3">
              {qr.data ? <img src={qr.data.dataUrl} alt={`${d.assetTag} QR kodu`} className="size-full" /> : <Skeleton className="size-full" />}
            </div>
            <p className="mt-3 text-center font-mono text-sm font-medium">{d.assetTag}</p>
            <p className="mt-1 text-center text-xs text-fg-subtle">Telefonla okutunca bu sayfa açılır</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={download} disabled={!qr.data}><Download className="size-3.5" />PNG</Button>
              <Button size="sm" onClick={() => window.print()} disabled={!qr.data}><Printer className="size-3.5" />Yazdır</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Yazdırma etiketi */}
      {qr.data && (
        <div className="print-area hidden">
          <div style={{ border: '2px solid #000', borderRadius: 12, padding: 20, textAlign: 'center', width: 330, fontFamily: 'sans-serif', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', marginBottom: 10 }}>
              <div style={{ width: 44, flex: 'none' }}><Logo variant="symbol" /></div>
              <div style={{ lineHeight: 1.25 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>TOKAT GAZİOSMANPAŞA ÜNİVERSİTESİ</p>
                <p style={{ margin: 0, fontSize: 10, color: '#444' }}>Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü</p>
              </div>
            </div>
            <img src={qr.data.dataUrl} alt="" style={{ width: 230, height: 230 }} />
            <p style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, margin: '8px 0 2px' }}>{d.assetTag}</p>
            <p style={{ fontSize: 14, margin: 0 }}>{d.brand} {d.model}</p>
          </div>
        </div>
      )}

      <DeviceFormDrawer open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)} device={d} />
      <AssignDialog open={dialog === 'assign'} onOpenChange={(o) => !o && setDialog(null)} device={d} />
      <ReturnDialog open={dialog === 'return'} onOpenChange={(o) => !o && setDialog(null)} device={d} />
      <StatusDialog open={dialog === 'status'} onOpenChange={(o) => !o && setDialog(null)} device={d} />
      <DueDialog open={dialog === 'due'} onOpenChange={(o) => !o && setDialog(null)} assignmentId={d.assignmentId} current={d.dueAt} subtitle={d.holder ? `${d.holder.name} · ${d.brand} ${d.model}` : undefined} />
      <FaultDialog open={dialog === 'fault'} onOpenChange={(o) => !o && setDialog(null)} device={d} />
      <ConfirmDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)} danger loading={del.isPending} title="Cihazı sil" confirmLabel="Evet, sil" description={`${d.brand} ${d.model} (${d.assetTag}) kalıcı olarak silinecek.`} onConfirm={remove}>
        <p className="rounded-lg bg-surface-2 p-3 text-xs">Zimmet geçmişi olan cihazlar silinemez; bunun yerine durumunu “Hizmet dışı” yapabilirsiniz.</p>
      </ConfirmDialog>
    </div>
  );
}
