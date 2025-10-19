import i2c from 'i2c-bus';
import { logger } from '../logger.js';

const SHTC3_I2C_ADDRESS = 0x70;
const SHTC3_WakeUp       = 0x3517;
const SHTC3_Software_RES = 0x805d;
const SHTC3_NM_CD_ReadTH = 0x7866;
const SHTC3_NM_CD_ReadRH = 0x58e0;

export class SHTC3 {
  constructor(busNum = 1) {
    this.busNum = busNum;
    this.bus = null;
    this.opening = false;
  }

  async init() {
    if (this.bus) return;
    this.opening = true;
    try {
      this.bus = await i2c.openPromisified(this.busNum);
      await this.reset();
      logger.info('[SHTC3] init OK', { bus: this.busNum });
    } finally {
      this.opening = false;
    }
  }

  async close() {
    try { if (this.bus) await this.bus.close(); } catch {}
    this.bus = null;
  }

  async reset() {
    await this.#writeCommand(SHTC3_Software_RES);
    await this.#sleep(10);
  }
  async wakeUp() {
    await this.#writeCommand(SHTC3_WakeUp);
    await this.#sleep(10);
  }

  async readTemperature() {
    return await this.#retry(async () => {
      await this.wakeUp();
      await this.#writeCommand(SHTC3_NM_CD_ReadTH);
      await this.#sleep(20);
      const buf = Buffer.alloc(3);
      await this.bus.i2cRead(SHTC3_I2C_ADDRESS, 3, buf);
      if (!this.#checkCrc(buf, 2, buf[2])) throw new Error('SHTC3 CRC temp');
      return (((buf[0] << 8) | buf[1]) * 175) / 65536 - 45.0;
    });
  }

  async readHumidity() {
    return await this.#retry(async () => {
      await this.wakeUp();
      await this.#writeCommand(SHTC3_NM_CD_ReadRH);
      await this.#sleep(20);
      const buf = Buffer.alloc(3);
      await this.bus.i2cRead(SHTC3_I2C_ADDRESS, 3, buf);
      if (!this.#checkCrc(buf, 2, buf[2])) throw new Error('SHTC3 CRC rh');
      return (100 * ((buf[0] << 8) | buf[1])) / 65536;
    });
  }

  // ===== helpers =====
  async #writeCommand(cmd) {
    const b = Buffer.from([(cmd >> 8) & 0xff, cmd & 0xff]);
    await this.bus.i2cWrite(SHTC3_I2C_ADDRESS, b.length, b);
  }
  async #sleep(ms){ await new Promise(r=>setTimeout(r,ms)); }
  #checkCrc(data,len,checksum){
    let crc=0xff;
    for(let i=0;i<len;i++){ crc^=data[i]; for(let b=0;b<8;b++){ crc=(crc&0x80)?((crc<<1)^0x131):(crc<<1); crc&=0xff; } }
    return crc===checksum;
  }

  async #retry(fn, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        if (!this.bus) await this.init();
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || e);
        // si es EIO o bus roto, reabrimos
        if (/EIO|i\/o error|Remote I\/O error|ENXIO|Remote/.test(msg)) {
          await this.close();
          await this.#sleep(30);
          continue;
        }
        // si es CRC, reintenta una vez más con breve espera
        if (/CRC/.test(msg)) {
          await this.#sleep(10);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }
}
