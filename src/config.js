import 'dotenv/config';
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

export const cfg = {
  backendUrl: (process.env.BACKEND_URL || '').replace(/\/+$/, ''),
  deviceId: Number(process.env.DEVICE_ID || 0),
  enrollToken: process.env.ENROLL_TOKEN || '',
  apiKeyEnv: process.env.API_KEY || '',
  cron: process.env.CRON_SCHEDULE || '*/30 * * * * *',

  // HW
  i2cBus: Number(process.env.I2C_BUS || 1),
  pms: {
    port: process.env.PMS_PORT || '/dev/serial0',
    baud: Number(process.env.PMS_BAUD || 9600)
  },
  sim7: {
    port: process.env.SIM7_PORT || '/dev/ttyUSB3',
    baud: Number(process.env.SIM7_BAUD || 115200),
    gnssPowerOn: String(process.env.SIM7_GNSS_POWER_ON || '1') === '1',
    gnssProfile: (process.env.SIM7_GNSS_PROFILE || 'CGNS').toUpperCase()
  },

  // Fallback GPS
  lat: Number(process.env.LAT || 0),
  lng: Number(process.env.LNG || 0),
  gpsAccuracy: Number(process.env.GPS_ACCURACY || 30),

  // Auto provision
  autoProvision: String(process.env.AUTO_PROVISION || 'false').toLowerCase() === 'true',
  agentEmail: process.env.AGENT_EMAIL || '',
  agentPassword: process.env.AGENT_PASSWORD || '',
  deviceName: process.env.DEVICE_NAME || '',
  deviceLocation: process.env.DEVICE_LOCATION || '',
  ownerId: process.env.OWNER_ID ? Number(process.env.OWNER_ID) : undefined
};

export function assertBaseConfig() {
  if (!cfg.backendUrl) throw new Error('BACKEND_URL es requerido');
}
