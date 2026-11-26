import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { openStore } from './session.mjs';
import { createWarrantyFile } from './warranty.mjs';

test('session and Signal keys persist encrypted and can be revoked', async t => {
  const dir=mkdtempSync(join(tmpdir(),'techplace-session-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'session.sqlite');
  const key=randomBytes(32);
  let store=openStore(path,key);
  const link={id:'link-a',mode:'test',number:'5511999999999'};
  store.setLink(link);
  const auth=store.auth(link.id);
  auth.creds.registered=true;
  auth.save();
  await auth.keys.set({'test-key':{test:Buffer.from('private-signal-key')}});
  store.close();

  assert.equal(readFileSync(path).includes(Buffer.from(link.number)),false);
  assert.equal(readFileSync(path).includes(Buffer.from('private-signal-key')),false);
  store=openStore(path,key);
  assert.deepEqual(store.getLink(),link);
  assert.equal(store.auth(link.id).creds.registered,true);
  assert.deepEqual(await store.auth(link.id).keys.get('test-key',['test']),{test:Buffer.from('private-signal-key')});
  store.clearLink();
  assert.equal(store.getLink(),undefined);
  assert.equal(store.auth(link.id).creds.registered,false);
  store.close();
});

test('receipts are durable, idempotent and scoped to the WhatsApp link', t => {
  const dir=mkdtempSync(join(tmpdir(),'techplace-receipt-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'session.sqlite');
  const key=randomBytes(32);
  let store=openStore(path,key);
  assert.equal(store.reserve('id','provider','link-a'),true);
  assert.equal(store.reserve('id','different','link-a'),false);
  store.acknowledge('provider','link-b','sent');
  assert.equal(store.receipt('id').state,'uncertain');
  store.acknowledge('provider','link-a','sent');
  store.acknowledge('provider','link-a','accepted');
  assert.equal(store.receipt('id').state,'sent');
  store.acknowledge('provider','link-a','delivered');
  store.acknowledge('provider','link-a','failed');
  store.close();
  store=openStore(path,key);
  assert.deepEqual({...store.receipt('id')},{ state:'delivered',provider_id:'provider' });
  store.close();
});

test('builds the existing warranty PDF from the saved order and terms', async () => {
  const file=createWarrantyFile({name:'Cliente Exemplo',phone:'5531900000000'},{
    number:123,title:'Troca de tela',warranty_start:'2026-11-25',warranty_days:90,warranty_terms:'Condições registradas no atendimento',
  });
  assert.equal(file.type,'application/pdf');
  assert.equal(file.name,'TechPlace-Garantia-OS-123.pdf');
  const pdf=Buffer.from(await file.arrayBuffer());
  assert.match(pdf.subarray(0,8).toString(),/^%PDF-/);
  const fields=[...pdf.toString('latin1').matchAll(/<([a-f0-9]+)> Tj/g)].map(match=>Buffer.from(match[1],'hex').toString('latin1'));
  assert.ok(fields.includes('Troca de tela'));
  assert.ok(fields.includes('Cliente Exemplo'));
});
