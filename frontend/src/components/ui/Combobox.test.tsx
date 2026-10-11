import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resolveTypeInput, typeOptions } from '@/lib/deviceTypes';
import { Combobox } from './Combobox';

const BRANDS = ['Dell', 'HP', 'Lenovo', 'Samsung'];

function Harness({ initial = '', onChange = () => {}, ...props }: { initial?: string; onChange?: (v: string) => void } & Partial<React.ComponentProps<typeof Combobox>>) {
  const [v, setV] = useState(initial);
  return (
    <>
      <Combobox label="Marka" value={v} onChange={(x) => { setV(x); onChange(x); }} options={BRANDS} {...props} />
      <output data-testid="value">{v}</output>
    </>
  );
}
const box = () => screen.getByRole('combobox');
const value = () => screen.getByTestId('value').textContent;

describe('Combobox: seçme', () => {
  it('seçili değerin etiketini gösterir', () => {
    render(<Harness initial="Dell" />);
    expect(box()).toHaveValue('Dell');
  });

  it('odaklanınca seçenekleri listeler; tıklayınca seçer ve listeyi kapatır', async () => {
    render(<Harness />);
    await userEvent.click(box());
    expect(await screen.findAllByRole('option')).toHaveLength(4);
    await userEvent.click(screen.getByRole('option', { name: 'Lenovo' }));
    expect(value()).toBe('Lenovo');
    expect(box()).toHaveValue('Lenovo');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('yazdıkça süzer (başlayanlar önce, içerenler sonra); Türkçe/ASCII harf farkı yok sayılır', async () => {
    render(<Harness options={['Ankara', 'İstanbul', 'Isparta', 'Kırıkkale', 'Muğla']} />);
    await userEvent.type(box(), 'ı'); // "i" ile aynı sayılır: İ/I/ı/i
    let names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(expect.arrayContaining(['İstanbul', 'Isparta', 'Kırıkkale']));
    expect(names).not.toContain('Ankara');
    expect(names[0]).toMatch(/^(İstanbul|Isparta)$/); // başlayanlar önce
    await userEvent.clear(box());
    await userEvent.type(box(), 'mugla');
    names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toContain('Muğla');
  });

  it('klavye: ↓ ile gezer, Enter ile seçer', async () => {
    render(<Harness />);
    await userEvent.click(box());
    await userEvent.keyboard('{ArrowDown}{Enter}'); // Dell (ilk) → HP
    expect(value()).toBe('HP');
    await userEvent.click(box());
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}'); // HP → Lenovo → Samsung → Lenovo
    expect(value()).toBe('Lenovo');
  });

  it('Escape listeyi kapatır ve yazılanı geri alır', async () => {
    render(<Harness initial="Dell" />);
    await userEvent.click(box());
    await userEvent.clear(box());
    await userEvent.type(box(), 'Lenx');
    await userEvent.keyboard('{Escape}');
    expect(box()).toHaveValue('Dell');
    expect(value()).toBe('Dell');
  });

  it('erişilebilirlik: combobox/listbox/option rolleri ve aria-expanded', async () => {
    render(<Harness />);
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(box());
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dell' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('Combobox: yazarak yeni değer ekleme', () => {
  it('listede olmayan değer "olarak ekle" seçeneğiyle eklenir', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(box(), 'Xiaomi');
    const create = await screen.findByRole('option', { name: /olarak ekle/ });
    expect(create).toHaveTextContent('Xiaomi');
    expect(create).toHaveTextContent('YENİ');
    await userEvent.click(create);
    expect(onChange).toHaveBeenLastCalledWith('Xiaomi');
    expect(await screen.findByText(/Yeni değer olarak kaydedilecek/)).toBeInTheDocument();
  });

  it('Enter ile de eklenir; baştaki/sondaki ve çift boşluklar temizlenir', async () => {
    render(<Harness />);
    await userEvent.type(box(), '  Mi   Band  {Enter}');
    expect(value()).toBe('Mi Band');
  });

  it('odak kaybında (dışarı tıklama/Tab) yazılan değer eklenir', async () => {
    render(<><Harness /><button>başka</button></>);
    await userEvent.type(box(), 'Huawei');
    await userEvent.click(screen.getByRole('button', { name: 'başka' }));
    expect(value()).toBe('Huawei');
  });

  it('mevcut kayıtla harf farkıyla aynıysa mevcut yazıma birleşir ("dell" → "Dell")', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'dELL{Enter}');
    expect(value()).toBe('Dell');
    expect(box()).toHaveValue('Dell');
  });

  it('Türkçe I/İ duyarlı birleştirme', async () => {
    render(<Harness options={['Bilgi İşlem']} />);
    await userEvent.type(box(), 'BİLGİ İŞLEM{Enter}');
    expect(value()).toBe('Bilgi İşlem');
  });

  it('Enter, vurgulanan (ilk süzülen) seçeneği seçer; yeni eklemek için "ekle" öğesine inilir', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'sam'); // "Samsung" başlangıçla eşleşir
    await userEvent.keyboard('{Enter}');
    expect(value()).toBe('Samsung');
    await userEvent.clear(box());
    await userEvent.type(box(), 'sam');
    await userEvent.keyboard('{ArrowDown}{Enter}'); // 0: Samsung, 1: "sam" olarak ekle
    expect(value()).toBe('sam');
  });

  it('Türkçe karakter yazmadan girilen değer mevcut kayıtla birleşir ("kutuphane" → "Kütüphane")', async () => {
    render(<Harness options={['Kütüphane', 'Bilgi İşlem']} />);
    await userEvent.type(box(), 'KUTUPHANE{Enter}');
    expect(value()).toBe('Kütüphane');
    await userEvent.clear(box());
    await userEvent.type(box(), 'bilgi islem{Enter}');
    expect(value()).toBe('Bilgi İşlem');
  });

  it('tam eşleşme varken "ekle" seçeneği gösterilmez', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'hp');
    expect(screen.queryByRole('option', { name: /olarak ekle/ })).not.toBeInTheDocument();
  });

  it('yazım hatası: "Şunu mu demek istediniz?" önerir; öneriye tıklayınca doğru değeri seçer', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'Lenavo');
    expect(await screen.findByText('Şunu mu demek istediniz?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lenovo' }));
    expect(value()).toBe('Lenovo');
  });

  it('çok farklı yazımda öneri çıkmaz', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'Xiaomi');
    expect(screen.queryByText('Şunu mu demek istediniz?')).not.toBeInTheDocument();
  });
});

