import axios from 'axios';
import { cfg, assertBaseConfig } from './config.js';
import { logger } from './logger.js';
import { loadApiKey, saveApiKey, enqueue, flushQueue, loadDeviceInfo } from './state.js';
import { readSensors } from './sensors/sensors.js';
import { getCurrentPosition } from './gps/gps.js';

function endpoints(){
  assertBaseConfig();
  return {
    enrollUrl: `${cfg.backendUrl}/api/devices/enroll`,
    readingsUrl: `${cfg.backendUrl}/api/readings`
  };
}
async function resolveDeviceId(){
  if(cfg.deviceId) return cfg.deviceId;
  const { deviceId } = await loadDeviceInfo();
  if(deviceId) return Number(deviceId);
  throw new Error('DEVICE_ID no disponible (define en .env o usa AUTO_PROVISION=true)');
}
async function sendPayload(payload, apiKey){
  const { readingsUrl } = endpoints();
  const deviceId = await resolveDeviceId();
  const headers = { 'x-api-key': apiKey, 'x-device-id': deviceId };
  await axios.post(readingsUrl, payload, { headers, timeout: 8000 });
}
export async function enroll(){
  const { enrollUrl } = endpoints();
  const token = cfg.enrollToken;
  const deviceId = await resolveDeviceId();
  if(!token) throw new Error('ENROLL_TOKEN es requerido para enrolar');
  const { data } = await axios.post(enrollUrl, { deviceId }, { headers: { 'x-enroll-token': token }, timeout: 8000 });
  const apiKey = data?.apiKey; if(!apiKey) throw new Error('Backend no devolvió apiKey');
  await saveApiKey(apiKey); logger.info('[Agent] Enroll OK. API_KEY guardada en data/apikey.json'); return apiKey;
}
export async function sendOne(){
  const sensors = await readSensors();
  const pos = await getCurrentPosition();
  const payload = { temperature:sensors.temperature, humidity:sensors.humidity, pm25:sensors.pm25, pm10:sensors.pm10, lat:pos.lat, lng:pos.lng, accuracy:pos.accuracy };

  let apiKey = cfg.apiKeyEnv || (await loadApiKey());
  if(!apiKey && cfg.enrollToken){ logger.info('[Agent] Sin API_KEY, intentando enrolar…'); apiKey = await enroll(); }
  if(!apiKey) throw new Error('API_KEY no disponible (setea en .env o usa AUTO_PROVISION)');

  try{
    await sendPayload(payload, apiKey);
    logger.info('[Agent] Reading sent OK', { payload });
    const { flushed, remaining } = await flushQueue((p)=>sendPayload(p, apiKey));
    if(flushed) logger.info('[Agent] Cola offline vaciada', { flushed, remaining });
    return { ok:true };
  }catch(e){
    logger.warn('[Agent] Error enviando, guardando en cola offline', { message:e?.message });
    await enqueue(payload);
    return { ok:false, queued:true };
  }
}
