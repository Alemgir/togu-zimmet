import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, heading, loginAs, short, test, tokenFor, userByEmail } from '../fixtures';

/** Yatay kaydırma (taşma) olmamalı */
async function noHorizontalOverflow(page: Page, label: string) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, `${label}: yatay taşma (scrollWidth ${o.sw} > ${o.cw})`).toBeLessThanOrEqual(o.cw + 1);
}

test.describe('mobil görünüm (Pixel 7)', () => {
  test('giriş ekranı mobilde kullanılır; kart ekrana sığar', async ({ page, errors }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Tekrar hoş geldiniz' })).toBeVisible();
    await noHorizontalOverflow(page, '/login');
    const card = await page.getByRole('heading', { name: 'Tekrar hoş geldiniz' }).evaluate((h) => h.closest('div[class*="rounded-3xl"]')!.getBoundingClientRect().width);
    expect(card).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.getByRole('button', { name: 'Yönetici' }).tap();
    await page.getByRole('button', { name: /Giriş yap/ }).tap();
    await expect(page.getByRole('dialog', { name: 'Hoş geldiniz' })).toBeVisible();
    await page.getByRole('button', { name: 'Atla' }).tap();
    await expect(heading(page)).toContainText('Sistem');
    expect(errors).toEqual([]);
  });

  test('alt menü görünür, kenar çubuğu gizli; her sayfaya alt menüden geçilir (yenilemesiz)', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/');
    await expect(page.locator('aside')).toBeHidden();
    const nav = page.getByRole('navigation', { name: 'Alt menü' });
    await expect(nav).toBeVisible();
    for (const [label, h] of [['Envanter', 'Envanter'], ['Zimmetler', 'Zimmetler'], ['Arızalar', 'Arızalar'], ['Sayım', 'Envanter sayımı'], ['Raporlar', 'Raporlar'], ['Kullanıcılar', 'Kullanıcılar'], ['Panel', 'Sistem']] as const) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await link.tap();
      await expect(heading(page), label).toContainText(h);
    }
  });

  test('hiçbir sayfada yatay taşma yok (yönetici sayfaları)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'MobilMarka' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
    await loginAs(page, request, 'admin');
    for (const path of ['/', '/devices', '/assignments', '/faults', '/counts', '/reports', '/users', '/profile', `/devices/${dev.id}`, `/tutanak/${asg.id}`, `/etiketler?ids=${dev.id}`, '/foy/me']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      if (path.startsWith('/tutanak') || path.startsWith('/etiketler') || path.startsWith('/foy')) continue; // yazdırma belgeleri sabit A4 genişliğindedir (yatay kaydırılabilir)
      await noHorizontalOverflow(page, path);
    }
  });

  test('envanter mobilde kart listesi olarak görünür; tablo gizli', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/devices');
    await expect(page.locator('table')).toBeHidden();
    const cards = page.locator('main ul > li');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);
    await cards.first().tap();
    await expect(page).toHaveURL(/\/devices\/[^/]+$/);
  });

  test('KPI kartları mobilde iki sütun', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/');
    const a = await page.getByRole('button', { name: /Toplam cihaz/ }).boundingBox();
    const b = await page.getByRole('button', { name: /Zimmetli/ }).boundingBox();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(4); // aynı satırda
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);
  });

  test('cihaz ekleme çekmecesi tam genişlik; Combobox dokunmatikle kullanılır, liste ekran içinde kalır', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/devices');
    await page.getByRole('button', { name: 'Yeni cihaz' }).tap();
    const dlg = page.getByRole('dialog', { name: 'Yeni cihaz ekle' });
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
    await dlg.getByLabel('Marka').tap();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    const lb = await list.boundingBox();
    expect(lb!.x).toBeGreaterThanOrEqual(0);
    expect(lb!.x + lb!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    await page.getByRole('option', { name: 'Lenovo' }).tap();
    await expect(dlg.getByLabel('Marka')).toHaveValue('Lenovo');
    // yeni tür yazma (ekran klavyesi yerine fill)
    await dlg.getByLabel('Cihaz türü').fill('Mobil Tür ' + short());
    await expect(page.getByRole('option', { name: /olarak ekle/ })).toBeVisible();
  });

  test('arıza panosu mobilde sütunlar alt alta; bildirim paneli ekrana sığar', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/faults');
    const cols = page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: /Açık|İnceleniyor|Çözüldü/ }) });
    const b1 = await cols.nth(0).boundingBox();
    const b2 = await cols.nth(1).boundingBox();
    expect(b2!.y).toBeGreaterThan(b1!.y + b1!.height - 4); // alt alta
    await page.getByRole('button', { name: /Bildirimler/ }).tap();
    const pop = page.getByText('Bildirimler', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    const pb = await pop.boundingBox();
    expect(pb!.x).toBeGreaterThanOrEqual(0);
    expect(pb!.x + pb!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });

  test('personel mobilde zimmet kartlarını görür ve arıza bildirir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'MobilPersonel' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await loginAs(page, request, 'staff');
    await page.goto('/');
    await noHorizontalOverflow(page, 'personel /');
    await expect(page.getByText(dev.brand)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Alt menü' })).toBeVisible();
    const cardEl = page.locator('div').filter({ hasText: dev.brand }).filter({ has: page.getByRole('button', { name: 'Arıza' }) }).last();
    await cardEl.getByRole('button', { name: 'Arıza' }).tap();
    await expect(page.getByRole('dialog', { name: 'Arıza bildir' })).toBeVisible();
  });

  test('toplu işlem çubuğu alt menünün üstünde, örtüşmeden görünür', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/devices');
    await page.locator('main ul > li input[type=checkbox]').first().check();
    const bar = page.getByRole('toolbar', { name: 'Toplu işlemler' });
    await expect(bar).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Alt menü' });
    // giriş animasyonu bitince çubuğun alt kenarı alt menünün üst kenarını geçmemeli
    await expect.poll(async () => {
      const [bb, nb] = [await bar.boundingBox(), await nav.boundingBox()];
      return nb!.y - (bb!.y + bb!.height);
    }).toBeGreaterThanOrEqual(-1);
  });
});
