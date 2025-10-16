import { cfg } from '../config.js';
import { logger } from '../logger.js';
import { SHTC3 } from './shtc3.js';
import { PMS5003 } from './pms5003.js';

let sht = null;
let pms = null;

export async function initSensors() {
  try {
    sht = new SHTC3(cfg.i2cBus);
    await sht.init();
  } catch (e) {
    logger.error('[Sensors] SHTC3 init failed', { error: e?.message });
    sht = null;
  }
  try {
    pms = new PMS5003(cfg.pms.port, cfg.pms.baud);
    await pms.init();
  } catch (e) {
    logger.error('[Sensors] PMS5003 init failed', { error: e?.message });
    pms = null;
  }
}

export async function readSensors() {
  if (!sht) throw new Error('SHTC3 no inicializado');
  if (!pms) throw new Error('PMS5003 no inicializado');

  const [t, h] = await Promise.all([sht.readTemperature(), sht.readHumidity()]);
  const { pm25, pm10 } = pms.read();

  return {
    temperature: Number(t.toFixed(2)),
    humidity: Number(h.toFixed(2)),
    pm25: Number(pm25),
    pm10: Number(pm10)
  };
}
