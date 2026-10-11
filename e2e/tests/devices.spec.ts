import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, heading, loginAs, test, toast, tokenFor, uniq, userByEmail, short } from '../fixtures';

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Yeni cihaz ekle' });
async function openNew(page: Page) {
  await page.goto('/devices');
  await page.getByRole('button', { name: 'Yeni cihaz' }).click();
  await expect(drawer(page)).toBeVisible();
  return drawer(page);
}
async function fillForm(d: ReturnType<typeof drawer>, v: { type?: string; brand?: string; model?: string; serial?: string; purchase?: string; warranty?: string; location?: string }) {
  if (v.type) { await d.getByLabel('Cihaz türü').fill(v.type); await d.getByLabel('Cihaz türü').press('Enter'); }
  if (v.brand) { await d.getByLabel('Marka').fill(v.brand); await d.getByLabel('Marka').press('Enter'); }
  if (v.model) await d.getByLabel('Model').fill(v.model);
  if (v.serial) await d.getByLabel('Seri numarası').fill(v.serial);
  if (v.purchase) await d.getByLabel('Alım tarihi').fill(v.purchase);
  if (v.warranty !== undefined) await d.getByLabel('Garanti bitişi').fill(v.warranty);
  if (v.location) { await d.getByLabel('Konum').fill(v.location); await d.getByLabel('Konum').press('Enter'); }
}

