import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://zimmet:zimmet_pass@localhost:5440/zimmet_test?schema=public',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      APP_URL: 'http://localhost:5173',
    },
  },
});
