import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { ChiniBackground } from '@/components/brand/ChiniBackground';
import { ButtonLogoSpinner, Logo, LogoPlate } from '@/components/brand/Logo';
import { WELCOME_KEY } from '@/components/brand/WelcomeSplash';
import { ThemeToggle } from '@/components/ThemeToggle';

const DEMO = import.meta.env.VITE_DEMO_LOGIN !== 'false';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  if (!loading && user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      sessionStorage.setItem(WELCOME_KEY, '1'); // karşılama animasyonu oturum başına bir kez
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setError('');
  };

  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 py-8">
      <ChiniBackground />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <motion.div
        key={shake}
        initial={shake === 0 ? { opacity: 0, y: 26, scale: 0.98 } : false}
        animate={shake === 0 ? { opacity: 1, y: 0, scale: 1 } : { x: [0, -8, 8, -6, 6, 0] }}
        transition={shake === 0 ? { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] } : { duration: 0.45 }}
        className="w-full max-w-[420px] rounded-3xl border border-border bg-surface/92 p-8 pb-6 shadow-lg backdrop-blur-xl"
      >
        <div className="mx-auto mb-6 w-[250px] max-w-[80%]">
          <LogoPlate className="block"><Logo animate delay={150} /></LogoPlate>
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Tekrar hoş geldiniz</h1>
        <p className="mb-6 mt-1.5 text-center text-sm text-fg-muted">IT Demirbaş ve Zimmet Yönetim Sistemi</p>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="E-posta" type="email" autoComplete="username" icon={<Mail className="size-4" />} placeholder="ad.soyad@gop.edu.tr" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <div className="relative">
            <Input label="Şifre" type={show ? 'text' : 'password'} autoComplete="current-password" icon={<Lock className="size-4" />} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute bottom-0 right-1 flex size-10 items-center justify-center rounded-lg text-fg-subtle hover:text-fg" aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </motion.p>
          )}
          <Button type="submit" variant="primary" size="lg" loading={busy} loadingIndicator={<ButtonLogoSpinner label="Giriş yapılıyor" />} disabled={!email || !password} className="w-full justify-center">
            Giriş yap <ArrowRight className="size-4" />
          </Button>
        </form>

        {DEMO && (
          <div className="mt-5 flex items-center gap-2 border-t border-dashed border-border-strong pt-4 text-xs text-fg-subtle">
            <span className="flex-1">Demo hesap</span>
            <Button size="sm" onClick={() => fill('admin@gop.edu.tr', 'Admin123!')}>Yönetici</Button>
            <Button size="sm" onClick={() => fill('ayse.yilmaz@gop.edu.tr', 'Demo1234')}>Personel</Button>
          </div>
        )}
        <p className="mt-5 text-center text-[11.5px] text-fg-subtle">TOGÜ Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü</p>
      </motion.div>
    </div>
  );
}
