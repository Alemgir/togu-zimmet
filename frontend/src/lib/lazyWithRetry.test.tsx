import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { lazyWithRetry, shouldReloadForChunkError } from './lazyWithRetry';

const reload = vi.fn();
const original = window.location;
beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
});
afterAll(() => Object.defineProperty(window, 'location', { configurable: true, value: original }));

const Page = () => <p>Sayfa yüklendi</p>;
const view = (C: ReturnType<typeof lazyWithRetry>) => render(<Suspense fallback={<p>yükleniyor</p>}><C /></Suspense>);

describe('shouldReloadForChunkError (sonsuz yenileme koruması)', () => {
  it('ilk seferde izin verir, 15 sn içinde tekrar izin vermez, sonra yine verir', () => {
    expect(shouldReloadForChunkError(1_000_000)).toBe(true);
    expect(shouldReloadForChunkError(1_005_000)).toBe(false);
    expect(shouldReloadForChunkError(1_020_000)).toBe(true);
  });
});

describe('lazyWithRetry', () => {
  it('başarılı yüklemede sayfayı gösterir, yenileme yapmaz', async () => {
    view(lazyWithRetry(() => Promise.resolve({ default: Page })));
    expect(await screen.findByText('Sayfa yüklendi')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('ilk deneme başarısız, ikincisi başarılıysa yenilemeden toparlar', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module')).mockResolvedValueOnce({ default: Page });
    view(lazyWithRetry(factory, 10));
    expect(await screen.findByText('Sayfa yüklendi')).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('iki deneme de başarısızsa sayfayı bir kez yeniler (yeni sürüm yayınlanmış olabilir)', async () => {
    view(lazyWithRetry(() => Promise.reject(new Error('404')), 10));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('yükleniyor')).toBeInTheDocument();
  });

  it('yenileme koruması devredeyse hatayı fırlatır (döngüye girmez)', async () => {
    sessionStorage.setItem('zimmet_chunk_reload_at', String(Date.now()));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const C = lazyWithRetry(() => Promise.reject(new Error('404')), 10);
    expect(() => render(<Suspense fallback={null}><C /></Suspense>)).not.toThrow();
    await new Promise((r) => setTimeout(r, 80));
    expect(reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('preload hata fırlatmaz', async () => {
    const C = lazyWithRetry(() => Promise.reject(new Error('x')), 10);
    await expect(C.preload()).resolves.toBeUndefined();
  });
});