describe('Combobox: denetim (doğrulama)', () => {
  it('çok kısa değeri reddeder, değer değişmez ve hata gösterir', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} fieldLabel="Marka" />);
    await userEvent.type(box(), 'q{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Marka en az 2 karakter olmalı');
    expect(onChange).not.toHaveBeenCalled();
    expect(box()).toHaveAttribute('aria-invalid', 'true');
  });

  it('min=1 verilince tek karakter kabul edilir', async () => {
    render(<Harness min={1} />);
    await userEvent.type(box(), 'X{Enter}');
    expect(value()).toBe('X');
  });

  it.each(['<script>alert(1)</script>', 'a@b.com', 'Dell{}', '!!!'])('tehlikeli/geçersiz karakterleri reddeder: %s', async (bad) => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(box(), `${bad.replace(/[{}]/g, (c) => c + c)}{Enter}`);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('en fazla uzunluğu aşan değeri reddeder', async () => {
    render(<Harness max={10} />);
    await userEvent.type(box(), 'Çok uzun bir marka adı{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('en fazla 10');
  });

  it('özel doğrulama (validate) hatası gösterilir', async () => {
    render(<Harness validate={(t) => (t.startsWith('x') ? 'x ile başlayamaz' : undefined)} />);
    await userEvent.type(box(), 'xyz{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('x ile başlayamaz');
  });

  it('dışarıdan verilen hata (error) gösterilir', () => {
    render(<Harness error="Marka zorunlu" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Marka zorunlu');
  });

  it('hata, yeniden yazmaya başlayınca temizlenir', async () => {
    render(<Harness />);
    await userEvent.type(box(), 'q{Enter}');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.type(box(), 'uz');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Combobox: yalnızca seçim modu (filtre) ve temizleme', () => {
  it('allowCreate=false: listede olmayan yazılırsa önceki değere döner, "ekle" seçeneği yoktur', async () => {
    const onChange = vi.fn();
    render(<Harness initial="Dell" allowCreate={false} onChange={onChange} />);
    await userEvent.click(box());
    await userEvent.clear(box());
    await userEvent.type(box(), 'Bilinmeyen');
    expect(screen.queryByRole('option', { name: /olarak ekle/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sonuç yok')).toBeInTheDocument();
    await userEvent.tab();
    expect(box()).toHaveValue('Dell');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clearLabel: "Tümü" seçeneği değeri boşaltır', async () => {
    render(<Harness initial="Dell" allowCreate={false} clearLabel="Tüm markalar" />);
    await userEvent.click(box());
    await userEvent.click(await screen.findByRole('option', { name: 'Tüm markalar' }));
    expect(value()).toBe('');
    expect(box()).toHaveValue('');
    expect(box()).toHaveAttribute('placeholder', 'Tüm markalar');
  });

  it('metni silip ayrılınca (filtre modunda) değer temizlenir', async () => {
    render(<Harness initial="Dell" allowCreate={false} clearLabel="Tümü" />);
    await userEvent.click(box());
    await userEvent.clear(box());
    await userEvent.tab();
    expect(value()).toBe('');
  });

  it('temizle düğmesi değeri siler', async () => {
    render(<Harness initial="HP" />);
    await userEvent.click(screen.getByRole('button', { name: 'Temizle' }));
    expect(value()).toBe('');
  });

  it('disabled iken açılmaz', async () => {
    render(<Harness disabled />);
    await userEvent.click(box());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dışarıdan değer değişince metin eşitlenir', () => {
    const { rerender } = render(<Combobox value="Dell" onChange={() => {}} options={BRANDS} />);
    expect(box()).toHaveValue('Dell');
    rerender(<Combobox value="HP" onChange={() => {}} options={BRANDS} />);
    expect(box()).toHaveValue('HP');
    rerender(<Combobox value="" onChange={() => {}} options={BRANDS} />);
    expect(box()).toHaveValue('');
  });
});

describe('Combobox: cihaz türü (resolve ile)', () => {
  const Type = (p: { onChange?: (v: string) => void }) => <Harness label="Tür" initial="LAPTOP" options={typeOptions(['Projeksiyon'])} resolve={resolveTypeInput} max={40} {...p} />;

  it('kodu değil etiketi gösterir; özel türler de listelenir', async () => {
    render(<Type />);
    expect(box()).toHaveValue('Dizüstü');
    await userEvent.click(box());
    expect(await screen.findByRole('option', { name: 'Projeksiyon' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(10);
  });

  it('yerleşik türün eş anlamlısı yazılınca koda çözülür', async () => {
    render(<Type />);
    await userEvent.clear(box());
    await userEvent.type(box(), 'masaüstü{Enter}');
    expect(value()).toBe('DESKTOP');
    expect(box()).toHaveValue('Masaüstü');
  });

  it('yeni tür yazılınca olduğu gibi (özel tür) kaydedilir', async () => {
    render(<Type />);
    await userEvent.clear(box());
    await userEvent.type(box(), 'Akıllı Tahta{Enter}');
    expect(value()).toBe('Akıllı Tahta');
    expect(box()).toHaveValue('Akıllı Tahta');
  });

  it('listedeki özel türün farklı yazımı mevcut yazıma birleşir', async () => {
    render(<Type />);
    await userEvent.clear(box());
    await userEvent.type(box(), 'projeksiyon{Enter}');
    expect(value()).toBe('Projeksiyon');
  });
});
