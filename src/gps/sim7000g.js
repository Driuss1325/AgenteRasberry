import { SerialPort } from 'serialport';
import { logger } from '../logger.js';

export class SIM7000G {
  constructor(path='/dev/ttyUSB2', baudRate=115200, profile='CGNS', autoPower=true){
    this.path=path; this.baudRate=baudRate; this.profile=profile; this.autoPower=autoPower;
    this.port=null; this.rx='';
  }
  async init(){
    this.port=new SerialPort({ path:this.path, baudRate:this.baudRate, autoOpen:true });
    this.port.on('data',(chunk)=>{ this.rx+=chunk.toString('utf8'); if(this.rx.length>4096) this.rx=this.rx.slice(-1024); });
    this.port.on('error',(e)=>logger.error('[SIM7000G] serial error',{error:e?.message}));
    await this.#delay(300); await this.#flushRx();
    await this.#cmd('AT',500); await this.#cmd('ATE0',500);
    if(this.autoPower){
      if(this.profile==='CGNS') await this.#cmd('AT+CGNSPWR=1',1000);
      else await this.#cmd('AT+CGPSPWR=1',1000);
    }
    logger.info('[SIM7000G] init OK',{port:this.path,baud:this.baudRate,profile:this.profile});
  }
  async #cmd(cmd,waitMs=500){ await this.#write(cmd+'\r'); await this.#delay(waitMs); const out=this.rx; await this.#flushRx(); return out; }
  async #write(s){ await new Promise((res,rej)=>{ this.port.write(s,(err)=>err?rej(err):res()); }); }
  async #flushRx(){ this.rx=''; } async #delay(ms){ await new Promise(r=>setTimeout(r,ms)); }
  async getFix(){
    if(this.profile==='CGNS'){
      const out=await this.#cmd('AT+CGNSINF',800);
      const m=out.match(/\+CGNSINF:\s*(\d),(\d),[^,]*,([\-0-9.]+),([\-0-9.]+)/);
      if(m){ const pwr=Number(m[1]); const fix=Number(m[2]);
        if(pwr===1 && fix===1){ const lat=Number(m[3]); const lng=Number(m[4]);
          const hdopMatch=out.match(/(?:^|\n)\+CGNSINF:.*?,([\-0-9.]+),([\-0-9.]+),([\-0-9.]+),([\-0-9.]+),([\-0-9.]+),/);
          const accuracy=Number.isFinite(Number(hdopMatch?.[5]))?Number(hdopMatch[5])*5:30;
          return { lat, lng, accuracy };
        }
      }
    }else{
      const out=await this.#cmd('AT+CGPSINFO?',800);
      const m=out.match(/\+CGPSINFO:\s*([\d.]+),([NS]),([\d.]+),([EW])/);
      if(m){ const latd=this.#nmeaToDeg(m[1],m[2]); const lngd=this.#nmeaToDeg(m[3],m[4]); return { lat:latd, lng:lngd, accuracy:30 }; }
    }
    return null;
  }
  #nmeaToDeg(v,hemi){ const f=parseFloat(v); const deg=Math.floor(f/100); const min=f-deg*100; let dec=deg+min/60; if(hemi==='S'||hemi==='W') dec=-dec; return dec; }
}
