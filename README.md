# raspi-agent-real (auto-provision, Node 20)

Agente headless para Raspberry Pi que lee **SHTC3 (I2C)**, **PMS5003 (UART)** y **GPS SIM7000G**.
Auto-provisiona: login (JWT) → crea/busca device → enroll → guarda apiKey.

## Uso
```bash
npm i
cp .env.example .env
# Edita BACKEND_URL, AUTO_PROVISION, AGENT_EMAIL, AGENT_PASSWORD, ENROLL_TOKEN, puertos
npm run provision   # o simplemente npm start (hará autoProvision si está activo)
npm start
```
