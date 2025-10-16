import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const apiKeyFile = path.join(dataDir, 'apikey.json');
const queueFile = path.join(dataDir, 'queue.json');

async function ensureDir() { try { await fs.mkdir(dataDir, { recursive: true }); } catch {} }

export async function loadApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  await ensureDir();
  try { const raw = await fs.readFile(apiKeyFile, 'utf8'); return JSON.parse(raw).apiKey || ''; }
  catch { return ''; }
}

export async function saveApiKey(apiKey) {
  await ensureDir();
  await fs.writeFile(apiKeyFile, JSON.stringify({ apiKey }, null, 2), 'utf8');
}

export async function enqueue(payload) {
  await ensureDir();
  let arr = [];
  try { arr = JSON.parse(await fs.readFile(queueFile, 'utf8')); } catch {}
  arr.push({ ts: Date.now(), payload });
  await fs.writeFile(queueFile, JSON.stringify(arr, null, 2), 'utf8');
}

export async function flushQueue(senderFn) {
  await ensureDir();
  let arr = [];
  try { arr = JSON.parse(await fs.readFile(queueFile, 'utf8')); } catch {}
  if (!arr.length) return { flushed: 0, remaining: 0 };
  const remaining = [];
  let ok = 0;
  for (const item of arr) {
    try { await senderFn(item.payload); ok++; } catch { remaining.push(item); }
  }
  await fs.writeFile(queueFile, JSON.stringify(remaining, null, 2), 'utf8');
  return { flushed: ok, remaining: remaining.length };
}
