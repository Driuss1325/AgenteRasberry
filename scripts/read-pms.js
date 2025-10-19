import { cfg } from '../src/config.js';
import { PMS5003 } from '../src/sensors/pms5003.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[PMS5003] Port:', cfg.pms.port, 'Baud:', cfg.pms.baud);
  const pms = new PMS5003(cfg.pms.port, cfg.pms.baud);
  try {
    await pms.init();

    // Dale tiempo a que llegue un frame completo
    let reading = null;
    const t0 = Date.now();
    while (!reading && (Date.now() - t0) < 5000) { // 5s
      try { reading = pms.read(); } catch (_) { /* aún no hay frame */ }
      if (!reading) await sleep(200);
    }

    if (!reading) {
      throw new Error('No se recibió frame válido del PMS5003 (revisa RX/TX/GND y si el fan está girando)');
    }

    console.log(JSON.stringify({ ok: true, pm25: reading.pm25, pm10: reading.pm10 }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('[PMS5003] ERROR:', e?.message || e);
    console.error('> Revisa: puerto correcto (/dev/serial0 o /dev/ttyUSB0), permisos (grupo "dialout"),');
    console.error('> que la consola por serial esté DESHABILITADA y enable_uart=1 en /boot/config.txt.');
    process.exit(1);
  }
}

main();
