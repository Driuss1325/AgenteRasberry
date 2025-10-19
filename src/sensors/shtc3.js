// src/sensors/shtc3.js
import i2c from 'i2c-bus';
import { logger } from '../logger.js';

const SHTC3_ADDR        = 0x70;
const CMD_WAKE          = 0x3517;
const CMD_SOFT_RESET    = 0x805d;
const CMD_READ_T        = 0x7866; // Normal mode, clock stretching disabled
const CMD_READ_RH       = 0x58e0;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Mutex sencillo
class Mutex {
  constructor(){ this.p = Promise.resolve(); }
  async run(fn){
    const prev = this.p;
    let resolve;
    this.p = new Promise(r => resolve = r);
    await prev;
    try { return await fn(); }
    finally { resolve(); }
  }
}

export class SHTC3 {
  constructor(busNum = 1) {
    this.busNum = busNum;
    this.bus = null;
    this.lock = new Mutex();
    this.lastInit = 0;
    this.MIN_REINIT_MS = 4000; // evita reabrir agresivamente
  }

  async init(force=false) {
    const now = Date.now();
    if (!force && this.bus) return;
    if (!force && (now - this.lastInit) < this.MIN_REINIT_MS) return; // backoff

    this.lastInit = now;
    if (this.bus) {
      try { await this.bus.close(); } catch {}
      this.bus = null;
    }

    this.bus = await i2c.openPromisified(this.busNum);
    await this.#writeCmd(CMD_SOFT_RESET);
    await sleep(10);
    logger.info('[SHTC3] init OK', { bus: this.busNum });
  }

  async close(){
    try { if (this.bus) await this.bus.close(); } catch {}
    this.bus = null;
  }

  async readPair() {
    // Ejecuta todo bajo lock para evitar solapes
    return this.lock.run(async () => {
      // 1) Garantiza bus abierto (con backoff)
      await this.init();

      // 2) Un solo wake para ambas lecturas
      await this.#writeCmd(CMD_WAKE);
      await sleep(10);

      // 3) Temperatura
      const t = await this.#read3(CMD_READ_T);
      const temp = (((t[0] << 8) | t[1]) * 175) / 65536 - 45.0;

      // 4) RH (pequeña pausa adicional)
      await sleep(30);
      const h = await this.#read3(CMD_READ_RH);
      const rh = (100 * ((h[0] << 8) | h[1])) / 65536;

      return { temperature: Number(temp.toFixed(2)), humidity: Number(rh.toFixed(2)) };
    });
  }

  async #read3(cmd, attempt=0){
    try {
      await this.#writeCmd(cmd);
      await sleep(40); // darle tiempo extra al conversor
      const buf = Buffer.alloc(3);
      await this.bus.i2cRead(SHTC3_ADDR, 3, buf);
      if (!this.#crcOk(buf)) throw new Error('SHTC3 CRC');
      return buf;
    } catch (e) {
      const msg = String(e?.message || e);
      // Si es EIO/NACK/CRC, una reinit suave y reintenta una sola vez
      if (attempt < 1 && /(EIO|Remote I\/O|ENXIO|CRC)/i.test(msg)) {
        await this.init(true);
        return this.#read3(cmd, attempt+1);
      }
      throw e;
    }
  }

  async #writeCmd(cmd){
    if (!this.bus) throw new Error('i2c bus not open');
    const b = Buffer.from([(cmd >> 8) & 0xff, cmd & 0xff]);
    await this.bus.i2cWrite(SHTC3_ADDR, b.length, b);
  }

  #crcOk(b){
    // Sensirion CRC-8 0x31 seed 0xFF
    let crc = 0xff;
    for (let i=0;i<2;i++){
      crc ^= b[i];
      for (let bit=0;bit<8;bit++){
        crc = (crc & 0x80) ? ((crc<<1) ^ 0x31) : (crc<<1);
        crc &= 0xff;
      }
    }
    return crc === b[2];
  }
}
