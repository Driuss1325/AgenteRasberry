import { cfg } from '../config.js';
import { logger } from '../logger.js';
import { SIM7000G } from './sim7000g.js';

let sim=null;
let lastInit=0;
const REINIT_BACKOFF_MS = 3000;

export async function initGps(){
  try{
    if (!sim) sim = new SIM7000G(cfg.sim7.port, cfg.sim7.baud, cfg.sim7.gnssProfile, cfg.sim7.gnssPowerOn);
    await sim.init();
    lastInit = Date.now();
  }catch(e){
    logger.error('[GPS] SIM7000G init failed',{error:e?.message});
    sim=null;
  }
}

export async function getCurrentPosition(){
  if(!sim){
    const now=Date.now();
    if (now - lastInit > REINIT_BACKOFF_MS){
      await initGps();
    }
  }
  try{
    if (sim) {
      const fix = await sim.getFix();
      if (fix?.lat && fix?.lng) return fix;
    }
  }catch(e){
    const msg = String(e?.message || e);
    if (/EIO|i\/o error|write/i.test(msg)) {
      logger.warn('[GPS] EIO al leer, forzando reinit…');
      try { await sim?.close(); } catch {}
      sim = null;
      await initGps();
      try {
        const fix2 = await sim?.getFix();
        if (fix2?.lat && fix2?.lng) return fix2;
      } catch {}
    } else {
      logger.warn('[GPS] getFix error',{message: msg});
    }
  }
  return { lat: cfg.lat, lng: cfg.lng, accuracy: cfg.gpsAccuracy };
}
