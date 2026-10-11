import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, FileText, Laptop, QrCode, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMyDevices } from '@/api/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, warrantyState } from '@/lib/format';
import { typeLabel } from '@/lib/labels';
import type { Device } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { DeviceIcon } from '@/components/devices/DeviceIcon';
import { DueBadge } from '@/components/devices/DueBadge';
import { FaultDialog } from '@/components/devices/DeviceDialogs';

export default function MyDevices() {
  const { user } = useAuth();
  const { data, isLoading } = useMyDevices();
  const [fault, setFault] = useState<Device | null>(null);

  return (
    <div>
      <PageHeader title="Zimmetlerim" description={`${user?.name} üzerine zimmetli cihazlar`} actions={!!data?.length && <Link to="/foy/me"><Button><FileText className="size-4" />Zimmet föyüm</Button></Link>} />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Laptop className="size-6" />} title="Üzerinize zimmetli cihaz yok" description="Size bir cihaz zimmetlendiğinde burada görünecek." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((d, i) => {
            const w = warrantyState(d.warrantyEnd);
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }}>
                <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <DeviceIcon type={d.type} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.brand} {d.model}</p>
                      <p className="text-xs text-fg-subtle"><span className="font-mono">{d.assetTag}</span> · {typeLabel(d.type)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={w.tone}>{w.label}</Badge><DueBadge dueAt={d.dueAt} /></div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-fg-muted"><CalendarDays className="size-4" />Zimmet: <b className="font-medium text-fg">{fmtDate(d.assignedAt)}</b></div>
                    <div className="flex items-center gap-2 text-fg-muted"><ShieldCheck className="size-4" />Garanti bitişi: <b className="font-medium text-fg">{fmtDate(d.warrantyEnd)}</b></div>
                  </div>
                  <div className="mt-5 flex gap-2 pt-1">
                    <Link to={`/devices/${d.id}`} className="flex-1"><Button className="w-full justify-center"><QrCode className="size-4" />Detay & QR</Button></Link>
                    <Link to={`/tutanak/${d.assignmentId}`} title="Zimmet tutanağı"><Button size="icon" aria-label="Zimmet tutanağı"><FileText className="size-4" /></Button></Link>
                    <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setFault(d)}><TriangleAlert className="size-4" />Arıza</Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
      <FaultDialog open={!!fault} onOpenChange={(o) => !o && setFault(null)} device={fault} />
    </div>
  );
}
