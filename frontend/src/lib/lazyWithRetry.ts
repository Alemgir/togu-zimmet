import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'zimmet_chunk_reload_at';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Yeni sürüm yayınlanınca açık duran sekmedeki eski JS parça (chunk) adları artık sunucuda yoktur;
 * sayfa yüklenemez ve uygulama kilitlenir. Çözüm: bir kez yeniden dene, olmazsa sayfayı yenile
 * (taze index.html doğru dosya adlarını getirir). Sonsuz yenileme döngüsünü 15 sn'lik koruma engeller.
 */
export function shouldReloadForChunkError(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export type LazyPage<T extends ComponentType<any>> = LazyExoticComponent<T> & { preload: () => Promise<unknown> };

export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>, retryDelayMs = 400): LazyPage<T> {
  const load = async (): Promise<{ default: T }> => {
    try {
      return await factory();
    } catch {
      await sleep(retryDelayMs);
      try {
        return await factory();
      } catch (e) {
        if (shouldReloadForChunkError()) {
          window.location.reload();
          return new Promise<never>(() => {}); // sayfa yenilenirken bekle
        }
        throw e;
      }
    }
  };
  const Comp = lazy(load) as LazyPage<T>;
  Comp.preload = () => factory().catch(() => undefined);
  return Comp;
}

// Vite, dinamik import önyükleme hatasında bu olayı yayar: tek seferlik yenileme ile toparla
export function installChunkErrorRecovery() {
  window.addEventListener('vite:preloadError', (e) => {
    if (shouldReloadForChunkError()) {
      e.preventDefault();
      window.location.reload();
    }
  });
}
