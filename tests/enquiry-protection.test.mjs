import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/enquire.js';
import {createSecurityEnv, secureRequest, withTurnstile} from './helpers/enquiry-env.mjs';
const base = {name:'Test User', email:'test@example.com', company:'Example Engineering', interest:'Applied AI Training', message:'Training for our operations team.',requestId:'3f7c44cb-9cb1-4200-a5d5-56e85df12b12'};
const fields = (number = 0, extra = {}) => ({...base,requestId:`3f7c44cb-9cb1-4200-a5d5-${String(number).padStart(12,'0')}`,...extra});
const submit = (env, data = base, options = {}) => onRequestPost({env,request:secureRequest(data,options.headers,options)});
const freeze = (t, initial = 1800000000000) => {const original=Date.now;let time=initial;Date.now=()=>time;t.after(()=>Date.now=original);return seconds=>time=initial+seconds*1000;};
function mockFetch(t, provider, verification) {const original=globalThis.fetch;globalThis.fetch=withTurnstile(provider,verification);t.after(()=>globalThis.fetch=original);}

test('rolling IP limit atomically admits ten attempts across both forms, includes invalid requests, and expires precisely', async t => {
  const advance=freeze(t);const env=createSecurityEnv(t);let calls=0;
  mockFetch(t,async()=>{calls++;throw new Error('Unexpected provider call');});
  const results=await Promise.all(Array.from({length:15},(_,i)=>submit(env,fields(i,{...(i%2?{kind:'callback'}:{}),email:'invalid'}))));
  assert.equal(results.filter(r=>r.status===400).length,10);
  assert.equal(results.filter(r=>r.status===429).length,5);
  const limited=results.find(r=>r.status===429);assert.equal(limited.headers.get('Retry-After'),'600');
  assert.deepEqual(Object.keys(await limited.json()).sort(),['code','error','ok','retryAfter']);
  assert.equal(env.SMS_ALERTS.sqlite.prepare('SELECT COUNT(*) AS n FROM enquiry_ip_attempts').get().n,10);
  advance(590);const almost=await submit(env,fields(99,{email:'invalid'}));assert.equal(almost.status,429);assert.equal(almost.headers.get('Retry-After'),'10');
  advance(600);assert.equal((await submit(env,fields(100,{email:'invalid'}))).status,400);
  assert.equal(calls,0);
});

test('email quota is shared across IPs and form types, case-insensitive, and only counts new verified submissions', async t => {
  const advance=freeze(t);const points=[];const env=createSecurityEnv(t,{ANALYTICS:{writeDataPoint:p=>points.push(p)}});let mails=0,verifications=0;
  mockFetch(t,async()=>Response.json({id:`receipt-${++mails}`}),payload=>{verifications++;return Response.json({success:true,hostname:'vyratec.com',action:payload.response==='test-token-callback'?'callback':'training'});});
  const second=fields(2,{kind:'callback',phone:'02 5550 1234',preferredTime:'Tuesday morning',email:'TEST@example.com'});
  for(const [i,data] of [fields(1),second,fields(3)].entries()) assert.equal((await submit(env,data,{headers:{'CF-Connecting-IP':`192.0.2.${i+1}`}})).status,200);
  const rejected=await submit(env,fields(4));assert.equal(rejected.status,429);assert.equal(rejected.headers.get('Retry-After'),'3600');
  assert.equal((await rejected.json()).code,'rate_limited');assert.equal(mails,3);assert.equal(verifications,4);assert.equal(points.length,3);
  const retry=await submit(env,second,{token:null});assert.equal(retry.status,200);assert.equal(mails,3);assert.equal(verifications,4);assert.equal(points.length,3);
  advance(3599);assert.equal((await submit(env,fields(5))).status,429);
  advance(3600);assert.equal((await submit(env,fields(6))).status,200);assert.equal(mails,4);
});

