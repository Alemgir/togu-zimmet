import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { api } from '@/lib/api';
import Login from './Login';

function setup() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<p>Ana sayfa</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('Login', () => {
  it('alanlar boşken giriş butonu kapalıdır', () => {
    setup();
    expect(screen.getByRole('button', { name: /giriş yap/i })).toBeDisabled();
  });

  it('başarılı girişte token saklanır ve ana sayfaya yönlenir', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { token: 'tok123', user: { id: '1', name: 'Test Admin', email: 'a@b.com', role: 'ADMIN', isActive: true } } });
    setup();
    await userEvent.type(screen.getByLabelText('E-posta'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Şifre'), 'Sifre1234');
    await userEvent.click(screen.getByRole('button', { name: /giriş yap/i }));
    await waitFor(() => expect(screen.getByText('Ana sayfa')).toBeInTheDocument());
    expect(localStorage.getItem('zimmet_token')).toBe('tok123');
    expect(sessionStorage.getItem('zimmet_welcome')).toBe('1'); // karşılama animasyonu tetiklenir
  });

  it('hatalı girişte sunucu mesajını gösterir ve token saklamaz', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(
      Object.assign(new Error('x'), { isAxiosError: true, response: { status: 401, data: { error: { message: 'E-posta veya şifre hatalı' } } } }),
    );
    setup();
    await userEvent.type(screen.getByLabelText('E-posta'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Şifre'), 'yanlis');
    await userEvent.click(screen.getByRole('button', { name: /giriş yap/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta veya şifre hatalı');
    expect(localStorage.getItem('zimmet_token')).toBeNull();
  });
});
