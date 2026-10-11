import { useEffect, useState, type FormEvent } from 'react';
import { Dices, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';
import { useCreateUser, useDepartments, useResetPassword, useTitles, useUpdateUser } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Combobox } from '@/components/ui/Combobox';
import { Drawer, Modal } from '@/components/ui/Overlay';
import type { User } from '@/lib/types';

export function validatePassword(p: string): string {
  if (p.length < 8) return 'Şifre en az 8 karakter olmalı';
  if (!/[A-Za-z]/.test(p)) return 'Şifre en az bir harf içermeli';
  if (!/\d/.test(p)) return 'Şifre en az bir rakam içermeli';
  return '';
}

export function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.getRandomValues(new Uint32Array(10));
  const body = Array.from(buf, (n) => chars[n % chars.length]).join('');
  return `${body}7a`;
}

function PasswordInput({ label, value, onChange, error, withGenerate }: { label: string; value: string; onChange: (v: string) => void; error?: string; withGenerate?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input label={label} type={show ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} error={error} className="pr-[5.5rem]" />
        <div className="absolute right-1 top-[1.65rem] flex">
          {withGenerate && (
            <button type="button" title="Rastgele güçlü şifre üret" onClick={() => { onChange(generatePassword()); setShow(true); }} className="flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-hover hover:text-fg"><Dices className="size-4" /></button>
          )}
          <button type="button" aria-label={show ? 'Gizle' : 'Göster'} onClick={() => setShow((s) => !s)} className="flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-hover hover:text-fg">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
      </div>
    </div>
  );
}

const empty = { name: '', email: '', role: 'STAFF', department: '', title: '', password: '' };

export function UserFormDrawer({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user?: User | null }) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const depts = useDepartments();
  const titles = useTitles();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = !!user;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(user ? { name: user.name, email: user.email, role: user.role, department: user.department ?? '', title: user.title ?? '', password: '' } : empty);
  }, [open, user]);

  const set = (k: keyof typeof empty) => (v: string) => (setF((s) => ({ ...s, [k]: v })), setErrors((s) => ({ ...s, [k]: '' })));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (f.name.trim().length < 2) err.name = 'Ad soyad en az 2 karakter olmalı';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) err.email = 'Geçerli bir e-posta girin';
    if (f.role === 'UNIT_MANAGER' && !f.department.trim()) err.department = 'Birim sorumlusu için birim zorunlu';
    if (!editing) {
      const pe = validatePassword(f.password);
      if (pe) err.password = pe;
    }
    setErrors(err);
    if (Object.keys(err).length) return;
    const { password, ...rest } = f;
    try {
      if (editing) {
        await update.mutateAsync({ id: user!.id, ...rest, name: rest.name.trim(), email: rest.email.trim() });
        toast.success('Kullanıcı güncellendi');
      } else {
        await create.mutateAsync({ ...rest, name: rest.name.trim(), email: rest.email.trim(), password });
        toast.success('Kullanıcı oluşturuldu', { description: rest.name });
      }
      onOpenChange(false);
    } catch (ex) {
      const m = errorMessage(ex);
      if (/e-posta/i.test(m)) setErrors({ email: m });
      else toast.error(m);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'}
      description={editing ? user!.email : 'Personel hesabı oluşturun'}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" type="submit" form="user-form" loading={create.isPending || update.isPending}>{editing ? 'Kaydet' : 'Oluştur'}</Button></>}
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Ad soyad" value={f.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} autoFocus />
        <Input label="E-posta" type="email" value={f.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} placeholder="ad.soyad@gop.edu.tr" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Rol" value={f.role} onChange={(e) => set('role')(e.target.value)}>
            <option value="STAFF">Standart personel</option>
            <option value="UNIT_MANAGER">Birim sorumlusu</option>
            <option value="ADMIN">Yönetici</option>
          </Select>
          <Combobox label="Birim / Departman" fieldLabel="Birim" value={f.department} onChange={set('department')} options={depts.data ?? []} max={100} error={errors.department} placeholder="Seçin veya yazın" hint="Listede yoksa yazın: yeni birim olarak eklenir" />
        </div>
        <Combobox label="Unvan" fieldLabel="Unvan" value={f.title} onChange={set('title')} options={titles.data ?? []} max={100} placeholder="Seçin veya yazın" />
        {!editing && <PasswordInput label="Geçici şifre" value={f.password} onChange={set('password')} error={errors.password} withGenerate />}
        {f.role === 'ADMIN' && <p className="rounded-xl bg-warning/12 p-3 text-xs text-warning">Yöneticiler kullanıcı, envanter ve zimmet işlemlerinin tamamına erişebilir.</p>}
        {f.role === 'UNIT_MANAGER' && <p className="rounded-xl bg-info/12 p-3 text-xs text-info">Birim sorumlusu yalnızca <b>kendi biriminin</b> cihaz, zimmet ve arıza kayıtlarını görür; arıza bildirebilir. Kayıt oluşturma/düzenleme yetkisi yoktur.</p>}
      </form>
    </Drawer>
  );
}

export function ResetPasswordDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: User | null }) {
  const reset = useResetPassword();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) (setPw(''), setErr(''));
  }, [open]);
  const submit = async () => {
    const e = validatePassword(pw);
    if (e) return setErr(e);
    await reset.mutateAsync({ id: user!.id, newPassword: pw }).then(() => {
      toast.success('Şifre sıfırlandı', { description: `${user!.name} yeniden giriş yapmalı` });
      onOpenChange(false);
    }).catch(() => {});
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Şifreyi sıfırla" description={user?.name}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Vazgeç</Button><Button variant="primary" loading={reset.isPending} onClick={submit}>Şifreyi değiştir</Button></>}>
      <div className="space-y-3">
        <PasswordInput label="Yeni şifre" value={pw} onChange={(v) => (setPw(v), setErr(''))} error={err} withGenerate />
        <p className="text-xs text-fg-subtle">Kullanıcının açık oturumları sonlandırılır.</p>
      </div>
    </Modal>
  );
}