test('Turnstile must be valid for both the exact request hostname and the selected form action', async t => {
  const scenarios=[
    {token:null,status:400},
    {validation:{success:false,'error-codes':['timeout-or-duplicate']},status:400},
    {validation:{success:true,hostname:'attacker.example',action:'training'},status:400},
    {validation:{success:true,hostname:'www.vyratec.com',action:'training'},status:400},
    {validation:{success:true,hostname:'vyratec.com',action:'callback'},status:400},
    {validation:{success:false,'error-codes':['invalid-input-secret']},status:503},
    {validation:{success:false,'error-codes':['internal-error']},status:503}
  ];
  let mails=0;const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
  for(const scenario of scenarios){
    const env=createSecurityEnv(t);
    globalThis.fetch=withTurnstile(async()=>{mails++;return Response.json({id:'unexpected'});},async(payload)=>{
      assert.equal(payload.secret,env.TURNSTILE_SECRET_KEY);assert.equal(payload.remoteip,'192.0.2.1');assert.equal(payload.idempotency_key,undefined);
      return Response.json(scenario.validation);
    });
    const response=await submit(env,base,{token:scenario.token});assert.equal(response.status,scenario.status);
    assert.equal((await response.json()).code,scenario.status===400?'verification_required':'security_unavailable');
    assert.equal(env.SMS_ALERTS.sqlite.prepare('SELECT COUNT(*) AS n FROM enquiry_receipts').get().n,0);
  }
  assert.equal(mails,0);
});

test('missing settings, missing trusted client IP, database errors and verification outage fail closed without delivery',async t=>{
  let mails=0;mockFetch(t,async()=>{mails++;return Response.json({id:'unexpected'});},async()=>{throw new Error('Verification unavailable');});
  const good=createSecurityEnv(t);
  for(const patch of [{ENQUIRY_HASH_KEY:''},{TURNSTILE_SECRET_KEY:''},{TURNSTILE_HOSTNAMES:''},{SMS_ALERTS:null},{SMS_ALERTS:{prepare(){throw new Error('DB unavailable');}}}]){
    const response=await submit({...good,...patch});assert.equal(response.status,503);assert.equal((await response.json()).code,'security_unavailable');
  }
  assert.equal((await submit(good,base,{headers:{'CF-Connecting-IP':''}})).status,503);
  assert.equal((await submit(good)).status,503);assert.equal(mails,0);
});

test('accepted exact retries recover confirmation without another token, notification, quota claim or conversion',async t=>{
  const points=[];const env=createSecurityEnv(t,{ANALYTICS:{writeDataPoint:p=>points.push(p)}});let mails=0,checks=0;
  mockFetch(t,async()=>{mails++;return Response.json({id:'accepted-receipt'});},async()=>{checks++;return Response.json({success:true,hostname:'vyratec.com',action:'training'});});
  const first=await submit(env);assert.equal(first.status,200);const payload=await first.json();
  const retry=await submit(env,base,{token:null});assert.equal(retry.status,200);assert.deepEqual(await retry.json(),payload);
  assert.equal(mails,1);assert.equal(checks,1);assert.equal(points.length,1);
  assert.equal(env.SMS_ALERTS.sqlite.prepare('SELECT COUNT(*) AS n FROM enquiry_receipts').get().n,1);
  const changed=await submit(env,{...base,message:'Changed requirement'},{token:null});assert.equal(changed.status,400);assert.equal((await changed.json()).code,'verification_required');assert.equal(mails,1);
});

test('concurrent identical submissions acquire one delivery lease and return a recoverable pending response',async t=>{
  const env=createSecurityEnv(t);const points=[];env.ANALYTICS={writeDataPoint:p=>points.push(p)};let finish,started;let mails=0;
  const waiting=new Promise(resolve=>started=resolve);
  mockFetch(t,async()=>{mails++;started();return new Promise(resolve=>finish=resolve);});
  const first=submit(env);await waiting;
  const results=await Promise.all(Array.from({length:6},()=>submit(env,base,{token:null})));
  for(const response of results){assert.equal(response.status,409);assert.equal(response.headers.get('Retry-After'),'3');assert.equal((await response.json()).code,'submission_pending');}
  finish(Response.json({id:'one-receipt'}));assert.equal((await first).status,200);
  assert.equal((await submit(env,base,{token:null})).status,200);assert.equal(mails,1);assert.equal(points.length,1);
});

