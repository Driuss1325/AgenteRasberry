import { cfg } from '../src/config.js';
import { SIM7000G } from '../src/gps/sim7000g.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[SIM7000G] Port:', cfg.sim7.port, 'Baud:', cfg.sim7.baud, 'Profile:', cfg.sim7.gnssProfile);
  const sim = new SIM7000G(cfg.sim7.port, cfg.sim7.baud, cfg.sim7.gnssProfile, cfg.sim7.gnssPowerOn);
  try {
    await sim.init();

    // Intenta varios intentos por si recién encendió GNSS
    let fix = null;
    for (let i = 0; i < 10; i++) { // ~10 intentos
      try {
        fix = await sim.getFix();
        if (fix?.lat && fix?.lng) break;
      } catch (_) {}
      await sleep(1000);
    }

    if (!fix?.lat || !fix?.lng) {
      console.error('[SIM7000G] Sin fix GNSS por ahora. Mostrando fallback del .env (si definido).');
      console.log(JSON.stringify({
        ok: false,
        message: 'No GNSS fix yet',
        fallback: { lat: cfg.lat, lng: cfg.lng, accuracy: cfg.gpsAccuracy }
      }, null, 2));
      process.exit(2); // no fatal, pero sin fix
    }

    console.log(JSON.stringify({ ok: true, ...fix }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('[SIM7000G] ERROR:', e?.message || e);
    console.error('> Revisa: antena GNSS, puerto AT correcto (/dev/ttyUSB3 normalmente), grupo "dialout",');
    console.error('> vista al cielo o ventana, y espera inicial 30-120s para primer fix en frío.');
    process.exit(1);
  }
}

main();
