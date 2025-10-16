import { logger } from './logger.js';
import { cfg } from './config.js';
import { enroll, sendOne } from './uploader.js';
import { startScheduler, getSchedule } from './scheduler.js';
import { initSensors } from './sensors/sensors.js';
import { initGps } from './gps/gps.js';

async function bootstrapHw() {
  await initSensors();
  await initGps();
}

async function main() {
  const cmd = process.argv[2] || 'run';

  await bootstrapHw();

  if (cmd === 'enroll') {
    const key = await enroll();
    logger.info('Enroll terminado', { apiKey: key });
    return;
  }

  if (cmd === 'once') {
    const res = await sendOne();
    logger.info('Envio puntual terminado', res);
    return;
  }

  if (cmd === 'set-cron') {
    const expression = process.argv[3];
    if (!expression) throw new Error('Uso: npm run set-cron "*/5 * * * *"');
    await startScheduler(expression);
    logger.info('Nuevo CRON activo', getSchedule());
    return;
  }

  await startScheduler(cfg.cron);
  logger.info('Agent started', { deviceId: cfg.deviceId, backend: cfg.backendUrl, cron: cfg.cron });
}

main().catch((e) => {
  logger.error('Agent crashed', { error: e?.message });
  process.exit(1);
});
