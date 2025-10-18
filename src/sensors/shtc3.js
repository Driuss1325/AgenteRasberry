import i2c from 'i2c-bus';
import { logger } from '../logger.js';

const SHTC3_I2C_ADDRESS = 0x70;
const SHTC3_WakeUp = 0x3517;
const SHTC3_Software_RES = 0x805d;
const SHTC3_NM_CD_ReadTH = 0x7866;
const SHTC3_NM_CD_ReadRH = 0x58e0;

export class SHTC3 {
  constructor(busNum = 1) { this.busNum = busNum; this.bus = null; }
  async init() {
    this.bus = await i2c.openPromisified(this.busNum);
    await this.reset();
    logger.info('[SHTC3] init OK', { bus: this.busNum });
  }
  async reset() { await this.#writeCommand(SHTC3_Software_RES); await this.#sleep(10); }
  async #writeCommand(cmd) {
    const buf = Buffer.from([(cmd >> 8) & 0xff, cmd & 0xff]);
    await this.bus.i2cWrite(SHTC3_I2C_ADDRESS, buf.length, buf);
  }
  async #sleep(ms){ await new Promise(r=>setTimeout(r,ms)); }
  #checkCrc(data,len,checksum){
    let crc=0xff;
    for(let i=0;i<len;i++){ crc^=data[i]; for(let b=0;b<8;b++){ crc=(crc&0x80)?((crc<<1)^0x131):(crc<<1); crc&=0xff; } }
    return crc===checksum;
  }
  async readTemperature(){
    await this.#writeCommand(SHTC3_WakeUp);
    await this.#writeCommand(SHTC3_NM_CD_ReadTH);
    await this.#sleep(20);
    const buf=Buffer.alloc(3);
    await this.bus.i2cRead(SHTC3_I2C_ADDRESS,3,buf);
    if(!this.#checkCrc(buf,2,buf[2])) throw new Error('SHTC3 CRC temp');
    return (((buf[0]<<8)|buf[1])*175)/65536-45.0;
  }
  async readHumidity(){
    await this.#writeCommand(SHTC3_WakeUp);
    await this.#writeCommand(SHTC3_NM_CD_ReadRH);
    await this.#sleep(20);
    const buf=Buffer.alloc(3);
    await this.bus.i2cRead(SHTC3_I2C_ADDRESS,3,buf);
    if(!this.#checkCrc(buf,2,buf[2])) throw new Error('SHTC3 CRC rh');
    return (100*((buf[0]<<8)|buf[1]))/65536;
  }
}
