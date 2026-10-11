import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorDetails, errorMessage } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useAssign, useDeviceMeta, useBulkAssign, useBulkStatus, useCreateDevice, useReportFault, useReturnDevice, useSetDue, useSetStatus, useUpdateDevice, type BulkOutcome, type DeviceInput } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Form';
import { Combobox } from '@/components/ui/Combobox';
import { resolveTypeInput, typeOptions } from '@/lib/deviceTypes';
import { Avatar, StatusBadge } from '@/components/ui/Misc';
import { Drawer, Modal } from '@/components/ui/Overlay';
import { DeviceIcon } from './DeviceIcon';
import { cn } from '@/lib/cn';
import { toInputDate } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';
import { useDebounced } from '@/lib/useDebounced';
import type { Device, DeviceStatus, Paged, User } from '@/lib/types';

/* ───────── Cihaz ekle / düzenle ───────── */
const emptyForm = { type: 'LAPTOP', brand: '', model: '', serialNumber: '', purchaseDate: '', warrantyEnd: '', location: '', notes: '' };

export function DeviceFormDrawer({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device?: Device | null }) {
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const meta = useDeviceMeta();
  const [f, setF] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!device;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(
      device
        ? { type: device.type, brand: device.brand, model: device.model, serialNumber: device.serialNumber, purchaseDate: toInputDate(device.purchaseDate), warrantyEnd: toInputDate(device.warrantyEnd), location: device.location ?? '', notes: device.notes ?? '' }
        : { ...emptyForm, purchaseDate: new Date().toISOString().slice(0, 10) },
    );
  }, [open, device]);

  const set = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setErrors((s) => ({ ...s, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.type.trim()) err.type = 'Cihaz türü zorunlu';
    if (!f.brand.trim()) err.brand = 'Marka zorunlu';
    if (!f.model.trim()) err.model = 'Model zorunlu';
    if (!f.serialNumber.trim()) err.serialNumber = 'Seri numarası zorunlu';
    if (!f.purchaseDate) err.purchaseDate = 'Alım tarihi zorunlu';
    if (f.warrantyEnd && f.purchaseDate && f.warrantyEnd < f.purchaseDate) err.warrantyEnd = 'Garanti bitişi alım tarihinden önce olamaz';
    setErrors(err);
    if (Object.keys(err).length) return;
    const body: DeviceInput = { ...f, brand: f.brand.trim(), model: f.model.trim(), serialNumber: f.serialNumber.trim() };
    try {
      if (editing) {
        await update.mutateAsync({ id: device!.id, ...body });
        toast.success('Cihaz güncellendi');
      } else {
        const d = await create.mutateAsync(body);
        toast.success(`Cihaz eklendi · ${d.assetTag}`, { description: 'QR etiketi otomatik oluşturuldu' });
      }
      onOpenChange(false);
    } catch (ex) {
      const msg = errorMessage(ex);
      if (/seri/i.test(msg)) setErrors({ serialNumber: msg });
      else toast.error(msg);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Cihazı düzenle' : 'Yeni cihaz ekle'}
      description={editing ? device!.assetTag : 'Demirbaş numarası ve QR kodu otomatik üretilir'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button variant="primary" type="submit" form="device-form" loading={create.isPending || update.isPending}>
            {editing ? 'Kaydet' : 'Cihazı ekle'}
          </Button>
        </>
      }
    >
      <form id="device-form" onSubmit={submit} className="space-y-4" noValidate>
        <Combobox label="Cihaz türü" fieldLabel="Cihaz türü" value={f.type} onChange={(v) => { setF((s) => ({ ...s, type: v })); setErrors((s) => ({ ...s, type: '' })); }} options={typeOptions(meta.data?.types)} resolve={resolveTypeInput} max={40} error={errors.type} placeholder="Seçin veya yeni tür yazın (örn. Projeksiyon)" hint="Listede yoksa yazın: yeni tür olarak eklenir" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Combobox label="Marka" fieldLabel="Marka" value={f.brand} onChange={(v) => { setF((s) => ({ ...s, brand: v })); setErrors((s) => ({ ...s, brand: '' })); }} options={meta.data?.brands ?? []} min={1} error={errors.brand} placeholder="Lenovo" />
          <Input label="Model" value={f.model} onChange={set('model')} error={errors.model} placeholder="ThinkPad T14" />
        </div>
        <Input label="Seri numarası" value={f.serialNumber} onChange={set('serialNumber')} error={errors.serialNumber} placeholder="PF3XXXXX" className="font-mono" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Alım tarihi" type="date" value={f.purchaseDate} onChange={set('purchaseDate')} error={errors.purchaseDate} />
          <Input label="Garanti bitişi" type="date" value={f.warrantyEnd} onChange={set('warrantyEnd')} error={errors.warrantyEnd} hint="İsteğe bağlı" />
        </div>
        <Combobox label="Konum" fieldLabel="Konum" value={f.location} onChange={(v) => { setF((s) => ({ ...s, location: v })); setErrors((s) => ({ ...s, location: '' })); }} options={meta.data?.locations ?? []} max={120} error={errors.location} placeholder="Merkez Kampüs · Oda 204" hint="İsteğe bağlı. Listede yoksa yazın" />
        <Textarea label="Notlar" value={f.notes} onChange={set('notes')} placeholder="Aksesuarlar, özel durumlar…" />
      </form>
    </Drawer>
  );
}

/* ───────── Seçiciler ───────── */
function PickerShell({ value, onChange, placeholder, children, loading, empty }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode; loading: boolean; empty: boolean }) {
  return (
    <div className="space-y-2">
      <Input icon={<Search className="size-4" />} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface-2/40 p-1.5">
        {loading && <p className="py-6 text-center text-sm text-fg-subtle">Aranıyor…</p>}
        {!loading && empty && <p className="py-6 text-center text-sm text-fg-subtle">Sonuç bulunamadı</p>}
        {children}
      </div>
    </div>
  );
}