test('uncertain provider result retries the same provider key within its safe window and blocks late retries',async t=>{
  const advance=freeze(t);const env=createSecurityEnv(t);const keys=[];let succeed=false;
  mockFetch(t,async(url,options)=>{keys.push(options.headers['Idempotency-Key']);if(!succeed)throw new DOMException('Timeout','TimeoutError');return Response.json({id:'recovered-receipt'});});
  assert.equal((await submit(env)).status,502);assert.equal(env.SMS_ALERTS.sqlite.prepare('SELECT status FROM enquiry_receipts').get().status,'unknown');
  succeed=true;advance(60);assert.equal((await submit(env,base,{token:null})).status,200);assert.equal(keys[0],keys[1]);
  const other=fields(9);succeed=false;assert.equal((await submit(env,other)).status,502);
  const calls=keys.length;advance(60+23*3600);const late=await submit(env,other,{token:null});assert.equal(late.status,409);assert.equal((await late.json()).code,'retry_expired');assert.equal(keys.length,calls);
});

test('a stale lease owner cannot overwrite acceptance or emit a second conversion',async t=>{
  const advance=freeze(t);const points=[];const env=createSecurityEnv(t,{ANALYTICS:{writeDataPoint:p=>points.push(p)}});let resolveOld,started;const keys=[];
  const waiting=new Promise(resolve=>started=resolve);
  mockFetch(t,async(url,options)=>{keys.push(options.headers['Idempotency-Key']);if(keys.length===1){started();return new Promise(resolve=>resolveOld=resolve);}return Response.json({id:'same-provider-receipt'});});
  const stale=submit(env);await waiting;advance(46);
  assert.equal((await submit(env,base,{token:null})).status,200);resolveOld(Response.json({id:'same-provider-receipt'}));assert.equal((await stale).status,200);
  assert.equal(keys[0],keys[1]);assert.equal(points.length,1);assert.equal(env.SMS_ALERTS.sqlite.prepare('SELECT status FROM enquiry_receipts').get().status,'accepted');
});

test('protection persistence contains keyed identifiers and minimal receipts, never visitor fields or raw secrets',async t=>{
  const env=createSecurityEnv(t);mockFetch(t,async()=>Response.json({id:'privacy-receipt'}));
  assert.equal((await submit(env)).status,200);
  const db=env.SMS_ALERTS.sqlite;
  const attempts=db.prepare('SELECT * FROM enquiry_ip_attempts').all();const receipts=db.prepare('SELECT * FROM enquiry_receipts').all();
  assert.match(attempts[0].ip_key,/^[a-f0-9]{64}$/);assert.match(receipts[0].email_key,/^[a-f0-9]{64}$/);assert.match(receipts[0].request_key,/^[a-f0-9]{64}$/);
  const stored=JSON.stringify({attempts,receipts,calls:env.SMS_ALERTS.calls});
  for(const value of [base.name,base.email,base.company,base.message,base.requestId,'192.0.2.1',env.ENQUIRY_HASH_KEY,env.TURNSTILE_SECRET_KEY])assert.ok(!stored.includes(value));
  assert.equal(receipts[0].lease_owner,null);
});

test('a form without JavaScript verification gets an accessible direct-contact fallback, never a false success',async t=>{
  const env=createSecurityEnv(t);let mails=0;mockFetch(t,async()=>{mails++;return Response.json({id:'unexpected'});});
  const response=await submit(env,base,{token:null,headers:{Accept:'text/html'}});const html=await response.text();
  assert.equal(response.status,400);assert.match(html,/JavaScript is unavailable/);assert.match(html,/mailto:shop@vyratec.com/);assert.match(html,/Contact us|contact us/);assert.doesNotMatch(html,/Your enquiry has been sent/);assert.equal(mails,0);
});
