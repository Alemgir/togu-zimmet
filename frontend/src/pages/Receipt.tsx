import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAssignment, useMyDevices, useUser } from '@/api/hooks';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { receiptNo as fmtReceipt, RETURN_REASON_LABEL, typeLabel } from '@/lib/labels';
import { Skeleton } from '@/components/ui/Misc';
import { Cell, DocFooter, DocHeader, DocPage, SignatureBlock } from '@/components/Doc';

/** Tek zimmet için teslim tutanağı (iade edilmişse iade tutanağı da üretilebilir). */
export function ReceiptPage() {
  const { id } = useParams();
  const { data: a, isLoading, isError } = useAssignment(id);
  const [mode, setMode] = useState<'deliver' | 'return'>('deliver');
  if (isLoading) return <Skeleton className="mx-auto h-[600px] max-w-[794px] rounded-lg" />;
  if (isError || !a) return <p className="py-20 text-center text-sm text-fg-muted">Tutanak bulunamadı veya erişim yetkiniz yok.</p>;

  const isReturn = mode === 'return' && !!a.returnedAt;
  const no = fmtReceipt(a.receiptNo, a.assignedAt);
  const d = a.device;
  const person = `${a.user.name}${a.user.title ? ` (${a.user.title})` : ''}`;

  return (
    <DocPage
      toolbar={
        a.returnedAt && (
          <div className="inline-flex rounded-xl bg-surface-2 p-1">
            {([['deliver', 'Teslim tutanağı'], ['return', 'İade tutanağı']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition', mode === v ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')}>{l}</button>
            ))}
          </div>
        )
      }
    >
      <DocHeader no={isReturn ? `${no}-İ` : no} date={fmtDate(isReturn ? a.returnedAt : a.assignedAt)} title={isReturn ? 'ZİMMET İADE TUTANAĞI' : 'ZİMMET TESLİM TUTANAĞI'} />
      <p className="mb-4">
        {isReturn ? (
          <>Aşağıda özellikleri belirtilen demirbaş, <b>{person}</b>{a.user.department ? <> ({a.user.department})</> : null} tarafından <b>{fmtDate(a.returnedAt)}</b> tarihinde iade edilmiş ve zimmetten düşülmüştür.</>
        ) : (
          <>Aşağıda özellikleri belirtilen demirbaş, <b>{fmtDate(a.assignedAt)}</b> tarihinde <b>{person}</b>{a.user.department ? <> ({a.user.department})</> : null} adına zimmetlenmiştir.</>
        )}
      </p>
      <table className="w-full border border-neutral-300 text-sm">
        <tbody>
          <Cell k="Demirbaş no" v={<b className="font-mono">{d.assetTag}</b>} />
          <Cell k="Cihaz" v={`${d.brand} ${d.model}`} />
          <Cell k="Tür" v={typeLabel(d.type)} />
          <Cell k="Seri numarası" v={<span className="font-mono">{d.serialNumber}</span>} />
          <Cell k="Alım tarihi" v={fmtDate(d.purchaseDate)} />
          {d.warrantyEnd && <Cell k="Garanti bitişi" v={fmtDate(d.warrantyEnd)} />}
          {d.location && <Cell k="Konum" v={d.location} />}
          {!isReturn && a.dueAt && <Cell k="Planlı iade tarihi" v={<b>{fmtDate(a.dueAt)}</b>} />}
          {isReturn && <Cell k="İade durumu" v={a.returnReason ? RETURN_REASON_LABEL[a.returnReason] : 'İade alındı'} />}
          {(isReturn ? a.returnNote : a.note) && <Cell k="Not" v={isReturn ? a.returnNote : a.note} />}
        </tbody>
      </table>
      <p className="mt-5 text-xs text-neutral-700">
        {isReturn
          ? 'İade alan, cihazın yukarıda belirtilen durumda teslim alındığını beyan eder; bu tarihten itibaren zimmet sorumluluğu sona ermiştir.'
          : 'Teslim alan; cihazı çalışır ve eksiksiz durumda teslim aldığını, kurum mevzuatı ve taşınır mal yönetimi esaslarına uygun biçimde özenle kullanacağını, kaybolması veya hasar görmesi hâlinde sorumluluğu üstleneceğini kabul eder.'}
      </p>
      <SignatureBlock
        left={isReturn ? { role: 'İade eden', name: a.user.name, sub: a.user.title } : { role: 'Teslim eden', name: a.assignedBy.name, sub: a.assignedBy.title ?? 'Sistem Yöneticisi' }}
        right={isReturn ? { role: 'İade alan', name: a.returnedBy?.name ?? '—', sub: a.returnedBy?.title ?? 'Sistem Yöneticisi' } : { role: 'Teslim alan', name: a.user.name, sub: a.user.title }}
      />
      <DocFooter />
      <p className="no-print mt-3 text-center text-[11px] text-neutral-400">{fmtDateTime(a.assignedAt)} · kayıt #{a.id.slice(-6)}</p>
    </DocPage>
  );
}

