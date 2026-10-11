import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { NotificationBell } from './NotificationBell';

const items = [
  { id: '1', type: 'FAULT_REPORTED', title: 'Yeni arıza kaydı', body: 'Dell P2422H arızalı', link: '/faults', readAt: null, createdAt: new Date().toISOString() },
  { id: '2', type: 'ASSIGNED', title: 'Size zimmet verildi', body: 'Galaxy S23', link: '/devices/x', readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
];

function setup(unread = 1) {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: items, unread } });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><NotificationBell /></MemoryRouter>
    </QueryClientProvider>,
  );
  return post;
}
afterEach(() => vi.restoreAllMocks());

describe('NotificationBell', () => {
  it('okunmamış sayısını rozet olarak gösterir', async () => {
    setup(3);
    expect(await screen.findByLabelText('Bildirimler, 3 okunmamış')).toBeInTheDocument();
  });

  it('açılınca bildirimleri listeler; tümünü okundu yap isteği gönderir', async () => {
    const post = setup(1);
    await userEvent.click(await screen.findByLabelText(/Bildirimler/));
    expect(await screen.findByText('Yeni arıza kaydı')).toBeInTheDocument();
    expect(screen.getByText('Size zimmet verildi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Tümünü okundu yap/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/notifications/read-all'));
  });

  it('okunmamış bildirime tıklayınca okundu işaretler', async () => {
    const post = setup(1);
    await userEvent.click(await screen.findByLabelText(/Bildirimler/));
    await userEvent.click(await screen.findByText('Yeni arıza kaydı'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/notifications/1/read'));
  });
});
