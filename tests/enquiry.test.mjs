import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost, onRequestGet} from '../functions/api/enquire.js';
import {onRequestPost as track} from '../functions/api/events.js';
const valid = {name: 'Test User', email: 'test@example.com', company: 'Example Engineering', interest: 'Applied AI Training', message: 'Training for an operations team of 20.', requestId: '3f7c44cb-9cb1-4200-a5d5-56e85df12b12'};
const env = {RESEND_API_KEY: 'test-only-key', CONTACT_FROM: 'Vyratec <training@vyratec.com>', CONTACT_BCC: 'owner@example.com'};
function request(fields = valid, headers = {}) {
  const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  return new Request('https://vyratec.com/api/enquire', {method: 'POST', headers: {Accept: 'application/json', Origin: 'https://vyratec.com', ...headers}, body: form});
}
test('accepted email routes to business inbox, BCCs operator, sets reply-to and records success', async () => {
  const original = globalThis.fetch; const points = []; let payload, key;
  globalThis.fetch = async (url, options) => {assert.equal(url, 'https://api.resend.com/emails'); payload = JSON.parse(options.body); key = options.headers['Idempotency-Key']; return Response.json({id: 'test-delivery-1'});};
  try {
    const configured = {...env, ANALYTICS: {writeDataPoint: value => points.push(value)}};
    const response = await onRequestPost({request: request(), env: configured});
    assert.equal(response.status, 200); assert.equal((await response.json()).reference, 'VYR-3F7C44CB');
    assert.deepEqual(payload.to, ['shop@vyratec.com']); assert.deepEqual(payload.bcc, [env.CONTACT_BCC]);
    assert.equal(payload.reply_to, valid.email); assert.match(payload.text, /operations team of 20/);
    assert.match(key, /^vyratec\/3f7c44cb.*\/[a-f0-9]{64}$/);
    assert.equal(points[0].blobs[0], 'enquiry_success');
    const firstKey = key;
    await onRequestPost({request: request(), env: configured}); assert.equal(key, firstKey);
    await onRequestPost({request: request({...valid, message: 'A revised training requirement'}), env: configured}); assert.notEqual(key, firstKey);
    assert.ok(!JSON.stringify(points).includes(valid.email));
  } finally { globalThis.fetch = original; }
});
test('missing mail configuration returns 503 and never reports success', async () => {
  const response = await onRequestPost({request: request(), env: {}});
  assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
});
test('provider rejection and missing delivery ID never record a conversion', async () => {
  const original = globalThis.fetch; const points = [];
  try {
    for (const mock of [() => Response.json({error: 'rejected'}, {status: 429}), () => Response.json({}), () => {throw new Error('network');}]) {
      globalThis.fetch = async () => mock();
      const response = await onRequestPost({request: request(), env: {...env, ANALYTICS: {writeDataPoint: p => points.push(p)}}});
      assert.equal(response.status, 502); assert.equal((await response.json()).ok, false);
    }
    assert.equal(points.length, 0);
  } finally {globalThis.fetch = original;}
});
test('invalid fields, missing requirements, unknown interests and honeypot are rejected', async () => {
  for (const fields of [{...valid, email: 'invalid'}, {...valid, message: ''}, {...valid, company: 'x'.repeat(201)}, {...valid, interest: 'fake'}, {...valid, website: 'spam'}, {...valid, company: 'Injected\r\nHeader'}]) {
    assert.equal((await onRequestPost({request: request(fields), env})).status, 400);
  }
});
test('rejects cross-origin submissions, oversized streams and unsupported content', async () => {
  assert.equal((await onRequestPost({request: request(valid, {Origin: 'https://other.example'}), env})).status, 403);
  const large = new Request('https://vyratec.com/api/enquire', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'}, body: 'a'.repeat(20001)});
  assert.equal((await onRequestPost({request: large, env})).status, 413);
  const wrong = new Request('https://vyratec.com/api/enquire', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
  assert.equal((await onRequestPost({request: wrong, env})).status, 415);
  assert.equal(onRequestGet().status, 405);
});
test('no-JavaScript submission returns an accessible confirmation after acceptance', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({id: 'test-delivery'});
  try {
    const response = await onRequestPost({request: request(valid, {Accept: 'text/html'}), env});
    assert.match(response.headers.get('content-type'), /text\/html/); assert.match(await response.text(), /Your enquiry has been sent/);
  } finally {globalThis.fetch = original;}
});
test('analytics are restricted to fixed labels and respect privacy signals', async () => {
  const points = []; const configured = {ANALYTICS: {writeDataPoint: point => points.push(point)}};
  const eventRequest = (body, headers = {}) => new Request('https://vyratec.com/api/events', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
  assert.equal((await track({request: eventRequest({event: 'cta_click', location: 'hero'}), env: configured})).status, 204);
  assert.equal(points.length, 1);
  assert.equal((await track({request: eventRequest({event: 'enquiry_success', location: 'contact-form'}), env: configured})).status, 400);
  assert.equal((await track({request: eventRequest({event: 'cta_click', location: 'test@example.com'}), env: configured})).status, 400);
  await track({request: eventRequest({event: 'page_view', location: 'website'}, {DNT: '1'}), env: configured});
  await track({request: eventRequest({event: 'page_view', location: 'website'}, {'Sec-GPC': '1'}), env: configured});
  assert.equal(points.length, 1);
});