const rowCls = (sel: boolean) => cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition', sel ? 'bg-accent-soft ring-1 ring-accent/40' : 'hover:bg-surface-hover');

export function UserPicker({ selected, onSelect }: { selected: User | null; onSelect: (u: User) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data, isFetching } = useQuery({
    queryKey: ['picker-users', dq],
    queryFn: async () => (await api.get<Paged<User>>('/users', { params: { search: dq || undefined, isActive: true, pageSize: 30 } })).data.data,
  });
  return (
    <PickerShell value={q} onChange={setQ} placeholder="Personel ara (ad, e-posta, birim)…" loading={isFetching && !data} empty={!!data && data.length === 0}>
      {data?.map((u) => (
        <button type="button" key={u.id} onClick={() => onSelect(u)} className={rowCls(selected?.id === u.id)}>
          <Avatar name={u.name} size={32} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-fg-subtle">{u.department ?? u.email}</span></span>
          <span className="text-xs text-fg-subtle">{u.activeDeviceCount ?? 0} cihaz</span>
          {selected?.id === u.id && <Check className="size-4 text-accent" />}
        </button>
      ))}
    </PickerShell>
  );
}

export function DevicePicker({ selected, onSelect }: { selected: Device | null; onSelect: (d: Device) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data, isFetching } = useQuery({
    queryKey: ['picker-devices', dq],
    queryFn: async () => (await api.get<Paged<Device>>('/devices', { params: { search: dq || undefined, status: 'IN_STOCK', pageSize: 30 } })).data.data,
  });
  return (
    <PickerShell value={q} onChange={setQ} placeholder="Depodaki cihazlarda ara…" loading={isFetching && !data} empty={!!data && data.length === 0}>
      {data?.map((d) => (
        <button type="button" key={d.id} onClick={() => onSelect(d)} className={rowCls(selected?.id === d.id)}>
          <DeviceIcon type={d.type} size="sm" />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{d.brand} {d.model}</span><span className="block font-mono text-[11px] text-fg-subtle">{d.assetTag} · {d.serialNumber}</span></span>
          {selected?.id === d.id && <Check className="size-4 text-accent" />}
        </button>
      ))}
    </PickerShell>
  );
}

