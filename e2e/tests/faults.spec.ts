import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, heading, loginAs, short, test, toast, tokenFor, userByEmail } from '../fixtures';

const column = (page: Page, name: string) => page.locator('div.rounded-2xl:not([role=dialog])').filter({ has: page.getByRole('heading', { name, exact: true }) }).first();
const card = (page: Page, text: string) => page.locator('[draggable]').filter({ hasText: text });

/** Arızalı cihaz + açık arıza kaydı hazırlar (iş kuralıyla: durum Arızalı → kayıt otomatik açılır). */
async function faultyDevice(a: ReturnType<typeof api>, brand: string, note = 'Ekran titriyor') {
  const dev = await createDevice(a, { brand });
  await a.patch(`/devices/${dev.id}/status`, { status: 'FAULTY', note });
  const ticket = (await a.get(`/faults?deviceId=${dev.id}`)).data[0];
  return { dev, ticket };
}

test.describe('arıza panosu (yönetici)', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('sütun sayıları sunucuyla aynı; yeni arıza "Açık" sütununda görünür', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'PanoMarka' + short();
    await faultyDevice(a, brand, 'Disk hatası');
    const board = await a.get('/faults/board');
    await page.goto('/faults');
    await expect(heading(page)).toHaveText('Arızalar');
    for (const [name, key] of [['Açık', 'OPEN'], ['İnceleniyor', 'IN_PROGRESS'], ['Çözüldü', 'RESOLVED']] as const) {
      await expect(column(page, name).locator('span.tabular-nums').first()).toHaveText(String(board[key].length));
    }
    await expect(column(page, 'Açık')).toContainText(brand);
    await expect(column(page, 'Açık')).toContainText('Disk hatası');
    expect(errors).toEqual([]);
  });

  test('SÜRÜKLE-BIRAK: kart Açık → İnceleniyor sütununa taşınır ve sunucuda kalıcı olur', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'SurukleMarka' + short();
    const { ticket } = await faultyDevice(a, brand);
    await page.goto('/faults');
    await card(page, brand).dragTo(column(page, 'İnceleniyor'));
    await expect(toast(page, /İnceleniyor/)).toBeVisible();
    await expect(column(page, 'İnceleniyor')).toContainText(brand);
    await expect(column(page, 'Açık')).not.toContainText(brand);
    await expect.poll(async () => (await a.get(`/faults/${ticket.id}`)).ticket.status).toBe('IN_PROGRESS');
    await page.reload();
    await expect(column(page, 'İnceleniyor')).toContainText(brand); // yenilemede de orada
  });

  test('Çözüldü sütununa bırakınca çözüm notu penceresi açılır; onaylanınca cihaz otomatik Depoya döner', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'CozMarka' + short();
    const { dev, ticket } = await faultyDevice(a, brand);
    await page.goto('/faults');
    await card(page, brand).dragTo(column(page, 'Çözüldü'));
    const dlg = page.getByRole('dialog', { name: 'Arızayı çözüldü olarak işaretle' });
    await expect(dlg).toContainText('Depoya döner');
    await dlg.getByLabel(/Çözüm notu/).fill('Ekran paneli değişti');
    await dlg.getByRole('button', { name: 'Çözüldü' }).click();
    await expect(toast(page, /çözüldü/)).toBeVisible();
    await expect(column(page, 'Çözüldü')).toContainText(brand);
    const t = (await a.get(`/faults/${ticket.id}`)).ticket;
    expect(t).toMatchObject({ status: 'RESOLVED', resolution: 'Ekran paneli değişti' });
    expect((await a.get(`/devices/${dev.id}`)).device.status).toBe('IN_STOCK');
  });

  test('çözüm penceresinden vazgeçilirse kart yerinde kalır, hiçbir şey değişmez', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'VazgecMarka' + short();
    const { ticket } = await faultyDevice(a, brand);
    await page.goto('/faults');
    await card(page, brand).dragTo(column(page, 'Çözüldü'));
    await page.getByRole('dialog', { name: 'Arızayı çözüldü olarak işaretle' }).getByRole('button', { name: 'Vazgeç' }).click();
    await expect(column(page, 'Açık')).toContainText(brand);
    expect((await a.get(`/faults/${ticket.id}`)).ticket.status).toBe('OPEN');
  });

  test('çözülen kart Açık sütununa geri sürüklenince arıza yeniden açılır, cihaz tekrar Arızalı olur', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'YenidenAc' + short();
    const { dev, ticket } = await faultyDevice(a, brand);
    await a.patch(`/faults/${ticket.id}`, { status: 'RESOLVED' });
    await page.goto('/faults');
    await expect(column(page, 'Çözüldü')).toContainText(brand);
    await card(page, brand).dragTo(column(page, 'Açık'));
    await expect.poll(async () => (await a.get(`/faults/${ticket.id}`)).ticket.status).toBe('OPEN');
    expect((await a.get(`/devices/${dev.id}`)).device.status).toBe('FAULTY');
  });

  test('geçersiz geçiş sunucuda reddedilirse kart eski yerine döner ve hata gösterilir (zimmetli cihaz için yeniden açma)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'GeciciRed' + short();
    const { dev, ticket } = await faultyDevice(a, brand);
    await a.patch(`/faults/${ticket.id}`, { status: 'RESOLVED' });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id }); // çözülünce depoya dönmüştü, şimdi zimmetli
    await page.goto('/faults');
    await card(page, brand).dragTo(column(page, 'Açık'));
    await expect(toast(page, /zimmetli/)).toBeVisible();
    await expect(column(page, 'Çözüldü')).toContainText(brand); // geri döndü
    expect((await a.get(`/faults/${ticket.id}`)).ticket.status).toBe('RESOLVED');
  });

  test('kart ayrıntı çekmecesi: durum düğmeleri, çözüm notu, süreç zaman çizelgesi, cihaz bağlantısı', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'CekmeceMarka' + short();
    const { dev, ticket } = await faultyDevice(a, brand, 'Klavye çalışmıyor');
    await page.goto(`/faults?ticket=${ticket.id}`);
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Klavye çalışmıyor');
    await expect(dlg).toContainText('Durum');
    await dlg.getByRole('button', { name: 'İnceleniyor' }).click();
    await expect(toast(page, 'Durum: İnceleniyor')).toBeVisible();
    await dlg.getByLabel('Çözüm notu').fill('Klavye değişimi bekleniyor');
    await dlg.getByLabel('Çözüm notu').blur();
    await expect.poll(async () => (await a.get(`/faults/${ticket.id}`)).ticket.resolution).toBe('Klavye değişimi bekleniyor');
    await expect(dlg).toContainText('İlgilenen: Sistem Yöneticisi');
    await expect(dlg.getByText(/Arıza kaydı #\d+: Açık → İnceleniyor/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Çözüldü', exact: true }).click();
    await expect(toast(page, 'Durum: Çözüldü')).toBeVisible();
    expect((await a.get(`/devices/${dev.id}`)).device.status).toBe('IN_STOCK');
    await dlg.getByRole('link', { name: /Cihaz sayfası/ }).click();
    await expect(page).toHaveURL(new RegExp(`/devices/${dev.id}$`));
    await page.getByRole('tab', { name: /Arıza kayıtları/ }).click();
    await expect(page.getByText('Klavye değişimi bekleniyor')).toBeVisible();
  });

  test('liste görünümü: arama, durum çipleri, sayfalama ve CSV', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'ListeAriza' + short();
    await faultyDevice(a, brand, 'Mouse tekerleği bozuk');
    await page.goto('/faults');
    await page.getByRole('tab', { name: 'Liste' }).click();
    await page.getByLabel('Arıza ara').fill('tekerleği');
    await expect(page.locator('main li').filter({ hasText: brand })).toHaveCount(1);
    await page.getByRole('button', { name: 'Çözüldü', exact: true }).click();
    await expect(page.locator('main li').filter({ hasText: brand })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tümü', exact: true }).click();
    await page.getByLabel('Arıza ara').fill('yokboylebirarizametni');
    await expect(page.getByText('Arıza kaydı yok')).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    const text = fs.readFileSync((await dl.path())!, 'utf8');
    expect(text.split('\r\n')[0]).toContain('Kayıt no;Demirbaş no;Cihaz;Durum');
    expect(text).toContain('Mouse tekerleği bozuk');
  });
});

