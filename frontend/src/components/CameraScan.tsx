import { useEffect, useId, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { safeStop, type Scanner } from '@/lib/camera';

/** Sürekli kamera taraması. Aynı kod 2,5 sn içinde tekrar bildirilmez. */
export function CameraScan({ onCode }: { onCode: (code: string) => void }) {
  const id = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    let cancelled = false;
    let scanner: Scanner | null = null;
    const last = { code: '', at: 0 };
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const s = new Html5Qrcode(id);
        scanner = s;
        await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (text) => {
          const now = Date.now();
          if (text === last.code && now - last.at < 2500) return;
          last.code = text;
          last.at = now;
          cb.current(text);
        }, () => {});
      } catch {
        if (!cancelled) setError('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin ya da kodu elle girin.');
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      safeStop(scanner);
    };
  }, [id]);

  return (
    <div className="space-y-2">
      <div id={id} className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface-2 [&_video]:object-cover" />
      {error && <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><Camera className="size-4 shrink-0" />{error}</p>}
    </div>
  );
}
