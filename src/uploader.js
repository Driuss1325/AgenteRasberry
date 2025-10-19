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
  let sensors = {};
  let pos = {};

  // 1) Lectura sensores con tolerancia
  try {
    sensors = await readSensors(); // { temperature, humidity, pm25, pm10 }
  } catch (e) {
    const msg = String(e?.message || e);
    logger.warn('[Agent] readSensors falló, continúo con datos parciales', { message: msg });
    sensors = {}; // seguimos con GPS si está disponible
  }

  // 2) Posición con tolerancia
  try {
    pos = await getCurrentPosition(); // ya hace reinit/retry y fallback interno
  } catch (e) {
    const msg = String(e?.message || e);
    logger.warn('[Agent] getCurrentPosition falló, uso fallback', { message: msg });
    pos = { lat: cfg.lat, lng: cfg.lng, accuracy: cfg.gpsAccuracy };
  }

  // 3) Armar payload solo con campos definidos (evita NaN/undefined)
  const payload = {};
  if (Number.isFinite(sensors.temperature)) payload.temperature = sensors.temperature;
  if (Number.isFinite(sensors.humidity))    payload.humidity    = sensors.humidity;
  if (Number.isFinite(sensors.pm25))        payload.pm25        = sensors.pm25;
  if (Number.isFinite(sensors.pm10))        payload.pm10        = sensors.pm10;
  if (Number.isFinite(pos.lat))             payload.lat         = pos.lat;
  if (Number.isFinite(pos.lng))             payload.lng         = pos.lng;
  if (Number.isFinite(pos.accuracy))        payload.accuracy    = pos.accuracy;

  // Si por algún motivo quedó vacío, no falles el tick: deja evidencia mínima
  if (Object.keys(payload).length === 0) {
    logger.warn('[Agent] Payload vacío, no hay métricas válidas en este tick');
    return { ok: false, empty: true };
  }

  // 4) Resolver API KEY (enroll si falta)
  let apiKey = cfg.apiKeyEnv || (await loadApiKey());
  if(!apiKey && cfg.enrollToken){
    try {
      logger.info('[Agent] Sin API_KEY, intentando enrolar…');
      apiKey = await enroll();
    } catch (e) {
      logger.warn('[Agent] Enroll falló, guardo en cola offline', { message: e?.message });
      await enqueue(payload);
      return { ok:false, queued:true, reason:'enroll_failed' };
    }
  }
  if(!apiKey){
    logger.warn('[Agent] API_KEY no disponible. Cola offline.');
    await enqueue(payload);
    return { ok:false, queued:true, reason:'no_api_key' };
  }

  // 5) Enviar + vaciar cola
  try{
    await sendPayload(payload, apiKey);
    logger.info('[Agent] Reading sent OK', { payload });
    const { flushed, remaining } = await flushQueue((p)=>sendPayload(p, apiKey));
    if(flushed) logger.info('[Agent] Cola offline vaciada', { flushed, remaining });
    return { ok:true };
  }catch(e){
    logger.warn('[Agent] Error enviando, guardo en cola offline', { message:e?.message });
    await enqueue(payload);
    return { ok:false, queued:true, reason:'send_failed' };
  }
}
