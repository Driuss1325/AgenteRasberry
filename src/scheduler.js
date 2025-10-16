import cron from 'node-cron';
import { sendOne } from './uploader.js';
import { logger } from './logger.js';

let job = null;
let expr = null;

export async function startScheduler(expression) {
  if (job) job.stop();
  expr = expression;
  job = cron.schedule(expression, async () => {
    try { await sendOne(); } catch (e) { logger.error('[Agent] Scheduler error', { message: e?.message }); }
  });
  logger.info('[Agent] Scheduler running', { expression });
}

export function getSchedule() { return { expression: expr, running: !!job }; }
