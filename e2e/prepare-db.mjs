// Her çalıştırmada taze bir test veritabanı (zimmet_e2e) kurar. Backend'den ÖNCE çalışır
// (backend bağlandıktan sonra veritabanı silinirse bağlantı havuzu bozulur).
import { execSync } from 'node:child_process';

const url = 'postgresql://zimmet:zimmet_pass@localhost:5440/zimmet_e2e?schema=public';
const env = { ...process.env, DATABASE_URL: url, JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-12345', NODE_ENV: 'test', ADMIN_EMAIL: 'admin@gop.edu.tr', ADMIN_PASSWORD: 'Admin123!' };
const sh = (cmd, e = process.env) => execSync(cmd, { stdio: 'pipe', env: e, shell: '/bin/sh' });

try {
  sh(`docker exec zimmet-db psql -U zimmet -d postgres -c "DROP DATABASE IF EXISTS zimmet_e2e WITH (FORCE)" -c "CREATE DATABASE zimmet_e2e"`);
} catch (e) {
  console.error('E2E veritabanı oluşturulamadı. "docker compose up -d db" çalışıyor mu?\n' + e);
  process.exit(1);
}
sh('npx prisma migrate deploy', env);
sh('npx tsx prisma/seed.ts --demo', env);
console.log('✔ zimmet_e2e hazır (şema + demo veri)');