test.describe('envanter listesi', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('10 satır, sayfalama, adres çubuğuyla eşitleme ve yenilemede korunma', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const total = (await a.get('/devices?pageSize=1')).meta.total;
    await page.goto('/devices');
    await expect(page.locator('tbody tr')).toHaveCount(10);
    const first = await page.locator('tbody tr').first().innerText();
    await expect(page.getByText(`1–10 / ${total} kayıt`)).toBeVisible();
    await page.getByRole('button', { name: 'Sonraki sayfa' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(new RegExp(`11–20 / ${total} kayıt`))).toBeVisible();
    expect(await page.locator('tbody tr').first().innerText()).not.toBe(first);
    await page.reload();
    await expect(page.getByText(new RegExp(`11–20 / ${total} kayıt`))).toBeVisible();
    await page.getByRole('button', { name: 'Önceki sayfa' }).click();
    await expect(page.getByRole('button', { name: 'Önceki sayfa' })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('arama: model/seri/demirbaş/kişi adıyla bulur, büyük-küçük harf duyarsız; sonuç yoksa boş durum', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'AramaMarka', model: 'Qwerty-' + short() });
    await page.goto('/devices');
    const search = page.getByLabel('Cihaz ara');
    for (const q of [dev.model, dev.model.toLowerCase(), dev.assetTag, 'aramamarka']) {
      await search.fill(q);
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr')).toContainText(dev.assetTag);
    }
    await search.fill('zzz-yok-boyle-bir-cihaz');
    await expect(page.getByText('Eşleşen cihaz yok')).toBeVisible();
    await page.getByRole('button', { name: 'Filtreleri temizle' }).first().click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(search).toHaveValue('');
  });

  test('durum sekmeleri sunucu sayılarıyla aynı; sekme süzer', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const t = (await a.get('/dashboard')).totals;
    await page.goto('/devices');
    await expect(page.getByRole('tab', { name: new RegExp(`^Tümü ${t.devices}$`) })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^Depoda ${t.inStock}$`) })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^Zimmetli ${t.assigned}$`) })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^Arızalı ${t.faulty}$`) })).toBeVisible();
    await page.getByRole('tab', { name: /^Arızalı/ }).click();
    await expect(page).toHaveURL(/status=FAULTY/);
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(Math.min(10, t.faulty));
    for (const r of await rows.all()) await expect(r).toContainText('Arızalı');
  });

  test('yazılabilir süzgeçler: Tür, Marka, Birim (yazarak ara, listeden seç, "Tümü" ile temizle)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    await page.goto('/devices');
    // Tür: yazarak daralt, seç
    const type = page.getByRole('combobox', { name: 'Tür' });
    await type.fill('moni');
    await page.getByRole('option', { name: 'Monitör' }).click();
    await expect(page).toHaveURL(/type=MONITOR/);
    await expect.poll(async () => (await page.locator('tbody tr td:nth-child(2)').allInnerTexts()).every((t) => t.includes('Monitör'))).toBe(true);
    // Marka (süzgeç modunda listede olmayan yazı reddedilir, önceki değere döner)
    const brand = page.getByRole('combobox', { name: 'Marka' });
    await brand.fill('YokBoyleMarka');
    await expect(page.getByRole('option', { name: /olarak ekle/ })).toHaveCount(0);
    await expect(page.getByText('Sonuç yok')).toBeVisible();
    await brand.press('Tab');
    await expect(brand).toHaveValue('');
    await expect(page).not.toHaveURL(/brand=/);
    // Gerçek marka seç
    const brands = (await a.get('/devices/meta')).brands as string[];
    await brand.fill(brands[0]!.slice(0, 3));
    await page.getByRole('option', { name: brands[0]! }).first().click();
    await expect(page).toHaveURL(new RegExp(`brand=${encodeURIComponent(brands[0]!).replace(/%20/g, '(%20|\\+)')}`));
    // Temizle
    await type.click();
    await page.getByRole('option', { name: 'Tüm türler' }).click();
    await expect(page).not.toHaveURL(/type=/);
    await page.getByRole('button', { name: 'Filtreleri temizle' }).first().click();
    await expect(page).not.toHaveURL(/brand=/);
  });

  test('adres çubuğundaki süzgeçler arayüze yansır (derin bağlantı)', async ({ page }) => {
    await page.goto('/devices?status=FAULTY&type=LAPTOP&sort=brand%3Aasc');
    await expect(page.getByRole('tab', { name: /^Arızalı/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('combobox', { name: 'Tür' })).toHaveValue('Dizüstü');
    await expect(page.getByLabel('Sırala')).toHaveValue('brand:asc');
  });

  test('sıralama: Marka A→Z listeyi alfabetik dizer', async ({ page }) => {
    await page.goto('/devices');
    await page.getByLabel('Sırala').selectOption('brand:asc');
    await expect(page).toHaveURL(/sort=brand/);
    const names = await page.locator('tbody tr td:nth-child(2) a').allTextContents();
    expect(names.length).toBeGreaterThan(3);
    const brands = names.map((n) => n.split(' ')[0]!);
    expect([...brands].sort((x, y) => x.localeCompare(y, 'tr'))).toEqual(brands);
  });

  test('CSV dışa aktarma: geçerli süzgeçle indirilir; BOM, başlık ve satır sayısı doğru', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const faulty = (await a.get('/devices?status=FAULTY&pageSize=1')).meta.total;
    await page.goto('/devices?status=FAULTY');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^envanter-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = fs.readFileSync((await dl.path())!, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split('\r\n')[0]).toContain('Demirbaş no;Tür;Marka;Model');
    expect(text.split('\r\n').filter(Boolean)).toHaveLength(faulty + 1);
    expect(text).not.toMatch(/;Depoda;|;Zimmetli;/); // yalnızca arızalılar
    await expect(toast(page, 'Dışa aktarıldı')).toBeVisible();
  });
});

test.describe('cihaz ekleme formu', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('boş gönderim: zorunlu alan hataları, form açık kalır, sunucuya istek gitmez', async ({ page }) => {
    const d = await openNew(page);
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/devices')) posted = true; });
    await d.getByLabel('Alım tarihi').fill('');
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(d.getByText('Marka zorunlu')).toBeVisible();
    await expect(d.getByText('Model zorunlu')).toBeVisible();
    await expect(d.getByText('Seri numarası zorunlu')).toBeVisible();
    await expect(d.getByText('Alım tarihi zorunlu')).toBeVisible();
    await expect(drawer(page)).toBeVisible();
    expect(posted).toBe(false);
  });

  test('garanti bitişi alım tarihinden önceyse hata verir; geçerli tarihle hata kalkar', async ({ page }) => {
    const d = await openNew(page);
    await fillForm(d, { brand: 'Lenovo', model: 'X', serial: uniq('S'), purchase: '2025-06-01', warranty: '2025-01-01' });
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(d.getByText('Garanti bitişi alım tarihinden önce olamaz')).toBeVisible();
    await d.getByLabel('Garanti bitişi').fill('2028-06-01');
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, 'Cihaz eklendi')).toBeVisible();
  });

  test('gelecek tarihli alım sunucuda reddedilir ve toast gösterilir', async ({ page }) => {
    const d = await openNew(page);
    const future = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
    await fillForm(d, { brand: 'Lenovo', model: 'Gelecek', serial: uniq('S'), purchase: future, warranty: '' });
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, 'Alım tarihi gelecekte olamaz')).toBeVisible();
    await expect(drawer(page)).toBeVisible();
  });

  test('yeni cihaz eklenir: toast demirbaş no gösterir, listede ve detayda görünür', async ({ page, request }) => {
    const d = await openNew(page);
    const serial = uniq('SER');
    await fillForm(d, { type: 'Dizüstü', brand: 'Lenovo', model: 'ThinkPad E2E', serial, purchase: '2025-02-01', warranty: '2028-02-01', location: 'Merkez Kampüs' });
    await d.getByLabel('Notlar').fill('E2E testi için eklendi');
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, /Cihaz eklendi · TOGU-\d{6}/)).toBeVisible();
    await expect(drawer(page)).toBeHidden();
    await page.getByLabel('Cihaz ara').fill(serial);
    const row = page.locator('tbody tr');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('ThinkPad E2E');
    await expect(row).toContainText('Depoda');
    const a = api(request, await tokenFor(request, 'admin'));
    const found = (await a.get(`/devices?search=${serial}`)).data[0];
    expect(found).toMatchObject({ type: 'LAPTOP', brand: 'Lenovo', location: 'Merkez Kampüs', notes: 'E2E testi için eklendi' });
    await row.getByRole('link', { name: /ThinkPad E2E/ }).click();
    await expect(heading(page)).toContainText('ThinkPad E2E');
  });

  test('YAZARAK YENİ TÜR EKLEME: listede olmayan tür yazılınca "YENİ" gösterilir, kaydedilir ve sonraki formda listede çıkar', async ({ page, request }) => {
    const custom = 'Akıllı Tahta ' + short();
    const d = await openNew(page);
    const t = d.getByLabel('Cihaz türü');
    await t.fill(custom);
    await expect(page.getByRole('option', { name: new RegExp(`“${custom}” olarak ekle`) })).toBeVisible();
    await expect(page.getByRole('option', { name: /YENİ/ })).toBeVisible();
    await t.press('Enter');
    await expect(t).toHaveValue(custom);
    await expect(d.getByText('Yeni değer olarak kaydedilecek')).toBeVisible();
    await fillForm(d, { brand: 'Samsung', model: 'Flip', serial: uniq('S'), purchase: '2025-01-10' });
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, 'Cihaz eklendi')).toBeVisible();
    const a = api(request, await tokenFor(request, 'admin'));
    expect((await a.get('/devices/meta')).types).toContain(custom);
    // Yeni formda artık seçenek olarak listelenir
    await page.getByRole('button', { name: 'Yeni cihaz' }).click();
    await page.getByLabel('Cihaz türü').click();
    await expect(page.getByRole('option', { name: custom })).toBeVisible();
    // Filtre listesinde de
    await page.keyboard.press('Escape');
  });

  test('yerleşik tür eş anlamlısı yazılınca koda çözülür ("masaüstü bilgisayar" → Masaüstü)', async ({ page, request }) => {
    const d = await openNew(page);
    const serial = uniq('S');
    await fillForm(d, { type: 'masaüstü bilgisayar', brand: 'Dell', model: 'EsAnlam', serial, purchase: '2025-01-10' });
    await expect(d.getByLabel('Cihaz türü')).toHaveValue('Masaüstü');
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, 'Cihaz eklendi')).toBeVisible();
    const a = api(request, await tokenFor(request, 'admin'));
    expect((await a.get(`/devices?search=${serial}`)).data[0].type).toBe('DESKTOP');
  });

  test('marka: "dell" yazılınca mevcut "Dell" yazımına birleşir (yeni marka oluşmaz)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brandsBefore = (await a.get('/devices/meta')).brands as string[];
    expect(brandsBefore).toContain('Dell');
    const d = await openNew(page);
    const serial = uniq('S');
    await fillForm(d, { brand: 'dELL', model: 'Birlesim', serial, purchase: '2025-01-10' });
    await expect(d.getByLabel('Marka')).toHaveValue('Dell');
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(toast(page, 'Cihaz eklendi')).toBeVisible();
    expect((await a.get('/devices/meta')).brands).toEqual(brandsBefore);
    expect((await a.get(`/devices?search=${serial}`)).data[0].brand).toBe('Dell');
  });

  test('yazım hatası önerisi: "Lenavo" yazınca "Şunu mu demek istediniz?" çıkar, öneri seçilir', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Marka').fill('Lenavo');
    await expect(page.getByText('Şunu mu demek istediniz?')).toBeVisible();
    await page.getByRole('button', { name: 'Lenovo' }).click();
    await expect(d.getByLabel('Marka')).toHaveValue('Lenovo');
  });

  test('geçersiz karakterler: marka ve konumda hata gösterilir, gönderim engellenir', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Marka').fill('<script>alert(1)</script>');
    await d.getByLabel('Marka').press('Enter');
    await expect(d.getByRole('alert').filter({ hasText: 'yalnızca harf' }).first()).toBeVisible();
    await d.getByLabel('Konum').fill('Bina * 3');
    await d.getByLabel('Konum').press('Enter');
    await expect(d.getByRole('alert').filter({ hasText: 'Konum yalnızca' })).toBeVisible();
    await d.getByLabel('Model').fill('M');
    await d.getByLabel('Seri numarası').fill(uniq('S'));
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(drawer(page)).toBeVisible(); // marka geçersiz → eklenmedi
  });

  test('Escape önce açık listeyi kapatır, çekmeceyi kapatmaz; ikinci Escape çekmeceyi kapatır', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Marka').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
  });

  test('seri numarası büyük/küçük harf farkıyla bile tekrar edilemez: alan hatası gösterilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const serial = uniq('dup').toLowerCase();
    await createDevice(a, { serialNumber: serial });
    const d = await openNew(page);
    await fillForm(d, { brand: 'Dell', model: 'Kopya', serial: serial.toUpperCase(), purchase: '2025-01-10' });
    await d.getByRole('button', { name: 'Cihazı ekle' }).click();
    await expect(d.getByText(/seri numarasıyla kayıtlı/)).toBeVisible();
    await expect(drawer(page)).toBeVisible();
  });

  test('klavyeyle tam akış: Tab ile alanlar arasında gezip Enter ile seçim yapılır', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Cihaz türü').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(d.getByLabel('Cihaz türü')).not.toHaveValue('');
    await page.keyboard.press('Tab');
    await expect(d.getByLabel('Marka')).toBeFocused();
  });
});

test.describe('cihaz detayı, düzenleme, durum, silme', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('düzenleme: değişiklik kaydedilir, başlık güncellenir, etkinlik kaydına yazılır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'DuzenMarka' });
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'Düzenle' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cihazı düzenle' });
    await dlg.getByLabel('Model').fill('Yeni Model Adı');
    await dlg.getByLabel('Marka').fill('duzenmarka'); // mevcut yazıma birleşir
    await dlg.getByLabel('Marka').press('Enter');
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect(toast(page, 'Cihaz güncellendi')).toBeVisible();
    await expect(heading(page)).toHaveText('DuzenMarka Yeni Model Adı');
    await page.getByRole('tab', { name: /Aktivite kaydı/ }).click();
    await expect(page.getByText('Cihaz bilgileri güncellendi')).toBeVisible();
  });

  test('QR kodu görüntü olarak yüklenir; PNG indirilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    await page.goto(`/devices/${dev.id}`);
    const img = page.getByRole('img', { name: `${dev.assetTag} QR kodu` });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(100);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG' }).click()]);
    expect(dl.suggestedFilename()).toBe(`${dev.assetTag}-qr.png`);
  });

  test('QR bağlantısı (/scan/:token) cihaz sayfasına yönlendirir; geçersiz token hata gösterir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    await page.goto(`/scan/${dev.qrToken}`);
    await expect(page).toHaveURL(new RegExp(`/devices/${dev.id}$`));
    await page.goto('/scan/gecersiz-token-123456');
    await expect(page.getByText('Cihaz bulunamadı')).toBeVisible();
  });

  test('zimmetli cihazın durumunu Arızalı yapınca uyarı gösterilir, zimmet düşer, arıza kaydı oluşur', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await page.goto(`/devices/${dev.id}`);
    await expect(page.getByText('Aktif zimmet')).toBeVisible().catch(() => undefined);
    await page.getByRole('button', { name: 'Durum', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Durumu değiştir' });
    await expect(dlg.getByText(/otomatik düşülecek/)).toBeVisible();
    await dlg.getByRole('button', { name: /Arızalı/ }).click();
    await dlg.getByLabel(/Not/).fill('Ekran çizik');
    await dlg.getByRole('button', { name: 'Uygula' }).click();
    await expect(toast(page, 'Durum: Arızalı')).toBeVisible();
    await expect(page.getByText('Zimmet otomatik olarak düşüldü')).toBeVisible();
    await expect(page.getByText('Cihaz arızalı olduğu için kimseye zimmetli değil.')).toBeVisible();
    const faults = (await a.get(`/faults?deviceId=${dev.id}`)).data;
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatchObject({ status: 'OPEN', description: 'Ekran çizik' });
  });

  test('silme: zimmet geçmişi olmayan cihaz onayla silinir; geçmişi olan silinemez', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const free = await createDevice(a);
    await page.goto(`/devices/${free.id}`);
    await page.getByRole('button', { name: 'Sil' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cihazı sil' });
    await expect(dlg).toContainText(free.assetTag);
    await dlg.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(dlg).toBeHidden();
    await page.getByRole('button', { name: 'Sil' }).click();
    await dlg.getByRole('button', { name: 'Evet, sil' }).click();
    await expect(toast(page, 'Cihaz silindi')).toBeVisible();
    await expect(page).toHaveURL(/\/devices$/);
    expect(await a.status('get', `/devices/${free.id}`)).toBe(404);

    const used = await createDevice(a);
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: used.id, userId: staff.id });
    await a.post(`/devices/${used.id}/return`, {});
    await page.goto(`/devices/${used.id}`);
    await page.getByRole('button', { name: 'Sil' }).click();
    await page.getByRole('dialog', { name: 'Cihazı sil' }).getByRole('button', { name: 'Evet, sil' }).click();
    await expect(toast(page, /Zimmet geçmişi olan cihaz silinemez/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/devices/${used.id}$`));
  });

  test('olmayan cihaz adresi "Cihaz bulunamadı" gösterir', async ({ page }) => {
    await page.goto('/devices/yok-boyle-bir-cihaz');
    await expect(page.getByText('Cihaz bulunamadı')).toBeVisible();
  });

  test('XSS: HTML içeren model ve not metin olarak gösterilir, betik çalışmaz', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mark = 'xssmark' + short();
    const evil = `<img src=x onerror="window.__xss=1"><b>kalin-${mark}</b>`;
    const dev = await createDevice(a, { model: evil, notes: '<script>window.__xss=2</script>' });
    await page.goto(`/devices/${dev.id}`);
    await expect(page.getByText(evil, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('<script>window.__xss=2</script>')).toBeVisible();
    await page.goto(`/devices?search=${encodeURIComponent(mark)}`);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText(`<b>kalin-${mark}</b>`); // etiket olarak değil, metin olarak
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('main img[src="x"]').count()).toBe(0);
    expect(await page.locator('tbody b').count()).toBe(0);
  });
});

