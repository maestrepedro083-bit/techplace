import { createServer } from 'node:http';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import makeWASocket, { Browsers, DisconnectReason, generateMessageIDV2, jidDecode } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { openStore } from './session.mjs';
import { openPostgres } from './session-pg.mjs';
import { createWarrantyFile } from './warranty.mjs';
import { createIntakeFile } from './warranty-pdf.mjs';

const { TECHPLACE_TOKEN, TECHPLACE_SESSION_KEY, TECHPLACE_DATABASE_URL, TECHPLACE_DATA = '/data', PORT = '8080' } = process.env;
const hexKey = /^[a-f0-9]{64}$/;
if (!hexKey.test(TECHPLACE_TOKEN ?? '') || !hexKey.test(TECHPLACE_SESSION_KEY ?? '') || TECHPLACE_TOKEN === TECHPLACE_SESSION_KEY) {
  throw new Error('Configure duas chaves hexadecimais diferentes de 32 bytes.');
}
process.umask(0o077);
const key = Buffer.from(TECHPLACE_SESSION_KEY, 'hex');
async function storeForEnvironment() {
  if (TECHPLACE_DATABASE_URL) return openPostgres(TECHPLACE_DATABASE_URL,key);
  mkdirSync(TECHPLACE_DATA, { recursive: true, mode: 0o700 });
  chmodSync(TECHPLACE_DATA, 0o700);
  return openStore(join(TECHPLACE_DATA, 'session.sqlite'),key);
}

let store;
let link;
try {
  store = await storeForEnvironment();
  link = await store.getLink();
} catch {
  console.error('TechPlace: armazenamento indisponível. Confira a configuração.');
  process.exit(1);
}

const logger = pino({ level: 'silent' });
let socket;
let phase = 'disconnected';
let qr = null;
let code = null;
let retry;
let expiry;
let activeSend = false;
let changing = false;
const phone = /^55[1-9]\d{9,10}$/;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function state(includePairing = false) {
  const result = { status: phase, mode: link?.mode ?? null, number: phase === 'connected' ? link.number : null, connection: link?.id ?? null };
  if (includePairing && phase === 'pairing') Object.assign(result, { qr, code });
  return result;
}

function clearPairing() {
  qr = null;
  code = null;
  clearTimeout(expiry);
}

async function clearSession() {
  clearPairing();
  clearTimeout(retry);
  socket = undefined;
  link = undefined;
  await store.clearLink();
  phase = 'disconnected';
}

function storageFailure() {
  console.error('TechPlace: não foi possível gravar a sessão.');
  process.exit(1);
}

async function start() {
  const session = link;
  const auth = await store.auth(session.id);
  if (link !== session) return;
  phase = auth.creds.registered ? 'connecting' : 'pairing';
  const client = makeWASocket({
    auth, logger, browser: Browsers.macOS('Chrome'), syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false, emitOwnEvents: false,
    enableAutoSessionRecreation: false, enableRecentMessageCache: false, retryRequestDelayMs: 0, maxMsgRetryCount: 0,
    getMessage: async () => undefined, defaultQueryTimeoutMs: 8000,
  });
  let pairingRequested = false;
  socket = client;
  client.ev.on('creds.update', () => { if (client === socket) void Promise.resolve(auth.save()).catch(storageFailure); });
  async function updateConnection(update) {
    if (client !== socket) return;
    if (update.qr && !auth.creds.registered) {
      if (session.method === 'code') {
        if (pairingRequested) return;
        pairingRequested = true;
        try {
          const value = await client.requestPairingCode(session.phone);
          if (client === socket && phase === 'pairing') code = value;
        } catch {
          if (client === socket && phase === 'pairing' && !auth.creds.registered) {
            phase = 'pairing_error';
            socket = undefined;
            client.end(undefined);
          }
        }
      } else {
        const image = await QRCode.toDataURL(update.qr, { margin: 2, width: 260 }).catch(() => null);
        if (client === socket && phase === 'pairing') qr = image;
      }
    }
    if (client !== socket) return;
    if (update.connection === 'open') {
      const number = jidDecode(auth.creds.me?.id)?.user;
      clearPairing();
      if (!number || !/^\d{10,15}$/.test(number)) {
        phase = 'error';
        socket = undefined;
        client.end(undefined);
        return;
      }
      link = { id: session.id, mode: session.mode, number };
      await store.setLink(link);
      if (client !== socket) return;
      phase = 'connected';
    }
    if (update.connection === 'close') {
      socket = undefined;
      const reason = update.lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut && phase !== 'disconnecting') { await clearSession(); return; }
      if (!auth.creds.registered) { clearPairing(); phase = 'pairing_error'; return; }
      const transient = [DisconnectReason.restartRequired, DisconnectReason.connectionClosed,
        DisconnectReason.connectionLost, DisconnectReason.unavailableService].includes(reason);
      phase = transient ? 'connecting' : 'error';
      if (transient) retry = setTimeout(() => void start().catch(storageFailure), reason === DisconnectReason.restartRequired ? 500 : 10000);
    }
  }
  client.ev.on('connection.update', update => { void updateConnection(update).catch(storageFailure); });
  // Only provider acknowledgements for IDs created by the panel are recorded.
  client.ws.on('CB:ack,class:message', ({ attrs }) => {
    if (typeof attrs?.id === 'string') void Promise.resolve(store.acknowledge(attrs.id, session.id, attrs.error ? 'failed' : 'sent')).catch(storageFailure);
  });
  client.ev.on('messages.update', updates => {
    for (const { key, update } of updates) {
      if (!key.fromMe || !key.id) continue;
      const mapped = { 0: 'failed', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' }[update.status];
      if (mapped) void Promise.resolve(store.acknowledge(key.id, session.id, mapped)).catch(storageFailure);
    }
  });
}

