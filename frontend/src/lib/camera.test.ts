import { safeStop } from './camera';

describe('safeStop (kamera kapatma)', () => {
  it('null/undefined ile hata vermez', () => {
    expect(() => safeStop(null)).not.toThrow();
    expect(() => safeStop(undefined)).not.toThrow();
  });

  it('başarılı durdurmada temizler', async () => {
    const clear = vi.fn();
    safeStop({ stop: () => Promise.resolve(), clear });
    await Promise.resolve();
    await Promise.resolve();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('stop() EŞZAMANLI hata fırlatırsa (kamera hiç başlamadı) çökmez ve yine temizler', () => {
    const clear = vi.fn();
    expect(() =>
      safeStop({
        stop: () => {
          throw new Error('Cannot stop, scanner is not running or paused.');
        },
        clear,
      }),
    ).not.toThrow();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('stop() reddedilirse çökmez ve temizler', async () => {
    const clear = vi.fn();
    safeStop({ stop: () => Promise.reject(new Error('x')), clear });
    await new Promise((r) => setTimeout(r, 0));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('clear() de hata fırlatırsa yutar', async () => {
    expect(() =>
      safeStop({
        stop: () => {
          throw new Error('a');
        },
        clear: () => {
          throw new Error('b');
        },
      }),
    ).not.toThrow();
  });
});