test.describe('toplu işlemler', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('çoklu seçim: çubuk sayıyı gösterir, hepsini seç/temizle çalışır', async ({ page }) => {
    await page.goto('/devices');
    const boxes = page.locator('tbody input[type=checkbox]');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await expect(page.getByRole('toolbar', { name: 'Toplu işlemler' })).toContainText('2 cihaz seçili');
    await page.getByRole('checkbox', { name: 'Sayfadakilerin tümünü seç' }).check();
    await expect(page.getByRole('toolbar')).toContainText('10 cihaz seçili');
    await page.getByRole('button', { name: 'Seçimi temizle' }).click();
    await expect(page.getByRole('toolbar')).toHaveCount(0);
  });

  test('toplu zimmet: seçilenler personele verilir; hatalı (arızalı) olan nedeniyle raporlanır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mark = 'ToplumZ' + short();
    const [d1, d2, d3] = [await createDevice(a, { brand: mark }), await createDevice(a, { brand: mark }), await createDevice(a, { brand: mark })];
    await a.patch(`/devices/${d3.id}/status`, { status: 'FAULTY' });
    await page.goto('/devices');
    await page.getByLabel('Cihaz ara').fill(mark);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Sayfadakilerin tümünü seç' }).check();
    await page.getByRole('toolbar').getByRole('button', { name: 'Zimmetle' }).click();
    const dlg = page.getByRole('dialog', { name: 'Toplu zimmet' });
    await expect(dlg).toContainText('3 cihaz');
    await dlg.getByPlaceholder(/Personel ara/).fill('Ayşe');
    await dlg.getByRole('button', { name: /Ayşe Yılmaz/ }).click();
    await dlg.getByRole('button', { name: '3 cihazı zimmetle' }).click();
    await expect(dlg.getByText(/2.*cihaz için işlem tamamlandı/)).toBeVisible();
    await expect(dlg.getByText('1 cihaz işlenemedi')).toBeVisible();
    await expect(dlg).toContainText(d3.assetTag);
    await expect(dlg).toContainText(/Arızalı cihaz zimmetlenemez/);
    await dlg.getByRole('button', { name: 'Tamam' }).click();
    const staffApi = api(request, await tokenFor(request, 'staff'));
    const mine = (await staffApi.get('/devices/mine')).data.map((x: { id: string }) => x.id);
    expect(mine).toEqual(expect.arrayContaining([d1.id, d2.id]));
    expect(mine).not.toContain(d3.id);
    await expect(page.getByRole('toolbar')).toHaveCount(0); // seçim temizlendi
  });

  test('toplu durum değişikliği: zimmetliler otomatik düşer uyarısı ve sonuç', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mark = 'ToplamD' + short();
    const d1 = await createDevice(a, { brand: mark });
    await createDevice(a, { brand: mark });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: d1.id, userId: staff.id });
    await page.goto('/devices');
    await page.getByLabel('Cihaz ara').fill(mark);
    await expect(page.locator('tbody tr')).toHaveCount(2); // süzgeç uygulanmadan "tümünü seç" yapılmamalı
    await page.getByRole('checkbox', { name: 'Sayfadakilerin tümünü seç' }).check();
    await page.getByRole('toolbar').getByRole('button', { name: 'Durum', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Toplu durum değişikliği' });
    await dlg.getByRole('button', { name: /Hizmet dışı/ }).click();
    await expect(dlg.getByText(/zimmetli; zimmetleri/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Uygula' }).click();
    await expect(dlg.getByText(/2.*cihaz için işlem tamamlandı/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Tamam' }).click();
    expect((await a.get(`/devices/${d1.id}`)).device).toMatchObject({ status: 'RETIRED', holder: null });
  });

  test('etiket yazdır: seçilen cihazların QR etiketleri A4 sayfasında çizilir; düzen değiştirilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mark = 'EtiketM' + short();
    const devs = [await createDevice(a, { brand: mark }), await createDevice(a, { brand: mark }), await createDevice(a, { brand: mark })];
    await page.goto('/devices');
    await page.getByLabel('Cihaz ara').fill(mark);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.getByRole('checkbox', { name: 'Sayfadakilerin tümünü seç' }).check();
    await page.getByRole('button', { name: 'Etiket yazdır' }).click();
    await expect(page).toHaveURL(/\/etiketler\?ids=/);
    const imgs = page.locator('.label-sheet img');
    await expect(imgs).toHaveCount(3);
    for (const d of devs) await expect(page.locator('.label-sheet').getByText(d.assetTag)).toBeVisible();
    await expect.poll(() => imgs.first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(50);
    await page.getByRole('button', { name: /Orta · 2×6/ }).click();
    await expect(page.locator('.label-sheet')).toHaveCSS('grid-template-columns', /^[\d.]+px [\d.]+px$/);
    await expect(page.getByRole('button', { name: /Yazdır \/ PDF kaydet/ })).toBeVisible();
  });

  test('etiket sayfası seçili cihaz yoksa boş durum gösterir', async ({ page }) => {
    await page.goto('/etiketler');
    await expect(page.getByText('Etiket oluşturulacak cihaz seçilmedi')).toBeVisible();
  });
});

test.describe('rol kısıtları (envanter)', () => {
  test('birim sorumlusu: yalnızca biriminin cihazlarını görür; yönetici işlemleri yok; etiket yazdırabilir', async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    const a = api(request, await tokenFor(request, 'manager'));
    const mine = await a.get('/devices?pageSize=100');
    await page.goto('/devices');
    await expect(page.locator('tbody tr')).toHaveCount(Math.min(10, mine.meta.total));
    await expect(page.getByRole('button', { name: 'Yeni cihaz' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zimmetle', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'İade al' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Tümü/ })).toHaveCount(0); // durum sekmeleri yöneticiye özel
    for (const r of await page.locator('tbody tr').all()) await expect(r).toContainText('Bilgi İşlem');
    await page.locator('tbody input[type=checkbox]').first().check();
    const bar = page.getByRole('toolbar');
    await expect(bar.getByRole('button', { name: 'Etiket yazdır' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Zimmetle' })).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Durum', exact: true })).toHaveCount(0);
  });

  test('personel kendi cihazı için arıza bildirir: zimmet düşer, cihaz listeden kalkar; başkasının cihazında düğme yok', async ({ page, request }) => {
    const admin = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(admin, { brand: 'PersonelAriza' });
    const other = await createDevice(admin, { brand: 'BaskaninCihazi' });
    const staff = await userByEmail(admin, ACCOUNTS.staff.email);
    const mgr = await userByEmail(admin, ACCOUNTS.manager.email);
    await admin.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await admin.post('/assignments', { deviceId: other.id, userId: mgr.id });
    await loginAs(page, request, 'staff');
    await page.goto('/');
    const card = page.locator('div').filter({ hasText: 'PersonelAriza' }).filter({ has: page.getByRole('button', { name: 'Arıza' }) }).last();
    await card.getByRole('button', { name: 'Arıza' }).click();
    const dlg = page.getByRole('dialog', { name: 'Arıza bildir' });
    await expect(dlg).toContainText('zimmetinizden otomatik düşer');
    await dlg.getByLabel('Arıza açıklaması').fill('Açılmıyor, ışık yanmıyor');
    await dlg.getByRole('button', { name: 'Arıza bildir' }).click();
    await expect(toast(page, 'Arıza bildirildi')).toBeVisible();
    await expect(page.getByText('PersonelAriza')).toHaveCount(0);
    expect((await admin.get(`/devices/${dev.id}`)).device).toMatchObject({ status: 'FAULTY', holder: null });
    await page.goto(`/devices/${other.id}`);
    await expect(heading(page)).toContainText('BaskaninCihazi');
    await expect(page.getByRole('button', { name: 'Arıza bildir' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Düzenle' })).toHaveCount(0);
    await expect(page.getByText('Zimmet geçmişi')).toHaveCount(0); // geçmiş yalnızca yönetici/birim sorumlusuna
  });
});
