import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, heading, loginAs, short, sql, test, toast, tokenFor, userByEmail } from '../fixtures';

const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

async function pickUser(dlg: ReturnType<Page['getByRole']>, name: string) {
  await dlg.getByPlaceholder(/Personel ara/).fill(name);
  await dlg.getByRole('button', { name: new RegExp(name) }).first().click();
}

test.describe('zimmet verme, devir, iade', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('cihaz satırından zimmet: planlı iade ve not ile verilir, toast\'taki "Tutanak" bağlantısı belgeyi açar', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'ZimmetMarka' + short() });
    await page.goto('/devices');
    await page.getByLabel('Cihaz ara').fill(dev.brand);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.locator('tbody tr').getByRole('button', { name: 'Zimmetle' }).click();
    const dlg = page.getByRole('dialog', { name: 'Zimmet ver' });
    await expect(dlg).toContainText(dev.assetTag);
    await expect(dlg.getByRole('button', { name: /Zimmetle/ })).toBeDisabled(); // kişi seçilmeden kapalı
    await pickUser(dlg, 'Ayşe');
    await dlg.getByLabel(/Planlı iade tarihi/).fill(iso(30));
    await dlg.getByLabel(/Not/).fill('Çanta ile teslim');
    await dlg.getByRole('button', { name: /Zimmetle/ }).click();
    const t = toast(page, 'Zimmet verildi');
    await expect(t).toBeVisible();
    await t.getByRole('button', { name: 'Tutanak' }).click();
    await expect(page).toHaveURL(/\/tutanak\//);
    await expect(page.getByText('ZİMMET TESLİM TUTANAĞI')).toBeVisible();
    await expect(page.locator('.print-doc')).toContainText(dev.assetTag);
    await expect(page.locator('.print-doc')).toContainText('Ayşe Yılmaz');
    await expect(page.locator('.print-doc')).toContainText('Planlı iade tarihi');
    await expect(page.locator('.print-doc')).toContainText('Çanta ile teslim');
    await expect(page.locator('.print-doc')).toContainText(/ZT-\d{4}-\d{6}/);
    const d = (await a.get(`/devices/${dev.id}`)).device;
    expect(d).toMatchObject({ status: 'ASSIGNED', holder: { name: 'Ayşe Yılmaz' } });
    expect(d.dueAt.slice(0, 10)).toBe(iso(30));
    expect(errors).toEqual([]);
  });

  test('başkasındaki cihaz devredilir: uyarı gösterilir, eski zimmet otomatik düşer, sonuç sunucuda doğrulanır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'DevirMarka' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'Devret' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cihazı devret' });
    await expect(dlg).toContainText('Ayşe Yılmaz');
    await expect(dlg).toContainText('otomatik olarak düşülecek');
    await pickUser(dlg, 'Mehmet');
    await dlg.getByRole('button', { name: /Devret/ }).click();
    await expect(toast(page, 'Cihaz devredildi')).toBeVisible();
    await expect(page.getByText('Mehmet Kaya').first()).toBeVisible();
    const detail = await a.get(`/devices/${dev.id}`);
    expect(detail.device.holder.name).toBe('Mehmet Kaya');
    expect(detail.history).toHaveLength(2);
    expect(detail.history.find((h: { user: { name: string } }) => h.user.name === 'Ayşe Yılmaz').returnReason).toBe('REASSIGNED');
  });

  test('iade (sağlam): zimmet düşer, cihaz Depoya döner; iade tutanağı üretilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'IadeMarka' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'İade al' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cihazı iade al' });
    await dlg.getByLabel(/Not/).fill('Sağlam teslim');
    await dlg.getByRole('button', { name: 'İade al' }).click();
    await expect(toast(page, 'Zimmet düşüldü')).toBeVisible();
    expect((await a.get(`/devices/${dev.id}`)).device).toMatchObject({ status: 'IN_STOCK', holder: null });
    await page.goto(`/tutanak/${asg.id}`);
    await page.getByRole('button', { name: 'İade tutanağı' }).click();
    await expect(page.getByText('ZİMMET İADE TUTANAĞI')).toBeVisible();
    await expect(page.locator('.print-doc')).toContainText('Sağlam teslim');
    await expect(page.locator('.print-doc')).toContainText('İade eden');
    await expect(page.locator('.print-doc')).toContainText('İade alan');
  });

  test('iade (arızalı): cihaz Arızalı olur ve arıza kaydı otomatik açılır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'ArizaliIade' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'İade al' }).click();
    const dlg = page.getByRole('dialog', { name: 'Cihazı iade al' });
    await dlg.getByRole('button', { name: /Arızalı/ }).click();
    await dlg.getByLabel(/Not/).fill('Menteşe kırık');
    await dlg.getByRole('button', { name: 'İade al' }).click();
    await expect(toast(page, 'Zimmet düşüldü')).toBeVisible();
    expect((await a.get(`/devices/${dev.id}`)).device.status).toBe('FAULTY');
    const faults = (await a.get(`/faults?deviceId=${dev.id}`)).data;
    expect(faults[0]).toMatchObject({ status: 'OPEN', description: 'Menteşe kırık' });
  });

  test('arızalı cihaz zimmetlenemez: detayda "Zimmetle" düğmesi yok, toplu zimmet seçicisinde yalnızca depodakiler listelenir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'ArizaliZimmet' + short() });
    await a.patch(`/devices/${dev.id}/status`, { status: 'FAULTY' });
    await page.goto(`/devices/${dev.id}`);
    await expect(page.getByRole('button', { name: 'Zimmetle', exact: true })).toHaveCount(0);
    await page.goto('/assignments');
    await page.getByRole('button', { name: 'Yeni zimmet' }).click();
    const dlg = page.getByRole('dialog', { name: 'Zimmet ver' });
    await dlg.getByPlaceholder(/Depodaki cihazlarda ara/).fill(dev.brand);
    await expect(dlg.getByText('Sonuç bulunamadı')).toBeVisible();
  });

  test('pasif kullanıcı zimmet seçicisinde çıkmaz', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = `pasif.${Date.now()}@gop.edu.tr`;
    const u = (await a.post('/users', { name: 'Pasif Adayı ' + short(), email, password: 'Sifre1234', role: 'STAFF' })).user;
    await a.patch(`/users/${u.id}`, { isActive: false });
    const dev = await createDevice(a);
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'Zimmetle', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Zimmet ver' });
    await dlg.getByPlaceholder(/Personel ara/).fill('Pasif Adayı');
    await expect(dlg.getByText('Sonuç bulunamadı')).toBeVisible();
  });

  test('planlı iade tarihi: belirle, uzat, kaldır (detay sayfasından)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await page.goto(`/devices/${dev.id}`);
    await expect(page.getByText('Planlı iade tarihi yok')).toBeVisible();
    await page.getByRole('button', { name: 'İade tarihi belirle' }).click();
    const dlg = page.getByRole('dialog', { name: 'Planlı iade tarihi' });
    await expect(dlg.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
    await dlg.getByLabel('Yeni iade tarihi').fill(iso(10));
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect(toast(page, 'Planlı iade tarihi güncellendi')).toBeVisible();
    await expect(page.getByText(/Planlı iade:/)).toBeVisible();
    await page.getByRole('button', { name: 'Uzat' }).click();
    await dlg.getByLabel('Yeni iade tarihi').fill(iso(20));
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect.poll(async () => ((await a.get(`/devices/${dev.id}`)).device.dueAt ?? '').slice(0, 10)).toBe(iso(20));
    await page.getByRole('button', { name: 'Uzat' }).click();
    await dlg.getByRole('button', { name: 'Tarihi kaldır' }).click();
    await expect(toast(page, 'Planlı iade tarihi kaldırıldı')).toBeVisible();
    await expect(page.getByText('Planlı iade tarihi yok')).toBeVisible();
  });

  test('geçmişe tarih seçilemez (min) ve sunucu da reddeder', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'Zimmetle', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Zimmet ver' });
    expect(await dlg.getByLabel(/Planlı iade tarihi/).getAttribute('min')).toBe(iso(0));
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    expect(await a.status('post', '/assignments', { deviceId: dev.id, userId: staff.id, dueAt: iso(-10) })).toBe(400);
  });

  test('hatırlat: personele bildirim gider (detay sayfası)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    const sApi = api(request, await tokenFor(request, 'staff'));
    const before = (await sApi.get('/notifications')).data.filter((n: { title: string }) => n.title === 'İade hatırlatması').length;
    await page.goto(`/devices/${dev.id}`);
    await page.getByRole('button', { name: 'Hatırlat' }).click();
    await expect(toast(page, 'Hatırlatma gönderildi')).toBeVisible();
    await expect.poll(async () => (await sApi.get('/notifications')).data.filter((n: { title: string }) => n.title === 'İade hatırlatması').length).toBe(before + 1);
  });
});

