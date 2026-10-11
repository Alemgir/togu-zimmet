import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';

export default function NotFound() {
  const navigate = useNavigate();
  return <EmptyState icon={<Compass className="size-6" />} title="Sayfa bulunamadı" description="Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir." action={<Button variant="primary" onClick={() => navigate('/')}>Ana sayfaya dön</Button>} />;
}