test.describe('arıza: personel ve birim sorumlusu', () => {
  test('personel yalnızca kendi bildirdiği arızaları liste olarak görür; pano/durum düğmeleri yok', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mine = await createDevice(a, { brand: 'BenimAriza' + short() });
    const theirs = await createDevice(a, { brand: 'DigerAriza' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: mine.id, userId: staff.id });
    const sApi = api(request, await tokenFor(request, 'staff'));
    await sApi.post(`/devices/${mine.id}/report-fault`, { note: 'Benim bildirdiğim' });
    await a.patch(`/devices/${theirs.id}/status`, { status: 'FAULTY', note: 'Başkasının' });
    await loginAs(page, request, 'staff');
    await page.goto('/faults');
    await expect(heading(page)).toHaveText('Arızalar');
    await expect(page.getByRole('tab', { name: 'Pano' })).toHaveCount(0);
    await expect(page.getByText('Benim bildirdiğim')).toBeVisible();
    await expect(page.getByText('Başkasının')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'CSV' })).toHaveCount(0);
    await page.locator('main li button').filter({ hasText: 'Benim bildirdiğim' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Benim bildirdiğim');
    await expect(dlg.getByRole('button', { name: 'İnceleniyor' })).toHaveCount(0); // yalnızca yönetici durum değiştirir
  });

  test('birim sorumlusu panoyu salt okunur görür: kartlar sürüklenemez, çekmecede durum düğmesi yok', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const brand = 'MudurAriza' + short();
    const dev = await createDevice(a, { brand });
    const mgrUser = await userByEmail(a, ACCOUNTS.manager.email);
    await a.post('/assignments', { deviceId: dev.id, userId: mgrUser.id });
    const mApi = api(request, await tokenFor(request, 'manager'));
    await mApi.post(`/devices/${dev.id}/report-fault`, { note: 'Birim sorumlusu bildirdi' });
    await loginAs(page, request, 'manager');
    await page.goto('/faults');
    await expect(column(page, 'Açık')).toContainText(brand);
    const c = page.locator('[role=button]').filter({ hasText: brand });
    await expect(c).toHaveAttribute('draggable', 'false');
    await c.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Birim sorumlusu bildirdi');
    await expect(dlg.getByRole('button', { name: 'İnceleniyor' })).toHaveCount(0);
    await expect(dlg.getByLabel('Çözüm notu')).toHaveCount(0);
  });
});
