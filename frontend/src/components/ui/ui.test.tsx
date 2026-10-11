import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';
import { StatusBadge, Badge } from './Misc';
import { Input } from './Form';

describe('Pagination', () => {
  it('aralığı ve sayfa bilgisini gösterir, sınırlarda butonları kapatır', () => {
    render(<Pagination page={1} totalPages={3} total={25} pageSize={10} onPage={() => {}} />);
    expect(screen.getByText('1–10')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki sayfa')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki sayfa')).toBeEnabled();
  });
  it('sonraki sayfaya geçiş için onPage çağırır', async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} total={25} pageSize={10} onPage={onPage} />);
    await userEvent.click(screen.getByLabelText('Sonraki sayfa'));
    expect(onPage).toHaveBeenCalledWith(3);
  });
  it('kayıt yoksa hiçbir şey çizmez', () => {
    const { container } = render(<Pagination page={1} totalPages={1} total={0} pageSize={10} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatusBadge', () => {
  it.each([
    ['IN_STOCK', 'Depoda'],
    ['ASSIGNED', 'Zimmetli'],
    ['FAULTY', 'Arızalı'],
    ['RETIRED', 'Hizmet dışı'],
  ] as const)('%s → %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it('Badge çocuğunu çizer', () => {
    render(<Badge tone="success">Tamam</Badge>);
    expect(screen.getByText('Tamam')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('etiket ve hata mesajını erişilebilir şekilde bağlar', () => {
    render(<Input label="E-posta" error="Geçerli bir e-posta girin" />);
    const input = screen.getByLabelText('E-posta');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Geçerli bir e-posta girin');
  });
});
