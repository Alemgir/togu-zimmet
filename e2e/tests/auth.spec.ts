import { ACCOUNTS, expect, heading, loginAs, test, tokenFor } from '../fixtures';

test.describe('giriş ve oturum', () => {
  test('giriş ekranı: logo, form ve demo düğmeleri görünür', async ({ page, errors }) => {
    await page.goto('/login');
    await expect(page.getByRole('img', { name: 'Tokat Gaziosmanpaşa Üniversitesi' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tekrar hoş geldiniz' })).toBeVisible();
    await expect(page.getByLabel('E-posta')).toBeVisible();
    await expect(page.getByLabel('Şifre', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Giriş yap/ })).toBeDisabled(); // boşken kapalı
    await expect(page.getByRole('button', { name: 'Yönetici' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('yanlış şifre: hata mesajı, oturum açılmaz, form yerinde kalır', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-posta').fill(ACCOUNTS.admin.email);
    await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre');
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(page.getByRole('alert')).toContainText('E-posta veya şifre hatalı');
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('zimmet_token'))).toBeNull();
  });

  test('e-posta başındaki/sonundaki boşluk ve büyük harf sorun çıkarmaz', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-posta').fill('  ADMIN@GOP.EDU.TR  ');
    await page.getByLabel('Şifre', { exact: true }).fill(ACCOUNTS.admin.password);
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('şifre göster/gizle düğmesi çalışır', async ({ page }) => {
    await page.goto('/login');
    const pw = page.getByLabel('Şifre', { exact: true });
    await pw.fill('gizli123');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Şifreyi göster' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Şifreyi gizle' }).click();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('demo düğmesi alanları doldurur; yönetici girişi karşılama animasyonunu gösterir ve atlanabilir', async ({ page, errors }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Yönetici' }).click();
    await expect(page.getByLabel('E-posta')).toHaveValue(ACCOUNTS.admin.email);
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    const splash = page.getByRole('dialog', { name: 'Hoş geldiniz' });
    await expect(splash).toBeVisible();
    await expect(splash).toContainText('Hoş geldiniz, Sistem');
    await page.getByRole('button', { name: 'Atla' }).click();
    await expect(splash).toBeHidden();
    await expect(heading(page)).toContainText('Sistem');
    // Aynı oturumda yenileyince karşılama tekrar gösterilmez
    await page.reload();
    await expect(heading(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Hoş geldiniz' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('karşılama Escape ile de geçilir', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-posta').fill(ACCOUNTS.staff.email);
    await page.getByLabel('Şifre', { exact: true }).fill(ACCOUNTS.staff.password);
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(page.getByRole('dialog', { name: 'Hoş geldiniz' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Hoş geldiniz' })).toBeHidden();
  });

  test('oturum yenilemeden sonra da sürer; çıkış yapınca kapanır ve korumalı sayfalara erişilemez', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/devices');
    await page.reload();
    await expect(heading(page)).toHaveText('Envanter');
    await page.getByRole('button', { name: 'Hesap menüsü' }).click();
    await page.getByRole('menuitem', { name: 'Çıkış yap' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('zimmet_token'))).toBeNull();
    await page.goto('/devices');
    await expect(page).toHaveURL(/\/login/);
  });

  test('korumalı sayfaya girişsiz gidince girişe yönlenir, giriş sonrası o sayfaya döner', async ({ page }) => {
    await page.goto('/reports?type=LAPTOP');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('E-posta').fill(ACCOUNTS.admin.email);
    await page.getByLabel('Şifre', { exact: true }).fill(ACCOUNTS.admin.password);
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(page).toHaveURL(/\/reports\?type=LAPTOP/);
    await page.keyboard.press('Escape');
    await expect(heading(page)).toHaveText('Raporlar');
  });

  test('girişliyken /login adresi uygulamaya yönlendirir', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('geçersiz/süresi dolmuş token: uygulama girişe döner', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('zimmet_token', 'gecersiz.token.degeri'));
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('oturum açıkken sunucu 401 dönerse (örn. şifre değişti) girişe yönlenir', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/devices');
    await expect(heading(page)).toHaveText('Envanter');
    await page.evaluate(() => localStorage.setItem('zimmet_token', 'bozuldu'));
    await page.getByRole('tab', { name: /Arızalı/ }).click(); // yeni veri isteği → 401
    await expect(page).toHaveURL(/\/login/);
  });

  test('rol bazlı açılış: yönetici panel, personel Zimmetlerim', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/');
    await expect(heading(page)).toContainText('Sistem');
    await expect(page.getByText('Dikkat gerektirenler')).toBeVisible();
  });

  test('personel yönetici sayfalarına giremez (ana sayfaya yönlenir)', async ({ page, request }) => {
    await loginAs(page, request, 'staff');
    for (const path of ['/users', '/devices', '/assignments', '/reports', '/counts', '/etiketler?ids=x']) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/$/);
      await expect(heading(page)).toHaveText('Zimmetlerim');
    }
  });

  test('birim sorumlusu Sayım sayfasına giremez ama Raporlar/Envanter/Kullanıcılar sayfalarını görür', async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    await page.goto('/counts');
    await expect(page).toHaveURL(/\/$/);
    for (const [path, h] of [['/devices', 'Envanter'], ['/reports', 'Raporlar'], ['/users', 'Kullanıcılar'], ['/assignments', 'Zimmetler'], ['/faults', 'Arızalar']] as const) {
      await page.goto(path);
      await expect(heading(page), path).toHaveText(h);
    }
  });

  test('profil: şifre değiştirme akışı (zayıf şifre reddi, başarı, yeni şifreyle giriş)', async ({ page, request, browser }) => {
    // Bu test kendi kullanıcısını oluşturur (diğer testleri etkilememek için)
    const adminToken = await tokenFor(request, 'admin');
    const email = `sifre.${Date.now()}@gop.edu.tr`;
    const created = await request.post('http://127.0.0.1:3100/api/users', { headers: { authorization: `Bearer ${adminToken}` }, data: { name: 'Şifre Deneme', email, password: 'Eski12345', role: 'STAFF' } });
    expect(created.ok()).toBeTruthy();
    await page.goto('/login');
    await page.getByLabel('E-posta').fill(email);
    await page.getByLabel('Şifre', { exact: true }).fill('Eski12345');
    await page.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(page.getByRole('dialog', { name: 'Hoş geldiniz' })).toBeVisible(); // giriş tamamlanmadan sayfadan ayrılma
    await page.keyboard.press('Escape');
    await page.goto('/profile');
    await page.getByLabel('Mevcut şifre').fill('Eski12345');
    await page.getByLabel('Yeni şifre', { exact: true }).fill('kisa');
    await page.getByLabel('Yeni şifre (tekrar)').fill('kisa');
    await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
    await expect(page.getByText('en az 8 karakter')).toBeVisible();
    await page.getByLabel('Yeni şifre', { exact: true }).fill('Yeni12345');
    await page.getByLabel('Yeni şifre (tekrar)').fill('Uyusmayan1');
    await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
    await expect(page.getByText('Şifreler eşleşmiyor')).toBeVisible();
    await page.getByLabel('Yeni şifre (tekrar)').fill('Yeni12345');
    await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Şifreniz değiştirildi' })).toBeVisible();
    // Eski şifre artık çalışmaz, yenisi çalışır
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto('http://localhost:5174/login');
    await p2.getByLabel('E-posta').fill(email);
    await p2.getByLabel('Şifre', { exact: true }).fill('Eski12345');
    await p2.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(p2.getByRole('alert')).toContainText('hatalı');
    await p2.getByLabel('Şifre', { exact: true }).fill('Yeni12345');
    await p2.getByRole('button', { name: /Giriş yap/ }).click();
    await expect(p2.getByRole('dialog', { name: 'Hoş geldiniz' })).toBeVisible();
    await ctx.close();
  });

  test('tema: koyu/açık seçimi kalıcıdır ve sayfa yenilemede titremeden uygulanır', async ({ page, request }) => {
    await loginAs(page, request, 'admin');
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Koyu' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Açık' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
  });
});
