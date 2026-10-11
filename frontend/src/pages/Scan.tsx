import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, QrCode } from 'lucide-react';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';

/** QR bağlantısı (…/scan/:token) → cihaz detayına yönlendirir. */
export default function Scan() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data, isError } = useQuery({
    queryKey: ['by-qr', token],
    retry: false,
    queryFn: async () => (await api.get<{ device: Device }>(`/devices/by-qr/${token}`)).data.device,
  });
  useEffect(() => {
    if (data) navigate(`/devices/${data.id}`, { replace: true });
  }, [data, navigate]);

  if (isError) {
    return <EmptyState icon={<QrCode className="size-6" />} title="Cihaz bulunamadı" description="Bu QR kodu geçerli bir cihaz etiketine ait değil." action={<Button onClick={() => navigate('/')}>Ana sayfa</Button>} />;
  }
  return <div className="flex justify-center py-24 text-fg-subtle"><Loader2 className="size-6 animate-spin" aria-label="Cihaz aranıyor" /></div>;
}
