const sessionCookies = [
  ['__Host-tp_session', 'SameSite=Lax'],
  ['__Host-tp_embed_session', 'SameSite=None; Partitioned']
];
const sessionSeconds = 14 * 86400;
const randomPattern = /^[A-Za-z0-9_-]{43}$/;
const passwordIterations = 100000;
const utf8 = new TextEncoder();

function randomAccessToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function accessTokens(request) {
  const cookies = (request.headers.get('cookie') || '').split(';').map((piece) => piece.trim());
  const tokens = sessionCookies.map(([name]) => cookies.find((piece) => piece.startsWith(name + '='))?.slice(name.length + 1));
  return [...new Set(tokens.filter((token) => token && randomPattern.test(token)))];
}

function setSession(response, value, duration = sessionSeconds) {
  for (const [name, flags] of sessionCookies) {
    response.headers.append('Set-Cookie', name + '=' + value +
      '; Path=/; Max-Age=' + duration + '; Secure; HttpOnly; ' + flags);
  }
  return response;
}

function hexDigest(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function accessDigest(value) {
  return hexDigest(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
}

async function passwordDigest(password, salt, env) {
  if (typeof env.TP_AUTH_PEPPER !== 'string' || env.TP_AUTH_PEPPER.length < 32) {
    throw new InputError('Acesso por senha temporariamente indisponível.', 503);
  }
  const pepper = await crypto.subtle.importKey('raw', utf8.encode(env.TP_AUTH_PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const keyedPassword = await crypto.subtle.sign('HMAC', pepper, utf8.encode(password));
  const material = await crypto.subtle.importKey('raw', keyedPassword, 'PBKDF2', false, ['deriveBits']);
  return hexDigest(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: passwordIterations,
    salt: utf8.encode(salt) }, material, 256));
}

function secureEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function userName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 70 || /[\p{Cc}\p{Cf}]/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    throw new InputError('Informe um nome de 2 a 70 caracteres.');
  }
  return { name, key: name.normalize('NFKC').toLocaleLowerCase('pt-BR') };
}

function staffPassword(value, newPassword) {
  const min = newPassword ? 10 : 1;
  if (typeof value !== 'string' || value.length < min || value.length > 128) {
    throw new InputError(newPassword ? 'Use uma senha de 10 a 128 caracteres.' : 'Confira o nome e a senha.');
  }
  return value;
}

async function accessIdentity(request, env) {
  for (const token of accessTokens(request)) {
    const hash = await accessDigest(token);
    const staff = await env.DB.prepare(`SELECT a.name FROM staff_sessions s JOIN staff_accounts a ON a.id=s.staff_id
      WHERE s.token_hash=? AND s.expires_at>? AND a.disabled_at IS NULL`).bind(hash, new Date().toISOString()).first();
    if (staff) return staff;
  }
  return null;
}

async function accessPayload(request, origin) {
  if (request.headers.get('origin') !== origin) throw new InputError('Origem inválida.', 403);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
    throw new InputError('Formato de dados inválido.', 415);
  }
  if (Number(request.headers.get('content-length')) > 4096) throw new InputError('Dados muito longos.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Dados inválidos.');
  const decoder = new TextDecoder();
  let raw = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4096) throw new InputError('Dados muito longos.', 413);
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
  let data;
  try { data = JSON.parse(raw); } catch { throw new InputError('Dados inválidos.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError('Dados inválidos.');
  return data;
}

async function capAttempts(db, request, nameKey, timestamp, action) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const window = Math.floor(timestamp / (15 * 60000));
  for (const [label, limit] of [['ip:' + ip, 35], ['name:' + nameKey, 10]]) {
    const key = await accessDigest(action + ':' + label);
    const attempts = await db.prepare(`INSERT INTO staff_login_attempts (key, window, count) VALUES (?,?,1)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,
      window=excluded.window RETURNING count`).bind(key, window).first();
    if (attempts.count > limit) throw new InputError('Muitas tentativas. Aguarde até 15 minutos e tente novamente.', 429);
  }
  if (timestamp % 31 === 0) await db.prepare('DELETE FROM staff_login_attempts WHERE window<?').bind(window - 2).run();
}

function dueDate(timestamp, seconds) {
  return new Date(timestamp + seconds * 1000).toISOString();
}

async function staffLogin(request, data, env, now) {
  const { key } = userName(data.name);
  const password = staffPassword(data.password, false);
  const db = env.DB;
  await capAttempts(db, request, key, now, 'login');
  const account = await db.prepare('SELECT id, name, salt, password_hash, disabled_at FROM staff_accounts WHERE name_key=?').bind(key).first();
  const computed = await passwordDigest(password, account?.salt || 'tech-place-default-comparison', env);
  const valid = secureEqual(computed, account?.password_hash || '0'.repeat(64));
  if (!valid || !account || account.disabled_at) throw new InputError('Nome ou senha inválidos.', 401);
  const session = randomAccessToken();
  const sessionHash = await accessDigest(session);
  const [inserted] = await db.batch([
    db.prepare(`INSERT INTO staff_sessions (token_hash, staff_id, expires_at)
      SELECT ?,id,? FROM staff_accounts WHERE id=? AND disabled_at IS NULL AND password_hash=?`)
      .bind(sessionHash, dueDate(now, sessionSeconds), account.id, account.password_hash),
    db.prepare('DELETE FROM staff_sessions WHERE expires_at<=?').bind(new Date(now).toISOString())
  ]);
  if (!inserted.meta.changes) throw new InputError('Nome ou senha inválidos.', 401);
  return setSession(json({ name: account.name }), session);
}

async function staffRegister(request, data, env, now) {
  const { name, key } = userName(data.name);
  const password = staffPassword(data.password, true);
  const db = env.DB;
  await capAttempts(db, request, key, now, 'register');
  const id = crypto.randomUUID();
  const salt = randomAccessToken();
  const passwordHash = await passwordDigest(password, salt, env);
  const session = randomAccessToken();
  const stamp = new Date(now).toISOString();
  const [account] = await db.batch([
    db.prepare(`INSERT INTO staff_accounts (id,name,name_key,salt,password_hash,created_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(name_key) DO NOTHING`).bind(id, name, key, salt, passwordHash, stamp),
    db.prepare(`INSERT INTO staff_sessions (token_hash,staff_id,expires_at)
      SELECT ?,id,? FROM staff_accounts WHERE id=?`).bind(await accessDigest(session), dueDate(now, sessionSeconds), id),
    db.prepare('DELETE FROM staff_sessions WHERE expires_at<=?').bind(stamp)
  ]);
  if (!account.meta.changes) throw new InputError('Este nome já está em uso. Escolha um nome diferente.', 409);
  return setSession(json({ name }, 201), session);
}

async function handleAccess(request, url, env) {
  if (request.method === 'GET') {
    const identity = await accessIdentity(request, env);
    return json({ name: identity?.name ?? null });
  }
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const data = await accessPayload(request, url.origin);
  if (data.action === 'login') return staffLogin(request, data, env, Date.now());
  if (data.action === 'register') return staffRegister(request, data, env, Date.now());
  if (data.action === 'logout') {
    const hashes = await Promise.all(accessTokens(request).map(accessDigest));
    if (hashes.length) {
      await env.DB.prepare('DELETE FROM staff_sessions WHERE token_hash IN (?,?)').bind(hashes[0], hashes[1] || hashes[0]).run();
    }
    return setSession(json({ ok: true }), '', 0);
  }
  throw new InputError('Operação inválida.');
}
