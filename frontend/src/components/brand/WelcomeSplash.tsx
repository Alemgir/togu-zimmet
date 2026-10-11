import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { Logo, LogoPlate, SYMBOL_RATIO, assembleLogo } from './Logo';

export const WELCOME_KEY = 'zimmet_welcome';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Girişten sonra, oturum başına bir kez gösterilir: logonun 4 birimi birleşir,
 * ardından logo kenar çubuğundaki yerine uçar. Atlanabilir; azaltılmış harekette kısa bir geçiştir.
 */
export function WelcomeSplash() {
  const { user } = useAuth();
  const [open, setOpen] = useState(() => sessionStorage.getItem(WELCOME_KEY) === '1');
  const [hello, setHello] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const logoBox = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let slot: HTMLElement | null = null;
    let fly: HTMLElement | null = null;

    const finish = () => {
      cancelled = true;
      sessionStorage.removeItem(WELCOME_KEY);
      if (slot) slot.style.opacity = '';
      fly?.remove();
      setOpen(false);
    };
    skipRef.current = finish;

    (async () => {
      const box = logoBox.current;
      const svg = box?.querySelector('svg');
      if (!box || !svg) return finish();
      const quick = reduced();
      if (quick) {
        setHello(true);
        await sleep(700);
        if (!cancelled) finish();
        return;
      }
      assembleLogo(svg as SVGSVGElement, { delay: 200, dur: 1200 });
      setTimeout(() => !cancelled && setHello(true), 1500);
      bar.current?.animate([{ width: '0%' }, { width: '100%' }], { duration: 2600, delay: 400, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' });
      await sleep(3100);
      if (cancelled) return;

      // Logo, kenar çubuğundaki yerine uçar (paylaşılan öğe geçişi)
      slot = [...document.querySelectorAll<HTMLElement>('[data-brand-slot]')].find((e) => e.getBoundingClientRect().width > 0) ?? null;
      setLeaving(true);
      if (!slot) {
        await sleep(600);
        if (!cancelled) finish();
        return;
      }
      const from = svg.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      slot.style.opacity = '0';
      fly = document.createElement('div');
      fly.appendChild(svg.cloneNode(true));
      Object.assign(fly.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, zIndex: '110', transformOrigin: '0 0', pointerEvents: 'none' });
      document.body.appendChild(fly);
      box.style.visibility = 'hidden';
      const inner = to.width * (slot.classList.contains('dark:p-1.5') && document.documentElement.classList.contains('dark') ? 0.8 : 1);
      const scale = inner / (from.width * SYMBOL_RATIO);
      const dx = to.left + (to.width - inner) / 2 - from.left;
      const dy = to.top + (to.height - inner) / 2 - from.top;
      fly.querySelectorAll('.lw').forEach((w) => (w as SVGElement).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }));
      await fly.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${scale})` }], { duration: 900, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' }).finished;
      if (!cancelled) finish();
    })();

    return () => {
      cancelled = true;
      fly?.remove();
      if (slot) slot.style.opacity = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && skipRef.current();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-label="Hoş geldiniz" className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg transition-opacity duration-[700ms] ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <div ref={logoBox} className="w-[min(560px,82vw)]">
        <LogoPlate className="block"><Logo /></LogoPlate>
      </div>
      <div className={`text-center transition-all duration-700 ${hello && !leaving ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <h2 className="text-2xl font-semibold tracking-tight">Hoş geldiniz, {user?.name.split(' ')[0]}</h2>
        <p className="mt-1.5 text-sm text-fg-muted">Zimmet sistemi hazırlanıyor…</p>
      </div>
      <div className="h-[3px] w-56 overflow-hidden rounded-full bg-border">
        <div ref={bar} className="h-full w-0 bg-teal" />
      </div>
      <button onClick={() => skipRef.current()} className="absolute bottom-6 right-6 rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-fg-muted shadow-sm transition hover:border-teal hover:text-fg">
        Atla
      </button>
    </div>,
    document.body,
  );
}
