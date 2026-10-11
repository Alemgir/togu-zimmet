import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3100;
const WEB_PORT = 5174;
const DB = 'postgresql://zimmet:zimmet_pass@localhost:5440/zimmet_e2e?schema=public';

/**
 * Uçtan uca testler gerçek tarayıcıda (Chrome) çalışır; ayrı bir veritabanı (zimmet_e2e) ve portlar kullanır,
 * geliştirme verisine dokunmaz. Gereksinim: `docker compose up -d db`.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'masaüstü', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } } },
    { name: 'mobil', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: [
    {
      command: 'node ../e2e/prepare-db.mjs && npx tsx src/server.ts',
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test', // günlük kapalı, giriş hız sınırı gevşek
        PORT: String(API_PORT),
        DATABASE_URL: DB,
        JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-12345',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        APP_URL: `http://localhost:${WEB_PORT}`,
        ADMIN_EMAIL: 'admin@gop.edu.tr',
        ADMIN_PASSWORD: 'Admin123!',
      },
    },
    {
      command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      cwd: '../frontend',
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_PROXY: `http://127.0.0.1:${API_PORT}`, VITE_DEMO_LOGIN: 'true' },
    },
  ],
});
