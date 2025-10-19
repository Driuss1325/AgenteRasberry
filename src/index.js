import { logger } from './logger.js';
import { cfg } from './config.js';
import { enroll, sendOne } from './uploader.js';
import { startScheduler, getSchedule } from './scheduler.js';
import { initSensors } from './sensors/sensors.js';
import { initGps } from './gps/gps.js';
import { autoProvision } from './provision.js';

async function bootstrapHw() {
  await initSensors();
  await initGps();
}

async function main() {
  const cmd = process.argv[2] || 'run';

  // Comandos "de una sola vez" (NO abrir hardware)
  if (cmd === 'provision') {
    try {
      const res = await autoProvision();
      logger.info('Provision terminado', res);
      process.exit(0);
    } catch (e) {
      logger.error('Provision failed', { error: e?.message });
      process.exit(1);
    }
    return; // por claridad
  }

  if (cmd === 'enroll') {
    try {
      const key = await enroll();
      logger.info('Enroll terminado', { apiKey: key });
      process.exit(0);
    } catch (e) {
      logger.error('Enroll failed', { error: e?.message });
      process.exit(1);
    }
    return;
  }

  if (cmd === 'once') {
    try {
      // Necesitamos HW solo aquí
      await bootstrapHw();
      const r = await sendOne();
      logger.info('Envio puntual terminado', r);
      process.exit(0);
    } catch (e) {
      logger.error('Once failed', { error: e?.message });
      process.exit(1);
    }
    return;
  }

  if (cmd === 'set-cron') {
    const expression = process.argv[3];
    if (!expression) throw new Error('Uso: npm run set-cron "*/5 * * * *"');
    await startScheduler(expression);
    logger.info('Nuevo CRON activo', getSchedule());
    process.exit(0);
    return;
  }

  // Modo daemon ("run"): aquí sí abrimos HW y nos quedamos vivos
  await bootstrapHw();
  if (cfg.autoProvision) {
    try { await autoProvision(); } catch (e) { logger.error('AutoProvision failed', { error: e?.message }); }
  }
  await startScheduler(cfg.cron);
  logger.info('Agent started', { cron: cfg.cron, backend: cfg.backendUrl });
}

main().catch((e) => {
  logger.error('Agent crashed', { error: e?.message });
  process.exit(1);
});
