import type { Page } from '@playwright/test';
import { ACCOUNTS, api, createDevice, expect, heading, loginAs, short, test, toast, tokenFor, userByEmail } from '../fixtures';

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Yeni kullanıcı' });
const rowOf = (page: Page, text: string) => page.locator('main li').filter({ hasText: text });
const menuFor = (page: Page, name: string) => page.getByRole('button', { name: `${name} işlemleri` });
const mail = () => `kullanici.${Date.now()}${short().toLowerCase()}@gop.edu.tr`;

async function openNew(page: Page) {
  await page.goto('/users');
  await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
  await expect(drawer(page)).toBeVisible();
  return drawer(page);
}
async function loginApi(request: import('@playwright/test').APIRequestContext, email: string, password: string) {
  return (await request.post('http://127.0.0.1:3100/api/auth/login', { data: { email, password } })).status();
}

test.describe('kullanıcı yönetimi (yönetici)', () => {
  test.beforeEach(async ({ page, request }) => loginAs(page, request, 'admin'));

  test('liste: toplam sayı sunucuyla aynı; arama, rol ve durum süzgeçleri; birim süzgeci yazılabilir seçim', async ({ page, request, errors }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const total = (await a.get('/users?pageSize=1')).meta.total;
    await page.goto('/users');
    await expect(heading(page)).toHaveText('Kullanıcılar');
    await expect(page.getByText(new RegExp(`1–\\d+ / ${total} kayıt`))).toBeVisible();
    await page.getByLabel('Kullanıcı ara').fill('ayşe');
    await expect(rowOf(page, 'Ayşe Yılmaz')).toHaveCount(1);
    await page.getByLabel('Kullanıcı ara').fill('');
    await page.getByLabel('Rol').selectOption('UNIT_MANAGER');
    await expect(page.locator('main li').first()).toContainText('Birim sorumlusu');
    const mgrCount = (await a.get('/users?role=UNIT_MANAGER&pageSize=1')).meta.total;
    await expect(page.getByText(new RegExp(`1–\\d+ / ${mgrCount} kayıt`))).toBeVisible();
    await page.getByLabel('Rol').selectOption('');
    const dept = page.getByRole('combobox', { name: 'Birim' });
    await dept.fill('bilgi');
    await page.getByRole('option', { name: 'Bilgi İşlem' }).click();
    await expect(page).toHaveURL(/department=Bilgi/);
    await expect.poll(async () => (await page.locator('main li').allInnerTexts()).every((t) => t.includes('Bilgi İşlem'))).toBe(true);
    await dept.fill('YokBoyleBirim');
    await expect(page.getByRole('option', { name: /olarak ekle/ })).toHaveCount(0); // süzgeçte yeni değer eklenmez
    await dept.press('Escape');
    expect(errors).toEqual([]);
  });

  test('YENİ BİRİM VE UNVAN YAZARAK ekleme: "YENİ" gösterilir, kayıt olur; sonra aynı birim farklı yazımla yazılınca birleşir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const dept = 'Test Birimi ' + short();
    const title = 'Test Unvanı ' + short();
    const d = await openNew(page);
    const email = mail();
    await d.getByLabel('Ad soyad').fill('Yeni Birimli Kişi');
    await d.getByLabel('E-posta').fill(email);
    const dc = d.getByLabel('Birim / Departman');
    await dc.fill(dept);
    await expect(page.getByRole('option', { name: new RegExp(`“${dept}” olarak ekle`) })).toBeVisible();
    await dc.press('Enter');
    await expect(d.getByText('Yeni değer olarak kaydedilecek').first()).toBeVisible();
    await d.getByLabel('Unvan').fill(title);
    await d.getByLabel('Unvan').press('Enter');
    await d.getByLabel('Geçici şifre').fill('Sifre12345');
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(toast(page, 'Kullanıcı oluşturuldu')).toBeVisible();
    await expect(drawer(page)).toBeHidden();
    await expect.poll(async () => (await userByEmail(a, email))?.department).toBe(dept);
    expect((await a.get('/meta/departments')).departments).toContain(dept);
    expect((await a.get('/meta/titles')).titles).toContain(title);

    // İkinci kişi: aynı birim küçük harfle yazılır → mevcut yazıma birleşir (yeni birim doğmaz)
    const before = (await a.get('/meta/departments')).departments.length;
    await page.getByRole('button', { name: 'Yeni kullanıcı' }).click();
    const email2 = mail();
    await d.getByLabel('Ad soyad').fill('Aynı Birimli Kişi');
    await d.getByLabel('E-posta').fill(email2);
    await d.getByLabel('Birim / Departman').click();
    await expect(page.getByRole('option', { name: dept, exact: true })).toBeVisible(); // yeni birim seçenek listesine düştü
    await d.getByLabel('Birim / Departman').fill(dept.toLocaleUpperCase('tr-TR'));
    await d.getByLabel('Birim / Departman').press('Enter');
    await expect(d.getByLabel('Birim / Departman')).toHaveValue(dept); // seçenek mevcut yazıma çevrildi
    await d.getByLabel('Geçici şifre').fill('Sifre12345');
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(drawer(page)).toBeHidden(); // önceki toast hâlâ görünür olabilir; asıl ölçüt: çekmece kapandı
    await expect.poll(async () => (await userByEmail(a, email2))?.department).toBe(dept);
    expect((await a.get('/meta/departments')).departments).toHaveLength(before);
  });

  test('doğrulama: boş form hataları, zayıf şifre, geçersiz e-posta, çift e-posta (alan hatası)', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const d = await openNew(page);
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(d.getByText('Ad soyad en az 2 karakter olmalı')).toBeVisible();
    await expect(d.getByText('Geçerli bir e-posta girin')).toBeVisible();
    await expect(d.getByText('Şifre en az 8 karakter olmalı')).toBeVisible();
    await d.getByLabel('Ad soyad').fill('Test Kişisi');
    await d.getByLabel('E-posta').fill('bozuk-eposta');
    await d.getByLabel('Geçici şifre').fill('12345678'); // harf yok
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(d.getByText('Geçerli bir e-posta girin')).toBeVisible();
    await expect(d.getByText('Şifre en az bir harf içermeli')).toBeVisible();
    await d.getByLabel('Geçici şifre').fill('sadeceharf');
    await d.getByLabel('E-posta').fill(ACCOUNTS.staff.email);
    await d.getByLabel('Geçici şifre').fill('Sifre12345');
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(d.getByText('Bu e-posta ile kayıtlı bir kullanıcı var')).toBeVisible(); // alan hatası, pencere açık
    await expect(drawer(page)).toBeVisible();
    expect(await a.status('get', '/users')).toBe(200);
  });

  test('birim sorumlusu rolü seçilince birim zorunlu olur; bilgi notu gösterilir', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Ad soyad').fill('Sorumlu Adayı');
    await d.getByLabel('E-posta').fill(mail());
    await d.getByLabel('Rol').selectOption('UNIT_MANAGER');
    await expect(d.getByText(/yalnızca kendi biriminin/)).toBeVisible();
    await d.getByLabel('Geçici şifre').fill('Sifre12345');
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(d.getByText('Birim sorumlusu için birim zorunlu')).toBeVisible();
    await d.getByLabel('Birim / Departman').fill('Kütüphane');
    await d.getByLabel('Birim / Departman').press('Enter');
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(toast(page, 'Kullanıcı oluşturuldu')).toBeVisible();
  });

  test('geçersiz karakterli birim reddedilir', async ({ page }) => {
    const d = await openNew(page);
    await d.getByLabel('Birim / Departman').fill('<b>Hack</b>');
    await d.getByLabel('Birim / Departman').press('Enter');
    await expect(d.getByRole('alert').filter({ hasText: 'Birim yalnızca' })).toBeVisible();
  });

  test('rastgele şifre üretici güçlü şifre doldurur; oluşturulan kullanıcı bu şifreyle giriş yapar', async ({ page, request }) => {
    const d = await openNew(page);
    const email = mail();
    await d.getByLabel('Ad soyad').fill('Üretici Şifreli');
    await d.getByLabel('E-posta').fill(email);
    await d.getByRole('button', { name: 'Rastgele güçlü şifre üret' }).click();
    const pw = await d.getByLabel('Geçici şifre').inputValue();
    expect(pw).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{10,}$/);
    await d.getByRole('button', { name: 'Oluştur' }).click();
    await expect(toast(page, 'Kullanıcı oluşturuldu')).toBeVisible();
    expect(await loginApi(request, email, pw)).toBe(200);
  });

  test('düzenleme: ad ve birim değişir; e-posta çakışması alan hatası verir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = mail();
    const u = (await a.post('/users', { name: 'Düzenlenecek Kişi', email, password: 'Sifre12345', role: 'STAFF', department: 'Kütüphane' })).user;
    await page.goto('/users');
    await page.getByLabel('Kullanıcı ara').fill(email);
    await menuFor(page, 'Düzenlenecek Kişi').click();
    await page.getByRole('menuitem', { name: 'Düzenle' }).click();
    const dlg = page.getByRole('dialog', { name: 'Kullanıcıyı düzenle' });
    await dlg.getByLabel('Ad soyad').fill('Düzenlenmiş Kişi');
    await dlg.getByLabel('E-posta').fill(ACCOUNTS.staff.email);
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect(dlg.getByText('Bu e-posta ile kayıtlı bir kullanıcı var')).toBeVisible();
    await dlg.getByLabel('E-posta').fill(email);
    await dlg.getByLabel('Birim / Departman').fill('KÜTÜPHANE'); // mevcut yazıma birleşir
    await dlg.getByLabel('Birim / Departman').press('Enter');
    await dlg.getByRole('button', { name: 'Kaydet' }).click();
    await expect(toast(page, 'Kullanıcı güncellendi')).toBeVisible();
    const after = (await a.get(`/users/${u.id}`)).user;
    expect(after).toMatchObject({ name: 'Düzenlenmiş Kişi', department: 'Kütüphane' });
  });

  test('şifre sıfırlama: yeni şifre çalışır, eski çalışmaz, açık oturum kapanır', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = mail();
    await a.post('/users', { name: 'Şifresi Sıfırlanacak', email, password: 'Eski12345', role: 'STAFF' });
    const oldToken = (await (await request.post('http://127.0.0.1:3100/api/auth/login', { data: { email, password: 'Eski12345' } })).json()).token;
    await page.goto('/users');
    await page.getByLabel('Kullanıcı ara').fill(email);
    await menuFor(page, 'Şifresi Sıfırlanacak').click();
    await page.getByRole('menuitem', { name: 'Şifre sıfırla' }).click();
    const dlg = page.getByRole('dialog', { name: 'Şifreyi sıfırla' });
    await dlg.getByLabel('Yeni şifre').fill('kisa');
    await dlg.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(dlg.getByText('Şifre en az 8 karakter olmalı')).toBeVisible();
    await dlg.getByLabel('Yeni şifre').fill('Yeni12345');
    await dlg.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(toast(page, 'Şifre sıfırlandı')).toBeVisible();
    expect(await loginApi(request, email, 'Eski12345')).toBe(401);
    expect(await loginApi(request, email, 'Yeni12345')).toBe(200);
    expect((await request.get('http://127.0.0.1:3100/api/auth/me', { headers: { authorization: `Bearer ${oldToken}` } })).status()).toBe(401);
  });

  test('pasife alma: cihazları otomatik depoya döner uyarısı; giriş engellenir; yeniden aktifleştirilebilir', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = mail();
    const u = (await a.post('/users', { name: 'Pasife Alınacak', email, password: 'Sifre12345', role: 'STAFF' })).user;
    const [d1, d2] = [await createDevice(a, { brand: 'PasifCihaz' + short() }), await createDevice(a, { brand: 'PasifCihaz' + short() })];
    await a.post('/assignments', { deviceId: d1.id, userId: u.id });
    await a.post('/assignments', { deviceId: d2.id, userId: u.id });
    await page.goto('/users');
    await page.getByLabel('Kullanıcı ara').fill(email);
    await expect(rowOf(page, 'Pasife Alınacak')).toContainText('2 cihaz');
    await menuFor(page, 'Pasife Alınacak').click();
    await page.getByRole('menuitem', { name: 'Pasife al' }).click();
    const dlg = page.getByRole('dialog', { name: 'Kullanıcıyı pasife al' });
    await expect(dlg).toContainText('2 cihaz otomatik olarak zimmetten düşülüp depoya dönecek');
    await dlg.getByRole('button', { name: 'Pasife al' }).click();
    await expect(toast(page, 'Kullanıcı pasife alındı')).toBeVisible();
    await expect(rowOf(page, 'Pasife Alınacak')).toContainText('Pasif');
    for (const d of [d1, d2]) expect((await a.get(`/devices/${d.id}`)).device).toMatchObject({ status: 'IN_STOCK', holder: null });
    expect(await loginApi(request, email, 'Sifre12345')).toBe(401);
    await menuFor(page, 'Pasife Alınacak').click();
    await page.getByRole('menuitem', { name: 'Aktifleştir' }).click();
    await expect(toast(page, 'Kullanıcı aktifleştirildi')).toBeVisible();
    expect(await loginApi(request, email, 'Sifre12345')).toBe(200);
    void u;
  });

  test('silme: geçmişi olmayan silinir; geçmişi olan pasife alınır (denetim izi korunur); kendi satırında silme/pasife alma yok', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const e1 = mail();
    const e2 = mail();
    await a.post('/users', { name: 'Silinecek Temiz', email: e1, password: 'Sifre12345', role: 'STAFF' });
    const used = (await a.post('/users', { name: 'Silinecek Geçmişli', email: e2, password: 'Sifre12345', role: 'STAFF' })).user;
    const dev = await createDevice(a);
    await a.post('/assignments', { deviceId: dev.id, userId: used.id });
    await page.goto('/users');
    await page.getByLabel('Kullanıcı ara').fill(e1);
    await menuFor(page, 'Silinecek Temiz').click();
    await page.getByRole('menuitem', { name: 'Sil' }).click();
    await page.getByRole('dialog', { name: 'Kullanıcıyı sil' }).getByRole('button', { name: 'Evet, sil' }).click();
    await expect(toast(page, 'Kullanıcı silindi')).toBeVisible();
    await expect(rowOf(page, 'Silinecek Temiz')).toHaveCount(0);
    await page.getByLabel('Kullanıcı ara').fill(e2);
    await menuFor(page, 'Silinecek Geçmişli').click();
    await page.getByRole('menuitem', { name: 'Sil' }).click();
    const dlg = page.getByRole('dialog', { name: 'Kullanıcıyı sil' });
    await expect(dlg).toContainText('1 cihaz otomatik olarak zimmetten düşülüp depoya dönecek');
    await dlg.getByRole('button', { name: 'Evet, sil' }).click();
    const t = toast(page, 'Kullanıcı pasife alındı');
    await expect(t).toBeVisible();
    await expect(t).toContainText('Zimmet geçmişi korunduğu için kayıt silinmedi');
    await expect(rowOf(page, 'Silinecek Geçmişli')).toContainText('Pasif');
    // Kendi satırı
    await page.getByLabel('Kullanıcı ara').fill(ACCOUNTS.admin.email);
    await menuFor(page, 'Sistem Yöneticisi').click();
    await expect(page.getByRole('menuitem', { name: 'Sil' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Pasife al' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Düzenle' })).toBeVisible();
  });

  test('kullanıcı çekmecesi: zimmetli cihazlar, geçmiş, föy bağlantısı ve cihaz zimmetleme', async ({ page, request }) => {
    const a = api(request, await tokenFor(request, 'admin'));
    const email = mail();
    const u = (await a.post('/users', { name: 'Çekmece Kişisi', email, password: 'Sifre12345', role: 'STAFF', department: 'Kütüphane' })).user;
    const dev = await createDevice(a, { brand: 'CekmeceCihaz' + short() });
    await a.post('/assignments', { deviceId: dev.id, userId: u.id });
    await page.goto('/users');
    await page.getByLabel('Kullanıcı ara').fill(email);
    await rowOf(page, 'Çekmece Kişisi').click();
    const dlg = page.getByRole('dialog', { name: 'Çekmece Kişisi' });
    await expect(dlg).toContainText('Üzerindeki cihazlar');
    await expect(dlg).toContainText(dev.assetTag);
    await expect(dlg.getByRole('link', { name: /Zimmet föyü/ })).toBeVisible();
    await dlg.getByRole('button', { name: 'Cihaz zimmetle' }).click();
    const assign = page.getByRole('dialog', { name: 'Zimmet ver' });
    await expect(assign).toContainText('Çekmece Kişisi'); // kişi önceden seçili
    await assign.getByPlaceholder(/Depodaki cihazlarda ara/).fill('TOGU');
    await expect(assign.getByRole('button').filter({ hasText: /TOGU-/ }).first()).toBeVisible();
  });
});

test.describe('kullanıcı yönetimi: birim sorumlusu (salt okunur)', () => {
  test('yalnızca kendi birimini listeler; ekleme/düzenleme/menü yok; föy bağlantısı var', async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    const a = api(request, await tokenFor(request, 'manager'));
    const mine = await a.get('/users?pageSize=100');
    await page.goto('/users');
    await expect(heading(page)).toHaveText('Kullanıcılar');
    await expect(page.getByRole('button', { name: 'Yeni kullanıcı' })).toHaveCount(0);
    await expect(page.getByText(new RegExp(`1–\\d+ / ${mine.meta.total} kayıt`))).toBeVisible();
    for (const li of await page.locator('main li').all()) await expect(li).toContainText('Bilgi İşlem');
    await expect(page.getByRole('button', { name: /işlemleri/ })).toHaveCount(0);
    await page.locator('main li').first().click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('link', { name: /Zimmet föyü/ })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Cihaz zimmetle' })).toHaveCount(0);
  });
});