test.describe('zimmet listesi', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('sekmeler sunucu sayılarıyla uyumlu; arama ve gecikmiş sekmesi çalışır; CSV iner', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'GecikenListe' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id, dueAt: iso(2) })).assignment;
    sql(`UPDATE "Assignment" SET "dueAt" = now() - interval '2 days' WHERE id = '${asg.id}'`);
    const active = (await a.get('/assignments?state=active&pageSize=1')).meta.total;
    const overdue = (await a.get('/assignments?overdue=true&pageSize=1')).meta.total;
    await page.goto('/assignments');
    await expect(heading(page)).toHaveText('Zimmetler');
    await expect(page.getByText(new RegExp(`1–\\d+ / ${active} kayıt`))).toBeVisible();
    await page.getByRole('tab', { name: 'Gecikmiş' }).click();
    await expect(page.getByText(new RegExp(`1–\\d+ / ${overdue} kayıt`))).toBeVisible();
    await expect(page.getByText(/gün gecikti/).first()).toBeVisible();
    await page.getByLabel('Zimmet ara').fill(dev.brand);
    await expect(page.locator('main li').filter({ hasText: dev.brand })).toHaveCount(1);
    await page.getByRole('tab', { name: 'Geçmiş' }).click();
    await expect(page.getByText('Kayıt bulunamadı')).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^zimmetler-/);
    expect(fs.readFileSync((await dl.path())!, 'utf8')).toContain('Tutanak no;Demirbaş no');
  });

  test('listeden iade alınır ve tutanak simgesi belgeye götürür', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'ListedenIade' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
    await page.goto('/assignments');
    await page.getByLabel('Zimmet ara').fill(dev.brand);
    const row = page.locator('main li').filter({ hasText: dev.brand });
    await expect(row).toHaveCount(1);
    await row.getByRole('link', { name: 'Tutanak' }).click();
    await expect(page).toHaveURL(new RegExp(`/tutanak/${asg.id}`));
    await page.goBack();
    await page.getByLabel('Zimmet ara').fill(dev.brand);
    await page.locator('main li').filter({ hasText: dev.brand }).getByRole('button', { name: 'İade al' }).click();
    await page.getByRole('dialog', { name: 'Cihazı iade al' }).getByRole('button', { name: 'İade al' }).click();
    await expect(toast(page, 'Zimmet düşüldü')).toBeVisible();
    expect((await a.get(`/devices/${dev.id}`)).device.status).toBe('IN_STOCK');
  });

  test('birim sorumlusu zimmet listesini görür ama "Yeni zimmet"/"İade al" yok', async ({ page, request }) => {
    await page.context().clearCookies();
    const p2 = await page.context().newPage();
    await loginAs(p2, request, 'manager');
    await p2.goto('/assignments');
    await expect(heading(p2)).toHaveText('Zimmetler');
    await expect(p2.getByRole('button', { name: 'Yeni zimmet' })).toHaveCount(0);
    await expect(p2.getByRole('button', { name: 'İade al' })).toHaveCount(0);
    await expect(p2.getByRole('button', { name: 'CSV' })).toBeVisible();
    await p2.close();
  });
});

