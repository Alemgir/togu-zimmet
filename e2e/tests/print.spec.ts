import { ACCOUNTS, api, createDevice, expect, loginAs, short, test, tokenFor, userByEmail } from '../fixtures';

const MM = 96 / 25.4;
const pdfPages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

test.describe('yazdırma ve PDF (A4)', () => {
  test('zimmet tutanağı: yazdırma görünümünde yalnızca belge görünür; PDF tek sayfa A4 üretilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'PdfMarka' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id, note: 'PDF testi' })).assignment;
    await loginAs(page, request, 'admin');
    await page.goto(`/tutanak/${asg.id}`);
    await expect(page.locator('.print-doc')).toContainText('ZİMMET TESLİM TUTANAĞI');
    await page.emulateMedia({ media: 'print' });
    // Menü, üst çubuk ve araç çubuğu yazdırmada görünmez; belge görünür
    await expect(page.locator('aside')).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('header').first()).toHaveCSS('visibility', 'hidden');
    await expect(page.getByRole('button', { name: /Yazdır \/ PDF kaydet/ })).toBeHidden();
    await expect(page.locator('.print-doc')).toHaveCSS('visibility', 'visible');
    await expect(page.locator('.print-doc').getByText('ZİMMET TESLİM TUTANAĞI')).toBeVisible();
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(pdfPages(pdf)).toBe(1);
  });

  test('iade tutanağı ve personel föyü de yazdırma görünümünde belge içerir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'PdfIade' + short() });
    const staff = await userByEmail(a, ACCOUNTS.staff.email);
    const asg = (await a.post('/assignments', { deviceId: dev.id, userId: staff.id })).assignment;
    await a.post(`/devices/${dev.id}/return`, { note: 'PDF iade' });
    await loginAs(page, request, 'admin');
    await page.goto(`/tutanak/${asg.id}`);
    await page.getByRole('button', { name: 'İade tutanağı' }).click();
    await page.emulateMedia({ media: 'print' });
    expect(pdfPages(await page.pdf({ format: 'A4' }))).toBe(1);
    await page.emulateMedia({ media: 'screen' });
    await page.goto(`/foy/${staff.id}`);
    await expect(page.locator('.print-doc')).toContainText('PERSONEL ZİMMET FÖYÜ');
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('QR etiket sayfası: etiket ölçüleri milimetrik; sayfa A4 kenar boşlukları içine sığar; 24 etiket tek sayfa', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const devs = [];
    for (let i = 0; i < 6; i++) devs.push(await createDevice(a, { brand: 'EtiketPdf' + short() }));
    await loginAs(page, request, 'admin');
    await page.goto(`/etiketler?ids=${devs.map((d) => d.id).join(',')}`);
    const sheet = page.locator('.label-sheet');
    await expect(sheet.locator('img')).toHaveCount(6);
    const label = sheet.locator('> div').first();
    const w = (await label.boundingBox())!.width;
    expect(Math.abs(w - 60 * MM)).toBeLessThan(2); // 60 mm
    const span = async () => {
      const boxes = await sheet.locator('> div').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      return Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left));
    };
    expect(await span()).toBeLessThanOrEqual(186 * MM + 1); // A4 − 2×12 mm kenar boşluğu
    await page.getByRole('button', { name: /Orta · 2×6/ }).click();
    expect(Math.abs((await sheet.locator('> div').first().boundingBox())!.width - 90 * MM)).toBeLessThan(2);
    expect(await span()).toBeLessThanOrEqual(186 * MM + 1);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('aside')).toHaveCSS('visibility', 'hidden');
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdfPages(pdf)).toBe(1);
  });

  test('24 etiket (3×8) bir A4 sayfaya sığar', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const list = (await a.get('/devices?pageSize=100')).data as { id: string }[];
    const ids = list.slice(0, 24).map((d) => d.id);
    expect(ids.length).toBe(24);
    await loginAs(page, request, 'admin');
    await page.goto(`/etiketler?ids=${ids.join(',')}`);
    await expect(page.locator('.label-sheet img')).toHaveCount(24);
    await page.emulateMedia({ media: 'print' });
    expect(pdfPages(await page.pdf({ format: 'A4', printBackground: true }))).toBe(1);
  });

  test('cihaz sayfasındaki QR etiketi: yazdırmada yalnızca etiket görünür', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dev = await createDevice(a, { brand: 'TekEtiket' + short() });
    await loginAs(page, request, 'admin');
    await page.goto(`/devices/${dev.id}`);
    await expect(page.getByRole('img', { name: `${dev.assetTag} QR kodu` })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-area')).toHaveCSS('visibility', 'visible');
    await expect(page.locator('.print-area').getByText(dev.assetTag)).toBeVisible();
    await expect(page.locator('.print-area').getByText('TOKAT GAZİOSMANPAŞA ÜNİVERSİTESİ')).toBeVisible();
    await expect(page.locator('aside')).toHaveCSS('visibility', 'hidden');
    expect(pdfPages(await page.pdf({ format: 'A4' }))).toBe(1);
  });
});
