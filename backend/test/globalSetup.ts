import { execSync } from 'node:child_process';

export default function setup() {
  if (!/_(test|e2e)\b/.test(process.env.DATABASE_URL ?? 'zimmet_test')) throw new Error('GÜVENLİK: test veritabanı adı _test ile bitmeli');
  const url = 'postgresql://zimmet:zimmet_pass@localhost:5440/zimmet_test?schema=public';
  const admin = 'postgresql://zimmet:zimmet_pass@localhost:5440/postgres';
  try {
    execSync(`docker exec zimmet-db psql -U zimmet -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='zimmet_test'" | grep -q 1 || docker exec zimmet-db psql -U zimmet -d postgres -c "CREATE DATABASE zimmet_test"`, { stdio: 'pipe', shell: '/bin/sh' });
  } catch (e) {
    throw new Error('Test veritabanı oluşturulamadı. `docker compose up -d db` çalışıyor mu?\n' + e);
  }
  void admin;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
}
