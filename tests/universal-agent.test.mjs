import test from 'node:test';
import assert from 'node:assert/strict';
import { agentMonth, buildAgentSnapshot } from '../src/universal-agent.js';
const now=new Date('2026-11-23T22:00:00Z');
const shop={"products":[{"id":"p1","name":"Cabo","qty":1,"min_qty":2,"updated_at":"2026-11-23T18:00:00Z"}],"orders":[{"id":"o1","status":"done","title":"Reparo","created_at":"2026-11-23T15:00:00Z","updated_at":"2026-11-23T16:00:00Z"}],"cash":[{"id":"s1","sale_id":"s1","kind":"in","amount":9000,"created_at":"2026-11-23T16:00:00Z"},{"id":"c1","kind":"in","amount":1000,"created_at":"2026-11-23T18:00:00Z"},{"id":"c2","kind":"out","amount":2000}]};
const sales={"sales":[{"id":"s1","payment":"Pix","amount":9000,"created_at":"2026-11-23T16:00:00Z"},{"id":"s2","payment":"Cartão","amount":5000,"created_at":"2026-11-23T16:00:00Z","voided_at":"2026-11-23T17:00:00Z"}]};
test('soma vendas ativas e caixa sem duplicar entradas vinculadas',()=>{
 const s=buildAgentSnapshot(shop,sales,now);
 assert.equal(s.metrics.salesAmount,9000);
 assert.equal(s.metrics.salesCount,1);
 assert.equal(s.metrics.cashBalance,8000);
 assert.equal(s.metrics.openOrders,0);
 assert.equal(s.metrics.lowStock,1);
 assert.equal(s.events.filter(e=>e.type==='cash').length,1);
 assert.equal(s.events.filter(e=>e.type==='sale-void').length,1);
 assert.equal(new Set(s.events.map(e=>e.key)).size,s.events.length);
});
test('calendário brasileiro na virada UTC',()=>assert.deepEqual(agentMonth(new Date('2026-03-01T01:00:00Z')),{start:'2026-02-01',end:'2026-02-28'}));
test('resposta inválida não gera eventos fictícios',()=>assert.throws(()=>buildAgentSnapshot({},sales,now)));

test('valores numéricos retornados como texto pelo MySQL',()=>{
 const result=buildAgentSnapshot({...shop,cash:shop.cash.map(c=>({...c,amount:String(c.amount)}))},{sales:sales.sales.map(s=>({...s,amount:String(s.amount)}))},now);
 assert.equal(result.metrics.salesAmount,9000);
 assert.equal(result.metrics.cashBalance,8000);
});
test('valor incorreto gera erro em vez de saldo falso',()=>assert.throws(()=>buildAgentSnapshot(shop,{sales:[{...sales.sales[0],amount:'inválido'}]},now)));
