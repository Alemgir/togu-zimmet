import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sparkline } from './Sparkline';
import { TypeTreemap } from './TypeTreemap';
import { DueBadge } from '@/components/devices/DueBadge';
import { faultNo, receiptNo } from '@/lib/labels';

const DATA = [
  { type: 'LAPTOP' as const, count: 21 },
  { type: 'MONITOR' as const, count: 12 },
  { type: 'SERVER' as const, count: 6 },
];

describe('TypeTreemap (çapraz filtre kutuları)', () => {
  it('her tür için adetli bir kutu çizer', () => {
    render(<TypeTreemap data={DATA} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dizüstü: 21 cihaz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monitör: 12 cihaz' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('tıklayınca türü seçer; seçili kutuya tekrar tıklayınca süzgeci kaldırır', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<TypeTreemap data={DATA} selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Monitör/ }));
    expect(onSelect).toHaveBeenLastCalledWith('MONITOR');
    rerender(<TypeTreemap data={DATA} selected="MONITOR" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /Monitör/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Dizüstü/ })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: /Monitör/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});

describe('Sparkline', () => {
  it('yeterli veri varsa çizgi çizer, tek noktada hiçbir şey çizmez', () => {
    const { container, rerender } = render(<Sparkline values={[1, 3, 2, 5]} color="red" />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
    rerender(<Sparkline values={[1]} color="red" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('DueBadge (planlı iade)', () => {
  const day = 864e5;
  it('tarih yoksa hiçbir şey göstermez', () => {
    const { container } = render(<DueBadge dueAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('geçmişse gecikme gününü gösterir', () => {
    render(<DueBadge dueAt={new Date(Date.now() - 6 * day).toISOString()} />);
    expect(screen.getByText(/6 gün gecikti/)).toBeInTheDocument();
  });
  it('gelecekteyse iade tarihini gösterir', () => {
    render(<DueBadge dueAt={new Date(Date.now() + 20 * day).toISOString()} />);
    expect(screen.getByText(/İade:/)).toBeInTheDocument();
  });
});

describe('belge numaraları', () => {
  it('arıza ve tutanak numaralarını biçimler', () => {
    expect(faultNo(12)).toBe('AR-00012');
    expect(receiptNo(7, '2026-10-10T10:00:00Z')).toBe('ZT-2026-000007');
  });
});
