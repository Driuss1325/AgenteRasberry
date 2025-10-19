import { cfg } from '../src/config.js';
import { SHTC3 } from '../src/sensors/shtc3.js';

async function main() {
  console.log('[SHTC3] Bus:', cfg.i2cBus);
  const sht = new SHTC3(cfg.i2cBus);
  try {
    await sht.init();
    const t = await sht.readTemperature();
    const h = await sht.readHumidity();
    console.log(JSON.stringify({
      ok: true,
      temperature: Number(t.toFixed(2)),
      humidity: Number(h.toFixed(2))
    }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('[SHTC3] ERROR:', e?.message || e);
    console.error('> Revisa: I2C habilitado en raspi-config, cableado SDA/SCL, grupo "i2c" para tu usuario.');
    process.exit(1);
  }
}

main();
