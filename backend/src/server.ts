import { buildApp } from './app.js';
import { config } from './config.js';
import { startScheduler } from './services/notificationService.js';

const app = await buildApp();
try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  startScheduler({ error: (e) => app.log.error(e) });
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
