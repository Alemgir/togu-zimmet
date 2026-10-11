import fs from 'node:fs';
import { api, createDevice, expect, heading, loginAs, short, test, toast, tokenFor } from '../fixtures';

test.describe('envanter sayımı', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('yeni sayım: konum yalnızca kayıtlı konumlardan seçilir; başlatınca beklenen cihaz sayısı gösterilir', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const loc = 'SayimOdasi ' + short();
    await createDevice(a, { location: loc });
    await createDevice(a, { location: loc });
    await page.goto('/counts');
    await expect(heading(page)).toHaveText('Envanter sayımı');
    await page.getByRole('button', { name: /Yeni sayım|İlk sayımı başlat/ }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Yeni sayım' });
    await expect(dlg.getByLabel('Sayım adı')).toHaveValue(/Envanter sayımı · /);
    await dlg.getByLabel('Sayım adı').fill('E2E sayımı ' + loc);
    const konum = dlg.getByRole('combobox', { name: 'Konum' });
    await konum.fill('yokboyle konum');
    await expect(page.getByRole('option', { name: /olarak ekle/ })).toHaveCount(0); // yeni konum yazılamaz (sayılacak cihaz olmaz)
    await konum.fill(loc.toLowerCase()); // büyük/küçük harf duyarsız eşleşir
    await page.getByRole('option', { name: loc }).click();
    await dlg.getByRole('button', { name: 'Sayımı başlat' }).click();
    await expect(toast(page, 'Sayım başlatıldı')).toBeVisible();
    await expect(page).toHaveURL(/\/counts\/[^/]+$/);
    await expect(heading(page)).toContainText('E2E sayımı');
    await expect(page.getByText('0/2')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Eksik 2$/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('okutma: demirbaş no yazıp Enter → "Sayıldı"; tekrar → uyarı; listede olmayan → beklenmeyen; geçersiz kod → hata', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const loc = 'OkutOdasi ' + short();
    const [d1, d2] = [await createDevice(a, { location: loc }), await createDevice(a, { location: loc })];
    const outsider = await createDevice(a, { location: 'Başka Yer ' + short() });
    const s = (await a.post('/counts', { name: 'Okutma ' + loc, location: loc })).session;
    await page.goto(`/counts/${s.id}`);
    const input = page.getByLabel('Kodu okutun veya yazın');
    await expect(input).toBeFocused(); // barkod okuyucu için otomatik odak
    await input.fill(d1.assetTag);
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText('Sayıldı');
    await expect(page.getByText('1/2')).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await input.fill(d1.assetTag.toLowerCase()); // büyük/küçük harf duyarsız
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText('Zaten sayılmıştı');
    await expect(page.getByText('1/2')).toBeVisible(); // ilerleme artmadı
    await input.fill(`http://localhost:5174/scan/${outsider.qrToken}`); // QR bağlantısı da kabul edilir
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText('Listede yok (beklenmeyen)');
    await expect(page.getByRole('tab', { name: /^Beklenmeyen 1$/ })).toBeVisible();
    await input.fill('YOK-BOYLE-KOD');
    await input.press('Enter');
    await expect(page.getByRole('status')).toContainText('Okutulamadı');
    // sekmeler
    await page.getByRole('tab', { name: /^Eksik 1$/ }).click();
    await expect(page.locator('main li').filter({ hasText: d2.assetTag })).toBeVisible();
    await expect(page.locator('main li').filter({ hasText: d1.assetTag })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Sayılan 1$/ }).click();
    await expect(page.locator('main li').filter({ hasText: d1.assetTag })).toContainText('Sayıldı');
    await page.getByRole('tab', { name: /^Beklenmeyen 1$/ }).click();
    await expect(page.locator('main li').filter({ hasText: outsider.assetTag })).toContainText('Beklenmeyen');
    await page.getByRole('tab', { name: /^Tümü 3$/ }).click();
    await page.getByLabel('Cihaz ara').fill(d2.assetTag);
    await expect(page.locator('main li').filter({ hasText: /TOGU-/ })).toHaveCount(1);
  });

  test('sayımı bitir: eksik sayısı uyarısı; kapanınca okutma kapanır, rapor indirilir, listede %100 görünür', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const loc = 'BitisOdasi ' + short();
    const [d1] = [await createDevice(a, { location: loc }), await createDevice(a, { location: loc })];
    const s = (await a.post('/counts', { name: 'Bitiş ' + loc, location: loc })).session;
    await a.post(`/counts/${s.id}/scan`, { code: d1.assetTag });
    await page.goto(`/counts/${s.id}`);
    await page.getByRole('button', { name: 'Sayımı bitir' }).click();
    const dlg = page.getByRole('dialog', { name: 'Sayımı bitir' });
    await expect(dlg).toContainText('1 cihaz');
    await expect(dlg).toContainText('Eksik');
    await dlg.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(dlg).toBeHidden(); // çıkış animasyonu bitmeden yeniden açılmaz
    await expect(page.getByLabel('Kodu okutun veya yazın')).toBeVisible(); // vazgeçildi: hâlâ açık
    await page.getByRole('button', { name: 'Sayımı bitir' }).click();
    await dlg.getByRole('button', { name: 'Sayımı bitir' }).click();
    await expect(toast(page, 'Sayım tamamlandı')).toBeVisible();
    await expect(page.getByLabel('Kodu okutun veya yazın')).toHaveCount(0);
    await expect(page.getByText(/Sayım tamamlandı\. 1 cihaz bulunamadı/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sayımı bitir' })).toHaveCount(0);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV raporu' }).click()]);
    const csv = fs.readFileSync((await dl.path())!, 'utf8');
    expect(csv).toContain('Sayıldı');
    expect(csv).toContain('Eksik');
    expect(csv).toContain(d1.assetTag);
    // kapalı sayıma API ile okutma reddedilir
    expect(await a.status('post', `/counts/${s.id}/scan`, { code: d1.assetTag })).toBe(409);
    await page.goto('/counts');
    const cardEl = page.getByRole('button').filter({ hasText: 'Bitiş ' + loc });
    await expect(cardEl).toContainText('Tamamlandı');
    await expect(cardEl).toContainText('%50');
  });

  test('tüm cihazlar okutulunca %100 ve "Eksik cihaz yok" boş durumu', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const loc = 'TamOda ' + short();
    const d = await createDevice(a, { location: loc });
    const s = (await a.post('/counts', { name: 'Tam ' + loc, location: loc })).session;
    await page.goto(`/counts/${s.id}`);
    await page.getByLabel('Kodu okutun veya yazın').fill(d.assetTag);
    await page.getByLabel('Kodu okutun veya yazın').press('Enter');
    await expect(page.getByText('%100')).toBeVisible();
    await page.getByRole('tab', { name: /^Eksik 0$/ }).click();
    await expect(page.getByText('Eksik cihaz yok')).toBeVisible();
  });

  test('sayılacak cihaz yoksa hata gösterilir; olmayan sayım adresi uyarı verir', async ({ page }) => {
    await page.goto('/counts');
    await page.getByRole('button', { name: /Yeni sayım|İlk sayımı başlat/ }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Yeni sayım' });
    await dlg.getByLabel('Sayım adı').fill('x'); // çok kısa: düğme kapalı
    await expect(dlg.getByRole('button', { name: 'Sayımı başlat' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.goto('/counts/yok-boyle-sayim');
    await expect(page.getByText('Sayım bulunamadı')).toBeVisible();
  });

  test('kamera düğmesi: açılır/kapanır, kamera yoksa anlaşılır hata gösterilir (uygulama çökmez)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const loc = 'KameraOda ' + short();
    await createDevice(a, { location: loc });
    const s = (await a.post('/counts', { name: 'Kamera ' + loc, location: loc })).session;
    await page.goto(`/counts/${s.id}`);
    await page.getByRole('button', { name: 'Kamerayı aç' }).click();
    await expect(page.getByRole('button', { name: 'Kamerayı kapat' })).toBeVisible();
    await expect(page.getByText(/Kameraya erişilemedi/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Kamerayı kapat' }).click(); // eskiden: "Cannot stop, scanner is not running" ile sayfa çöküyordu
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kamerayı aç' })).toBeVisible();
    await expect(heading(page)).toContainText('Kamera');
  });
});
