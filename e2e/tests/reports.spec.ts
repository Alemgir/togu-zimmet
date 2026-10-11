import fs from 'node:fs';
import { api, createDevice, expect, heading, loginAs, short, test, toast, tokenFor, uniq } from '../fixtures';

test.describe('raporlar (içgörü)', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('sağlık puanı ve oranlar sunucu değerleriyle aynı; tüm kartlar görünür', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const r = await a.get('/reports/summary');
    await page.goto('/reports');
    await expect(heading(page)).toHaveText('Raporlar');
    await expect(page.getByText('Envanter sağlık puanı')).toBeVisible();
    await expect(page.locator('main').getByText(String(r.health.score), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`%${r.health.utilization}`).first()).toBeVisible();
    for (const t of ['Cihaz türleri', 'Cihaz yaşı', 'Garanti takvimi', 'Durum karması', 'Birimlere göre zimmet', 'Hareket']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('group', { name: 'Cihaz türüne göre süz' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('tür kutusu çapraz filtre: puan ve cihaz yaşı o türe göre yeniden hesaplanır; adres çubuğunda kalır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mon = await a.get('/reports/summary?type=MONITOR');
    await page.goto('/reports');
    await page.getByRole('button', { name: /^Monitör: \d+ cihaz$/ }).click();
    await expect(page).toHaveURL(/type=MONITOR/);
    await expect(page.getByText('Filtre: Monitör')).toBeVisible();
    await expect(page.locator('main').getByText(String(mon.health.score), { exact: true }).first()).toBeVisible();
    // yaş dağılımındaki sütun değerleri toplamı = o türün cihaz sayısı
    const counts = (await page.locator('main em').allTextContents()).map(Number).filter((n) => !Number.isNaN(n));
    expect(counts.reduce((x, y) => x + y, 0)).toBe(mon.total);
    await page.reload();
    await expect(page.getByText('Filtre: Monitör')).toBeVisible();
    await page.getByRole('button', { name: 'Filtreyi kaldır' }).click();
    await expect(page).not.toHaveURL(/type=/);
  });

  test('özel cihaz türü raporlarda da süzülebilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const custom = 'RaporTuru' + short();
    await createDevice(a, { type: custom });
    await createDevice(a, { type: custom, purchaseDate: '2020-01-01', warrantyEnd: '2021-01-01' });
    await page.goto('/reports');
    await page.getByRole('button', { name: new RegExp(`^${custom}: 2 cihaz$`) }).click();
    await expect(page.getByText(`Filtre: ${custom}`)).toBeVisible();
    await expect(page.getByText('Tüm cihazlar')).toHaveCount(0);
    const r = await a.get(`/reports/summary?type=${encodeURIComponent(custom)}`);
    expect(r.total).toBe(2);
    expect(r.health.expiredWarrantyRate).toBe(50);
  });

  test('üç dışa aktarma düğmesi CSV indirir (envanter süzgeçli; zimmetler; arızalar)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const custom = 'CsvTuru' + short();
    await createDevice(a, { type: custom, brand: 'CsvMarka' });
    await page.goto(`/reports?type=${encodeURIComponent(custom)}`);
    const get = async (name: string) => {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name, exact: true }).click()]);
      return { name: dl.suggestedFilename(), text: fs.readFileSync((await dl.path())!, 'utf8') };
    };
    const inv = await get('Envanter');
    expect(inv.name).toMatch(/^envanter-/);
    expect(inv.text.split('\r\n').filter(Boolean)).toHaveLength(2); // başlık + süzgeçteki tek cihaz
    expect(inv.text).toContain(`;${custom};CsvMarka;`);
    const asg = await get('Zimmetler');
    expect(asg.name).toMatch(/^zimmetler-/);
    expect(asg.text.split('\r\n')[0]).toContain('Tutanak no;Demirbaş no;Cihaz;Personel');
    const flt = await get('Arızalar');
    expect(flt.name).toMatch(/^ariza-kayitlari-/);
    expect(flt.text.split('\r\n')[0]).toContain('Kayıt no;Demirbaş no');
    await expect(toast(page, 'Dışa aktarıldı').first()).toBeVisible();
  });

  test('CSV enjeksiyonu: formül karakteriyle başlayan değerler etkisizleştirilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const mark = 'Formul' + short();
    await createDevice(a, { brand: 'Formul' + mark.slice(-3), model: '=HYPERLINK("http://kotu.example","t")', type: 'LAPTOP', location: 'Test ' + uniq('').slice(-3) });
    await page.goto('/reports');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Envanter', exact: true }).click()]);
    const text = fs.readFileSync((await dl.path())!, 'utf8');
    expect(text).toContain(`'=HYPERLINK`);
    expect(text).not.toMatch(/;=HYPERLINK/);
  });

  test('birim sorumlusu raporlarda yalnızca kendi birimini görür; dışa aktarma kendi biriminle sınırlı', async ({ page, request }) => {
    await page.context().clearCookies();
    const p = await page.context().newPage();
    await loginAs(p, request, 'manager');
    const a = api(request, await tokenFor(request, 'manager'));
    const r = await a.get('/reports/summary');
    await p.goto('/reports');
    await expect(p.getByText('Bilgi İşlem birimi')).toBeVisible();
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Envanter', exact: true }).click()]);
    const lines = fs.readFileSync((await dl.path())!, 'utf8').split('\r\n').filter(Boolean);
    expect(lines.length - 1).toBe(r.total);
    // kapsam: biriminin zimmetli cihazları + biriminden bildirilen (artık zimmetsiz) arızalı cihazlar
    for (const l of lines.slice(1)) expect(l.includes('Bilgi İşlem') || l.includes(';Arızalı;')).toBe(true);
    await p.close();
  });
});
