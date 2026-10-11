import { ACCOUNTS, expect, heading, loginAs, test } from '../fixtures';

const ADMIN_PAGES: [string, string, string][] = [
  ['Envanter', '/devices', 'Envanter'], ['Zimmetler', '/assignments', 'Zimmetler'], ['Arızalar', '/faults', 'Arızalar'], ['Sayım', '/counts', 'Envanter sayımı'],
  ['Raporlar', '/reports', 'Raporlar'], ['Kullanıcılar', '/users', 'Kullanıcılar'],
];

/** Menüde tıklanan sayfa, sayfa yenilemeden açılmalı. (Bildirilen sorun: tıklayınca açılmıyor, yenileyince açılıyor.) */
async function clickNav(page: import('@playwright/test').Page, label: string, path: string, h: string) {
  await page.locator('aside').getByRole('link', { name: label, exact: true }).click();
  await expect(page, `${label} → URL`).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
  await expect(heading(page), `${label} → başlık`).toHaveText(h, { timeout: 5000 });
}

test.describe('gezinme güvenilirliği', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('menüdeki her bağlantı sayfayı yenilemeden açar (tüm yönetici sayfaları)', async ({ page, errors }) => {
    await page.goto('/');
    for (const [label, path, h] of ADMIN_PAGES) await clickNav(page, label, path, h);
    await page.locator('aside').getByRole('link', { name: 'Panel', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test('art arda hızlı tıklama: 30 geçiş sonunda sayfa tutarlı kalır', async ({ page, errors }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      for (const [label, path, h] of ADMIN_PAGES) {
        await page.locator('aside').getByRole('link', { name: label, exact: true }).click();
        if (i === 4) await expect(heading(page)).toHaveText(h);
        void path;
      }
    }
    await expect(heading(page)).toHaveText('Kullanıcılar');
    await expect(page).toHaveURL(/\/users$/);
    expect(errors).toEqual([]);
  });

  test('tarayıcı geri/ileri düğmeleri doğru sayfayı gösterir', async ({ page }) => {
    await page.goto('/');
    await clickNav(page, 'Envanter', '/devices', 'Envanter');
    await clickNav(page, 'Raporlar', '/reports', 'Raporlar');
    await page.goBack();
    await expect(heading(page)).toHaveText('Envanter');
    await page.goBack();
    await expect(heading(page)).toContainText('Sistem');
    await page.goForward();
    await expect(heading(page)).toHaveText('Envanter');
  });

  test('her sayfaya doğrudan adresle girilip yenilenince açılır (derin bağlantı)', async ({ page, errors }) => {
    for (const [, path, h] of ADMIN_PAGES) {
      await page.goto(path);
      await expect(heading(page), path).toHaveText(h);
      await page.reload();
      await expect(heading(page), `${path} (yenileme)`).toHaveText(h);
    }
    expect(errors).toEqual([]);
  });

  test('animasyon kareleri hiç çalışmasa bile (arka plan sekmesi) gezinme kilitlenmez', async ({ page }) => {
    // requestAnimationFrame'i öldür: eski sürümde çıkış animasyonu beklendiği için sayfa hiç değişmeyebiliyordu
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('/');
    for (const [label, path, h] of ADMIN_PAGES) await clickNav(page, label, path, h);
  });

  test('yavaş işlemci (6×) ve yavaş ağda gezinme tamamlanır', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 200, downloadThroughput: 150_000, uploadThroughput: 75_000 });
    await page.goto('/');
    for (const [label, path, h] of ADMIN_PAGES.slice(0, 4)) {
      await page.locator('aside').getByRole('link', { name: label, exact: true }).click();
      await expect(heading(page), label).toHaveText(h, { timeout: 15_000 });
      void path;
    }
  });

  test('klavyeyle gezinme: Tab ile menüye gelip Enter ile açılır', async ({ page }) => {
    await page.goto('/');
    await page.locator('aside').getByRole('link', { name: 'Zimmetler', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('Zimmetler');
  });

  test('aktif menü öğesi geçerli sayfayı gösterir (aria-current)', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('aside').getByRole('link', { name: 'Raporlar', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('aside').getByRole('link', { name: 'Envanter', exact: true })).not.toHaveAttribute('aria-current', 'page');
  });

  test('bilinmeyen adres: "Sayfa bulunamadı" gösterir, menü çalışmaya devam eder', async ({ page }) => {
    await page.goto('/boyle-bir-sayfa-yok');
    await expect(page.getByText('Sayfa bulunamadı')).toBeVisible();
    await clickNav(page, 'Envanter', '/devices', 'Envanter');
  });

  test.describe('yeni sürüm yayınlanınca eski sekme (parça yükleme hatası)', () => {
    test('eski sekmenin parça adları artık yoksa (404) sayfa otomatik yenilenip açılır, elle yenileme gerekmez', async ({ page }) => {
      // Yeni sürüm yayınlanmış gibi: ilk belge yüklemesinde eski parça adları 404 döner; yenilemeden sonra (taze sürüm) sorun kalmaz
      let loads = 0;
      page.on('load', () => loads++);
      await page.route(/\/assets\/Reports-[^/]+\.js/, (route) => (loads < 2 ? route.fulfill({ status: 404, body: 'yok' }) : route.continue()));
      await page.goto('/');
      await expect(heading(page)).toContainText('Sistem');
      await page.locator('aside').getByRole('link', { name: 'Raporlar', exact: true }).click();
      await expect(heading(page)).toHaveText('Raporlar', { timeout: 15_000 });
      await expect(page).toHaveURL(/\/reports$/);
      expect(loads, 'sayfa kendiliğinden bir kez yenilenmeli').toBe(2);
    });

    test('parça kalıcı yoksa: hata ekranı çıkar, menü yine de çalışır (uygulama kilitlenmez)', async ({ page }) => {
      await page.route(/\/assets\/Faults-[^/]+\.js/, (route) => route.fulfill({ status: 404, body: 'yok' }));
      await page.goto('/');
      await expect(heading(page)).toContainText('Sistem');
      await page.evaluate(() => sessionStorage.setItem('zimmet_chunk_reload_at', String(Date.now()))); // yenileme koruması devrede
      await page.locator('aside').getByRole('link', { name: 'Arızalar', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Sayfa yüklenemedi', { timeout: 15_000 });
      await expect(page.getByRole('button', { name: /Sayfayı yenile/ })).toBeVisible();
      // Menü hâlâ çalışıyor: başka sayfaya geçilebilir
      await clickNav(page, 'Envanter', '/devices', 'Envanter');
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  });
});

test.describe('rol bazlı menüler', () => {
  const EXPECTED: Record<'admin' | 'manager' | 'staff', string[]> = {
    admin: ['Panel', 'Envanter', 'Zimmetler', 'Arızalar', 'Sayım', 'Raporlar', 'Kullanıcılar'],
    manager: ['Panel', 'Envanter', 'Zimmetler', 'Arızalar', 'Raporlar', 'Kullanıcılar'],
    staff: ['Zimmetlerim', 'Arızalarım'],
  };
  for (const who of ['admin', 'manager', 'staff'] as const) {
    test(`${who}: menü öğeleri ${EXPECTED[who].length} adet ve doğru sırada`, async ({ page, request }) => {
      await loginAs(page, request, who);
      await page.goto('/');
      await expect(page.locator('aside nav[aria-label="Ana menü"] a')).toHaveCount(EXPECTED[who].length);
      const names = (await page.locator('aside nav[aria-label="Ana menü"] a').allTextContents()).map((t) => t.trim());
      expect(names).toEqual(EXPECTED[who]);
      void ACCOUNTS;
    });
  }
});