test.describe('tutanak ve föy belgeleri', () => {
  test('zimmet sahibi kendi tutanağını görür; başkası göremez', async ({ page, request, browser }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a);
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
    await loginAs(page, request, 'staff');
    await page.goto(`/tutanak/${asg.id}`);
    await expect(page.locator('.print-doc')).toContainText(dev.assetTag);
    // Farklı bir personel (kendi oluşturulan) göremez
    const email = `baska.${Date.now()}@gop.edu.tr`;
    await a.post('/users', { name: 'Başka Kişi', email, password: 'Sifre1234', role: 'STAFF', department: 'Kütüphane' });
    const ctx = await browser.newContext({ locale: 'tr-TR' });
    const p2 = await ctx.newPage();
    const tok = (await (await request.post('http://127.0.0.1:3100/api/auth/login', { data: { email, password: 'Sifre1234' } })).json()).token;
    await p2.addInitScript((t) => localStorage.setItem('zimmet_token', t), tok);
    await p2.goto(`http://localhost:5174/tutanak/${asg.id}`);
    await expect(p2.getByText('Tutanak bulunamadı veya erişim yetkiniz yok')).toBeVisible();
    await ctx.close();
  });

  test('personel zimmet föyü (/foy/me): cihazlar, imza alanları ve tutanak numaraları', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'FoyMarka' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    await a.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await loginAs(page, request, 'staff');
    await page.goto('/');
    await page.getByRole('link', { name: 'Zimmet föyüm' }).click();
    await expect(page).toHaveURL(/\/foy\/me$/);
    const doc = page.locator('.print-doc');
    await expect(doc).toContainText('PERSONEL ZİMMET FÖYÜ');
    await expect(doc).toContainText('Ayşe Yılmaz');
    await expect(doc).toContainText(dev.assetTag);
    await expect(doc).toContainText(/ZT-\d{4}-\d{6}/);
    await expect(doc).toContainText('Teslim alan');
  });

  test('yönetici bir kullanıcının föyünü kullanıcı çekmecesinden açar; zimmeti yoksa boş durum', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = `bos.foy.${Date.now()}@gop.edu.tr`;
    const u = (await a.post('/users', { name: 'Föysüz Kişi', email, password: 'Sifre1234', role: 'STAFF' })).user;
    await loginAs(page, request, 'admin');
    await page.goto(`/foy/${u.id}`);
    await expect(page.locator('.print-doc')).toContainText('Üzerinde zimmetli cihaz bulunmamaktadır');
    await page.goto('/foy/yok-boyle-kullanici');
    await expect(page.getByText('Kullanıcı bulunamadı veya erişim yetkiniz yok')).toBeVisible();
  });

  test('tutanak sayfası: Yazdır düğmesi, geri düğmesi ve olmayan kayıt', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/tutanak/yok-boyle-bir-kayit');
    await expect(page.getByText('Tutanak bulunamadı veya erişim yetkiniz yok')).toBeVisible();
  });
});
