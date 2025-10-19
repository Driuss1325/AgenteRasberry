// scripts/read-gps-raw.js (ESM, Node 20)
import { SerialPort } from 'serialport';
import { cfg } from '../src/config.js';

const candidatePorts = [
  process.env.PORT || cfg.sim7.port || '/dev/ttyUSB2',
  '/dev/ttyUSB3',
  '/dev/ttyUSB2',
  '/dev/ttyUSB1',
  '/dev/ttyUSB0'
].filter((v, i, a) => v && a.indexOf(v) === i); // únicos

const baud = Number(process.env.BAUD || cfg.sim7.baud || 115200);

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function tryPort(portPath) {
  console.log('\n[RAW] Trying', portPath, 'baud', baud);
  let rx = '';
  const port = new SerialPort({
    path: portPath,
    baudRate: baud,
    autoOpen: false,
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false
  });

  port.on('data', c => { rx += c.toString('utf8'); if (rx.length > 16384) rx = rx.slice(-8192); });
  port.on('error', e => console.error('[RAW] serial error:', e?.message));

  // abrir y esperar
  await new Promise((res, rej) => port.open(err => err ? rej(err) : res()));
  console.log('[RAW] Port open');

  // a veces ayuda alternar DTR/RTS (no imprescindible)
  try { await new Promise((res,rej)=>port.set({ dtr: true, rts: true }, err => err?rej(err):res())); } catch {}
  await delay(200);
  rx = ''; // limpia

  // Enviar comandos con \r y luego \r\n
  const write = s => new Promise((res,rej)=> port.write(s, err => err?rej(err):res()));
  // “despertar”
  await write('AT\r'); await delay(300);
  await write('AT\r\n'); await delay(400);
  await write('ATE0\r\n'); await delay(400);
  await write('AT+CGNSPWR?\r\n'); await delay(600);
  await write('AT+CGNSPWR=1\r\n'); await delay(900);
  await write('AT+CGNSINF\r\n'); await delay(1200);

  console.log('--- RAW BEGIN ---');
  console.log(rx || '(no data)');
  console.log('--- RAW END ---');

  // heurística: ¿vimos +CGNSINF u OK?
  const ok = /\+CGNSINF|OK/i.test(rx);
  try { port.close(); } catch {}

  return { ok, rx };
}

(async () => {
  for (const p of candidatePorts) {
    try {
      const { ok, rx } = await tryPort(p);
      if (ok) {
        console.log('[RAW] SUCCESS on', p);
        process.exit(0);
      }
    } catch (e) {
      console.error('[RAW] Failed on', p, e?.message || e);
    }
  }
  console.error('[RAW] No port responded. Check permissions / port in use / wiring.');
  process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