/* ───────── Zimmetle ───────── */
export function AssignDialog({ open, onOpenChange, device: initial, presetUser }: { open: boolean; onOpenChange: (o: boolean) => void; device?: Device | null; presetUser?: User | null }) {
  const assign = useAssign();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');

  useEffect(() => {
    if (open) {
      setDevice(initial ?? null);
      setUser(presetUser ?? null);
      setNote('');
      setDueAt('');
    }
  }, [open, initial, presetUser]);

  const holder = device?.holder;
  const transfer = !!holder && device?.status === 'ASSIGNED';
  const blocked = device && (device.status === 'FAULTY' || device.status === 'RETIRED');

  const submit = async () => {
    if (!device || !user) return;
    try {
      const a = await assign.mutateAsync({ deviceId: device.id, userId: user.id, note: note.trim() || undefined, transfer, dueAt: dueAt || undefined });
      toast.success(transfer ? 'Cihaz devredildi' : 'Zimmet verildi', {
        description: transfer ? `${holder!.name} üzerinden otomatik düşüldü → ${user.name}` : `${device.brand} ${device.model} → ${user.name}`,
        action: { label: 'Tutanak', onClick: () => navigate(`/tutanak/${a.id}`) },
      });
      onOpenChange(false);
    } catch (e) {
      const d = errorDetails<{ code?: string }>(e);
      toast.error(d?.code === 'ALREADY_ASSIGNED' ? 'Cihaz bu sırada başkasına zimmetlendi, sayfayı yenileyin' : errorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={transfer ? 'Cihazı devret' : 'Zimmet ver'}
      description="Cihazı bir personele resmen teslim edin"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button variant="primary" disabled={!device || !user || !!blocked} loading={assign.isPending} onClick={submit}>
            {transfer ? 'Devret' : 'Zimmetle'} <ArrowRight className="size-4" />
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-fg-muted">Cihaz</p>
          {initial ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
              <DeviceIcon type={initial.type} size="sm" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{initial.brand} {initial.model}</p><p className="font-mono text-[11px] text-fg-subtle">{initial.assetTag}</p></div>
              <StatusBadge status={initial.status} />
            </div>
          ) : (
            <DevicePicker selected={device} onSelect={setDevice} />
          )}
        </div>

        {transfer && (
          <div className="flex gap-3 rounded-xl bg-warning/12 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p><b className="font-medium">{holder!.name}</b> üzerindeki zimmet bu işlemle <b className="font-medium">otomatik olarak düşülecek</b> ve cihaz yeni kişiye geçecek.</p>
          </div>
        )}
        {blocked && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{STATUS_LABEL[device!.status]} durumundaki cihaz zimmetlenemez.</p>}

        <div>
          <p className="mb-2 text-[13px] font-medium text-fg-muted">Personel</p>
          {presetUser ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3"><Avatar name={presetUser.name} size={32} /><p className="text-sm font-medium">{presetUser.name}</p></div>
          ) : (
            <UserPicker selected={user} onSelect={setUser} />
          )}
        </div>
        <Input label="Planlı iade tarihi (isteğe bağlı)" type="date" min={new Date().toISOString().slice(0, 10)} value={dueAt} onChange={(e) => setDueAt(e.target.value)} hint="Geçici görevlendirmelerde: tarih geçince hatırlatma gider ve gecikme olarak işaretlenir" />
        <Textarea label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Çanta ve şarj aleti ile teslim edildi" className="min-h-16" />
      </div>
    </Modal>
  );
}

/* ───────── Planlı iade tarihi (uzat / belirle) ───────── */
export function DueDialog({ open, onOpenChange, assignmentId, current, subtitle }: { open: boolean; onOpenChange: (o: boolean) => void; assignmentId: string | null; current?: string | null; subtitle?: string }) {
  const setDue = useSetDue();
  const [date, setDate] = useState('');
  useEffect(() => {
    if (open) setDate(current ? current.slice(0, 10) : '');
  }, [open, current]);
  const save = async (value: string | null) => {
    if (!assignmentId) return;
    await setDue.mutateAsync({ id: assignmentId, dueAt: value }).then(() => {
      toast.success(value ? 'Planlı iade tarihi güncellendi' : 'Planlı iade tarihi kaldırıldı');
      onOpenChange(false);
    }).catch(() => {});
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Planlı iade tarihi" description={subtitle}
      footer={<>
        {current && <Button variant="ghost" className="mr-auto" onClick={() => save(null)}>Tarihi kaldır</Button>}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button>
        <Button variant="primary" loading={setDue.isPending} disabled={!date} onClick={() => save(date)}>Kaydet</Button>
      </>}>
      <Input label="Yeni iade tarihi" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
    </Modal>
  );
}

