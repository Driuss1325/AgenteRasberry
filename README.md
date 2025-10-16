# raspi-agent-real (Node 20)

Agente headless para Raspberry Pi que lee **SHTC3 (I2C)**, **PMS5003 (UART)** y **GPS SIM7000G (AT por UART)**, y envía lecturas al backend:
- POST /api/devices/enroll
- POST /api/readings

## Uso
```bash
npm i
cp .env.example .env
# editar BACKEND_URL, DEVICE_ID y puertos
npm run enroll   # opcional, si no tienes API_KEY
npm run once     # test de un envío
npm start        # corre con cron interno (CRON_SCHEDULE)
```

> Requiere Node.js 20.x.
