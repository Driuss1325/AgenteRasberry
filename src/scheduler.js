import cron from 'node-cron';
import { sendOne } from './uploader.js';
import { logger } from './logger.js';

let job=null, expr=null, running=false;

export async function startScheduler(expression){
  if(job) job.stop();
  expr=expression;
  job=cron.schedule(expression, async ()=>{
    if (running) {
      logger.warn('[Agent] Tick saltado: job anterior aún en curso');
      return;
    }
    running = true;
    try{
      await sendOne();
    }catch(e){
      logger.error('[Agent] Scheduler error', { message: e?.message });
    }finally{
      running = false;
    }
  });
  logger.info('[Agent] Scheduler running', { expression });
}

export function getSchedule(){ return { expression: expr, running: !!job }; }
