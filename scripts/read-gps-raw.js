// scripts/read-gps-raw.js  (ESM)
import { SerialPort } from 'serialport';
import { cfg } from '../src/config.js';

const portPath = process.env.PORT || cfg.sim7.port;
const baud = Number(process.env.BAUD || cfg.sim7.baud || 115200);

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async () => {
  console.log('[RAW] Opening', portPath, baud);
  const port = new SerialPort({ path: portPath, baudRate: baud, autoOpen: true });
  let rx = '';
  port.on('data', c => { rx += c.toString('utf8'); if (rx.length > 8192) rx = rx.slice(-4096); });

  await delay(300);
  const write = (s) => new Promise((res, rej)=> port.write(s, err=> err?rej(err):res()));

  await write('AT\r\n'); await delay(300);
  await write('ATE0\r\n'); await delay(300);
  await write('AT+CGNSPWR?\r\n'); await delay(600);
  await write('AT+CGNSPWR=1\r\n'); await delay(900);
  await write('AT+CGNSINF\r\n'); await delay(900);

  console.log('--- RAW BEGIN ---');
  console.log(rx);
  console.log('--- RAW END ---');

  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
