import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  /** Değiştiğinde (örn. başka bir sayfaya geçince) hata durumu sıfırlanır */
  resetKey: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Bir sayfadaki hata tüm uygulamayı çökertmesin: kabuk (menü) çalışmaya devam eder. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sayfa hatası:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-warning"><TriangleAlert className="size-7" /></div>
        <h2 className="text-lg font-semibold">{chunk ? 'Sayfa yüklenemedi' : 'Bir şeyler ters gitti'}</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          {chunk ? 'Uygulama güncellenmiş olabilir. Sayfayı yenileyerek devam edebilirsiniz.' : 'Bu sayfa beklenmeyen bir hatayla karşılaştı. Menüden başka bir sayfaya geçebilir veya yenileyebilirsiniz.'}
        </p>
        <Button className="mt-5" variant="primary" onClick={() => window.location.reload()}><RefreshCw className="size-4" />Sayfayı yenile</Button>
      </div>
    );
  }
}
