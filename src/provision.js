import os from 'os';
import { promises as fs } from 'fs';
import axios from 'axios';
import { cfg, assertBaseConfig } from './config.js';
import { logger } from './logger.js';
import { saveApiKey, loadApiKey, saveDeviceInfo, loadDeviceInfo, saveJwt, loadJwt } from './state.js';

function endpoints(){
  assertBaseConfig();
  return {
    loginUrl: `${cfg.backendUrl}/api/auth/login`,
    devicesUrl: `${cfg.backendUrl}/api/devices`,
    enrollUrl: `${cfg.backendUrl}/api/devices/enroll`
  };
}
async function getSerial(){
  try{ const txt=await fs.readFile('/proc/cpuinfo','utf8'); const m=txt.match(/Serial\s*:\s*(\w+)/i); if(m) return m[1]; }catch{}
  return os.hostname();
}
async function login(){
  const { loginUrl } = endpoints();
  const email = cfg.agentEmail, password = cfg.agentPassword;
  if(!email || !password) throw new Error('AGENT_EMAIL/AGENT_PASSWORD requeridos');
  const { data } = await axios.post(loginUrl, { email, password }, { timeout: 8000 });
  const token = data?.token; if(!token) throw new Error('Login no devolvió token');
  await saveJwt(token); return token;
}
async function authHeader(){ const t=(await loadJwt()) || (await login()); return { Authorization: `Bearer ${t}` }; }
async function findDeviceByName(name){
  const { devicesUrl } = endpoints(); const headers = await authHeader();
  const { data } = await axios.get(devicesUrl, { headers, timeout: 8000 });
  return (data||[]).find(d => String(d.name).toLowerCase() === String(name).toLowerCase());
}
async function createDeviceIfMissing({ name, location, ownerId, lat, lng }){
  const exists = await findDeviceByName(name); if(exists) return exists;
  const { devicesUrl } = endpoints(); const headers = await authHeader();
  const body = { name, location, ownerId, lat, lng };
  const { data } = await axios.post(devicesUrl, body, { headers, timeout: 8000 });
  return data;
}
async function enrollDevice(deviceId){
  const { enrollUrl } = endpoints(); const token = cfg.enrollToken;
  if(!token) throw new Error('ENROLL_TOKEN requerido');
  const { data } = await axios.post(enrollUrl, { deviceId }, { headers: { 'x-enroll-token': token }, timeout: 8000 });
  const apiKey = data?.apiKey; if(!apiKey) throw new Error('Enroll no devolvió apiKey');
  await saveApiKey(apiKey); return apiKey;
}

export async function autoProvision(){
  if(!cfg.autoProvision){ logger.info('[Provision] AUTO_PROVISION=false (omitido)'); return {}; }
  const token = (await loadJwt()) || (await login()); logger.info('[Provision] Login OK');

  const serial = await getSerial();
  const defaultName = `Raspi-${serial.slice(-8)}`;
  const name = cfg.deviceName || defaultName;

  const device = await createDeviceIfMissing({
    name,
    location: cfg.deviceLocation || undefined,
    ownerId: cfg.ownerId,
    lat: Number.isFinite(cfg.lat) ? cfg.lat : undefined,
    lng: Number.isFinite(cfg.lng) ? cfg.lng : undefined
  });
  const deviceId = Number(device?.id); if(!deviceId) throw new Error('No se obtuvo deviceId');
  await saveDeviceInfo({ deviceId, name }); logger.info('[Provision] Device OK', { deviceId, name });

  let apiKey = await loadApiKey();
  if(!apiKey){ apiKey = await enrollDevice(deviceId); logger.info('[Provision] Enroll OK (apiKey guardada)'); }

  return { deviceId, apiKey, name };
}