/* ───────── Toplu işlemler ───────── */
function BulkResult({ outcome, devices }: { outcome: BulkOutcome; devices: Device[] }) {
  const name = (id: string) => devices.find((d) => d.id === id);
  const failed = outcome.results.filter((r) => !r.ok);
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 rounded-xl bg-success/12 p-3 text-success"><Check className="size-4" /><b>{outcome.ok}</b> cihaz için işlem tamamlandı</p>
      {failed.length > 0 && (
        <div className="rounded-xl bg-danger/10 p-3">
          <p className="mb-2 font-medium text-danger">{failed.length} cihaz işlenemedi</p>
          <ul className="space-y-1.5 text-xs text-fg-muted">
            {failed.map((f) => (
              <li key={f.deviceId}><b className="font-medium text-fg">{name(f.deviceId)?.assetTag ?? f.deviceId}</b> · {f.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BulkAssignDialog({ open, onOpenChange, devices, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; devices: Device[]; onDone: () => void }) {
  const bulk = useBulkAssign();
  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  useEffect(() => {
    if (open) (setUser(null), setNote(''), setDueAt(''), setOutcome(null));
  }, [open]);
  const submit = async () => {
    if (!user) return;
    const o = await bulk.mutateAsync({ deviceIds: devices.map((d) => d.id), userId: user.id, note: note.trim() || undefined, dueAt: dueAt || undefined }).catch(() => null);
    if (o) {
      setOutcome(o);
      if (o.ok) toast.success(`${o.ok} cihaz ${user.name} kişisine zimmetlendi`);
    }
  };
  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && outcome?.ok) onDone(); }} title="Toplu zimmet" description={`${devices.length} cihaz tek personele zimmetlenecek`}
      footer={outcome ? <Button variant="primary" onClick={() => { onOpenChange(false); if (outcome.ok) onDone(); }}>Tamam</Button> : <><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" disabled={!user} loading={bulk.isPending} onClick={submit}>{devices.length} cihazı zimmetle</Button></>}>
      {outcome ? <BulkResult outcome={outcome} devices={devices} /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">{devices.slice(0, 12).map((d) => <span key={d.id} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-muted">{d.assetTag}</span>)}{devices.length > 12 && <span className="px-1 py-1 text-xs text-fg-subtle">+{devices.length - 12}</span>}</div>
          <UserPicker selected={user} onSelect={setUser} />
          <Input label="Planlı iade tarihi (isteğe bağlı)" type="date" min={new Date().toISOString().slice(0, 10)} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <Textarea label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </div>
      )}
    </Modal>
  );
}

export function BulkStatusDialog({ open, onOpenChange, devices, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; devices: Device[]; onDone: () => void }) {
  const bulk = useBulkStatus();
  const [status, setStatus] = useState<DeviceStatus>('IN_STOCK');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  useEffect(() => {
    if (open) (setStatus('IN_STOCK'), setNote(''), setOutcome(null));
  }, [open]);
  const assigned = devices.filter((d) => d.status === 'ASSIGNED').length;
  const submit = async () => {
    const o = await bulk.mutateAsync({ ids: devices.map((d) => d.id), status, note: note.trim() || undefined }).catch(() => null);
    if (o) {
      setOutcome(o);
      if (o.ok) toast.success(`${o.ok} cihazın durumu güncellendi`);
    }
  };
  return (
    <Modal open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && outcome?.ok) onDone(); }} title="Toplu durum değişikliği" description={`${devices.length} cihaz`}
      footer={outcome ? <Button variant="primary" onClick={() => { onOpenChange(false); if (outcome.ok) onDone(); }}>Tamam</Button> : <><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" loading={bulk.isPending} onClick={submit}>Uygula</Button></>}>
      {outcome ? <BulkResult outcome={outcome} devices={devices} /> : (
        <div className="space-y-4">
          <div className="grid gap-2">
            {(['IN_STOCK', 'FAULTY', 'RETIRED'] as DeviceStatus[]).map((s) => (
              <button type="button" key={s} onClick={() => setStatus(s)} className={cn('flex items-center justify-between rounded-xl border p-3 text-left transition', status === s ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}>
                <StatusBadge status={s} />{status === s && <Check className="size-4 text-accent" />}
              </button>
            ))}
          </div>
          {assigned > 0 && <div className="flex gap-3 rounded-xl bg-warning/12 p-3 text-sm text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Seçilenlerin <b className="font-medium">{assigned}</b> tanesi zimmetli; zimmetleri <b className="font-medium">otomatik düşülecek</b>.</p></div>}
          <Textarea label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </div>
      )}
    </Modal>
  );
}

/* ───────── İade al ───────── */
export type ReturnTarget = Pick<Device, 'id' | 'brand' | 'model'> & { holder?: { name: string } | null };

export function ReturnDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: ReturnTarget | null }) {
  const ret = useReturnDevice();
  const [condition, setCondition] = useState<'OK' | 'FAULTY'>('OK');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) (setCondition('OK'), setNote(''));
  }, [open]);

  const submit = async () => {
    if (!device) return;
    await ret.mutateAsync({ id: device.id, condition, note: note.trim() || undefined }).then(() => {
      toast.success('Zimmet düşüldü', { description: condition === 'OK' ? `${device.brand} ${device.model} depoya döndü` : `${device.brand} ${device.model} arızalı olarak işaretlendi` });
      onOpenChange(false);
    }).catch(() => {});
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Cihazı iade al"
      description={device ? `${device.brand} ${device.model} · ${device.holder?.name ?? ''}` : undefined}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" loading={ret.isPending} onClick={submit}>İade al</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {([['OK', 'Sağlam', 'Depoya döner', Check], ['FAULTY', 'Arızalı', 'Arızalı olarak işaretlenir', Wrench]] as const).map(([v, label, hint, Icon]) => (
            <button type="button" key={v} onClick={() => setCondition(v)} className={cn('rounded-xl border p-3 text-left transition', condition === v ? (v === 'OK' ? 'border-success bg-success/10' : 'border-danger bg-danger/10') : 'border-border hover:border-border-strong')}>
              <Icon className={cn('mb-1.5 size-4', v === 'OK' ? 'text-success' : 'text-danger')} />
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-fg-subtle">{hint}</p>
            </button>
          ))}
        </div>
        <Textarea label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Teslim durumu, eksik aksesuar vb." className="min-h-16" />
      </div>
    </Modal>
  );
}

