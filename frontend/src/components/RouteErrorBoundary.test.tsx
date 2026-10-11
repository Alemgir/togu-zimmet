import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Boom({ msg }: { msg: string }): never {
  throw new Error(msg);
}

function Harness() {
  const [path, setPath] = useState('/a');
  return (
    <>
      <nav>
        <button onClick={() => setPath('/a')}>A</button>
        <button onClick={() => setPath('/b')}>B</button>
      </nav>
      <RouteErrorBoundary resetKey={path}>{path === '/a' ? <Boom msg="patladı" /> : <p>B sayfası sağlam</p>}</RouteErrorBoundary>
    </>
  );
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('hata olunca menü çalışır kalır; yenile düğmesi gösterilir', () => {
    render(<Harness />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bir şeyler ters gitti');
    expect(screen.getByRole('button', { name: /Sayfayı yenile/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('başka sayfaya geçince hata temizlenir ve yeni sayfa açılır (kilitlenme yok)', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByText('B sayfası sağlam')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('yükleme (chunk) hatasında özel mesaj gösterir', () => {
    render(<RouteErrorBoundary resetKey="x"><Boom msg="Failed to fetch dynamically imported module: /assets/X.js" /></RouteErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Sayfa yüklenemedi');
    expect(screen.getByRole('alert')).toHaveTextContent('güncellenmiş olabilir');
  });
});
