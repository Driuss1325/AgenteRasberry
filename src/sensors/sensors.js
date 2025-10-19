// src/sensors/sensors.js
import { cfg } from '../config.js';
import { logger } from '../logger.js';
import { SHTC3 } from './shtc3.js';
import { PMS5003 } from './pms5003.js';

let sht=null, pms=null;

export async function initSensors(){
  try { sht = new SHTC3(cfg.i2cBus); await sht.init(); }
  catch(e){ logger.error('[Sensors] SHTC3 init failed',{error:e?.message}); sht=null; }

  try { pms = new PMS5003(cfg.pms.port, cfg.pms.baud); await pms.init(); }
  catch(e){ logger.error('[Sensors] PMS5003 init failed',{error:e?.message}); pms=null; }
}

export async function readSensors(){
  const out = {};

  // SHTC3 (con lock/reintentos internos)
  if (sht) {
    try {
      const { temperature, humidity } = await sht.readPair();
      out.temperature = temperature;
      out.humidity    = humidity;
    } catch (e) {
      logger.warn('[Sensors] SHTC3 read error', { message: String(e?.message || e) });
    }
  }

  // PMS5003
  if (pms) {
    try {
      const { pm25, pm10 } = pms.read();
      out.pm25 = Number(pm25);
      out.pm10 = Number(pm10);
    } catch (e) {
      logger.warn('[Sensors] PMS5003 read error', { message: e?.message });
    }
  }

  if (Object.keys(out).length === 0) throw new Error('Ningún sensor disponible');
  return out;
}
