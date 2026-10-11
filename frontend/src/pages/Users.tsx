import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { FileText, KeyRound, Laptop, MoreHorizontal, Pencil, Plus, Power, Search, ShieldCheck, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteUser, useDepartments, useUpdateUser, useUser, useUsers } from '@/api/hooks';
import { useAuth } from '@/lib/auth';
import { useListParams } from '@/lib/useListParams';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { RETURN_REASON_LABEL, ROLE_LABEL } from '@/lib/labels';
import type { User } from '@/lib/types';
import { Avatar, Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Combobox } from '@/components/ui/Combobox';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { Pagination } from '@/components/ui/Pagination';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { AssignDialog } from '@/components/devices/DeviceDialogs';
import { ResetPasswordDialog, UserFormDrawer } from '@/components/users/UserDialogs';

function UserDetailDrawer({ id, onClose, onAssign, canAssign }: { id: string | null; onClose: () => void; onAssign: (u: User) => void; canAssign: boolean }) {
  const { data } = useUser(id ?? undefined);
  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()} title={data?.user.name ?? 'Kullanıcı'} description={data ? [data.user.title, data.user.department].filter(Boolean).join(' · ') || data.user.email : undefined}
      footer={data ? <>
        <Link to={`/foy/${data.user.id}`}><Button><FileText className="size-4" />Zimmet föyü</Button></Link>
        {canAssign && data.user.isActive && <Button variant="primary" onClick={() => onAssign(data.user)}><UserPlus className="size-4" />Cihaz zimmetle</Button>}
      </> : undefined}>
      {!data ? <Skeleton className="h-40" /> : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Laptop className="size-4 text-accent" />Üzerindeki cihazlar <span className="rounded-md bg-fg/6 px-1.5 text-xs text-fg-subtle">{data.activeAssignments.length}</span></h3>
            {data.activeAssignments.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-fg-subtle">Zimmetli cihaz yok</p> : (
              <ul className="space-y-2">
                {data.activeAssignments.map((a) => (
                  <li key={a.id}><Link to={`/devices/${a.device.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-accent hover:bg-accent-soft">
                    <DeviceIcon type={a.device.type} size="sm" /><span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-medium">{a.device.brand} {a.device.model}</span><span className="font-mono text-[11px] text-fg-subtle">{a.device.assetTag}</span></span>
                    <span className="text-xs text-fg-subtle">{fmtDate(a.assignedAt)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Geçmiş zimmetler</h3>
            {data.history.length === 0 ? <p className="text-sm text-fg-subtle">Kayıt yok</p> : (
              <ul className="space-y-2">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-3 text-sm">
                    <DeviceIcon type={h.device.type} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.device.brand} {h.device.model}</span><span className="text-xs text-fg-subtle">{fmtDate(h.assignedAt)} → {fmtDate(h.returnedAt)}</span></span>
                    {h.returnReason && <Badge>{RETURN_REASON_LABEL[h.returnReason]}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

export default function UsersPage() {
  const { user: me, isAdmin } = useAuth();
  const p = useListParams();
  const [search, setSearch] = useState(p.get('search'));
  const dSearch = useDebounced(search, 300);
  useEffect(() => {
    if (dSearch !== p.get('search')) p.set({ search: dSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch]);

  const { data, isLoading, isFetching } = useUsers({ page: p.page, pageSize: 10, search: p.get('search'), role: p.get('role'), department: p.get('department'), isActive: p.get('isActive'), sortBy: 'name' });
  const departments = useDepartments().data ?? [];
  const update = useUpdateUser();
  const del = useDeleteUser();

  const [form, setForm] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [reset, setReset] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [toToggle, setToToggle] = useState<User | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<User | null>(null);

  const doDelete = async () => {
    if (!toDelete) return;
    await del.mutateAsync(toDelete.id).then((r) => {
      toast.success(r.mode === 'deleted' ? 'Kullanıcı silindi' : 'Kullanıcı pasife alındı', {
        description: [r.mode === 'deactivated' ? 'Zimmet geçmişi korunduğu için kayıt silinmedi' : null, r.releasedDevices ? `${r.releasedDevices} cihaz otomatik depoya döndü` : null].filter(Boolean).join(' · ') || undefined,
      });
      setToDelete(null);
    }).catch(() => setToDelete(null));
  };

  const doToggle = async () => {
    if (!toToggle) return;
    const activating = !toToggle.isActive;
    await update.mutateAsync({ id: toToggle.id, isActive: activating }).then(() => {
      toast.success(activating ? 'Kullanıcı aktifleştirildi' : 'Kullanıcı pasife alındı', { description: !activating && toToggle.activeDeviceCount ? `${toToggle.activeDeviceCount} cihaz otomatik depoya döndü` : undefined });
      setToToggle(null);
    }).catch(() => setToToggle(null));
  };

  const filtered = !!(p.get('search') || p.get('role') || p.get('department') || p.get('isActive'));

  return (
    <div>
      <PageHeader title="Kullanıcılar" description="Personel hesapları, roller ve zimmet durumları" actions={isAdmin ? <Button variant="primary" onClick={() => setForm({ open: true, user: null })}><Plus className="size-4" />Yeni kullanıcı</Button> : undefined} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, e-posta veya birim ara…" aria-label="Kullanıcı ara" className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm shadow-sm transition placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/40" />
          </div>
          <Select aria-label="Rol" value={p.get('role')} onChange={(e) => p.set({ role: e.target.value })}><option value="">Tüm roller</option><option value="ADMIN">Yönetici</option><option value="UNIT_MANAGER">Birim sorumlusu</option><option value="STAFF">Personel</option></Select>
          <Combobox aria-label="Birim" value={p.get('department')} onChange={(v) => p.set({ department: v })} options={departments} allowCreate={false} clearLabel="Tüm birimler" />
          <Select aria-label="Durum" value={p.get('isActive')} onChange={(e) => p.set({ isActive: e.target.value })}><option value="">Aktif + pasif</option><option value="true">Aktif</option><option value="false">Pasif</option></Select>
        </div>

        {isLoading ? <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div> : !data?.data.length ? (
          <EmptyState icon={<UsersIcon className="size-6" />} title={filtered ? 'Eşleşen kullanıcı yok' : 'Kullanıcı bulunamadı'} description={filtered ? 'Arama veya filtreleri değiştirin.' : undefined} action={filtered ? <Button onClick={() => { setSearch(''); p.clear(); }}>Filtreleri temizle</Button> : undefined} />
        ) : (
          <>
            <ul className={cn('divide-y divide-border transition-opacity', isFetching && 'opacity-60')}>
              {data.data.map((u, i) => (
                <motion.li key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} onClick={() => setDetail(u.id)} className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 p-4 transition hover:bg-surface-hover/60">
                  <div className="flex min-w-[240px] flex-1 items-center gap-3">
                    <Avatar name={u.name} size={40} className={cn(!u.isActive && 'opacity-50')} />
                    <div className="min-w-0 leading-tight">
                      <p className={cn('truncate font-medium', !u.isActive && 'text-fg-muted line-through decoration-fg-subtle/50')}>{u.name}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-fg-subtle">(siz)</span>}</p>
                      <p className="truncate text-xs text-fg-subtle">{u.email}</p>
                    </div>
                  </div>
                  <div className="min-w-[160px] flex-1 text-sm"><p className="truncate">{u.department ?? '—'}</p><p className="truncate text-xs text-fg-subtle">{u.title ?? ''}</p></div>
                  <div className="flex min-w-[170px] items-center gap-2">
                    {u.role === 'ADMIN' ? <Badge tone="accent"><ShieldCheck className="size-3" />Yönetici</Badge> : u.role === 'UNIT_MANAGER' ? <Badge tone="info">{ROLE_LABEL[u.role]}</Badge> : <Badge>Personel</Badge>}
                    {!u.isActive && <Badge tone="danger" dot>Pasif</Badge>}
                  </div>
                  <div className="flex w-24 items-center gap-1.5 text-sm text-fg-muted"><Laptop className="size-4" /><b className="font-medium text-fg tabular-nums">{u.activeDeviceCount ?? 0}</b> cihaz</div>
                  {isAdmin && <div onClick={(e) => e.stopPropagation()}>
                    <Menu.Root>
                      <Menu.Trigger asChild><Button variant="ghost" size="icon" aria-label={`${u.name} işlemleri`}><MoreHorizontal className="size-4" /></Button></Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                          <Menu.Item onSelect={() => setForm({ open: true, user: u })} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover"><Pencil className="size-4" />Düzenle</Menu.Item>
                          <Menu.Item onSelect={() => setReset(u)} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover"><KeyRound className="size-4" />Şifre sıfırla</Menu.Item>
                          {u.id !== me?.id && <Menu.Item onSelect={() => (u.isActive ? setToToggle(u) : update.mutate({ id: u.id, isActive: true }, { onSuccess: () => toast.success('Kullanıcı aktifleştirildi') }))} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover"><Power className="size-4" />{u.isActive ? 'Pasife al' : 'Aktifleştir'}</Menu.Item>}
                          {u.id !== me?.id && (<><Menu.Separator className="my-1 h-px bg-border" /><Menu.Item onSelect={() => setToDelete(u)} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger/10"><Trash2 className="size-4" />Sil</Menu.Item></>)}
                        </Menu.Content>
                      </Menu.Portal>
                    </Menu.Root>
                  </div>}
                </motion.li>
              ))}
            </ul>
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={data.meta.pageSize} onPage={(n) => p.set({ page: n })} />
          </>
        )}
      </Card>

      {isAdmin && <UserFormDrawer open={form.open} onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))} user={form.user} />}
      <ResetPasswordDialog open={!!reset} onOpenChange={(o) => !o && setReset(null)} user={reset} />
      <UserDetailDrawer id={detail} onClose={() => setDetail(null)} onAssign={(u) => setAssignTo(u)} canAssign={isAdmin} />
      <AssignDialog open={!!assignTo} onOpenChange={(o) => !o && setAssignTo(null)} presetUser={assignTo} />
      <ConfirmDialog open={!!toToggle} onOpenChange={(o) => !o && setToToggle(null)} danger loading={update.isPending} title="Kullanıcıyı pasife al" confirmLabel="Pasife al" onConfirm={doToggle}
        description={`${toToggle?.name} artık giriş yapamayacak.`}>
        {!!toToggle?.activeDeviceCount && <p className="rounded-lg bg-warning/12 p-3 text-warning">Üzerindeki <b>{toToggle.activeDeviceCount} cihaz otomatik olarak zimmetten düşülüp depoya dönecek.</b></p>}
      </ConfirmDialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} danger loading={del.isPending} title="Kullanıcıyı sil" confirmLabel="Evet, sil" onConfirm={doDelete}
        description={`${toDelete?.name} hesabı silinecek.`}>
        {!!toDelete?.activeDeviceCount && <p className="rounded-lg bg-warning/12 p-3 text-warning">Üzerindeki <b>{toDelete.activeDeviceCount} cihaz otomatik olarak zimmetten düşülüp depoya dönecek.</b></p>}
        <p className="rounded-lg bg-surface-2 p-3 text-xs">Zimmet geçmişi olan kullanıcılar denetim izini korumak için silinmez, pasife alınır.</p>
      </ConfirmDialog>
    </div>
  );
}
