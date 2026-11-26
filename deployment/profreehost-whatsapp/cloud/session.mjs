import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';

export function canAcknowledge(previous, next) {
  const rank = { uncertain: 0, accepted: 1, sent: 2, delivered: 3, read: 4, failed: 4 };
  return previous && rank[next] > rank[previous] && !(previous === 'delivered' && next === 'failed');
}

export function sealer(key) {
  return {
    open(name, input) {
      const raw = Buffer.from(input);
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      decipher.setAAD(Buffer.from(name));
      decipher.setAuthTag(raw.subarray(12, 28));
      const plaintext = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
      return JSON.parse(plaintext.toString(), BufferJSON.reviver);
    },
    seal(name, value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(name));
      const body = Buffer.concat([cipher.update(JSON.stringify(value, BufferJSON.replacer)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]);
    },
  };
}

export function authState(db, scope, saved) {
  const path = id => `session:${scope}:${id}`;
  const creds = saved ?? initAuthCreds();
  return {
    creds,
    save: () => db.write(path('creds'), creds),
    keys: {
      async get(type, ids) {
        const values = await db.readMany(ids.map(id => path(`key:${type}:${id}`)));
        return Object.fromEntries(ids.map((id, index) => [
          id, type === 'app-state-sync-key' && values[index] ? proto.Message.AppStateSyncKeyData.fromObject(values[index]) : values[index],
        ]));
      },
      async set(data) {
        await db.writeMany(Object.entries(data).flatMap(([type, values]) =>
          Object.entries(values).map(([id, value]) => [path(`key:${type}:${id}`), value])));
      },
    },
  };
}

export function openStore(path, key) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS secure (name TEXT PRIMARY KEY, value BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, provider_id TEXT UNIQUE, connection TEXT NOT NULL, state TEXT NOT NULL);
  `);
  const crypto = sealer(key);
  const get = db.prepare('SELECT value FROM secure WHERE name=?');
  const put = db.prepare('INSERT INTO secure VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value');
  const remove = db.prepare('DELETE FROM secure WHERE name=?');
  function read(name) {
    const row=get.get(name);
    return row ? crypto.open(name,row.value) : undefined;
  }
  function write(name,value) {
    if (value == null) remove.run(name);
    else put.run(name,crypto.seal(name,value));
  }
  const adapter={
    readMany: names => names.map(read),
    write,
    writeMany(entries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const pair of entries) write(...pair);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const receipt = db.prepare('SELECT state,provider_id FROM receipts WHERE id=?');
  const receiptByProvider = db.prepare('SELECT state FROM receipts WHERE provider_id=? AND connection=?');
  return {
    close: () => db.close(),
    getLink: () => read('link'),
    setLink: value => write('link',value),
    clearLink: () => db.exec('DELETE FROM secure'),
    auth: scope => authState(adapter,scope,read(`session:${scope}:creds`)),
    receipt: id => receipt.get(id) ?? { state: 'uncertain' },
    reserve(id, provider, connection, state = 'uncertain') {
      return db.prepare('INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)').run(id, provider, connection, state).changes === 1;
    },
    acknowledge(provider, connection, state) {
      const row = receiptByProvider.get(provider, connection);
      if (canAcknowledge(row?.state,state)) {
        db.prepare('UPDATE receipts SET state=? WHERE provider_id=? AND connection=?').run(state,provider,connection);
      }
    },
  };
}
