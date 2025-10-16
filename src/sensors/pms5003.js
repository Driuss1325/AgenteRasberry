import { SerialPort } from 'serialport';
import { logger } from '../logger.js';

export class PMS5003 {
  constructor(path = '/dev/serial0', baudRate = 9600) {
    this.path = path;
    this.baudRate = baudRate;
    this.port = null;
    this.buffer = Buffer.alloc(0);
  }
  async init() {
    this.port = new SerialPort({ path: this.path, baudRate: this.baudRate, dataBits: 8, parity: 'none', stopBits: 1, autoOpen: true });
    this.port.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (this.buffer.length > 256) this.buffer = this.buffer.slice(-96);
    });
    this.port.on('error', err => logger.error('[PMS5003] serial error', { err: err?.message }));
    await new Promise(r => setTimeout(r, 500));
    logger.info('[PMS5003] init OK', { port: this.path, baud: this.baudRate });
  }
  read() {
    const header = Buffer.from([0x42, 0x4d]); // 'BM'
    const idx = this.buffer.indexOf(header);
    if (idx !== -1 && this.buffer.length >= idx + 32) {
      const frame = this.buffer.slice(idx, idx + 32);
      const pm25 = frame.readUInt16BE(10);
      const pm10 = frame.readUInt16BE(12);
      return { pm25, pm10 };
    }
    throw new Error('PMS5003: frame no disponible todavía');
  }
}
