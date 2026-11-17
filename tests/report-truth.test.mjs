import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from '../api/_lib/orders/store.js';
import {runStuckWatch} from '../api/_lib/orders/service.js';
function db(result) { return {from(){return {select(){return {order(){return {range(){return Promise.resolve(result)}}}}}}}} }
const good={data:[],error:null,count:0};
test('truncated or failed query is not a zero result', async()=>{
 for (const bad of [{data:[],error:null,count:1},{data:null,error:{message:'down'},count:null},{data:[],error:null,count:null}]) await assert.rejects(()=>createSupabaseStore(db(bad)).listStuck({paidBefore:'2026-01-01'}));
 assert.deepEqual(await createSupabaseStore(db(good)).listStuck({paidBefore:'2026-01-01'}),[]);
 for (const row of [{id:'x',status:'mystery'},{id:'x',status:'paid',paid_at:null}]) await assert.rejects(()=>createSupabaseStore(db({data:[row],count:1,error:null})).listStuck({paidBefore:'2026-01-01'}));
});
test('unknown status cannot yield a successful clean report',async()=>{
 let writes=0; const store={listStuck:async()=>[{id:'synthetic',status:'mystery'}],hasEvent:async()=>false,addEvent:async()=>{writes++}};
 await assert.rejects(()=>runStuckWatch({store,env:{},now:()=>new Date('2026-11-17T00:00:00Z')}));
 assert.equal(writes,0);
});

test('two watchers claim once; HTTP success has no recipient receipt',async()=>{
 const {createMemoryStore}=await import('../api/_lib/orders/store.js');const store=createMemoryStore();
 await store.insertOrder({user_id:'synthetic',idempotency_key:'k',status:'failed_needs_attention'});
 let calls=0;const deps={store,env:{PRINT_ALERT_WEBHOOK_URL:'https://example.invalid'},fetchImpl:async()=>{calls++;return {ok:true,status:200}},now:()=>new Date('2026-11-17T00:00:00Z')};
 const result=await Promise.all([runStuckWatch(deps),runStuckWatch(deps)]);
 assert.equal(calls,1);assert.ok(result.some(x=>x.webhookAttempt==='accepted' && x.recipientDelivery==='unknown'));
 assert.equal(store._events.filter(x=>x.type==='watch_claim:failed_needs_attention').length,1);
});
test('claim survives crash before send and forbids automatic retry',async()=>{
 const {createMemoryStore}=await import('../api/_lib/orders/store.js');const store=createMemoryStore();
 const {order}=await store.insertOrder({user_id:'synthetic',idempotency_key:'k',status:'failed_needs_attention'});
 await store.tryWatchClaim(order.id,order.status);let calls=0;
 const out=await runStuckWatch({store,env:{PRINT_ALERT_WEBHOOK_URL:'https://example.invalid'},fetchImpl:async()=>{calls++},now:()=>new Date('2026-11-17T00:00:00Z')});
 assert.equal(calls,0);assert.equal(out.previousClaimsUnknown,1);assert.equal(out.recipientDelivery,'unknown');
});

test('paid cutoff compares instants across timezone offsets',async()=>{
 const rows=[{id:'synthetic',status:'paid',paid_at:'2026-11-17T02:00:00+02:00'}];
 const found=await createSupabaseStore(db({data:rows,error:null,count:1})).listStuck({paidBefore:'2026-11-17T00:30:00.000Z'});
 assert.equal(found.length,1);
});

test('existing admin alert list includes uncertain watcher claims',async()=>{
 const {createMemoryStore}=await import('../api/_lib/orders/store.js');const store=createMemoryStore();
 const {order}=await store.insertOrder({user_id:'synthetic',idempotency_key:'k',status:'failed_needs_attention'});
 await store.tryWatchClaim(order.id,order.status); const alerts=await store.listAlerts();
 assert.equal(alerts.length,1);assert.equal(alerts[0].type,'watch_claim:failed_needs_attention');
});

test('paid cutoff invalid is unknown and partial claims are dispatched',async()=>{
 await assert.rejects(()=>createSupabaseStore(db(good)).listStuck({paidBefore:'invalid'}));
 let count=0, calls=0;
 const store={listStuck:async()=>[{id:'a',status:'failed_needs_attention'},{id:'b',status:'failed_needs_attention'}],hasEvent:async()=>{if(++count>2) throw Error('offline'); return false},tryWatchClaim:async()=>true};
 const result=await runStuckWatch({store,env:{PRINT_ALERT_WEBHOOK_URL:'https://example.invalid'},fetchImpl:async()=>{calls++;return {ok:true}},now:()=>new Date('2026-11-17T00:00:00Z')});
 assert.equal(calls,1); assert.equal(result.newClaims,1); assert.equal(result.claimCollection,'partial'); assert.equal(result.webhookAttempt,'accepted');
});
test('source beyond cap is unavailable',async()=>{
 const rows=Array.from({length:500},(_,i)=>({id:String(i),status:'cancelled',paid_at:null}));
 await assert.rejects(()=>createSupabaseStore(db({data:rows,count:501,error:null})).listStuck({paidBefore:'2026-01-01'}));
});
test('first claim failure is not nothing-to-send',async()=>{
 const store={listStuck:async()=>[{id:'a',status:'failed_needs_attention'}],hasEvent:async()=>{throw Error('offline')}};
 const out=await runStuckWatch({store,env:{PRINT_ALERT_WEBHOOK_URL:'https://example.invalid'},now:()=>new Date('2026-11-17T00:00:00Z')});
 assert.equal(out.claimCollection,'partial'); assert.equal(out.webhookAttempt,'not_attempted');
});