/** Bir personelin üzerindeki tüm cihazların zimmet föyü. */
export function PersonSheetPage() {
  const { userId = '' } = useParams();
  const { user: me } = useAuth();
  const mine = userId === 'me';
  const remote = useUser(mine ? undefined : userId);
  const own = useMyDevices();
  if ((mine ? own.isLoading : remote.isLoading)) return <Skeleton className="mx-auto h-[600px] max-w-[794px] rounded-lg" />;
  if (!mine && (remote.isError || !remote.data)) return <p className="py-20 text-center text-sm text-fg-muted">Kullanıcı bulunamadı veya erişim yetkiniz yok.</p>;

  const person = mine ? me! : remote.data!.user;
  const rows = mine
    ? (own.data ?? []).map((d) => ({ id: d.id, tag: d.assetTag, name: `${d.brand} ${d.model}`, serial: d.serialNumber, at: d.assignedAt!, due: d.dueAt, no: d.receiptNo ? fmtReceipt(d.receiptNo, d.assignedAt!) : '—' }))
    : remote.data!.activeAssignments.map((a) => ({ id: a.id, tag: a.device.assetTag, name: `${a.device.brand} ${a.device.model}`, serial: a.device.serialNumber, at: a.assignedAt, due: a.dueAt, no: fmtReceipt(a.receiptNo, a.assignedAt) }));

  return (
    <DocPage>
      <DocHeader no={`ZF-${new Date().getFullYear()}-${person.id.slice(-5).toUpperCase()}`} date={fmtDate(new Date().toISOString())} title="PERSONEL ZİMMET FÖYÜ" />
      <table className="mb-5 w-full border border-neutral-300 text-sm">
        <tbody>
          <Cell k="Ad soyad" v={<b>{person.name}</b>} />
          {person.title && <Cell k="Unvan" v={person.title} />}
          {person.department && <Cell k="Birim" v={person.department} />}
          <Cell k="Toplam zimmetli cihaz" v={<b>{rows.length}</b>} />
        </tbody>
      </table>
      {rows.length === 0 ? <p className="rounded border border-dashed border-neutral-300 p-6 text-center text-neutral-500">Üzerinde zimmetli cihaz bulunmamaktadır.</p> : (
        <table className="w-full border border-neutral-300 text-[12px]">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>{['#', 'Demirbaş no', 'Cihaz', 'Seri no', 'Zimmet tarihi', 'Planlı iade', 'Tutanak'].map((h) => <th key={h} className="border-b border-neutral-300 px-2.5 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-neutral-200 last:border-0">
                <td className="px-2.5 py-2">{i + 1}</td>
                <td className="px-2.5 py-2 font-mono font-semibold">{r.tag}</td>
                <td className="px-2.5 py-2">{r.name}</td>
                <td className="px-2.5 py-2 font-mono">{r.serial}</td>
                <td className="px-2.5 py-2">{fmtDate(r.at)}</td>
                <td className="px-2.5 py-2">{r.due ? fmtDate(r.due) : '—'}</td>
                <td className="px-2.5 py-2 font-mono text-[11px]">{r.no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-5 text-xs text-neutral-700">Yukarıda listelenen demirbaşları çalışır ve eksiksiz durumda teslim aldığımı, kurum mevzuatına uygun kullanacağımı ve iade tarihine kadar koruyacağımı kabul ederim.</p>
      <SignatureBlock left={{ role: 'Zimmet sorumlusu', name: 'Sistem Yöneticisi', sub: 'Yapay Zeka ve Dijital Dönüşüm Koord.' }} right={{ role: 'Teslim alan', name: person.name, sub: person.title }} />
      <DocFooter />
    </DocPage>
  );
}
