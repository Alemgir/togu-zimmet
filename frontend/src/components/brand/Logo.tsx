import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { LOGO } from './logoData';

const SYMBOL_VIEWBOX = '-10 0 5240 5240';
export const SYMBOL_RATIO = 5240 / 23255; // sembolün tam logo genişliğine oranı

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 4 birim köşelerden dönerek gelip logoyu oluşturur. Animasyon sonunda logo birebir orijinaldir. */
export function assembleLogo(svg: SVGSVGElement, { delay = 0, dur = 1100 }: { delay?: number; dur?: number } = {}): Promise<unknown> {
  if (reduced()) return Promise.resolve();
  const from: [number, number, number][] = [[1, -1, 100], [-1, -1, -100], [-1, 1, 100], [1, 1, -150]];
  const jobs: Promise<unknown>[] = [];
  svg.querySelectorAll<SVGPathElement>('.lt').forEach((p, i) => {
    const [x, y, r] = from[i]!;
    jobs.push(
      p.animate(
        [{ transform: `translate(${x * 3200}px,${y * 3200}px) rotate(${r}deg) scale(.2)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: dur, delay: delay + i * 110, easing: 'cubic-bezier(.2,.9,.25,1.12)', fill: 'backwards' },
      ).finished,
    );
  });
  svg.querySelectorAll<SVGPathElement>('.lw').forEach((p, i) => {
    jobs.push(
      p.animate([{ transform: 'translateY(900px)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: 650,
        delay: delay + 780 + i * 38,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'backwards',
      }).finished,
    );
  });
  return Promise.all(jobs);
}

interface LogoProps {
  /** full: sembol + yazı (yatay), symbol: yalnızca 4 birimli sembol */
  variant?: 'full' | 'symbol';
  animate?: boolean;
  delay?: number;
  className?: string;
  onAssembled?: () => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

export function Logo({ variant = 'full', animate = false, delay = 0, className, onAssembled, svgRef }: LogoProps) {
  const inner = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!animate || !inner.current) return;
    let alive = true;
    assembleLogo(inner.current, { delay }).then(() => alive && onAssembled?.());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const symbol = variant === 'symbol';
  return (
    <svg
      ref={(el) => {
        inner.current = el;
        if (typeof svgRef === 'function') svgRef(el);
        else if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
      }}
      viewBox={symbol ? SYMBOL_VIEWBOX : LOGO.viewBox}
      role="img"
      aria-label="Tokat Gaziosmanpaşa Üniversitesi"
      className={cn('block h-auto w-full overflow-visible', className)}
    >
      {LOGO.tiles.map((t, i) => (
        <path key={i} className="lt" fill={t.c} d={t.d} />
      ))}
      {!symbol && LOGO.word.map((d, i) => <path key={i} className="lw" fill="#462B55" d={d} />)}
    </svg>
  );
}

/** Koyu temada logo orijinal renklerini korumak için beyaz plaka üzerinde durur (kılavuz: renk değiştirilemez). */
export function LogoPlate({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-block rounded-2xl dark:bg-white dark:px-4 dark:py-3', className)}>{children}</span>;
}

/** Kenar çubuğu / üst çubuk için küçük sembol. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span data-brand-slot className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl dark:bg-white dark:p-1.5', className)}>
      <Logo variant="symbol" className="size-full" />
    </span>
  );
}

/** Yükleme göstergesi: dönen 4 birim. */
export function BrandLoader({ className, label = 'Yükleniyor' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex rounded-xl dark:bg-white dark:p-2', className)}>
      <Logo variant="symbol" className="size-10 animate-[spin_1.1s_cubic-bezier(.6,.1,.3,.9)_infinite]" />
    </span>
  );
}

/** Birincil (mor) düğme içinde yükleme göstergesi: logo rengi değişmesin diye beyaz plaka üzerinde dönen sembol. */
export function ButtonLogoSpinner({ label = 'Yükleniyor' }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-white p-1 shadow-sm">
      <Logo variant="symbol" className="size-5 animate-[spin_1.1s_cubic-bezier(.6,.1,.3,.9)_infinite] motion-reduce:animate-none" />
    </span>
  );
}
