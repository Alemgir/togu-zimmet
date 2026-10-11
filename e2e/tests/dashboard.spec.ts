import { ACCOUNTS, api, createDevice, expect, heading, loginAs, short, sql, test, tokenFor, uniq, userByEmail } from '../fixtures';

test.describe('komuta merkezi (yönetici)', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('KPI rakamları sunucudaki gerçek değerlerle birebir aynıdır', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const d = await a.get('/dashboard');
    await page.goto('/');
    const kpi = (label: string) => page.getByRole('button', { name: new RegExp(label) });
    await expect(kpi('Toplam cihaz')).toContainText(String(d.totals.devices));
    await expect(kpi('Zimmetli')).toContainText(String(d.totals.assigned));
    await expect(kpi('Boşta')).toContainText(String(d.totals.inStock));
    await expect(kpi('Arızalı')).toContainText(String(d.totals.faulty));
    await expect(page.getByText('Dikkat gerektirenler')).toBeVisible();
    await expect(page.getByText('Cihaz türleri', { exact: true })).toBeVisible();
    await expect(page.getByText('Canlı akış')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('"Hareket" grafiği yok; yerinde cihaz türü kutuları var', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hareket' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Cihaz türüne göre süz' })).toBeVisible();
    await expect(page.getByText('Kutulara tıklayarak diğer grafikleri süz')).toBeVisible();
  });

  test('tür kutusuna tıklamak tüm göstergeleri o türe göre süzer; tekrar tıklayınca kalkar; adres çubuğunda saklanır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const all = await a.get('/dashboard');
    const lap = await a.get('/dashboard?type=LAPTOP');
    expect(lap.totals.devices).toBeLessThan(all.totals.devices);
    await page.goto('/');
    await page.getByRole('button', { name: /^Dizüstü: \d+ cihaz$/ }).click();
    await expect(page).toHaveURL(/\?type=LAPTOP/);
    await expect(page.getByText('Filtre: Dizüstü')).toBeVisible();
    await expect(page.getByRole('button', { name: /Toplam cihaz/ })).toContainText(String(lap.totals.devices));
    await expect(page.getByRole('button', { name: /Zimmetli/ })).toContainText(String(lap.totals.assigned));
    await expect(page.getByRole('button', { name: /^Dizüstü: \d+ cihaz$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Monitör: \d+ cihaz$/ })).toHaveAttribute('aria-pressed', 'false');
    // Yenileyince süzgeç korunur
    await page.reload();
    await expect(page.getByText('Filtre: Dizüstü')).toBeVisible();
    await expect(page.getByRole('button', { name: /Toplam cihaz/ })).toContainText(String(lap.totals.devices));
    // Aynı kutuya tekrar tıklayınca kalkar
    await page.getByRole('button', { name: /^Dizüstü: \d+ cihaz$/ }).click();
    await expect(page).not.toHaveURL(/type=/);
    await expect(page.getByRole('button', { name: /Toplam cihaz/ })).toContainText(String(all.totals.devices));
  });

  test('süzgeç çubuğundaki ✕ ve "Süzgeci kaldır" düğmesi süzgeci temizler; KPI kartı süzgeçle birlikte listeye gider', async ({ page }) => {
    await page.goto('/?type=MONITOR');
    await expect(page.getByText('Filtre: Monitör')).toBeVisible();
    await page.getByRole('button', { name: 'Süzgeci kaldır' }).first().click();
    await expect(page).not.toHaveURL(/type=/);
    await page.goto('/?type=MONITOR');
    await page.getByRole('button', { name: 'Filtreyi kaldır' }).click();
    await expect(page).not.toHaveURL(/type=/);
    await page.goto('/?type=MONITOR');
    await page.getByRole('button', { name: /Zimmetli/ }).click();
    await expect(page).toHaveURL(/\/devices\?status=ASSIGNED&type=MONITOR/);
  });

  test('özel (yazılan) cihaz türü kutularda görünür ve süzülebilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const custom = 'Projeksiyon' + short();
    await createDevice(a, { type: custom });
    await createDevice(a, { type: custom });
    await page.goto('/');
    const box = page.getByRole('button', { name: new RegExp(`^${custom}: 2 cihaz$`) });
    await expect(box).toBeVisible();
    await box.click();
    await expect(page.getByRole('button', { name: /Toplam cihaz/ })).toContainText('2');
    await expect(page.getByText(`Filtre: ${custom}`)).toBeVisible();
  });

  test('KPI kartları ilgili sayfaya götürür', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Boşta/ }).click();
    await expect(page).toHaveURL(/\/devices\?status=IN_STOCK/);
    await page.goto('/');
    await page.getByRole('button', { name: /Arızalı/ }).click();
    await expect(page).toHaveURL(/\/faults$/);
    await expect(heading(page)).toHaveText('Arızalar');
  });

  test('"Dikkat gerektirenler": sekme sayıları sunucu verisiyle tutarlı, arıza maddesi kayda götürür', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const d = await a.get('/dashboard');
    await page.goto('/');
    await expect(page.getByRole('tab', { name: new RegExp(`^Arıza ${d.attention.faults.length}$`) })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^Garanti ${d.attention.warranty.length}$`) })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^Gecikme ${d.attention.overdue.length}$`) })).toBeVisible();
    const total = d.attention.faults.length + d.attention.warranty.length + d.attention.overdue.length + (d.attention.stale.count > 0 ? 1 : 0);
    await expect(page.getByRole('tab', { name: new RegExp(`^Hepsi ${total}$`) })).toBeVisible();
    await page.getByRole('tab', { name: /^Arıza/ }).click();
    await page.getByRole('button', { name: 'Kaydı aç' }).first().click();
    await expect(page).toHaveURL(/\/faults\?ticket=/);
    await expect(page.getByRole('dialog')).toBeVisible(); // ayrıntı çekmecesi
  });

  test('gecikmiş zimmet: "Hatırlat" personele bildirim gönderir; "Uzat" tarihi günceller', async ({ page, request }) => {
    const admin = api(request, await tokenFor(request, 'admin'));
    const staffTok = await tokenFor(request, 'staff');
    const staffApi = api(request, staffTok);
    const dev = await createDevice(admin, { brand: 'GecikmeMarka' });
    const staff = await userByEmail(admin, ACCOUNTS.staff.email);
    const asg = (await admin.post('/assignments', { deviceId: dev.id, userId: staff.id, dueAt: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) })).assignment;
    sql(`UPDATE "Assignment" SET "dueAt" = now() - interval '3 days' WHERE id = '${asg.id}'`); // iş kuralı geçmiş tarihi reddettiği için zaman yolculuğu
    await page.goto('/');
    const row = page.getByTestId('attention-list').getByRole('listitem').filter({ hasText: 'GecikmeMarka' });
    await expect(row).toContainText('iade tarihi 3 gün geçti');
    const before = (await staffApi.get('/notifications')).unread;
    await row.getByRole('button', { name: 'Hatırlat' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'hatırlatma gönderildi' })).toBeVisible();
    await expect.poll(async () => (await staffApi.get('/notifications')).unread).toBeGreaterThan(before);
    await row.getByRole('button', { name: 'Uzat' }).click();
    const dlg = page.getByRole('dialog', { name: 'Planlı iade tarihi' });
    await expect(dlg).toBeVisible();
    const future = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    await dlg.getByLabel('Yeni iade tarihi').fill(future);
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'güncellendi' })).toBeVisible();
    await expect(page.getByTestId('attention-list').getByRole('listitem').filter({ hasText: 'GecikmeMarka' })).toHaveCount(0); // artık gecikmiş değil
  });

  test('hızlı işlemler: Zimmetle ve Cihaz ekle pencereleri açılır, QR tara tarayıcıyı açar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Zimmetle', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Zimmet ver' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Cihaz ekle', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Yeni cihaz ekle' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'QR tara' }).click();
    const qr = page.getByRole('dialog', { name: 'QR ile cihaz bul' });
    await expect(qr).toBeVisible();
    await page.waitForTimeout(1200); // kamera başlatma denemesi (kamera yok → hata mesajı)
    await expect(qr.getByText(/Kameraya erişilemedi/)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape'); // kamera hiç başlamadan kapatma uygulamayı çökertmemeli
    await expect(qr).toBeHidden();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(heading(page)).toContainText('Sistem');
  });

  test('canlı akış: yeni hareket birkaç saniye içinde görünür (otomatik yenileme)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    await page.goto('/');
    const marker = 'CanliAkis' + short();
    await createDevice(a, { brand: marker });
    // 20 sn'lik yenileme beklemek yerine odağı yeniden kazandırarak değil, gerçekten bekleyerek doğrula
    await expect(page.getByText(new RegExp(marker))).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('birim sorumlusu paneli', () => {
  test('yalnızca kendi biriminin verisini gösterir; yönetici işlemleri yoktur', async ({ page, request, errors }) => {
    await loginAs(page, request, 'manager');
    const a = api(request, await tokenFor(request, 'manager'));
    const d = await a.get('/dashboard');
    expect(d.scope).toBe('department');
    await page.goto('/');
    await expect(page.getByText('Bilgi İşlem birimi')).toBeVisible();
    await expect(page.getByRole('button', { name: /Toplam cihaz/ })).toContainText(String(d.totals.devices));
    await expect(page.getByRole('button', { name: 'Cihaz ekle', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zimmetle', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Raporlar', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Hareketsiz/ })).toHaveCount(0);
    await expect(page.getByText('Biriminizdeki cihazlar')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('bildirim zili ve komut paleti', () => {
  test('zil: okunmamış sayısı sunucuyla aynı; tıklayınca ilgili sayfaya gider ve okundu olur; tümünü okundu yap', async ({ page, request }) => {
    const admin = api(request, await tokenFor(request, 'admin'));
    const staffApi = api(request, await tokenFor(request, 'staff'));
    const dev = await createDevice(admin, { brand: 'BildirimMarka' });
    const staff = await userByEmail(admin, ACCOUNTS.staff.email);
    await admin.post('/assignments', { deviceId: dev.id, userId: staff.id });
    await loginAs(page, request, 'staff');
    await page.goto('/');
    const n = await staffApi.get('/notifications');
    expect(n.unread).toBeGreaterThan(0);
    const bell = page.getByRole('button', { name: new RegExp(`Bildirimler, ${n.unread} okunmamış`) });
    await expect(bell).toBeVisible();
    await bell.click();
    const item = page.getByRole('button', { name: /Size zimmet verildi/ }).filter({ hasText: 'BildirimMarka' }).first();
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(new RegExp(`/devices/${dev.id}$`));
    await expect.poll(async () => (await staffApi.get('/notifications')).unread).toBe(n.unread - 1);
    await page.getByRole('button', { name: /Bildirimler/ }).click();
    await page.getByRole('button', { name: /Tümünü okundu yap/ }).click();
    await expect.poll(async () => (await staffApi.get('/notifications')).unread).toBe(0);
    await expect(page.getByRole('button', { name: 'Bildirimler', exact: true })).toBeVisible(); // rozet kalktı
  });

  test('bildirim yokken boş durum gösterilir', async ({ page, request }) => {
    const admin = api(request, await tokenFor(request, 'admin'));
    const email = `bos.${Date.now()}@gop.edu.tr`;
    await admin.post('/users', { name: 'Bildirimsiz Kişi', email, password: 'Sifre1234', role: 'STAFF' });
    const res = await request.post('http://127.0.0.1:3100/api/auth/login', { data: { email, password: 'Sifre1234' } });
    const token = (await res.json()).token;
    await page.addInitScript((t) => localStorage.setItem('zimmet_token', t), token);
    await page.goto('/');
    await page.getByRole('button', { name: 'Bildirimler' }).click();
    await expect(page.getByText('Henüz bildirim yok')).toBeVisible();
  });

  test('komut paleti: Ctrl+K ile açılır, cihaz arar, Enter ile cihaza gider, Esc kapatır', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'PaletMarka', model: 'ZX-' + short() });
    await page.goto('/');
    await expect(heading(page)).toContainText('Sistem');
    await page.keyboard.press('Control+k');
    const box = page.getByPlaceholder(/Cihaz, seri no, kişi veya sayfa ara/);
    await expect(box).toBeVisible();
    await box.fill('PaletMarka');
    await expect(page.getByRole('button', { name: new RegExp(dev.assetTag) })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/devices/${dev.id}$`));
    await page.keyboard.press('Control+k');
    await expect(box).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
  });

  test('komut paleti: sayfa adı yazınca sayfaya gider; sonuç yoksa mesaj gösterir', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/');
    await page.getByRole('button', { name: 'Ara', exact: true }).click();
    await page.getByPlaceholder(/ara/i).fill('rapor');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/reports$/);
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder(/ara/i).fill('zzzyokboylebirsey123');
    await expect(page.getByText('Sonuç bulunamadı')).toBeVisible();
  });

  test('personelde komut paleti yalnızca kendi sayfalarını gösterir', async ({ page, request }) => {
    await loginAs(page, request, 'staff');
    await page.goto('/');
    await expect(heading(page)).toHaveText('Zimmetlerim'); // sayfa etkileşime hazır olmadan kısayol basılmaz
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('button', { name: /Zimmetlerim/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Kullanıcılar/ })).toHaveCount(0);
  });
});