/* ───────── Durum değiştir ───────── */
export function StatusDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: Device | null }) {
  const setStatus = useSetStatus();
  const [status, setSt] = useState<DeviceStatus>('IN_STOCK');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open && device) {
      setSt(device.status === 'ASSIGNED' ? 'FAULTY' : device.status);
      setNote('');
    }
  }, [open, device]);
  const auto = device?.status === 'ASSIGNED' && status !== 'ASSIGNED';
  const options: DeviceStatus[] = ['IN_STOCK', 'FAULTY', 'RETIRED'];

  const submit = async () => {
    if (!device) return;
    await setStatus.mutateAsync({ id: device.id, status, note: note.trim() || undefined }).then((r) => {
      toast.success(`Durum: ${STATUS_LABEL[status]}`, { description: r.autoReturned ? 'Zimmet otomatik olarak düşüldü' : undefined });
      onOpenChange(false);
    }).catch(() => {});
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Durumu değiştir" description={device ? `${device.brand} ${device.model}` : undefined}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" loading={setStatus.isPending} disabled={status === device?.status} onClick={submit}>Uygula</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-2">
          {options.map((s) => (
            <button type="button" key={s} onClick={() => setSt(s)} className={cn('flex items-center justify-between rounded-xl border p-3 text-left transition', status === s ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}>
              <StatusBadge status={s} />
              {status === s && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
        {auto && (
          <div className="flex gap-3 rounded-xl bg-warning/12 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Cihaz şu an <b className="font-medium">{device?.holder?.name}</b> üzerinde. Bu işlemle zimmet <b className="font-medium">otomatik düşülecek</b>.</p>
          </div>
        )}
        <Textarea label="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
      </div>
    </Modal>
  );
}

/* ───────── Arıza bildir (personel & yönetici) ───────── */
export function FaultDialog({ open, onOpenChange, device }: { open: boolean; onOpenChange: (o: boolean) => void; device: Device | null }) {
  const report = useReportFault();
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  const submit = async () => {
    if (!device) return;
    await report.mutateAsync({ id: device.id, note: note.trim() || undefined }).then(() => {
      toast.success('Arıza bildirildi', { description: 'Cihaz zimmetinizden düşüldü ve bakıma alındı' });
      onOpenChange(false);
    }).catch(() => {});
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Arıza bildir" description={device ? `${device.brand} ${device.model} · ${device.assetTag}` : undefined}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="danger" loading={report.isPending} onClick={submit}>Arıza bildir</Button></>}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl bg-warning/12 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>Arıza bildirildiğinde cihaz <b className="font-medium">zimmetinizden otomatik düşer</b> ve “Arızalı” durumuna alınır.</p>
        </div>
        <Textarea label="Arıza açıklaması" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ne oldu? Örn. Ekran açılmıyor" autoFocus />
      </div>
    </Modal>
  );
}
