import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchQrBatch } from '@/api/hooks';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Misc';
import { Logo } from '@/components/brand/Logo';
import { DocPage } from '@/components/Doc';

const LAYOUTS = {
  // A4 (12 mm kenar boşluğu → 186 × 273 mm kullanılabilir alan): 3×60 mm + boşluklar, 8×33 mm + boşluklar
  small: { name: 'Küçük · 3×8 (24 etiket)', cols: 3, w: 60, h: 33, qr: 22 },
  medium: { name: 'Orta · 2×6 (12 etiket)', cols: 2, w: 90, h: 44, qr: 32 },
} as const;

/** Seçilen cihazlar için A4 toplu QR etiket sayfası. */
export default function Labels() {
  const [sp] = useSearchParams();
  const ids = useMemo(() => (sp.get('ids') ?? '').split(',').filter(Boolean), [sp]);
  const [layout, setLayout] = useState<keyof typeof LAYOUTS>('small');
  const { data, isLoading } = useQuery({ queryKey: ['qr-batch', ids], enabled: ids.length > 0, queryFn: () => fetchQrBatch(ids), staleTime: Infinity });
  const L = LAYOUTS[layout];

  return (
    <DocPage
      toolbar={
        <div className="inline-flex rounded-xl bg-surface-2 p-1">
          {(Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]).map((k) => (
            <button key={k} onClick={() => setLayout(k)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition', layout === k ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')}>{LAYOUTS[k].name}</button>
          ))}
        </div>
      }
    >
      {isLoading ? <Skeleton className="h-96" /> : !data?.length ? (
        <p className="py-16 text-center text-sm text-neutral-500">Etiket oluşturulacak cihaz seçilmedi.</p>
      ) : (
        <div className="label-sheet grid justify-center gap-1" style={{ gridTemplateColumns: `repeat(${L.cols}, ${L.w}mm)` }}>
          {data.map((d) => (
            <div key={d.id} className="flex break-inside-avoid items-center gap-[2.2mm] overflow-hidden border border-dashed border-neutral-400 p-[2mm] text-neutral-900" style={{ width: `${L.w}mm`, height: `${L.h}mm` }}>
              <img src={d.dataUrl} alt={`${d.assetTag} QR`} style={{ width: `${L.qr}mm`, height: `${L.qr}mm` }} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="mb-[1.2mm] flex items-center gap-[1.2mm]"><div style={{ width: `${L.qr * 0.28}mm` }} className="shrink-0"><Logo variant="symbol" /></div><p className="text-[5pt] font-bold leading-[1.15]">TOKAT GAZİOSMANPAŞA<br />ÜNİVERSİTESİ · YZ ve Dijital Dönüşüm</p></div>
                <p className="font-mono font-bold" style={{ fontSize: layout === 'small' ? '9pt' : '13pt' }}>{d.assetTag}</p>
                <p className="truncate text-[7.5pt]">{d.brand} {d.model}</p>
                <p className="truncate font-mono text-[6pt] text-neutral-500">{d.serialNumber}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DocPage>
  );
}