async function connect(input) {
  if (link || activeSend) return state(true);
  if (!['store', 'test'].includes(input.mode) || !['qr', 'code'].includes(input.method)
      || input.method === 'code' && !phone.test(input.phone ?? '')) throw new Error('Invalid connection request');
  link = { id: randomUUID(), mode: input.mode, method: input.method, phone: input.phone };
  await store.setLink(link);
  await start();
  expiry = setTimeout(() => {
    if (phase !== 'pairing') return;
    const old = socket;
    old?.end(undefined);
    void clearSession().catch(storageFailure);
  }, 180000);
  return state(true);
}

async function disconnect() {
  if (activeSend) return { status: 'busy' };
  clearTimeout(retry);
  if (link && (await store.auth(link.id)).creds.registered) {
    if (phase !== 'connected' || !socket) return { status: 'unlink_first' };
    phase = 'disconnecting';
    try { await socket.logout(); }
    catch { phase = 'error'; return { status: 'unlink_first' }; }
  }
  const old = socket;
  old?.end(undefined);
  await clearSession();
  return state();
}

async function submit(input) {
  const { id, mode, connection, text, warranty, intake } = input;
  if (!uuid.test(id ?? '') || !phone.test(input.phone ?? '') || typeof text !== 'string' || !text.trim() || text.length > 4000) {
    throw new Error('Invalid message');
  }
  const client = socket;
  if (!uuid.test(connection ?? '')) throw new Error('Invalid connection');
  if (changing || phase !== 'connected' || !client || connection !== link?.id || mode !== link.mode) {
    await store.reserve(id, null, connection, 'failed');
    return store.receipt(id);
  }
  const provider = generateMessageIDV2(client.user?.id);
  activeSend = true;
  try {
    if (!await store.reserve(id, provider, connection)) return store.receipt(id);
    let content = { text };
    if (warranty || intake) {
      const file = intake ? createIntakeFile(intake.client,intake.order,intake.problem,intake.technician)
        : createWarrantyFile(warranty.client,warranty.order);
      const document = Buffer.from(await file.arrayBuffer());
      content = { document, mimetype: 'application/pdf', fileName: file.name, caption: text };
    }
    if (client !== socket || phase !== 'connected') {
      await store.acknowledge(provider, connection, 'failed');
      return store.receipt(id);
    }
    const msg = await client.sendMessage(input.phone + '@s.whatsapp.net', content, { messageId: provider });
    if (msg?.key?.id === provider) await store.acknowledge(provider, connection, 'accepted');
  } catch {
    // Delivery is unknown after the request begins. Never retry it automatically.
  } finally {
    activeSend = false;
  }
  return store.receipt(id);
}

async function handle(input) {
  switch (input.action) {
    case 'status': return state(input.pairing === true);
    case 'connect':
    case 'disconnect':
    case 'forget_unlinked': {
      if (changing || activeSend) return { status:'busy' };
      changing = true;
      try {
        if (input.action === 'connect') return await connect(input);
        if (input.action === 'disconnect') return await disconnect();
        if (phase === 'connected') return state();
        socket?.end(undefined);
        await clearSession();
        return state();
      } finally { changing = false; }
    }
    case 'receipt': {
      if (!uuid.test(input.id ?? '')) throw new Error('Invalid receipt request');
      return store.receipt(input.id);
    }
    case 'send': {
      if (activeSend && uuid.test(input.id ?? '') && uuid.test(input.connection ?? '')) {
        await store.reserve(input.id, null, input.connection, 'failed');
        return store.receipt(input.id);
      }
      return submit(input);
    }
    default: throw new Error('Invalid operation');
  }
}

const expected = Buffer.from('Bearer ' + TECHPLACE_TOKEN);
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','no-store');
  const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/techplace') return reply(404, {});
  const supplied = Buffer.from(req.headers.authorization ?? '');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return reply(401, {});
  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 24000) { req.destroy(); return; }
      chunks.push(chunk);
    }
    reply(200, await handle(JSON.parse(Buffer.concat(chunks).toString())));
  } catch { reply(400, { error: 'Requisição indisponível.' }); }
});
server.requestTimeout = 15000;
server.listen(Number(PORT), '0.0.0.0');
if (link && (await store.auth(link.id)).creds.registered) await start();
else if (link) await clearSession();
