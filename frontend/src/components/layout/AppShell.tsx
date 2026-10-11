import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { Skeleton } from '@/components/ui/Misc';
import { preloadAllPages } from '@/pages/lazyPages';
import { BarChart3, Boxes, ClipboardCheck, ClipboardList, KeyRound, LayoutDashboard, Laptop, LogOut, ScanLine, Search, Users, Wrench, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { ROLE_LABEL } from '@/lib/labels';
import { Avatar } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { CommandPalette } from './CommandPalette';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { BrandMark } from '@/components/brand/Logo';
import { WelcomeSplash } from '@/components/brand/WelcomeSplash';
import { QrScanner } from './QrScanner';

interface Nav {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
const ADMIN_NAV: Nav[] = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/devices', label: 'Envanter', icon: Boxes },
  { to: '/assignments', label: 'Zimmetler', icon: ClipboardList },
  { to: '/faults', label: 'Arızalar', icon: Wrench },
  { to: '/counts', label: 'Sayım', icon: ClipboardCheck },
  { to: '/reports', label: 'Raporlar', icon: BarChart3 },
  { to: '/users', label: 'Kullanıcılar', icon: Users },
];
const MANAGER_NAV: Nav[] = ADMIN_NAV.filter((n) => n.to !== '/counts');
const STAFF_NAV: Nav[] = [
  { to: '/', label: 'Zimmetlerim', icon: Laptop, end: true },
  { to: '/faults', label: 'Arızalarım', icon: Wrench },
];

function Brand({ compact, onDark }: { compact?: boolean; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className={onDark ? 'bg-white p-1.5' : undefined} />
      {!compact && (
        <div className="leading-tight">
          <p className={cn('text-[15px] font-semibold tracking-tight', onDark && 'text-sb-title')}>Zimmet</p>
          <p className={cn('text-[11px]', onDark ? 'text-sb-fg' : 'text-fg-subtle')}>TOGÜ · Dijital Dönüşüm</p>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-surface-hover" aria-label="Hesap menüsü">
          <Avatar name={user.name} size={34} />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-[13px] font-medium">{user.name}</span>
            <span className="block text-[11px] text-fg-subtle">{ROLE_LABEL[user.role]}</span>
          </span>
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-fg-subtle">{user.email}</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item onSelect={() => navigate('/profile')} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover">
            <KeyRound className="size-4" /> Profil ve şifre
          </Menu.Item>
          <Menu.Item onSelect={() => logout()} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger/10">
            <LogOut className="size-4" /> Çıkış yap
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function AppShell() {
  const { isAdmin, isManager } = useAuth();
  const location = useLocation();
  const nav = isAdmin ? ADMIN_NAV : isManager ? MANAGER_NAV : STAFF_NAV;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    preloadAllPages();
  }, []);

  useEffect(() => {
    const open = () => setScanOpen(true);
    window.addEventListener('open-scanner', open);
    return () => window.removeEventListener('open-scanner', open);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ambient min-h-dvh">
      {/* Masaüstü kenar çubuğu */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sb-border bg-sb p-4 lg:flex">
        <div className="px-2 pb-6 pt-2"><Brand onDark /></div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Ana menü">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'text-sb-title' : 'text-sb-fg hover:bg-sb-hover hover:text-sb-title')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-sb-active shadow-[inset_3px_0_0_var(--teal)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <Icon className="relative size-[18px]" />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => setScanOpen(true)} className="group flex items-center gap-3 rounded-2xl border border-dashed border-sb-border p-3 text-left transition hover:border-teal hover:bg-sb-hover">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sb-active text-teal"><ScanLine className="size-[18px]" /></span>
          <span className="text-[13px] leading-tight"><b className="block font-medium text-sb-title">QR ile cihaz bul</b><span className="text-sb-fg">Etiketi kameraya göster</span></span>
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/75 px-4 backdrop-blur-xl sm:px-6">
          <div className="lg:hidden"><Brand compact /></div>
          <button onClick={() => setPaletteOpen(true)} className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-border bg-surface px-3.5 text-sm text-fg-subtle shadow-sm transition hover:border-border-strong sm:max-w-md" aria-label="Ara">
            <Search className="size-4" />
            <span className="flex-1 text-left">Ara…</span>
            <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] sm:block">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setScanOpen(true)} aria-label="QR tara"><ScanLine className="size-[18px]" /></Button>
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {/* Hata sınırı + Suspense kabuğun İÇİNDE: sayfa yüklenemese bile menü çalışır, başka sayfaya geçilebilir.
              Not: AnimatePresence(mode="wait") KULLANILMAZ; çıkış animasyonu beklemek gezinmeyi kilitleyebilir. */}
          <RouteErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<div className="space-y-4" aria-busy="true"><Skeleton className="h-9 w-64" /><Skeleton className="h-64 rounded-2xl" /></div>}>
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <Outlet />
              </motion.div>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      {/* Mobil alt gezinme */}
      {nav.length > 1 && (
        <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/90 p-1.5 shadow-lg backdrop-blur-xl lg:hidden pb-[max(0.375rem,env(safe-area-inset-bottom))]" aria-label="Alt menü">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-w-[68px] flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors', isActive ? 'bg-accent-soft text-accent' : 'text-fg-muted')}>
              <Icon className="size-5" /> {label}
            </NavLink>
          ))}
        </nav>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <QrScanner open={scanOpen} onOpenChange={setScanOpen} />
      <WelcomeSplash />
    </div>
  );
}
