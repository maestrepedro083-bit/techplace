import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

test('HTTP requires the server credential and refuses to send without a paired session', async t => {
  const reservation=createServer().listen(0,'127.0.0.1');
  await once(reservation,'listening');
  const {port}=reservation.address();
  reservation.close();
  await once(reservation,'close');

  const data=mkdtempSync(join(tmpdir(),'techplace-http-'));
  const token=randomBytes(32).toString('hex');
  const child=spawn(process.execPath,['server.mjs'],{ env:{
    ...process.env, PORT:String(port), TECHPLACE_DATA:data, TECHPLACE_TOKEN:token, TECHPLACE_SESSION_KEY:randomBytes(32).toString('hex'),
  }, stdio:'ignore' });
  t.after(async()=>{
    if (child.exitCode===null) { child.kill(); await once(child,'exit'); }
    rmSync(data,{recursive:true,force:true});
  });
  const base='http://127.0.0.1:'+port;
  const post=(payload,authorization='Bearer '+token)=>fetch(base+'/techplace',{
    method:'POST',body:JSON.stringify(payload),headers:{Authorization:authorization,'Content-Type':'application/json'},
  });
  let up=false;
  for (let poll=0;poll<80 && !up;poll++) {
    if (child.exitCode!==null) break;
    up=await fetch(base+'/health').then(r=>r.ok,()=>false);
    if (!up) await delay(50);
  }
  assert.equal(up,true);
  assert.equal((await post({action:'status'},'Bearer invalid')).status,401);
  assert.equal((await (await post({action:'status'})).json()).status,'disconnected');
  const id=randomUUID();
  const result=await (await post({action:'send',id,connection:randomUUID(),mode:'test',phone:'5531912345678',text:'Teste'})).json();
  assert.equal(result.state,'failed');
  assert.equal((await (await post({action:'receipt',id})).json()).state,'failed');
});
