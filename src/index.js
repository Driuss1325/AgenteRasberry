import { logger } from './logger.js';
import { cfg } from './config.js';
import { enroll, sendOne } from './uploader.js';
import { startScheduler, getSchedule } from './scheduler.js';
import { initSensors } from './sensors/sensors.js';
import { initGps } from './gps/gps.js';
import { autoProvision } from './provision.js';

async function bootstrapHw(){ await initSensors(); await initGps(); }

async function main(){
  const cmd = process.argv[2] || 'run';
  await bootstrapHw();

  if(cmd === 'provision'){ const res = await autoProvision(); logger.info('Provision terminado', res); return; }
  if(cmd === 'enroll'){ const key = await enroll(); logger.info('Enroll terminado', { apiKey: key }); return; }
  if(cmd === 'once'){ const r = await sendOne(); logger.info('Envio puntual terminado', r); return; }
  if(cmd === 'set-cron'){
    const expression = process.argv[3];
    if(!expression) throw new Error('Uso: npm run set-cron "*/5 * * * *"');
    await startScheduler(expression);
    logger.info('Nuevo CRON activo', getSchedule());
    return;
  }

  if(cfg.autoProvision){ await autoProvision(); }
  await startScheduler(cfg.cron);
  logger.info('Agent started', { cron: cfg.cron, backend: cfg.backendUrl });
}

main().catch((e)=>{ logger.error('Agent crashed', { error: e?.message }); process.exit(1); });
