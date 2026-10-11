import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';

export const API = 'http://127.0.0.1:3100/api';

export const ACCOUNTS = {
  admin: { email: 'admin@gop.edu.tr', password: 'Admin123!', name: 'Sistem Yöneticisi' },
  staff: { email: 'ayse.yilmaz@gop.edu.tr', password: 'Demo1234', name: 'Ayşe Yılmaz' },
  manager: { email: 'mehmet.kaya@gop.edu.tr', password: 'Demo1234', name: 'Mehmet Kaya' }, // Bilgi İşlem birim sorumlusu
} as const;
export type Who = keyof typeof ACCOUNTS;

/** Doğrudan API ile giriş: arayüzü yavaşlatmadan oturum açmak için. */
export async function tokenFor(request: APIRequestContext, who: Who): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email: ACCOUNTS[who].email, password: ACCOUNTS[who].password } });
  expect(res.ok(), `${who} girişi`).toBeTruthy();
  return (await res.json()).token;
}

/** Oturumu (token) sayfa açılmadan enjekte eder; karşılama animasyonu tetiklenmez. */
export async function loginAs(page: Page, request: APIRequestContext, who: Who, theme: 'light' | 'dark' = 'light') {
  const token = await tokenFor(request, who);
  // Yalnızca sekmenin ilk yüklemesinde enjekte edilir: sonraki gezinmelerde (çıkış, yenileme) oturum/tema ezilmez
  await page.addInitScript(([t, th]) => {
    if (sessionStorage.getItem('__e2e_seeded')) return;
    sessionStorage.setItem('__e2e_seeded', '1');
    localStorage.setItem('zimmet_token', t as string);
    localStorage.setItem('theme', th as string);
  }, [token, theme]);
  return token;
}

/** Kısa, tipli API yardımcısı (test verisi hazırlamak ve sunucu durumunu doğrulamak için). */
export function api(request: APIRequestContext, token: string) {
  const h = { authorization: `Bearer ${token}` };
  const url = (p: string) => `${API}${p}`;
  return {
    get: async (p: string) => (await request.get(url(p), { headers: h })).json(),
    status: async (m: 'get' | 'post' | 'patch' | 'delete', p: string, data?: unknown) => (await request[m](url(p), { headers: h, data })).status(),
    post: async (p: string, data?: unknown) => (await request.post(url(p), { headers: h, data })).json(),
    patch: async (p: string, data?: unknown) => (await request.patch(url(p), { headers: h, data })).json(),
    del: async (p: string) => (await request.delete(url(p), { headers: h })).json(),
  };
}

import { execFileSync } from 'node:child_process';

/** Test veritabanında doğrudan SQL çalıştırır ("zaman yolculuğu": geçmişe çekilen iade tarihleri gibi, arayüz/API ile yapılamayan durumlar için). */
export function sql(query: string) {
  return execFileSync('docker', ['exec', 'zimmet-db', 'psql', '-U', 'zimmet', '-d', 'zimmet_e2e', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' });
}

let seq = 0;
export const uniq = (prefix = 'X') => `${prefix}${Date.now().toString(36).toUpperCase()}${(++seq).toString(36).toUpperCase()}`;

/** Kısa ama ayırt edici ek (zaman damgasının SON basamakları). */
export const short = () => uniq('').slice(-5);

export async function createDevice(a: ReturnType<typeof api>, over: Record<string, unknown> = {}) {
  const res = await a.post('/devices', { type: 'LAPTOP', brand: 'TestMarka', model: 'Model ' + uniq('M'), serialNumber: uniq('SN'), purchaseDate: '2025-03-15', warrantyEnd: '2028-03-15', ...over });
  expect(res.device, JSON.stringify(res)).toBeTruthy();
  return res.device as { id: string; assetTag: string; brand: string; model: string; qrToken: string; status: string };
}

export async function userByEmail(a: ReturnType<typeof api>, email: string) {
  const res = await a.get(`/users?search=${encodeURIComponent(email)}&pageSize=5`);
  return res.data.find((u: { email: string }) => u.email === email) as { id: string; name: string; department: string };
}

/** Konsol hatası ve beklenmeyen 5xx/ağ hatası yakalar: her testin sonunda sıfır olmalı. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource.*(401|403|404|409|400|429)/.test(t)) return; // beklenen API hata yanıtları
    errors.push(`CONSOLE ${t}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}

export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors = watchErrors(page);
    await use(errors);
    expect(errors, 'Tarayıcıda beklenmeyen hata').toEqual([]);
  },
});
export { expect };

export const heading = (page: Page) => page.locator('main h1').first();
export const sidebar = (page: Page) => page.locator('aside nav[aria-label="Ana menü"]');
export const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first();
