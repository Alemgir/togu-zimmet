import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';

/** Yazdırılabilir resmî belge çerçevesi: ekranda kâğıt gibi, yazdırırken yalnızca belge. */
export function DocPage({ toolbar, children }: { toolbar?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />Geri</Button>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <Button variant="primary" onClick={() => window.print()}><Printer className="size-4" />Yazdır / PDF kaydet</Button>
        </div>
      </div>
      <article className="print-doc mx-auto max-w-[794px] rounded-lg border border-border bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-md">{children}</article>
    </div>
  );
}

export function DocHeader({ no, date, title }: { no: string; date: string; title: string }) {
  return (
    <header>
      <div className="flex items-start justify-between gap-6 border-b-2 border-[#462b55] pb-4">
        <div className="w-[230px]"><Logo /></div>
        <div className="text-right text-xs text-neutral-600">
          <p>Belge no: <b className="font-mono text-neutral-900">{no}</b></p>
          <p className="mt-0.5">Tarih: <b className="text-neutral-900">{date}</b></p>
        </div>
      </div>
      <h1 className="mt-6 text-center text-lg font-bold tracking-wide">{title}</h1>
      <p className="mb-5 text-center text-xs text-neutral-600">Yapay Zeka ve Dijital Dönüşüm Koordinatörlüğü</p>
    </header>
  );
}

export function SignatureBlock({ left, right }: { left: { role: string; name: string; sub?: string | null }; right: { role: string; name: string; sub?: string | null } }) {
  return (
    <div className="mt-14 grid grid-cols-2 gap-12 break-inside-avoid">
      {[left, right].map((s) => (
        <div key={s.role} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{s.role}</p>
          <div className="mt-12 border-t border-neutral-800 pt-1.5">
            <p className="font-semibold">{s.name}</p>
            {s.sub && <p className="text-xs text-neutral-600">{s.sub}</p>}
            <p className="mt-0.5 text-[11px] text-neutral-500">İmza</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const DocFooter = () => (
  <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[10.5px] text-neutral-500">
    Bu belge Zimmet Yönetim Sistemi tarafından otomatik oluşturulmuştur. · Tokat Gaziosmanpaşa Üniversitesi
  </footer>
);

export const Cell = ({ k, v }: { k: string; v: ReactNode }) => (
  <tr className="border-b border-neutral-200 last:border-0">
    <th className="w-44 bg-neutral-50 px-3 py-2 text-left text-xs font-semibold text-neutral-600">{k}</th>
    <td className="px-3 py-2">{v}</td>
  </tr>
);
