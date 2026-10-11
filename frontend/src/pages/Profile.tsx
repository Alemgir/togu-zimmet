import { useState, type FormEvent } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { ROLE_LABEL } from '@/lib/labels';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { validatePassword } from '@/components/users/UserDialogs';

export default function Profile() {
  const { user, setSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!cur) err.cur = 'Mevcut şifrenizi girin';
    const pe = validatePassword(next);
    if (pe) err.next = pe;
    if (next !== again) err.again = 'Şifreler eşleşmiyor';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const { data } = await api.patch<{ token: string }>('/auth/me/password', { currentPassword: cur, newPassword: next });
      await setSession(data.token);
      toast.success('Şifreniz değiştirildi');
      setCur(''); setNext(''); setAgain('');
    } catch (ex) {
      const m = errorMessage(ex);
      if (/mevcut/i.test(m)) setErrors({ cur: m });
      else toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const themes: { v: Theme; l: string; i: typeof Sun }[] = [{ v: 'light', l: 'Açık', i: Sun }, { v: 'dark', l: 'Koyu', i: Moon }, { v: 'system', l: 'Sistem', i: Monitor }];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profil" description="Hesap bilgileriniz ve tercihleriniz" />
      <div className="space-y-6">
        <Card className="flex items-center gap-4 p-5">
          <Avatar name={user.name} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-fg-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone={user.role === 'ADMIN' ? 'accent' : user.role === 'UNIT_MANAGER' ? 'info' : 'neutral'}>{ROLE_LABEL[user.role]}</Badge>{user.department && <Badge>{user.department}</Badge>}</div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Görünüm</h2>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ v, l, i: Icon }) => (
              <button key={v} onClick={() => setTheme(v)} className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition', theme === v ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>
                <Icon className="size-5" />{l}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Şifre değiştir</h2>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Input label="Mevcut şifre" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} error={errors.cur} />
            <Input label="Yeni şifre" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} hint="En az 8 karakter, harf ve rakam içermeli" />
            <Input label="Yeni şifre (tekrar)" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={errors.again} />
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={busy}>Şifreyi güncelle</Button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
