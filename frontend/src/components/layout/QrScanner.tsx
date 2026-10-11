import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ScanLine } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { safeStop, type Scanner } from '@/lib/camera';

/** QR içeriğinden cihaz token'ını çıkarır: tam link (…/scan/<token>) veya çıplak token. */
export function extractToken(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/\/scan\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

export function QrScanner({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const regionId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const scannerRef = useRef<Scanner | null>(null);

  const go = (token: string) => {
    onOpenChange(false);
    navigate(`/scan/${token}`);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    let cancelled = false;
    // Kamera kütüphanesi yalnızca tarayıcı açıldığında yüklenir
    const timer = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            const token = extractToken(text);
            if (token) go(token);
            else setError('Bu QR kodu bir cihaz etiketi değil');
          },
          () => {},
        );
      } catch {
        if (!cancelled) setError('Kameraya erişilemedi. İzin verin veya kodu aşağıya yapıştırın.');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      safeStop(s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, regionId]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="QR ile cihaz bul" description="Cihaz etiketindeki QR kodu kameraya gösterin">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
          <div id={regionId} className="aspect-square w-full [&_video]:object-cover" />
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-fg-subtle">
              <ScanLine className="size-8 animate-pulse" />
            </div>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <Camera className="size-4 shrink-0" /> {error}
          </p>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = extractToken(manual);
            if (t) go(t);
            else setError('Geçerli bir QR bağlantısı veya kodu girin');
          }}
        >
          <div className="flex-1">
            <Input label="Ya da kodu elle girin" placeholder="Bağlantı veya kod" value={manual} onChange={(e) => setManual(e.target.value)} />
          </div>
          <Button type="submit" variant="primary">Bul</Button>
        </form>
      </div>
    </Modal>
  );
}
