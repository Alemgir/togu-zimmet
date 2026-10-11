import { useEffect, useRef } from 'react';

const TILE = '<svg viewBox="0 0 100 100" style="display:block;width:100%;height:100%"><path fill-rule="evenodd" d="M2 2H98V98H2Z M98 98V30A68 68 0 0 0 30 98Z"/></svg>';

/**
 * Logonun birim şeklinden esinlenen çini kafes. İmleç yaklaştıkça çiniler döner ve parlar.
 * Dokunmatik cihazlarda ve "azaltılmış hareket" tercihinde statik/sakin kalır.
 */
export function ChiniBackground() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    type T = { el: HTMLElement; base: number; cur: number; ph: number; cx: number; cy: number };
    let tiles: T[] = [];
    let px = -999, py = -999, raf = 0;

    const build = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const size = w < 700 ? 64 : 92;
      const cols = Math.ceil(w / size) + 1, rows = Math.ceil(h / size) + 1;
      el.innerHTML = '';
      const grid = document.createElement('div');
      Object.assign(grid.style, { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gridAutoRows: `${size}px`, justifyContent: 'center', alignContent: 'center', width: '100%', height: '100%' });
      el.appendChild(grid);
      tiles = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const t = document.createElement('i');
          t.innerHTML = TILE;
          t.style.cssText = `display:block;padding:${size * 0.06}px;will-change:transform,opacity`;
          const path = t.querySelector('path')!;
          path.setAttribute('fill', (r * 5 + c * 3) % 3 === 0 ? 'var(--tile-purple)' : 'var(--teal)');
          grid.appendChild(t);
          tiles.push({ el: t, base: ((r + c * 2) % 4) * 90, cur: 0, ph: r * 0.7 + c * 0.45, cx: 0, cy: 0 });
        }
      }
      requestAnimationFrame(() => {
        for (const t of tiles) {
          const b = t.el.getBoundingClientRect();
          t.cx = b.left + b.width / 2;
          t.cy = b.top + b.height / 2;
        }
        if (reduce) frame(0);
      });
    };

    const frame = (now: number) => {
      const dark = document.documentElement.classList.contains('dark');
      const base = dark ? 0.2 : 0.13;
      for (const t of tiles) {
        const d = Math.hypot(px - t.cx, py - t.cy);
        const inf = reduce ? 0 : Math.max(0, 1 - d / 260);
        const wave = reduce ? 0 : Math.sin(now / 1800 + t.ph) * 6;
        t.cur += (t.base + inf * 180 + wave - t.cur) * 0.14;
        t.el.style.transform = `rotate(${t.cur.toFixed(1)}deg) scale(${(1 + inf * 0.14).toFixed(3)})`;
        t.el.style.opacity = (base + inf * 0.5).toFixed(3);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    let rt: number;
    const onResize = () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        build();
        if (!reduce) raf = requestAnimationFrame(frame);
      }, 150);
    };

    build();
    if (!reduce) raf = requestAnimationFrame(frame);
    addEventListener('pointermove', onMove);
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(rt);
      removeEventListener('pointermove', onMove);
      removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <div ref={host} aria-hidden className="pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(60% 55% at 50% 50%, var(--bg) 0%, color-mix(in srgb, var(--bg) 75%, transparent) 45%, transparent 100%)' }} />
    </>
  );
}
