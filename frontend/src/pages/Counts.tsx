import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Plus, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useCounts, useCreateCount } from '@/api/hooks';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Combobox } from '@/components/ui/Combobox';
import { Modal } from '@/components/ui/Overlay';

export default function Counts() {
  const navigate = useNavigate();
  const { data, isLoading } = useCounts();
  const create = useCreateCount();
  const meta = useQuery({ queryKey: ['device-meta'], queryFn: async () => (await api.get<{ locations: string[] }>('/devices/meta')).data });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  useEffect(() => {
    if (open) {
      setName(`Envanter sayımı · ${new Date().toLocaleDateString('tr-TR')}`);
      setLocation('');
    }
  }, [open]);

  const submit = async () => {
    const r = await create.mutateAsync({ name: name.trim(), location: location || null }).catch(() => null);
    if (r) {
      toast.success('Sayım başlatıldı', { description: `${r.progress.expected} cihaz sayılacak` });
      navigate(`/counts/${r.session.id}`);
    }
  };

  return (
    <div>
      <PageHeader title="Envanter sayımı" description="Cihazları QR ile okutarak sayın; eksik ve beklenmeyenleri otomatik bulun" actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" />Yeni sayım</Button>} />
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div> : !data?.length ? (
        <Card><EmptyState icon={<ClipboardCheck className="size-6" />} title="Henüz sayım yapılmadı" description="Bir konum seçip sayım başlatın; telefon kamerası veya barkod okuyucu ile cihazları okutun." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" />İlk sayımı başlat</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s, i) => {
            const p = s.progress!;
            const pct = p.expected ? Math.round((p.scanned / p.expected) * 100) : 0;
            return (
              <motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }} onClick={() => navigate(`/counts/${s.id}`)} className="rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="text-xs text-fg-subtle">{s.location ?? 'Tüm konumlar'} · {fmtDateTime(s.createdAt)}</p></div>
                  <Badge tone={s.status === 'OPEN' ? 'warning' : 'success'} dot>{s.status === 'OPEN' ? 'Devam ediyor' : 'Tamamlandı'}</Badge>
                </div>
                <div className="mt-5 flex items-end justify-between"><span className="text-3xl font-semibold tabular-nums">%{pct}</span><span className="text-xs text-fg-muted">{p.scanned}/{p.expected} sayıldı</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="mt-3 flex gap-4 text-xs text-fg-muted"><span>Eksik <b className="text-danger">{p.missing}</b></span><span>Beklenmeyen <b className="text-warning">{p.unexpected}</b></span></div>
              </motion.button>
            );
          })}
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Yeni sayım" description="Sayılacak cihazlar oturum açılırken listelenir"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button><Button variant="primary" loading={create.isPending} disabled={name.trim().length < 2} onClick={submit}><ScanLine className="size-4" />Sayımı başlat</Button></>}>
        <div className="space-y-4">
          <Input label="Sayım adı" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Combobox label="Konum" aria-label="Konum" value={location} onChange={setLocation} options={meta.data?.locations ?? []} allowCreate={false} clearLabel="Tüm konumlar (hizmet dışı hariç)" hint="Yalnızca kayıtlı konumlar seçilebilir" />
        </div>
      </Modal>
    </div>
  );
}
