// src/gps/sim7000g.js
import { SerialPort } from 'serialport';
import { logger } from '../logger.js';

export class SIM7000G {
  constructor(path='/dev/ttyUSB2', baudRate=115200, profile='CGNS', autoPower=true){
    this.path=path; this.baudRate=baudRate; this.profile=profile.toUpperCase(); this.autoPower=autoPower;
    this.port=null; this.rx='';
  }

  async init(){
    this.port=new SerialPort({ path:this.path, baudRate:this.baudRate, autoOpen:true });
    this.port.on('data',(chunk)=>{
      this.rx += chunk.toString('utf8');
      if (this.rx.length > 8192) this.rx = this.rx.slice(-4096);
    });
    this.port.on('error',(e)=>logger.error('[SIM7000G] serial error',{error:e?.message}));

    // pequeña espera a que abra el puerto
    await this.#delay(300);
    await this.#flushRx();

    // saneo básico
    await this.#cmd('AT', 600);
    await this.#cmd('ATE0', 600); // eco off

    if (this.profile === 'CGNS') {
      // asegura GNSS encendido
      const pwr = await this.#cmd('AT+CGNSPWR?', 600);
      if (!/\+CGNSPWR:\s*1/.test(pwr)) {
        await this.#cmd('AT+CGNSPWR=1', 1200);
      }
      // secuencia recomendada (no siempre necesaria, pero ayuda)
      await this.#cmd('AT+CGNSSEQ="RMC"', 600);
    } else {
      await this.#cmd('AT+CGPSPWR=1', 1200);
    }

    logger.info('[SIM7000G] init OK',{port:this.path,baud:this.baudRate,profile:this.profile});
  }

  async getFix(){
    if (this.profile === 'CGNS') {
      // devuelve: +CGNSINF: <mode>,<status>,<date>,<lat>,<lon>,...
      const out = await this.#cmd('AT+CGNSINF', 900);
      // status = 1 => tiene fix
      const statusMatch = out.match(/\+CGNSINF:\s*\d,(\d)/);
      if (!statusMatch || Number(statusMatch[1]) !== 1) return null;

      // captura lat/lon viendo los dos floats que siguen tras 3er campo
      const ll = out.match(/\+CGNSINF:[^,]*,[^,]*,[^,]*,([\-0-9.]+),([\-0-9.]+)/);
      if (ll) {
        const lat = Number(ll[1]); const lng = Number(ll[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          // intenta extraer HDOP/accuracy si viene en la cadena (no estandarizado)
          let accuracy = 30;
          const hd = out.match(/\+CGNSINF:.*?,.*?,.*?,[\-0-9.]+,[\-0-9.]+,[^,]*,[^,]*,[^,]*,[^,]*,([\d.]+)/);
          if (hd && Number.isFinite(Number(hd[1]))) accuracy = Number(hd[1]) * 5;
          return { lat, lng, accuracy };
        }
      }
      return null;
    } else {
      // Modo viejo CGPSINFO (NMEA)
      const out = await this.#cmd('AT+CGPSINFO?', 900);
      const m = out.match(/\+CGPSINFO:\s*([\d.]+),([NS]),([\d.]+),([EW])/);
      if (!m) return null;
      const lat = this.#nmeaToDeg(m[1], m[2]);
      const lng = this.#nmeaToDeg(m[3], m[4]);
      return { lat, lng, accuracy: 30 };
    }
  }

  // ===== helpers =====
  async #cmd(cmd, waitMs=500){
    await this.#write(cmd + '\r\n');
    await this.#delay(waitMs);
    const out = this.rx;
    await this.#flushRx();
    return out;
  }
  async #write(s){
    await new Promise((res, rej) => this.port.write(s, err => err ? rej(err) : res()));
  }
  async #flushRx(){ this.rx=''; }
  async #delay(ms){ await new Promise(r=>setTimeout(r,ms)); }
  #nmeaToDeg(v, hemi){ const f=parseFloat(v); const deg=Math.floor(f/100); const min=f-deg*100; let dec=deg+min/60; if(hemi==='S'||hemi==='W') dec=-dec; return dec; }
}
