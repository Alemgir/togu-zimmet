import { render } from '@testing-library/react';
import { LOGO } from './logoData';
import { Logo, assembleLogo } from './Logo';

describe('Logo', () => {
  it('resmî logo verisi 4 birim ve yazı şekillerini içerir', () => {
    expect(LOGO.tiles).toHaveLength(4);
    expect(LOGO.tiles.map((t) => t.c)).toEqual(['#0098C0', '#0098C0', '#0098C0', '#462B55']); // 3 firuze + 1 mor
    expect(LOGO.word.length).toBeGreaterThan(30);
  });

  it('tam logo birimleri ve yazıyı, sembol yalnızca birimleri çizer', () => {
    const full = render(<Logo />);
    expect(full.container.querySelectorAll('.lt')).toHaveLength(4);
    expect(full.container.querySelectorAll('.lw').length).toBe(LOGO.word.length);
    expect(full.getByRole('img', { name: /Tokat Gaziosmanpaşa Üniversitesi/ })).toBeInTheDocument();
    const sym = render(<Logo variant="symbol" />);
    expect(sym.container.querySelectorAll('.lw')).toHaveLength(0);
  });

  it('azaltılmış harekette animasyon beklemeden tamamlanır', async () => {
    const { container } = render(<Logo />);
    await expect(assembleLogo(container.querySelector('svg')!)).resolves.toBeUndefined();
  });
});
