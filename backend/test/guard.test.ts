import { afterEach, describe, expect, it } from 'vitest';
import { assertTestDatabase } from './helpers.js';

const original = process.env.DATABASE_URL;
afterEach(() => (process.env.DATABASE_URL = original));
const use = (url?: string) => (url === undefined ? delete process.env.DATABASE_URL : (process.env.DATABASE_URL = url));

describe('test veritabanı güvenlik kilidi', () => {
  it('test ve e2e veritabanlarına izin verir', () => {
    use('postgresql://u:p@localhost:5440/zimmet_test?schema=public');
    expect(() => assertTestDatabase()).not.toThrow();
    use('postgresql://u:p@localhost:5440/zimmet_e2e');
    expect(() => assertTestDatabase()).not.toThrow();
  });

  it('geliştirme/üretim veritabanında ve tanımsızken çalışmayı REDDEDER', () => {
    for (const url of ['postgresql://u:p@localhost:5440/zimmet?schema=public', 'postgresql://u:p@db:5432/zimmet', 'postgresql://u:p@x/production', 'postgresql://u:p@x/zimmet_test_backup', undefined, '']) {
      use(url);
      expect(() => assertTestDatabase(), String(url)).toThrow(/GÜVENLİK/);
    }
  });
});
