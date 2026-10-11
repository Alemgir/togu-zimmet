import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, loginAs, short, test, tokenFor, userByEmail } from '../fixtures';

/** Ciddi/kritik erişilebilirlik ihlali bulunmamalı (axe-core, WCAG 2.1 A/AA). */
async function audit(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = bad.map((v) => `${v.id} [${v.impact}] ${v.nodes.length}× — ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
  expect(bad, `${label}\n${summary.join('\n')}`).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`erişilebilirlik (${theme})`, () => {
    test(`giriş ekranı`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Tekrar hoş geldiniz' })).toBeVisible();
      await page.waitForTimeout(1500); // logo animasyonu bitsin
      await audit(page, `login ${theme}`);
    });

    test(`yönetici sayfaları`, async ({ page, request }) => {
      const a = api(request, await tokenFor(request, 'admin'));
      const dev = await createDevice(a, { brand: 'AxeMarka' + short() });
      const staff = await userByEmail(a, ACCOUNTS.staff.email);
      const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
      await loginAs(page, request, 'admin', theme);
      for (const path of ['/', '/devices', `/devices/${dev.id}`, '/assignments', '/faults', '/counts', '/reports', '/users', '/profile', `/tutanak/${asg.id}`]) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900); // giriş animasyonları
        await audit(page, `${path} ${theme}`);
      }
    });

    test(`açık pencere ve çekmeceler (cihaz formu + Combobox listesi, zimmet penceresi)`, async ({ page, request }) => {
      await loginAs(page, request, 'admin', theme);
      await page.goto('/devices');
      await page.getByRole('button', { name: 'Yeni cihaz' }).click();
      const dlg = page.getByRole('dialog', { name: 'Yeni cihaz ekle' });
      await expect(dlg).toBeVisible();
      await dlg.getByLabel('Marka').click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.waitForTimeout(500);
      await audit(page, `cihaz formu + liste ${theme}`);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Zimmetle', exact: true }).first().click().catch(() => undefined);
    });

    test(`personel ve birim sorumlusu sayfaları`, async ({ page, request }) => {
      await loginAs(page, request, 'staff', theme);
      for (const path of ['/', '/faults']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(700);
        await audit(page, `personel ${path} ${theme}`);
      }
    });
  });
}
