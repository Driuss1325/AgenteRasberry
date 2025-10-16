import { cfg } from '../config.js';
import { logger } from '../logger.js';
import { SIM7000G } from './sim7000g.js';

let sim = null;

export async function initGps() {
  try {
    sim = new SIM7000G(cfg.sim7.port, cfg.sim7.baud, cfg.sim7.gnssProfile, cfg.sim7.gnssPowerOn);
    await sim.init();
  } catch (e) {
    logger.error('[GPS] SIM7000G init failed', { error: e?.message });
    sim = null;
  }
}

export async function getCurrentPosition() {
  if (sim) {
    try {
      const fix = await sim.getFix();
      if (fix?.lat && fix?.lng) return fix;
    } catch {}
  }
  return { lat: cfg.lat, lng: cfg.lng, accuracy: cfg.gpsAccuracy };
}
