import pg from 'pg';
import { authState, canAcknowledge, sealer } from './session.mjs';

export async function openPostgres(connectionString,key) {
  const url=new URL(connectionString);
  if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('URL de armazenamento inválida.');
  for (const param of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat']) url.searchParams.delete(param);
  const client = new pg.Client({
    connectionString: url.toString(), connectionTimeoutMillis: 6000,
    ssl: { rejectUnauthorized: true, ...(process.env.TECHPLACE_DATABASE_CA ? {ca:process.env.TECHPLACE_DATABASE_CA} : {}) },
  });
  await client.connect();
  client.on('error', () => {
    console.error('TechPlace: conexão com o armazenamento interrompida.');
    process.exit(1);
  });
  try {
    const result=await client.query('SELECT pg_try_advisory_lock(344854960124) acquired');
    if (!result.rows[0].acquired) throw new Error('A sessão já está em uso por outra instância.');
    return await postgresStore(client,key);
  } catch (error) {
    await client.end();
    throw error;
  }
}

export async function postgresStore(client,key) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tp_wa_secure (name TEXT PRIMARY KEY, value BYTEA NOT NULL);
    CREATE TABLE IF NOT EXISTS tp_wa_receipts (id TEXT PRIMARY KEY, provider_id TEXT UNIQUE, connection TEXT NOT NULL, state TEXT NOT NULL);
  `);
  const crypto=sealer(key);
  async function readMany(names) {
    const {rows}=await client.query('SELECT name,value FROM tp_wa_secure WHERE name=ANY($1::text[])',[names]);
    const values = new Map(rows.map(row=>[row.name,crypto.open(row.name,row.value)]));
    return names.map(name=>values.get(name));
  }
  async function read(name) {
    return (await readMany([name]))[0];
  }
  async function writeMany(entries) {
    if (!entries.length) return;
    const names=entries.map(([name])=>name);
    const values=entries.map(([name,value])=>value == null ? null : crypto.seal(name,value));
    await client.query(`
      WITH incoming AS (SELECT * FROM unnest($1::text[],$2::bytea[]) AS data(name,value)),
      removed AS (DELETE FROM tp_wa_secure target USING incoming
        WHERE target.name=incoming.name AND incoming.value IS NULL)
      INSERT INTO tp_wa_secure(name,value)
        SELECT name,value FROM incoming WHERE value IS NOT NULL
        ON CONFLICT(name) DO UPDATE SET value=EXCLUDED.value
    `,[names,values]);
  }
  const adapter={readMany,writeMany,write:(name,value)=>writeMany([[name,value]])};
  return {
    close: () => client.end(),
    getLink: () => read('link'),
    setLink: value => adapter.write('link',value),
    clearLink: () => client.query('DELETE FROM tp_wa_secure'),
    auth: async scope => authState(adapter,scope,await read(`session:${scope}:creds`)),
    async receipt(id) {
      const {rows}=await client.query('SELECT state,provider_id FROM tp_wa_receipts WHERE id=$1',[id]);
      return rows[0] ?? {state:'uncertain'};
    },
    async reserve(id,provider,connection,state='uncertain') {
      const {rowCount}=await client.query('INSERT INTO tp_wa_receipts VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [id,provider,connection,state]);
      return rowCount===1;
    },
    async acknowledge(provider,connection,state) {
      const {rows}=await client.query('SELECT state FROM tp_wa_receipts WHERE provider_id=$1 AND connection=$2',[provider,connection]);
      const previous=rows[0]?.state;
      if (canAcknowledge(previous,state)) {
        const {rowCount}=await client.query('UPDATE tp_wa_receipts SET state=$1 WHERE provider_id=$2 AND connection=$3 AND state=$4',
          [state,provider,connection,previous]);
        if (!rowCount) await this.acknowledge(provider,connection,state);
      }
    },
  };
}
